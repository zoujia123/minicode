import type { SessionMessage } from "../session/types"

export type CompactionOptions = {
  maxApproxTokens: number
  keepRecentMessages: number
}

export function approximateTokens(text: string) {
  return Math.ceil(text.length / 4)
}

export function messageApproxTokens(message: SessionMessage) {
  return approximateTokens(JSON.stringify(message.parts))
}

export function compactMessages(
  messages: SessionMessage[],
  options: CompactionOptions,
): { messages: SessionMessage[]; summary?: string } {
  let total = messages.reduce((sum, message) => sum + messageApproxTokens(message), 0)
  if (total <= options.maxApproxTokens) return { messages }

  return compactSessionMessages(messages, options)
}

export function compactSessionMessages(
  messages: SessionMessage[],
  options: CompactionOptions,
  existingSummary?: string,
): { messages: SessionMessage[]; summary: string; compactedCount: number; recentApproxTokens: number } {
  const recent = messages.slice(-options.keepRecentMessages)
  const older = messages.slice(0, -options.keepRecentMessages)
  const body = older
    .map((message) => formatMessageForSummary(message))
    .join("\n\n")
    .slice(0, options.maxApproxTokens * 2)
  const total = recent.reduce((sum, message) => sum + messageApproxTokens(message), 0)
  const previous = existingSummary?.trim()
  const previousSection = previous ? `Previous summary:\n${previous}\n\n` : ""
  return {
    messages: recent,
    summary: `${previousSection}Compacted ${older.length} older messages. Approx recent tokens: ${total}.\n${body}`,
    compactedCount: older.length,
    recentApproxTokens: total,
  }
}

function formatMessageForSummary(message: SessionMessage) {
  const parts = message.parts.map((part) => {
    if (part.type === "text") return part.text
    if (part.type === "reasoning") return `[reasoning] ${part.text}`
    if (part.type === "error") return `[error${part.code ? ` ${part.code}` : ""}] ${part.message}`
    if (part.type === "tool_call") return `[tool_call ${part.name}] ${JSON.stringify(part.input)}`
    if (part.type === "tool_result") return `[tool_result ${part.name}] ${JSON.stringify(part.result)}`
    return JSON.stringify(part)
  })
  return `${message.role} ${message.createdAt}:\n${parts.join("\n")}`
}
