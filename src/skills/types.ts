export type SkillSource = {
  root: string
  rootIndex: number
  relativePath: string
}

export type SkillFile = {
  path: string
  size: number
}

export type SkillContract = {
  triggers?: string[]
  when_to_use?: string
  when_not_to_use?: string
  required_tools?: string[]
  risk?: "low" | "medium" | "high"
  version?: string
  dependencies?: string[]
  inputs?: string
  outputs?: string
  quality_checks?: string[]
}

export type SkillDuplicate = {
  rootDir: string
  skillPath: string
  source: SkillSource
}

export type SkillDiagnostic = {
  code: "SKILL_INVALID" | "SKILL_METADATA_INVALID" | "SKILL_DUPLICATE" | "SKILL_SCAN_FAILED"
  message: string
  root?: string
  skillPath?: string
  source?: SkillSource
}

export type SkillSummary = {
  name: string
  description: string
  contract?: SkillContract
  rootDir: string
  skillPath: string
  source: SkillSource
  duplicates?: SkillDuplicate[]
}

export type LoadedSkill = SkillSummary & {
  content: string
  files: SkillFile[]
}
