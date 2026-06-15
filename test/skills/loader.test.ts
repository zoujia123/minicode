import { describe, expect, test } from "bun:test"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { SkillLoader } from "../../src/skills/loader"

describe("skill loader", () => {
  test("discovers and loads local skills", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-"))
    await mkdir(join(root, "demo", "references"), { recursive: true })
    await writeFile(join(root, "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo skill\n---\nbody", "utf8")
    await writeFile(join(root, "demo", "references", "usage.md"), "reference body", "utf8")
    const loader = new SkillLoader([root])

    const summary = (await loader.list())[0]!
    expect(summary.name).toBe("demo")
    expect(summary.source).toEqual({ root, rootIndex: 0, relativePath: "demo/SKILL.md" })

    const loaded = await loader.load("demo")
    expect(loaded.content).toContain("body")
    expect(loaded.files).toEqual([{ path: "references/usage.md", size: "reference body".length }])
    expect(await loader.readRelative("demo", "references/usage.md")).toBe("reference body")
  })

  test("falls back to heading and body when frontmatter is absent", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-heading-"))
    await mkdir(join(root, "heading"), { recursive: true })
    await writeFile(join(root, "heading", "SKILL.md"), "# heading-skill\n\nUse this skill for heading fallback.", "utf8")
    const loader = new SkillLoader([root])

    expect((await loader.list())[0]?.name).toBe("heading-skill")
    expect((await loader.list())[0]?.description).toBe("Use this skill for heading fallback.")
  })

  test("parses simple multiline frontmatter descriptions", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-frontmatter-"))
    await mkdir(join(root, "multi"), { recursive: true })
    await writeFile(join(root, "multi", "SKILL.md"), "---\nname: multi\ndescription: |\n  Line one.\n  Line two.\n---\nbody", "utf8")
    const loader = new SkillLoader([root])

    expect((await loader.list())[0]?.description).toBe("Line one.\nLine two.")
  })

  test("searches local skills by name, description, and path", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-search-"))
    await mkdir(join(root, "react"), { recursive: true })
    await mkdir(join(root, "python"), { recursive: true })
    await writeFile(join(root, "react", "SKILL.md"), "---\nname: react-ui\ndescription: Build React components\n---\nbody", "utf8")
    await writeFile(join(root, "python", "SKILL.md"), "---\nname: scripts\ndescription: Python automation\n---\nbody", "utf8")
    const loader = new SkillLoader([root])

    expect((await loader.search("react")).map((skill) => skill.name)).toEqual(["react-ui"])
    expect((await loader.search("automation")).map((skill) => skill.name)).toEqual(["scripts"])
    expect((await loader.search("python/SKILL")).map((skill) => skill.name)).toEqual(["scripts"])
  })

  test("uses cached discovery until refresh or invalidate", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-cache-"))
    await mkdir(join(root, "one"), { recursive: true })
    await writeFile(join(root, "one", "SKILL.md"), "---\nname: one\ndescription: First skill\n---\nbody", "utf8")
    const loader = new SkillLoader([root])

    expect((await loader.list()).map((skill) => skill.name)).toEqual(["one"])

    await mkdir(join(root, "two"), { recursive: true })
    await writeFile(join(root, "two", "SKILL.md"), "---\nname: two\ndescription: Second skill\n---\nbody", "utf8")
    expect((await loader.list()).map((skill) => skill.name)).toEqual(["one"])

    await loader.refresh()
    expect((await loader.list()).map((skill) => skill.name)).toEqual(["one", "two"])

    await mkdir(join(root, "three"), { recursive: true })
    await writeFile(join(root, "three", "SKILL.md"), "---\nname: three\ndescription: Third skill\n---\nbody", "utf8")
    loader.invalidate()
    expect((await loader.list()).map((skill) => skill.name)).toEqual(["one", "three", "two"])
  })

  test("filters noisy reference files", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-filter-"))
    const skillRoot = join(root, "demo")
    await mkdir(join(skillRoot, "references"), { recursive: true })
    await mkdir(join(skillRoot, "node_modules", "pkg"), { recursive: true })
    await mkdir(join(skillRoot, ".git"), { recursive: true })
    await mkdir(join(skillRoot, "dist"), { recursive: true })
    await writeFile(join(skillRoot, "SKILL.md"), "---\nname: demo\ndescription: Demo skill\n---\nbody", "utf8")
    await writeFile(join(skillRoot, "references", "guide.md"), "guide", "utf8")
    await writeFile(join(skillRoot, ".source.json"), "{}", "utf8")
    await writeFile(join(skillRoot, "node_modules", "pkg", "index.md"), "dependency docs", "utf8")
    await writeFile(join(skillRoot, ".git", "config"), "git config", "utf8")
    await writeFile(join(skillRoot, "dist", "bundle.js"), "bundle", "utf8")
    await writeFile(join(skillRoot, "image.png"), "not really png", "utf8")
    await writeFile(join(skillRoot, "large.md"), "x".repeat(260_000), "utf8")

    const files = (await new SkillLoader([root]).load("demo")).files.map((file) => file.path)
    expect(files).toEqual([".source.json", "references/guide.md"])
  })

  test("parses optional contract metadata and ranks search matches", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-contract-"))
    await mkdir(join(root, "react"), { recursive: true })
    await mkdir(join(root, "docs"), { recursive: true })
    await writeFile(
      join(root, "react", "SKILL.md"),
      [
        "---",
        "name: react-ui",
        "description: Build UI components",
        "triggers:",
        "  - components",
        "  - jsx",
        "when_to_use: Use for polished React interfaces.",
        "required_tools: read, edit",
        "risk: medium",
        "quality_checks:",
        "  - run typecheck",
        "---",
        "body",
      ].join("\n"),
      "utf8",
    )
    await writeFile(join(root, "docs", "SKILL.md"), "---\nname: docs\ndescription: Mention components in docs\n---\nbody", "utf8")
    const loader = new SkillLoader([root])

    const react = (await loader.list()).find((skill) => skill.name === "react-ui")
    expect(react?.contract).toMatchObject({
      triggers: ["components", "jsx"],
      when_to_use: "Use for polished React interfaces.",
      required_tools: ["read", "edit"],
      risk: "medium",
      quality_checks: ["run typecheck"],
    })
    expect((await loader.search("components")).map((skill) => skill.name)).toEqual(["react-ui", "docs"])
  })

  test("warns on malformed optional contract metadata without skipping skill", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-contract-bad-"))
    await mkdir(join(root, "demo"), { recursive: true })
    await writeFile(join(root, "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo skill\nrisk: extreme\n---\nbody", "utf8")
    const loader = new SkillLoader([root])

    expect((await loader.list()).map((skill) => skill.name)).toEqual(["demo"])
    expect((await loader.diagnostics())[0]?.code).toBe("SKILL_METADATA_INVALID")
  })

  test("keeps deterministic first source and reports duplicate skills", async () => {
    const first = await mkdtemp(join(tmpdir(), "pixiu-skills-first-"))
    const second = await mkdtemp(join(tmpdir(), "pixiu-skills-second-"))
    await mkdir(join(first, "demo"), { recursive: true })
    await mkdir(join(second, "demo"), { recursive: true })
    await writeFile(join(first, "demo", "SKILL.md"), "---\nname: demo\ndescription: First source\n---\nfirst", "utf8")
    await writeFile(join(second, "demo", "SKILL.md"), "---\nname: demo\ndescription: Second source\n---\nsecond", "utf8")
    const loader = new SkillLoader([first, second])

    const [skill] = await loader.list()
    expect(skill?.description).toBe("First source")
    expect(skill?.duplicates?.[0]?.source.root).toBe(second)
    const duplicate = (await loader.diagnostics()).find((item) => item.code === "SKILL_DUPLICATE")
    expect(duplicate?.message).toContain("Duplicate skill")
  })

  test("skips invalid skills and exposes diagnostics", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-invalid-"))
    await mkdir(join(root, "bad"), { recursive: true })
    await writeFile(join(root, "bad", "SKILL.md"), "---\nname: bad\n---\n", "utf8")
    const loader = new SkillLoader([root])

    expect(await loader.list()).toEqual([])
    const diagnostics = await loader.diagnostics()
    expect(diagnostics[0]?.code).toBe("SKILL_INVALID")
    expect(diagnostics[0]?.skillPath).toContain("SKILL.md")
  })

  test("rejects relative path escape", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-escape-"))
    await mkdir(join(root, "demo"), { recursive: true })
    await writeFile(join(root, "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo skill\n---\nbody", "utf8")
    const loader = new SkillLoader([root])

    await expect(loader.readRelative("demo", "../outside.txt")).rejects.toThrow("escapes root")
  })

  test("rejects empty and absolute reference paths", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-skills-paths-"))
    await mkdir(join(root, "demo"), { recursive: true })
    await writeFile(join(root, "demo", "SKILL.md"), "---\nname: demo\ndescription: Demo skill\n---\nbody", "utf8")
    const loader = new SkillLoader([root])

    await expect(loader.readRelative("demo", " ")).rejects.toThrow("relative file path")
    await expect(loader.readRelative("demo", "/tmp/outside.txt")).rejects.toThrow("relative file path")
  })
})
