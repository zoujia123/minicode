import { describe, expect, test } from "bun:test"
import { chmod, mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

import { ToolRegistry } from "../../src/tools/registry"
import { createBuiltinTools } from "../../src/tools/builtin"
import { StaticPermissionManager } from "../../src/permission/evaluator"
import { PathGuard } from "../../src/sandbox/path"

async function context(root: string, autoApprove = true) {
  return {
    cwd: root,
    workspaceRoot: root,
    permissions: new StaticPermissionManager(
      [
        { tool: "read", action: "allow" },
        { tool: "write", action: "ask" },
        { tool: "shell", action: "ask" },
        { tool: "request_user_action", action: "allow" },
      ],
      { nonInteractive: true, autoApprove },
    ),
    pathGuard: new PathGuard({ workspaceRoot: root, workspaceOnly: true }),
    config: { shellTimeoutMs: 500, outputMaxBytes: 4_000, envAllowlist: ["PATH"] },
  }
}

describe("tool registry and builtins", () => {
  test("LLM tool schemas expose optional Pixiu activity intent without changing execution validation", async () => {
    const registry = new ToolRegistry().registerMany(createBuiltinTools())
    const shellSchema = registry.toLLMTools(["shell"])[0]?.inputSchema
    const executionSchema = registry.get("shell")?.inputSchema

    expect(shellSchema?.properties?._activity).toMatchObject({
      type: "object",
      description: expect.stringContaining("Pixiu-only"),
    })
    expect(shellSchema?.properties?.command).toMatchObject({ type: "string" })
    expect(shellSchema?.properties?.purpose).toMatchObject({ type: "string" })
    expect(executionSchema?.properties?.purpose).toMatchObject({ type: "string" })
    expect(executionSchema?.properties?._activity).toBeUndefined()
  })

  test("read tool returns clear file content", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-"))
    await writeFile(join(root, "note.txt"), "hello world", "utf8")
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute("read", { path: "note.txt" }, await context(root))
    expect(result.ok).toBe(true)
    expect(result.content).toContain("hello world")
    expect(result.metadata?.activity).toMatchObject({
      kind: "file",
      title: "Read file",
      target: "note.txt",
    })
  })

  test("request_user_action captures generic user collaboration requests", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-user-action-"))
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute(
      "request_user_action",
      {
        category: "auth",
        title: "需要登录小红书",
        reason: "当前工具需要登录态才能读取小红书内容。",
        instructions: ["运行 xhs login", "扫码完成登录"],
        resumeHint: "完成后回复“好了”，我会继续获取热门话题。",
      },
      await context(root),
    )

    expect(result.ok).toBe(true)
    expect(result.content).toContain("需要登录小红书")
    expect(result.metadata).toMatchObject({
      userActionRequired: true,
      category: "auth",
      title: "需要登录小红书",
      instructions: ["运行 xhs login", "扫码完成登录"],
      activity: {
        kind: "permission",
        title: "需要登录小红书",
        status: "skipped",
        details: {
          userActionRequired: true,
          category: "auth",
        },
      },
    })
  })

  test("invalid input returns model-correctable error", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-"))
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute("read", {}, await context(root))
    expect(result.ok).toBe(false)
    expect(result.content).toContain("missing required field")
  })

  test("write is denied without auto approval", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-"))
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute("write", { path: "a.txt", content: "x" }, await context(root, false))
    expect(result.ok).toBe(false)
    expect(result.content).toContain("Permission denied")
    expect(result.metadata?.permissionAction).toBe("deny")
    expect(result.metadata?.permissionOriginalAction).toBe("ask")
  })

  test("outside workspace paths trigger permission", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-"))
    const outside = join(tmpdir(), "pixiu-outside.txt")
    await writeFile(outside, "secret", "utf8")
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute("read", { path: outside }, await context(root, false))
    expect(result.ok).toBe(false)
    expect(result.content).toContain("outside-workspace")
  })

  test("shell audit metadata includes risk, permission, cwd, duration, and output sizes", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-shell-audit-"))
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute("shell", { command: "printf hello" }, await context(root))

    expect(result.ok).toBe(true)
    expect(result.content).toContain("hello")
    expect(result.metadata).toMatchObject({
      command: "printf hello",
      cwd: root,
      exitCode: 0,
      timedOut: false,
      permissionAction: "allow",
      permissionOriginalAction: "ask",
      shellRisk: "low",
      shellRiskCategory: "read",
    })
    expect(typeof result.metadata?.durationMs).toBe("number")
    expect(result.metadata?.stdoutBytes).toBe(5)
    expect(result.metadata?.activity).toMatchObject({
      kind: "shell",
      status: "success",
      title: "Ran command",
      command: "printf hello",
    })
  })

  test("shell purpose is accepted as activity metadata without changing process input", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-shell-purpose-"))
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute(
      "shell",
      {
        command: "printf command-ok",
        purpose: "检查 Agent Reach 可用状态",
      },
      await context(root),
    )

    expect(result.ok).toBe(true)
    expect(result.content).toContain("command-ok")
    expect(result.content).not.toContain("检查 Agent Reach 可用状态")
    expect(result.metadata).toMatchObject({
      command: "printf command-ok",
      activity: {
        kind: "shell",
        status: "success",
        title: "检查 Agent Reach 可用状态",
        summary: "检查 Agent Reach 可用状态",
        command: "printf command-ok",
      },
    })
  })

  test("shell uses managed environment PATH from tool context", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-shell-managed-path-"))
    const bin = join(root, "managed-bin")
    await mkdir(bin)
    const commandPath = join(bin, "pixiu-managed-tool")
    await writeFile(commandPath, "#!/bin/sh\nprintf managed-tool-ok\n", "utf8")
    await chmod(commandPath, 0o755)
    const registry = new ToolRegistry().registerMany(createBuiltinTools())
    const base = await context(root)

    const result = await registry.execute(
      "shell",
      { command: "pixiu-managed-tool" },
      {
        ...base,
        config: {
          ...base.config,
          envPrependPath: [bin],
        },
      },
    )

    expect(result.ok).toBe(true)
    expect(result.content).toContain("managed-tool-ok")
  })

  test("shell denies obvious writes outside the workspace", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-shell-outside-"))
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute("shell", { command: "printf bad > ../outside.txt" }, await context(root))

    expect(result.ok).toBe(false)
    expect(result.content).toContain("outside the workspace")
    expect(result.metadata?.outsideWorkspaceTarget).toBe("../outside.txt")
    expect(result.metadata?.activity).toMatchObject({
      kind: "shell",
      status: "error",
      title: "Command failed",
    })
  })

  test("shell can write temporary files under .pixiu/tmp", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-shell-tmp-"))
    const registry = new ToolRegistry().registerMany(createBuiltinTools())

    const result = await registry.execute(
      "shell",
      { command: "mkdir -p .pixiu/tmp && printf tmp-ok > .pixiu/tmp/a.txt" },
      await context(root),
    )

    expect(result.ok).toBe(true)
    expect(await readFile(join(root, ".pixiu/tmp/a.txt"), "utf8")).toBe("tmp-ok")
  })

  test("shell env allowlist does not expose provider API keys", async () => {
    const root = await mkdtemp(join(tmpdir(), "pixiu-tools-shell-env-"))
    const previous = process.env.PIXIU_API_KEY
    process.env.PIXIU_API_KEY = "sk-test-secret-1234567890"
    try {
      const registry = new ToolRegistry().registerMany(createBuiltinTools())
      const result = await registry.execute("shell", { command: "env | grep PIXIU_API_KEY || true" }, await context(root))

      expect(result.ok).toBe(true)
      expect(result.content).not.toContain("PIXIU_API_KEY")
      expect(result.content).not.toContain("sk-test-secret")
    } finally {
      if (previous === undefined) delete process.env.PIXIU_API_KEY
      else process.env.PIXIU_API_KEY = previous
    }
  })
})
