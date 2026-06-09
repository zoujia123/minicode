import { describe, expect, test } from "bun:test"

import { collectSessionEvidence } from "../../src/session/evidence"
import type { JsonValue } from "../../src/shared/json"
import type { SessionMessage } from "../../src/session/types"

describe("session evidence", () => {
  test("collects artifacts, sources, and shell commands from tool results", () => {
    const messages: SessionMessage[] = [
      toolMessage("write", { ok: true, content: "Changed report.md", metadata: { path: "report.md" } }),
      toolMessage("web_search", {
        ok: true,
        content: "1. Agent Sandbox",
        metadata: {
          kind: "web_search",
          query: "agent sandbox papers",
          searchURL: "https://duckduckgo.com/html/?q=agent+sandbox+papers",
          accessedAt: "2026-06-09T00:00:00.000Z",
        },
      }),
      toolMessage("web_fetch", {
        ok: true,
        content: "title: Agent Sandbox",
        metadata: {
          kind: "web_fetch",
          url: "https://arxiv.org/abs/2604.23425",
          title: "Agent Sandbox",
          accessedAt: "2026-06-09T00:00:01.000Z",
        },
      }),
      toolMessage("shell", {
        ok: true,
        content: "exitCode: 0",
        metadata: { command: "printf ok", exitCode: 0 },
      }),
      toolMessage("write", { ok: true, content: "Changed report.md", metadata: { path: "report.md" } }),
    ]

    const evidence = collectSessionEvidence(messages)

    expect(evidence.artifacts).toEqual([
      expect.objectContaining({ tool: "write", path: "report.md" }),
    ])
    expect(evidence.sources).toEqual([
      expect.objectContaining({ tool: "web_search", query: "agent sandbox papers" }),
      expect.objectContaining({ tool: "web_fetch", url: "https://arxiv.org/abs/2604.23425", title: "Agent Sandbox" }),
    ])
    expect(evidence.shellCommands).toEqual([
      expect.objectContaining({ command: "printf ok", exitCode: 0 }),
    ])
  })
})

function toolMessage(name: string, result: JsonValue): SessionMessage {
  return {
    id: `msg_${name}_${Math.random()}`,
    sessionId: "session_test",
    role: "tool",
    createdAt: "2026-06-09T00:00:00.000Z",
    parts: [{ type: "tool_result", toolCallId: `call_${name}`, name, result }],
  }
}
