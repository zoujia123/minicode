import { describe, expect, test } from "bun:test"

import type { AgentEvent } from "../../src/agent/events"
import { CliTraceRenderer } from "../../src/cli/trace"

function render(events: AgentEvent[], ticks?: number[], style?: "compact" | "codebuddy", options: { verbose?: boolean } = {}) {
  const chunks: string[] = []
  let index = 0
  const renderer = new CliTraceRenderer({
    write: (chunk) => chunks.push(chunk),
    now: () => ticks?.[index++] ?? 0,
    ...(options.verbose !== undefined ? { verbose: options.verbose } : {}),
    ...(style ? { style } : {}),
  })
  for (const event of events) renderer.handle(event)
  renderer.finish()
  return chunks.join("")
}

describe("CliTraceRenderer", () => {
  test("renders shell activity before the final answer", () => {
    const output = render(
      [
        { type: "tool_call", id: "call_1", name: "shell", input: { command: "curl -s http://wttr.in/Wuhan" } },
        {
          type: "tool_result",
          id: "call_1",
          name: "shell",
          ok: true,
          content: "exitCode: 0\nSunny +32C",
          metadata: { exitCode: 0, timedOut: false },
        },
        { type: "llm_text_delta", text: "done" },
      ],
      [1000, 1420],
    )

    expect(output).toContain("tool bash curl -s http://wttr.in/Wuhan")
    expect(output).toContain("  ok exit=0 420 ms")
    expect(output).toContain("\n\ndone\n")
  })

  test("previews failed tool output and redacts secrets", () => {
    const output = render(
      [
        {
          type: "tool_call",
          id: "call_1",
          name: "shell",
          input: {
            command:
              "PIXIU_API_KEY=sk-1234567890abcdef curl 'https://api.example.test/weather?api_key=very-secret'",
          },
        },
        {
          type: "tool_result",
          id: "call_1",
          name: "shell",
          ok: false,
          content: "exitCode: 1\nrequest failed for sk-abcdef1234567890 and api_key=very-secret",
          metadata: { exitCode: 1, timedOut: false },
        },
      ],
      [0, 50],
    )

    expect(output).toContain("PIXIU_API_KEY=[redacted]")
    expect(output).toContain("api_key=[redacted]")
    expect(output).toContain("sk-[redacted]")
    expect(output).toContain("  fail exit=1 50 ms")
    expect(output).not.toContain("very-secret")
    expect(output).not.toContain("sk-1234567890abcdef")
    expect(output).not.toContain("sk-abcdef1234567890")
  })

  test("renders compact labels for common file tools", () => {
    const output = render([
      { type: "tool_call", id: "read_1", name: "read", input: { path: "docs/usage.md" } },
      { type: "tool_result", id: "read_1", name: "read", ok: true, content: "hello", metadata: { path: "docs/usage.md" } },
      { type: "tool_call", id: "grep_1", name: "grep", input: { query: "weather", path: "docs" } },
      { type: "tool_result", id: "grep_1", name: "grep", ok: true, content: "No matches" },
      { type: "tool_call", id: "write_1", name: "write", input: { path: "docs/weather.md", content: "# Weather" } },
      { type: "tool_result", id: "write_1", name: "write", ok: true, content: "Changed docs/weather.md" },
    ])

    expect(output).toContain("tool read docs/usage.md")
    expect(output).toContain("tool grep \"weather\" in docs")
    expect(output).toContain("tool write docs/weather.md")
  })

  test("renders CodeBuddy-style progress and tool summaries", () => {
    const output = render(
      [
        { type: "assistant_progress_delta", text: "我先搜索相关论文，然后整理成 Markdown。" },
        { type: "tool_call", id: "search_1", name: "grep", input: { query: "agent sandbox", path: "papers" } },
        { type: "tool_result", id: "search_1", name: "grep", ok: true, content: "paper-a\npaper-b" },
        { type: "tool_call", id: "fetch_1", name: "webfetch", input: { url: "https://arxiv.org/abs/2604.23425" } },
        { type: "tool_result", id: "fetch_1", name: "webfetch", ok: true, content: "title\nabstract" },
        { type: "tool_call", id: "write_1", name: "write", input: { path: "agent_sandbox_papers.md", content: "# Papers" } },
        { type: "tool_result", id: "write_1", name: "write", ok: true, content: "Changed agent_sandbox_papers.md", metadata: { path: "agent_sandbox_papers.md" } },
      ],
      [0, 50, 100, 180, 220, 260],
      "codebuddy",
    )

    expect(output).toContain("● 我先搜索相关论文，然后整理成 Markdown。")
    expect(output).toContain("● Search(agent sandbox in papers)")
    expect(output).toContain("⎿ Found 2 results for \"agent sandbox\"")
    expect(output).toContain("● Fetch(https://arxiv.org/abs/2604.23425)")
    expect(output).toContain("⎿ ✓ Fetched content from https://arxiv.org/abs/2604.23425")
    expect(output).toContain("● Write(agent_sandbox_papers.md)")
    expect(output).toContain("⎿ ✓ Wrote agent_sandbox_papers.md")
  })

  test("renders CodeBuddy shell purpose instead of raw Bash labels", () => {
    const output = render(
      [
        {
          type: "tool_call",
          id: "call_1",
          name: "shell",
          input: { command: "agent-reach doctor --json", purpose: "检查 Agent Reach 可用状态" },
        },
        {
          type: "tool_result",
          id: "call_1",
          name: "shell",
          ok: true,
          content: "exitCode: 0\n{\"ok\":true}",
          metadata: {
            command: "agent-reach doctor --json",
            exitCode: 0,
            timedOut: false,
            activity: {
              kind: "shell",
              title: "检查 Agent Reach 可用状态",
              command: "agent-reach doctor --json",
              status: "success",
            },
          },
        },
      ],
      [0, 80],
      "codebuddy",
    )

    expect(output).toContain("● 检查 Agent Reach 可用状态")
    expect(output).toContain("⎿ ✓ 检查 Agent Reach 可用状态")
    expect(output).not.toContain("Bash(agent-reach doctor --json)")
    expect(output).not.toContain("Completed bash command")
  })

  test("renders deterministic Agent Reach shell fallback and friendly missing result", () => {
    const output = render(
      [
        {
          type: "tool_call",
          id: "call_1",
          name: "shell",
          input: { command: "agent-reach doctor --json" },
        },
        {
          type: "tool_result",
          id: "call_1",
          name: "shell",
          ok: false,
          content: "exitCode: 127\n/bin/sh: 1: agent-reach: not found",
          metadata: {
            command: "agent-reach doctor --json",
            exitCode: 127,
            timedOut: false,
            activity: {
              kind: "shell",
              title: "Command failed",
              command: "agent-reach doctor --json",
              status: "error",
            },
          },
        },
      ],
      [0, 2100],
      "codebuddy",
    )

    expect(output).toContain("● 检查 Agent Reach 可用状态")
    expect(output).toContain("⎿ ✗ Agent Reach 未安装 · 2.1 s")
    expect(output).not.toContain("Bash(agent-reach doctor --json)")
    expect(output).not.toContain("Bash failed")
  })

  test("keeps raw shell command details in verbose CodeBuddy output", () => {
    const output = render(
      [
        {
          type: "tool_call",
          id: "call_1",
          name: "shell",
          input: { command: "agent-reach doctor --json", purpose: "检查 Agent Reach 可用状态" },
        },
        {
          type: "tool_result",
          id: "call_1",
          name: "shell",
          ok: false,
          content: "exitCode: 127\n/bin/sh: 1: agent-reach: not found",
          metadata: {
            command: "agent-reach doctor --json",
            exitCode: 127,
            timedOut: false,
            activity: {
              kind: "shell",
              title: "检查 Agent Reach 可用状态",
              command: "agent-reach doctor --json",
              status: "error",
            },
          },
        },
      ],
      [0, 2100],
      "codebuddy",
      { verbose: true },
    )

    expect(output).toContain("● 检查 Agent Reach 可用状态")
    expect(output).toContain("⎿ ✗ Agent Reach 未安装 · 2.1 s")
    expect(output).toContain("raw: agent-reach doctor --json")
    expect(output).toContain("exit: 127")
    expect(output).toContain("/bin/sh: 1: agent-reach: not found")
  })

  test("renders user action requests as collaboration prompts", () => {
    const events: AgentEvent[] = [
      {
        type: "tool_call",
        id: "action_1",
        name: "request_user_action",
        input: {
          category: "auth",
          title: "需要登录小红书",
          reason: "当前工具需要登录态才能读取小红书内容。",
          instructions: ["运行 xhs login", "扫码完成登录"],
          resumeHint: "完成后回复“好了”，我会继续。",
        },
      },
      {
        type: "tool_result",
        id: "action_1",
        name: "request_user_action",
        ok: true,
        content: "需要登录小红书",
        metadata: {
          userActionRequired: true,
          category: "auth",
          title: "需要登录小红书",
          reason: "当前工具需要登录态才能读取小红书内容。",
          instructions: ["运行 xhs login", "扫码完成登录"],
          resumeHint: "完成后回复“好了”，我会继续。",
          activity: {
            kind: "permission",
            title: "需要登录小红书",
            status: "skipped",
          },
        },
      },
    ]
    const output = render(
      events,
      [0, 10],
      "codebuddy",
    )

    expect(output).toContain("● 需要登录小红书")
    expect(output).toContain("⎿ ! 等待用户操作")
    expect(output).toContain("当前工具需要登录态才能读取小红书内容。")
    expect(output).toContain("请完成：")
    expect(output).toContain("1. 运行 xhs login")
    expect(output).toContain("2. 扫码完成登录")
    expect(output).toContain("完成后回复“好了”，我会继续。")

    const compact = render(events, [0, 10])
    expect(compact).toContain("tool user action 需要登录小红书")
    expect(compact).toContain("wait user-action")
    expect(compact).toContain("1. 运行 xhs login")
  })

  test("renders compact todo snapshots from todo_updated events", () => {
    const output = render([
      {
        type: "todo_updated",
        sessionId: "session_1",
        currentTodoId: "implement",
        todos: [
          { id: "inspect", content: "Inspect workspace", status: "completed", priority: "high" },
          { id: "implement", content: "Implement todo persistence", status: "in_progress", priority: "medium" },
          { id: "web", content: "Update Web UI progress panel", status: "pending", priority: "low" },
          { id: "old", content: "Drop old scratch plan", status: "cancelled", priority: "low" },
        ],
      },
    ])

    expect(output).toContain("Tasks")
    expect(output).toContain("✓ Inspect workspace")
    expect(output).toContain("● Implement todo persistence")
    expect(output).toContain("○ Update Web UI progress panel")
    expect(output).toContain("× Drop old scratch plan")
  })

  test("does not repeat identical todo snapshots", () => {
    const snapshot = {
      type: "todo_updated" as const,
      sessionId: "session_1",
      todos: [{ id: "one", content: "Do one thing", status: "pending" as const, priority: "medium" as const }],
    }
    const output = render([snapshot, snapshot])

    expect((output.match(/Tasks/g) ?? []).length).toBe(1)
    expect((output.match(/○ Do one thing/g) ?? []).length).toBe(1)
  })

  test("renders todo block before later ordinary tool traces", () => {
    const output = render([
      {
        type: "todo_updated",
        sessionId: "session_1",
        currentTodoId: "read",
        todos: [{ id: "read", content: "Read file", status: "in_progress", priority: "high" }],
      },
      { type: "tool_call", id: "read_1", name: "read", input: { path: "docs/usage.md" } },
      { type: "tool_result", id: "read_1", name: "read", ok: true, content: "hello", metadata: { path: "docs/usage.md" } },
    ])

    expect(output.indexOf("Tasks")).toBeLessThan(output.indexOf("tool read docs/usage.md"))
    expect(output).toContain("tool read docs/usage.md")
    expect(output).toContain("  ok")
  })

  test("old traces without todo_updated keep the same compact tool output", () => {
    const output = render([
      { type: "tool_call", id: "todo_1", name: "todo", input: { items: ["inspect workspace"] } },
      { type: "tool_result", id: "todo_1", name: "todo", ok: true, content: "1. inspect workspace" },
    ])

    expect(output).toContain("tool todo")
    expect(output).toContain("  ok")
    expect(output).not.toContain("Tasks")
  })
})
