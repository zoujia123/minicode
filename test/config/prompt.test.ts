import { describe, expect, test } from "bun:test"
import { readFile } from "node:fs/promises"

import { defaultConfig } from "../../src/config/defaults"
import { createBuiltinTools } from "../../src/tools/builtin"

describe("default agent prompt", () => {
  test("guides non-trivial task progress through todowrite without pressuring simple tasks", () => {
    const prompt = defaultConfig.agents.default.systemPrompt ?? ""

    expect(prompt).toContain("Track execution progress with todowrite for non-trivial work")
    expect(prompt).toContain("3+ steps")
    expect(prompt).toContain("multi-file changes")
    expect(prompt).toContain("tests/typecheck/build")
    expect(prompt).toContain("explicit user checklist")
    expect(prompt).toContain("Do not use todowrite for simple factual Q&A")
    expect(prompt).toContain("one-step explanations")
    expect(prompt).toContain("short translation/polish")
    expect(prompt).toContain("complete latest todo snapshot")
    expect(prompt).toContain("keep at most one in_progress item")
    expect(prompt).toContain("mark completed only after the needed implementation and verification are done")
    expect(prompt).toContain("not hidden reasoning")
  })

  test("keeps legacy todo available while preferring todowrite", () => {
    const tools = defaultConfig.agents.default.tools
    const builtins = createBuiltinTools()
    const todo = builtins.find((tool) => tool.name === "todo")
    const todowrite = builtins.find((tool) => tool.name === "todowrite")
    const requestUserAction = builtins.find((tool) => tool.name === "request_user_action")

    expect(tools).toContain("todowrite")
    expect(tools).toContain("todo")
    expect(tools).toContain("request_user_action")
    expect(tools.indexOf("todowrite")).toBeLessThan(tools.indexOf("todo"))
    expect(todo?.description).toContain("Legacy compatibility")
    expect(todo?.description).toContain("Prefer todowrite")
    expect(todowrite?.description).toContain("non-trivial task progress")
    expect(todowrite?.description).toContain("avoid for simple Q&A")
    expect(requestUserAction?.description).toContain("external action")
    expect(requestUserAction?.description).toContain("login")
    expect(requestUserAction?.description).toContain("captcha")
  })

  test("guides user collaboration requests for external action blockers", () => {
    const prompt = defaultConfig.agents.default.systemPrompt ?? ""

    expect(prompt).toContain("request_user_action")
    expect(prompt).toContain("external user action")
    expect(prompt).toContain("QR scanning")
    expect(prompt).toContain("captcha")
    expect(prompt).toContain("cookie/session import")
  })

  test("guides optional CLI installs through the managed tool environment", () => {
    const prompt = defaultConfig.agents.default.systemPrompt ?? ""

    expect(prompt).toContain("optional CLI tool is missing")
    expect(prompt).toContain("Pixiu's managed tool environment")
    expect(prompt).toContain("pixiu tools env status")
    expect(prompt).toContain("pixiu tools install agent-reach")
    expect(prompt).toContain("global pip")
  })

  test("treats loaded skill guardrails as execution constraints", () => {
    const prompt = defaultConfig.agents.default.systemPrompt ?? ""

    expect(prompt).toContain("When using a local skill")
    expect(prompt).toContain("hard stop")
    expect(prompt).toContain("install")
    expect(prompt).toContain("credential")
    expect(prompt).toContain("do not route around them")
  })

  test("agent completion protocol documents shell purpose and activity examples", async () => {
    const source = await readFile(new URL("../../src/agent/runner.ts", import.meta.url), "utf8")

    expect(source).toContain("purpose")
    expect(source).toContain("agent-reach doctor --json")
    expect(source).toContain("检查 Agent Reach 可用状态")
    expect(source).toContain("request_user_action")
    expect(source).toContain("required external user action")
    expect(source).toContain("loaded Skill gives hard stop")
    expect(source).toContain("alternate tools unless the user explicitly chooses")
    expect(source).toContain("_activity")
  })
})
