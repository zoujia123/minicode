import { describe, expect, test } from "bun:test"

import { compactMessages, compactSessionMessages } from "../../src/agent/compaction"
import type { SessionMessage } from "../../src/session/types"

describe("compaction", () => {
  test("summarizes older messages and keeps recent turns", () => {
    const messages: SessionMessage[] = Array.from({ length: 8 }, (_, index) => ({
      id: `m${index}`,
      sessionId: "s",
      role: "user",
      createdAt: new Date(index).toISOString(),
      parts: [{ type: "text", text: "x".repeat(200) }],
    }))
    const result = compactMessages(messages, { maxApproxTokens: 100, keepRecentMessages: 2 })
    expect(result.messages.length).toBe(2)
    expect(result.summary).toContain("Compacted 6 older messages")
  })

  test("explicit session compaction preserves prior summary", () => {
    const messages: SessionMessage[] = Array.from({ length: 5 }, (_, index) => ({
      id: `m${index}`,
      sessionId: "s",
      role: index % 2 === 0 ? "user" : "assistant",
      createdAt: new Date(index).toISOString(),
      parts: [{ type: "text", text: `message ${index}` }],
    }))

    const result = compactSessionMessages(messages, { maxApproxTokens: 100, keepRecentMessages: 2 }, "Existing summary")

    expect(result.messages.map((message) => message.id)).toEqual(["m3", "m4"])
    expect(result.summary).toContain("Previous summary:")
    expect(result.summary).toContain("Existing summary")
    expect(result.summary).toContain("Compacted 3 older messages")
    expect(result.compactedCount).toBe(3)
  })
})
