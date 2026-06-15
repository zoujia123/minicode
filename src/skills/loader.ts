import { access, readFile, stat } from "node:fs/promises"
import { basename, dirname, extname, isAbsolute, relative, resolve } from "node:path"
import { homedir } from "node:os"

import { PixiuError } from "../shared/errors"
import { isInside } from "../sandbox/path"
import type { LoadedSkill, SkillContract, SkillDiagnostic, SkillDuplicate, SkillFile, SkillSource, SkillSummary } from "./types"

type DiscoveryResult = {
  skills: SkillSummary[]
  diagnostics: SkillDiagnostic[]
  timestamp: number
}

const CONTRACT_LIST_FIELDS = new Set(["triggers", "required_tools", "dependencies", "quality_checks"])
const CONTRACT_TEXT_FIELDS = new Set(["when_to_use", "when_not_to_use", "version", "inputs", "outputs"])
const CONTRACT_RISKS = new Set(["low", "medium", "high"])
const DEFAULT_SKILL_SEARCH_LIMIT = 10
const DEFAULT_REFERENCE_FILE_LIMIT = 50
const MAX_REFERENCE_FILE_BYTES = 256_000
const IGNORED_REFERENCE_DIRS = new Set([
  ".cache",
  ".git",
  ".next",
  ".turbo",
  "build",
  "coverage",
  "dist",
  "node_modules",
])
const IGNORED_REFERENCE_EXTENSIONS = new Set([
  ".7z",
  ".a",
  ".avi",
  ".bmp",
  ".class",
  ".db",
  ".dll",
  ".dylib",
  ".eot",
  ".exe",
  ".gif",
  ".gz",
  ".ico",
  ".jpeg",
  ".jpg",
  ".lockdb",
  ".mov",
  ".mp3",
  ".mp4",
  ".o",
  ".otf",
  ".pdf",
  ".png",
  ".so",
  ".sqlite",
  ".sqlite3",
  ".tar",
  ".tgz",
  ".ttf",
  ".wasm",
  ".webm",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
])

function expandHome(path: string) {
  return path.startsWith("~/") ? resolve(homedir(), path.slice(2)) : resolve(path)
}

function splitFrontmatter(content: string) {
  const match = content.match(/^---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/)
  if (!match) return { metadata: {}, body: content }
  return {
    metadata: parseFrontmatter(match[1] ?? ""),
    body: content.slice(match[0].length),
  }
}

function parseFrontmatter(input: string) {
  const metadata: Record<string, string> = {}
  const lines = input.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ""
    if (!line.trim() || line.trimStart().startsWith("#")) continue
    const match = line.match(/^([A-Za-z0-9_-]+):(?:\s*(.*))?$/)
    if (!match) continue
    const key = match[1]!.toLowerCase()
    const raw = (match[2] ?? "").trim()
    if (/^[>|]/.test(raw) || (!raw && isIndentedContinuation(lines[index + 1] ?? ""))) {
      const block: string[] = []
      while (index + 1 < lines.length) {
        const next = lines[index + 1] ?? ""
        if (/^[A-Za-z0-9_-]+:\s*/.test(next)) break
        index += 1
        block.push(next.replace(/^[ \t]{1,4}/, ""))
      }
      metadata[key] = raw.startsWith(">") ? block.map((item) => item.trim()).filter(Boolean).join(" ") : block.join("\n").trim()
    } else {
      metadata[key] = unquote(raw)
    }
  }
  return metadata
}

function isIndentedContinuation(line: string) {
  return /^[ \t]+/.test(line) || /^\s*-\s+/.test(line)
}

function unquote(value: string) {
  const trimmed = value.trim()
  if ((trimmed.startsWith("\"") && trimmed.endsWith("\"")) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function parseListValue(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim().replace(/^-\s*/, ""))
    .filter(Boolean)
}

function parseContract(metadata: Record<string, string>, skillPath: string) {
  const contract: SkillContract = {}
  const diagnostics: SkillDiagnostic[] = []
  for (const [key, value] of Object.entries(metadata)) {
    if (key === "name" || key === "description") continue
    if (CONTRACT_LIST_FIELDS.has(key)) {
      const items = parseListValue(value)
      if (items.length) {
        ;(contract as Record<string, unknown>)[key] = items
      }
      continue
    }
    if (CONTRACT_TEXT_FIELDS.has(key)) {
      if (value.trim()) {
        ;(contract as Record<string, unknown>)[key] = value.trim()
      }
      continue
    }
    if (key === "risk") {
      const risk = value.trim().toLowerCase()
      if (CONTRACT_RISKS.has(risk)) {
        contract.risk = risk as NonNullable<SkillContract["risk"]>
      } else {
        diagnostics.push({
          code: "SKILL_METADATA_INVALID",
          skillPath,
          message: `Skill ${skillPath} has invalid risk "${value}". Expected low, medium, or high.`,
        })
      }
    }
  }
  return { contract: Object.keys(contract).length ? contract : undefined, diagnostics }
}

// Parses the metadata from a skill file.
function parseMetadata(content: string, skillPath: string) {
  const { metadata, body } = splitFrontmatter(content)
  const heading = body.match(/^#\s+(.+)$/m)?.[1]?.trim()
  const description =
    metadata.description ??
    body
      .split(/\r?\n/)
      .find((line) => line.trim() && !line.startsWith("#"))
      ?.trim()
  const name = metadata.name ?? heading
  if (!name || !description) {
    throw new PixiuError(`Skill ${skillPath} must include name and description`, { code: "SKILL_INVALID" })
  }
  // Trim the name and description.
  const contract = parseContract(metadata, skillPath)
  return {
    name: name.trim(),
    description: description.trim(),
    ...(contract.contract ? { contract: contract.contract } : {}),
    diagnostics: contract.diagnostics,
  }
}

function skillSource(root: string, rootIndex: number, skillPath: string): SkillSource {
  return {
    root,
    rootIndex,
    relativePath: toRelativePath(root, skillPath),
  }
}

function toRelativePath(root: string, path: string) {
  return relative(root, path).replaceAll("\\", "/")
}

function duplicateOf(skill: SkillSummary): SkillDuplicate {
  return {
    rootDir: skill.rootDir,
    skillPath: skill.skillPath,
    source: skill.source,
  }
}

export class SkillLoader {
  private cachedDiscovery: DiscoveryResult | undefined

  constructor(private readonly paths: string[]) {}

  invalidate() {
    this.cachedDiscovery = undefined
  }

  async refresh() {
    this.cachedDiscovery = await this.discoverFresh()
    return this.cachedDiscovery
  }

  private async discover() {
    return this.cachedDiscovery ?? (this.cachedDiscovery = await this.discoverFresh())
  }

  private async discoverFresh(): Promise<DiscoveryResult> {
    const diagnostics: SkillDiagnostic[] = []
    const skills = new Map<string, SkillSummary>()
    const roots = this.paths.map(expandHome)
    for (const [rootIndex, root] of roots.entries()) {
      try {
        await access(root)
      } catch {
        continue
      }

      let matches: string[] = []
      try {
        // recursively scan for SKILL.md files under the root directory. Each SKILL.md represents a skill, and its parent directory is the skill root.
        for await (const skillPath of new Bun.Glob("**/SKILL.md").scan({ cwd: root, absolute: true, onlyFiles: true })) {
          matches.push(skillPath)
        }
      } catch (cause) {
        diagnostics.push({
          code: "SKILL_SCAN_FAILED",
          root,
          message: `Failed to scan skills under ${root}: ${cause instanceof Error ? cause.message : String(cause)}`,
        })
        continue
      }
      // sort the matches to ensure deterministic order of skill loading and duplicate 
      // detection. The sorting is based on the skillPath string comparison, which 
      // effectively sorts by directory depth and then alphabetically.
      for (const skillPath of matches.sort((a, b) => a.localeCompare(b))) {
        const source = skillSource(root, rootIndex, skillPath)
        let metadata: Pick<SkillSummary, "name" | "description" | "contract"> & { diagnostics: SkillDiagnostic[] }
        // name and description are required metadata.
        try {
          metadata = parseMetadata(await readFile(skillPath, "utf8"), skillPath)
        } catch (cause) {
          diagnostics.push({
            code: "SKILL_INVALID",
            root,
            skillPath,
            source,
            message: cause instanceof Error ? cause.message : String(cause),
          })
          continue
        }
        for (const diagnostic of metadata.diagnostics) {
          diagnostics.push({ ...diagnostic, root, source })
        }

        const { diagnostics: metadataDiagnostics, ...skillMetadata } = metadata
        void metadataDiagnostics
        const summary: SkillSummary = {
          // spread the parsed metadata
          // object spread
          ...skillMetadata,
          rootDir: dirname(skillPath),
          skillPath,
          source,
        }
        // deal with duplicate skill.
        const existing = skills.get(summary.name)
        if (existing) {
          existing.duplicates = [...(existing.duplicates ?? []), duplicateOf(summary)]
          diagnostics.push({
            code: "SKILL_DUPLICATE",
            root,
            skillPath,
            source,
            message: `Duplicate skill "${summary.name}" ignored at ${skillPath}; using ${existing.skillPath}`,
          })
          continue
        }
        skills.set(summary.name, summary)
      }
    }
    // skills.values() return iterator of skillsummary objects.
    // ... spread into array and sort by skill name.
    // [
    //   {
    //     name: "pdf",
    //     description: "Process PDF files",
    //     rootDir: "/skills/pdf",
    //     skillPath: "/skills/pdf/SKILL.md"
    //   },
    //   {
    //     name: "excel",
    //     description: "Process Excel files",
    //     rootDir: "/skills/excel",
    //     skillPath: "/skills/excel/SKILL.md"
    //   }
    // ]
    // [...] means spread the iterable into an array literal.
    return {
      skills: [...skills.values()].sort((a, b) => a.name.localeCompare(b.name)),
      diagnostics,
      timestamp: Date.now(),
    }
  }

  async list() {
    return (await this.discover()).skills
  }

  async diagnostics() {
    return (await this.discover()).diagnostics
  }

  async search(query: string, options: { limit?: number } = {}) {
    const skills = await this.list()
    const limit = Math.max(1, Math.min(100, options.limit ?? DEFAULT_SKILL_SEARCH_LIMIT))
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
    if (!terms.length) return skills.slice(0, limit)
    return skills
      .map((skill) => ({ skill, score: scoreSkill(skill, terms) }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score || a.skill.name.localeCompare(b.skill.name))
      .slice(0, limit)
      .map((item) => item.skill)
  }

  // Loads the skill instructions and reference files. The skill content is the full text content of the SKILL.md
  // file, and the reference files are all other files under the same skill root directory.
  async load(name: string): Promise<LoadedSkill> {
    const skill = await this.find(name)
    return { ...skill, content: await readFile(skill.skillPath, "utf8"), files: await this.filesFor(skill) }
  }

  async files(name: string) {
    return this.filesFor(await this.find(name))
  }
  
  // Reads a specific file under the skill root directory. This is used by the skill tool to safely 
  // load reference files listed in the skill instructions.
  async readRelative(skillName: string, relativePath: string) {
    const skill = await this.find(skillName)
    const normalized = relativePath.trim()
    if (!normalized || normalized.includes("\0") || isAbsolute(normalized)) {
      throw new PixiuError(`Skill path must be a relative file path: ${relativePath}`, { code: "SKILL_PATH_INVALID" })
    }
    const path = resolve(skill.rootDir, normalized)
    if (!isInside(skill.rootDir, path)) {
      throw new PixiuError(`Skill path escapes root: ${relativePath}`, { code: "SKILL_PATH_ESCAPE" })
    }
    return readFile(path, "utf8")
  }

  private async find(name: string) {
    const skills = await this.list()
    const skill = skills.find((item) => item.name === name)
    if (!skill) {
      throw new PixiuError(`Skill not found: ${name}. Available: ${skills.map((item) => item.name).join(", ")}`, {
        code: "SKILL_NOT_FOUND",
      })
    }
    return skill
  }

  private async filesFor(skill: SkillSummary, limit = DEFAULT_REFERENCE_FILE_LIMIT): Promise<SkillFile[]> {
    const files: SkillFile[] = []
    for await (const path of new Bun.Glob("**/*").scan({ cwd: skill.rootDir, absolute: true, onlyFiles: true, dot: true })) {
      if (path === skill.skillPath) continue
      const relativePath = toRelativePath(skill.rootDir, path)
      if (shouldIgnoreReferenceFile(relativePath)) continue
      const item = await stat(path)
      if (item.size > MAX_REFERENCE_FILE_BYTES) continue
      files.push({ path: relativePath, size: item.size })
    }
    return files.sort((a, b) => a.path.localeCompare(b.path)).slice(0, limit)
  }
}

function shouldIgnoreReferenceFile(path: string) {
  const parts = path.split("/")
  if (parts.some((part) => IGNORED_REFERENCE_DIRS.has(part))) return true
  const name = basename(path)
  if (name.startsWith(".") && name !== ".source.json") return true
  return IGNORED_REFERENCE_EXTENSIONS.has(extname(name).toLowerCase())
}

function scoreSkill(skill: SkillSummary, terms: string[]) {
  let score = 0
  for (const term of terms) {
    const next = scoreTerm(skill, term)
    if (next === 0) return 0
    score += next
  }
  return score
}

function scoreTerm(skill: SkillSummary, term: string) {
  let score = 0
  if (skill.name.toLowerCase().includes(term)) score += 100
  if (skill.contract?.triggers?.some((item) => item.toLowerCase().includes(term))) score += 80
  if (skill.contract?.when_to_use?.toLowerCase().includes(term)) score += 55
  if (skill.description.toLowerCase().includes(term)) score += 45
  if (skill.contract?.required_tools?.some((item) => item.toLowerCase().includes(term))) score += 25
  if (skill.source.relativePath.toLowerCase().includes(term)) score += 15
  if (skill.contract?.when_not_to_use?.toLowerCase().includes(term)) score -= 10
  return Math.max(0, score)
}
