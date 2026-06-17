import type { AgentEvent } from "../agent/events"
import { activityFromToolIntent, activityFromToolResult, updateActivityWithToolResult } from "../activity/format"
import type { ActivityItem } from "../activity/types"
import type { JsonObject, JsonValue } from "../shared/json"
import { redactSecrets } from "../shared/redact"
import type { TodoItem, TodoStatus } from "../todo/types"
import { createTerminal, formatBytes, formatDuration, oneLine, stripAnsi, type Terminal } from "./terminal"

type Writer = (text: string) => void

type ActiveTool = {
  name: string
  input: JsonObject
  startedAt: number
  activity?: ActivityItem
}

export type CliTraceRendererOptions = {
  write: Writer
  now?: () => number
  noColor?: boolean
  verbose?: boolean
  terminal?: Terminal
  style?: "compact" | "codebuddy"
}

export class CliTraceRenderer {
  private readonly writeChunk: Writer
  private readonly now: () => number
  private readonly verbose: boolean
  private readonly terminal: Terminal
  private readonly style: "compact" | "codebuddy"
  private readonly activeTools = new Map<string, ActiveTool>()
  private printedTrace = false
  private answerStarted = false
  private lastTodoSnapshot = ""

  constructor(options: CliTraceRendererOptions) {
    this.writeChunk = options.write
    this.now = options.now ?? Date.now
    this.verbose = options.verbose ?? false
    this.style = options.style ?? "compact"
    this.terminal = options.terminal ?? createTerminal({ ...(options.noColor !== undefined ? { noColor: options.noColor } : {}) })
  }

  handle(event: AgentEvent) {
    switch (event.type) {
      case "assistant_progress_delta":
        this.progress(event.text)
        return
      case "tool_call":
        this.toolCall(event)
        return
      case "tool_result":
        this.toolResult(event)
        return
      case "todo_updated":
        this.todoUpdated(event)
        return
      case "llm_text_delta":
        this.textDelta(event.text)
        return
      case "error":
        this.error(event.message)
        return
      default:
        return
    }
  }

  private progress(text: string) {
    const lines = text
      .replace(/\r\n?/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
    for (const line of lines) {
      if (this.style === "codebuddy") {
        this.writeTrace(`${this.terminal.blue("●")} ${oneLine(line, 180)}\n`)
      } else {
        this.writeTrace(`${this.terminal.dim("note")} ${oneLine(line, 180)}\n`)
      }
    }
  }

  finish() {
    if (this.answerStarted) this.write("\n")
  }

  private toolCall(event: Extract<AgentEvent, { type: "tool_call" }>) {
    const input = objectValue(event.input)
    const activity = activityFromToolIntent({
      toolCallId: event.id,
      toolName: event.name,
      input,
    })
    this.activeTools.set(event.id, { name: event.name, input, startedAt: this.now(), ...(activity ? { activity } : {}) })
    if (this.style === "codebuddy") {
      this.writeTrace(`${this.terminal.blue("●")} ${formatCodeBuddyToolCall(event.name, input, this.terminal, activity)}\n`)
      this.writeVerboseToolCall(event.name, input, activity)
      return
    }
    this.writeTrace(`${this.terminal.dim("tool")} ${formatToolCall(event.name, input, this.terminal)}\n`)
  }

  private toolResult(event: Extract<AgentEvent, { type: "tool_result" }>) {
    const active = this.activeTools.get(event.id)
    if (active) this.activeTools.delete(event.id)

    const elapsedMs = active ? Math.max(0, this.now() - active.startedAt) : undefined
    const metadata = objectValue(event.metadata)
    const line =
      this.style === "codebuddy"
        ? formatCodeBuddyToolResult(event, metadata, elapsedMs, this.terminal, active)
        : formatToolResult(event, metadata, elapsedMs, this.terminal)
    if (this.style === "codebuddy") {
      this.writeTrace(`  ${this.terminal.gray("⎿")} ${line}\n`)
      this.writeVerboseToolResult(metadata)
    } else {
      this.writeTrace(`  ${line}\n`)
    }

    const userActionDetails = formatUserActionDetails(event, metadata, this.terminal)
    if (userActionDetails) {
      for (const line of userActionDetails.split("\n")) {
        const marker = this.style === "codebuddy" ? "  " : "|"
        this.writeTrace(`  ${this.terminal.gray(marker)} ${line}\n`)
      }
      return
    }

    if (!event.ok || this.verbose) {
      const preview = previewOutput(event.content)
      if (preview) {
        for (const line of preview.split("\n")) {
          const marker = this.style === "codebuddy" ? "  " : "|"
          this.writeTrace(`  ${this.terminal.gray(marker)} ${line}\n`)
        }
      }
    }
  }

  private todoUpdated(event: Extract<AgentEvent, { type: "todo_updated" }>) {
    const snapshot = todoSnapshotKey(event.todos, event.currentTodoId)
    if (snapshot === this.lastTodoSnapshot) return
    this.lastTodoSnapshot = snapshot
    const block = formatTodoBlock(event.todos, event.currentTodoId, this.terminal)
    if (block) this.writeTrace(`${block}\n`)
  }

  private textDelta(text: string) {
    if (!this.answerStarted) {
      if (this.printedTrace) this.write("\n")
      this.answerStarted = true
    }
    this.write(text)
  }

  private error(message: string) {
    if (this.answerStarted) this.write("\n")
    this.writeTrace(`${this.terminal.red("error")} ${oneLine(message, 240)}\n`)
  }

  private writeTrace(text: string) {
    if (this.answerStarted) this.write("\n")
    this.answerStarted = false
    this.printedTrace = true
    this.write(text)
  }

  private write(text: string) {
    this.writeChunk(redactSecrets(text))
  }

  private writeVerboseToolCall(name: string, input: JsonObject, activity: ActivityItem | undefined) {
    if (!this.verbose || name !== "shell") return
    const command = stringValue(input, "command")
    if (!command) return
    const displayTitle = activity?.title ?? stringValue(input, "purpose")
    if (!displayTitle || displayTitle !== command) {
      this.writeTrace(`  ${this.terminal.gray("raw:")} ${oneLine(command, Math.max(24, Math.min(180, this.terminal.width - 8)))}\n`)
    }
  }

  private writeVerboseToolResult(metadata: JsonObject) {
    if (!this.verbose) return
    const details = objectValue(metadata.details)
    const exitCode = numberValue(metadata, "exitCode") ?? numberValue(details, "exitCode")
    const timedOut = booleanValue(metadata, "timedOut") ?? booleanValue(details, "timedOut")
    if (exitCode !== undefined) this.writeTrace(`  ${this.terminal.gray("exit:")} ${exitCode}\n`)
    if (timedOut) this.writeTrace(`  ${this.terminal.gray("timeout:")} true\n`)
  }
}

function objectValue(value: JsonValue | undefined): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return value
}

function todoSnapshotKey(todos: TodoItem[], currentTodoId: string | undefined) {
  return JSON.stringify({
    currentTodoId: currentTodoId ?? "",
    todos: todos.map((todo) => ({
      id: todo.id,
      content: todo.content,
      status: todo.status,
      priority: todo.priority,
    })),
  })
}

function formatTodoBlock(todos: TodoItem[], currentTodoId: string | undefined, terminal: Terminal) {
  if (!todos.length) return ""
  const targetWidth = Math.max(24, Math.min(180, terminal.width - 4))
  const lines = [terminal.blue("Tasks")]
  for (const todo of todos) {
    const current = currentTodoId ? todo.id === currentTodoId : todo.status === "in_progress"
    const marker = todoMarker(todo.status)
    const content = oneLine(todo.content, targetWidth)
    lines.push(current ? terminal.bold(`${marker} ${content}`) : `${marker} ${content}`)
  }
  return lines.join("\n")
}

function todoMarker(status: TodoStatus) {
  if (status === "completed") return "✓"
  if (status === "in_progress") return "●"
  if (status === "cancelled") return "×"
  return "○"
}

function stringValue(input: JsonObject, key: string) {
  const value = input[key]
  return typeof value === "string" ? value : ""
}

function numberValue(input: JsonObject, key: string) {
  const value = input[key]
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

function booleanValue(input: JsonObject, key: string) {
  const value = input[key]
  return typeof value === "boolean" ? value : undefined
}

function formatToolCall(name: string, input: JsonObject, terminal: Terminal) {
  const label = (value: string) => terminal.blue(value)
  const targetWidth = (reserved = 14) => Math.max(24, Math.min(180, terminal.width - reserved))
  switch (name) {
    case "shell":
      return `${label("bash")} ${oneLine(stringValue(input, "command") || "(empty command)", targetWidth())}`
    case "read":
      return `${label("read")} ${oneLine(stringValue(input, "path") || "(missing path)", targetWidth())}`
    case "grep": {
      const query = quote(stringValue(input, "query"))
      const path = stringValue(input, "path")
      return `${label("grep")} ${query}${path ? ` in ${oneLine(path, targetWidth(40))}` : ""}`
    }
    case "glob": {
      const pattern = quote(stringValue(input, "pattern"))
      const cwd = stringValue(input, "cwd")
      return `${label("glob")} ${pattern}${cwd ? ` in ${oneLine(cwd, targetWidth(40))}` : ""}`
    }
    case "write":
      return `${label("write")} ${oneLine(stringValue(input, "path") || "(missing path)", targetWidth())}`
    case "edit":
      return `${label("edit")} ${oneLine(stringValue(input, "path") || "(missing path)", targetWidth())}`
    case "patch":
      return `${label("patch")} ${oneLine(stringValue(input, "path") || "(missing path)", targetWidth())}`
    case "todo":
      return label("todo")
    case "todowrite":
      return label("todowrite")
    case "request_user_action":
      return `${label("user action")} ${oneLine(stringValue(input, "title") || "(missing title)", targetWidth())}`
    case "skill":
      return `${label("skill")} ${quote(stringValue(input, "name"))}${stringValue(input, "path") ? ` ${quote(stringValue(input, "path"))}` : ""}`
    case "skill_search":
      return `${label("skill search")} ${quote(stringValue(input, "query"))}`
    case "skillhub_search":
      return `${label("skillhub search")} ${quote(stringValue(input, "query"))}`
    case "skillhub_install":
      return `${label("skillhub install")} ${quote(stringValue(input, "id"))}`
    default:
      return `${label(name)}${inputSummary(input)}`
  }
}

function formatCodeBuddyToolCall(name: string, input: JsonObject, terminal: Terminal, activity?: ActivityItem) {
  const targetWidth = (reserved = 18) => Math.max(24, Math.min(180, terminal.width - reserved))
  const call = (label: string, value?: string) => {
    const suffix = value ? oneLine(value, targetWidth(label.length + 8)) : ""
    return `${terminal.blue(label)}(${suffix})`
  }
  const lower = name.toLowerCase()
  if (activity?.title) return oneLine(activity.title, targetWidth(4))
  if (name === "shell") return oneLine("运行命令", targetWidth(4))
  if (name === "read") return call("Read", stringValue(input, "path") || "(missing path)")
  if (name === "grep") {
    const query = stringValue(input, "query")
    const path = stringValue(input, "path")
    return call("Search", path ? `${query} in ${path}` : query)
  }
  if (name === "glob") return call("Glob", stringValue(input, "pattern") || "(missing pattern)")
  if (name === "write") return call("Write", stringValue(input, "path") || "(missing path)")
  if (name === "edit") return call("Edit", stringValue(input, "path") || "(missing path)")
  if (name === "patch") return call("Patch", stringValue(input, "path") || "(missing path)")
  if (name === "request_user_action") return oneLine(stringValue(input, "title") || "需要用户协作", targetWidth(4))
  if (name === "skill") return call("Skill", stringValue(input, "name") || "(missing name)")
  if (name === "skill_search") return call("SkillSearch", stringValue(input, "query") || "(empty query)")
  if (lower.includes("fetch")) return call("Fetch", stringValue(input, "url") || stringValue(input, "path") || inputSummary(input))
  if (lower.includes("search")) return call("Search", stringValue(input, "query") || inputSummary(input))
  return call(titleCaseToolName(name), inputSummary(input).replace(/^\s*\[/, "").replace(/\]\s*$/, ""))
}

function formatToolResult(
  event: Extract<AgentEvent, { type: "tool_result" }>,
  metadata: JsonObject,
  elapsedMs: number | undefined,
  terminal: Terminal,
) {
  if (event.name === "request_user_action") {
    const parts = [terminal.gray("wait"), "user-action"]
    if (elapsedMs !== undefined) parts.push(formatDuration(elapsedMs))
    return parts.join(" ")
  }
  const parts = [event.ok ? terminal.green("ok") : terminal.red("fail")]
  const exitCode = numberValue(metadata, "exitCode")
  const timedOut = booleanValue(metadata, "timedOut")
  if (exitCode !== undefined) parts.push(`exit=${exitCode}`)
  if (timedOut) parts.push("timeout")
  if (elapsedMs !== undefined) parts.push(formatDuration(elapsedMs))
  parts.push(formatBytes(Buffer.byteLength(event.content)))
  return parts.join(" ")
}

function formatCodeBuddyToolResult(
  event: Extract<AgentEvent, { type: "tool_result" }>,
  metadata: JsonObject,
  elapsedMs: number | undefined,
  terminal: Terminal,
  active?: ActiveTool,
) {
  const input = active?.input ?? {}
  const name = event.name.toLowerCase()
  const ok = event.ok
  const prefix = ok ? terminal.green("✓") : terminal.red("✗")
  const elapsed = elapsedMs === undefined ? "" : ` · ${formatDuration(elapsedMs)}`
  const exitCode = numberValue(metadata, "exitCode")
  if (event.name === "request_user_action") {
    return `${terminal.gray("!")} 等待用户操作${elapsed}`
  }
  const semantic = codeBuddySemanticToolResult(event, metadata, active)
  if (semantic) return `${prefix} ${oneLine(semantic, Math.max(24, Math.min(180, terminal.width - 10)))}${elapsed}`
  const path = stringValue(metadata, "path") || stringValue(input, "path")
  const url = stringValue(input, "url")
  const query = stringValue(input, "query")
  const count = nonEmptyLineCount(event.content)

  if (event.name === "write") return ok ? `${prefix} Wrote ${path || "file"}${elapsed}` : `${prefix} Write failed${elapsed}`
  if (event.name === "edit" || event.name === "patch") return ok ? `${prefix} Updated ${path || "file"}${elapsed}` : `${prefix} Update failed${elapsed}`
  if (event.name === "read") return ok ? `${prefix} Read ${path || "file"} (${formatBytes(Buffer.byteLength(event.content))})${elapsed}` : `${prefix} Read failed${elapsed}`
  if (event.name === "glob") {
    const pattern = stringValue(input, "pattern")
    return ok ? `Found ${count} ${count === 1 ? "file" : "files"}${pattern ? ` for "${oneLine(pattern, 80)}"` : ""}${elapsed}` : `${prefix} Glob failed${elapsed}`
  }
  if (event.name === "grep" || name.includes("search")) {
    if (!ok) return `${prefix} Search failed${elapsed}`
    if (/^No matches\s*$/i.test(stripAnsi(event.content).trim())) return `No matches${query ? ` for "${oneLine(query, 80)}"` : ""}${elapsed}`
    return `Found ${count} ${count === 1 ? "result" : "results"}${query ? ` for "${oneLine(query, 80)}"` : ""}${elapsed}`
  }
  if (name.includes("fetch")) {
    return ok ? `${prefix} Fetched content${url ? ` from ${oneLine(url, 120)}` : ""}${elapsed}` : `${prefix} Fetch failed${elapsed}`
  }
  if (event.name === "shell") {
    const exit = exitCode === undefined ? "" : ` exit=${exitCode}`
    return ok ? `${prefix} 命令已完成${exit}${elapsed}` : `${prefix} 命令失败${exit}${elapsed}`
  }
  const fallback = formatToolResult(event, metadata, elapsedMs, terminal)
  return ok ? fallback : `${prefix} ${fallback}`
}

function codeBuddySemanticToolResult(
  event: Extract<AgentEvent, { type: "tool_result" }>,
  metadata: JsonObject,
  active?: ActiveTool,
) {
  if (!shouldUseSemanticToolResult(event.name, metadata, active)) return undefined
  const resultActivity = activityFromToolResult({
    toolCallId: event.id,
    toolName: event.name,
    input: active?.input,
    ok: event.ok,
    content: event.content,
    metadata,
  })
  const activity = active?.activity
    ? updateActivityWithToolResult(active.activity, resultActivity, event.ok)
    : resultActivity
  if (!activity.title || isGenericToolActivityTitle(activity.title)) return undefined
  return activity.title
}

function shouldUseSemanticToolResult(name: string, metadata: JsonObject, active?: ActiveTool) {
  if (active?.activity) return true
  if (name === "shell") return true
  if (!metadata.activity || typeof metadata.activity !== "object" || Array.isArray(metadata.activity)) return false
  return !new Set(["read", "write", "edit", "patch", "glob", "grep"]).has(name)
}

function isGenericToolActivityTitle(title: string) {
  return title === "Ran command" || title === "Command failed" || title.startsWith("Used tool:")
}

function formatUserActionDetails(
  event: Extract<AgentEvent, { type: "tool_result" }>,
  metadata: JsonObject,
  terminal: Terminal,
) {
  if (event.name !== "request_user_action" && metadata.userActionRequired !== true) return ""
  const reason = stringValue(metadata, "reason")
  const instructions = stringArrayValue(metadata, "instructions")
  const resumeHint = stringValue(metadata, "resumeHint")
  const width = Math.max(24, Math.min(180, terminal.width - 8))
  const lines: string[] = []
  if (reason) lines.push(oneLine(reason, width))
  if (instructions.length) {
    if (lines.length) lines.push("")
    lines.push("请完成：")
    instructions.forEach((instruction, index) => {
      lines.push(`${index + 1}. ${oneLine(instruction, width - 3)}`)
    })
  }
  if (resumeHint) {
    if (lines.length) lines.push("")
    lines.push(oneLine(resumeHint, width))
  }
  return lines.join("\n")
}

function stringArrayValue(input: JsonObject, key: string) {
  const value = input[key]
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())) : []
}

function inputSummary(input: JsonObject) {
  const values = Object.entries(input)
    .filter(([, value]) => typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    .slice(0, 3)
    .map(([key, value]) => `${key}=${oneLine(String(value), 60)}`)
  return values.length ? ` [${values.join(", ")}]` : ""
}

function nonEmptyLineCount(content: string) {
  return stripAnsi(content)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => line.trim() && !/^exitCode:\s*/i.test(line) && !/^timedOut:\s*/i.test(line)).length
}

function titleCaseToolName(name: string) {
  return name
    .split(/[_:-]+/)
    .filter(Boolean)
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join("")
}

function quote(value: string) {
  return `"${oneLine(value, 120).replaceAll("\"", "\\\"")}"`
}

function previewOutput(content: string) {
  const lines = stripAnsi(content)
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .filter((line) => !/^exitCode:\s*/.test(line) && !/^timedOut:\s*/.test(line))
    .map((line) => oneLine(line, 180))
    .filter(Boolean)
    .slice(0, 3)
  return lines.join("\n")
}
