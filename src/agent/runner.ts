import { createID } from "../shared/id"
import { stripToolActivityInput } from "../activity/format"
import { formatError } from "../shared/errors"
import type { LLMClient, LLMMessage } from "../llm/types"
import type { SessionRecord, SessionStore } from "../session/types"
import { toLLMMessages } from "../session/format"
import type { ToolContext } from "../tools/types"
import type { ToolRegistry } from "../tools/registry"
import type { AgentEvent } from "./events"
import { approximateTokens, compactMessages } from "./compaction"
import type { JsonObject, JsonValue } from "../shared/json"
import type { TodoItem, TodoPriority, TodoStatus } from "../todo/types"

export type AgentRunnerOptions = {
  llm: LLMClient
  tools: ToolRegistry
  sessions: SessionStore
  toolContext: Omit<ToolContext, "sessionId">
  createSessionWorkspace?: (sessionId: string) => Promise<{ cwd: string; metadata?: JsonObject }> | { cwd: string; metadata?: JsonObject }
  toolContextForSession?: (session: SessionRecord) => Omit<ToolContext, "sessionId">
  model: string
  systemPrompt: string
  toolNames?: string[]
  maxSteps: number
  signal?: AbortSignal
  compaction?: {
    maxApproxTokens: number
    keepRecentMessages: number
  }
  managedTools?: {
    autoInstall?: "off" | "ask" | "allow"
    installAgentReach?: (input: { cwd: string; signal?: AbortSignal }) => Promise<{
      exitCode: number | null
      stdout: string
      stderr: string
    }>
  }
}

export class AgentRunner {
  constructor(private readonly options: AgentRunnerOptions) {}

  async *run(input: { message: string; sessionId?: string; title?: string; signal?: AbortSignal }): AsyncIterable<AgentEvent> {
    const session =
      input.sessionId && (await this.options.sessions.getSession(input.sessionId))
        ? (await this.options.sessions.getSession(input.sessionId))!
        : await this.createSession(input)

    yield { type: "session_created", sessionId: session.id }

    await this.options.sessions.appendMessage({
      sessionId: session.id,
      role: "user",
      parts: [{ type: "text", text: input.message }],
    })

    const continuationMessages: LLMMessage[] = []
    const skillRouteState = createSkillRouteState()
    let draftContinuations = 0
    for (let step = 0; step < this.options.maxSteps; step += 1) {
      const storedMessages = await this.options.sessions.readMessages(session.id)
      const currentSession = (await this.options.sessions.getSession(session.id)) ?? session
      const compacted = this.options.compaction ? compactMessages(storedMessages, this.options.compaction) : { messages: storedMessages }
      if (compacted.summary) {
        const nextSummary = mergeSessionSummary(currentSession.summary, compacted.summary)
        await this.options.sessions.updateSession(session.id, { summary: nextSummary })
        currentSession.summary = nextSummary
      }

      const messages: LLMMessage[] = [
        {
          role: "system",
          content: [this.options.systemPrompt, AGENT_COMPLETION_PROTOCOL, currentSession.summary ? `Conversation summary:\n${currentSession.summary}` : ""]
            .filter(Boolean)
            .join("\n\n"),
        },
        ...toLLMMessages(compacted.messages),
        ...continuationMessages,
      ]

      yield { type: "context_usage", inputTokens: estimateLLMInputTokens(messages), source: "estimated" }

      const toolCalls = []
      let assistantText = ""
      let progressYielded = false
      try {
        for await (const event of this.options.llm.stream(
          {
            model: this.options.model,
            messages,
            tools: this.options.tools.toLLMTools(this.options.toolNames),
            toolChoice: "auto",
          },
          input.signal ?? this.options.signal,
        )) {
          if (event.type === "text_delta") {
            assistantText += event.text
          }
          if (event.type === "usage") {
            const inputTokens = event.usage.inputTokens ?? event.usage.totalTokens
            if (inputTokens !== undefined) {
              yield {
                type: "context_usage",
                inputTokens,
                ...(event.usage.outputTokens !== undefined ? { outputTokens: event.usage.outputTokens } : {}),
                source: "provider",
              }
            }
          }
          if (event.type === "tool_call") {
            if (!progressYielded && assistantText.trim()) {
              progressYielded = true
              yield { type: "assistant_progress_delta", text: assistantText.trim() }
            }
            toolCalls.push(event.call)
            yield { type: "tool_call", id: event.call.id, name: event.call.name, input: event.call.input }
          }
          if (event.type === "error") {
            await this.options.sessions.appendMessage({
              sessionId: session.id,
              role: "assistant",
              parts: [
                ...(assistantText ? [{ type: "text" as const, text: assistantText }] : []),
                { type: "error", message: event.error, ...(event.code ? { code: event.code } : {}) },
              ],
            })
            yield { type: "error", message: event.error }
            yield { type: "finish", reason: "error", sessionId: session.id }
            return
          }
        }
      } catch (error) {
        if ((input.signal ?? this.options.signal)?.aborted || isAbortError(error)) {
          yield { type: "finish", reason: "cancelled", sessionId: session.id }
          return
        }
        const message = formatError(error)
        await this.options.sessions.appendMessage({
          sessionId: session.id,
          role: "assistant",
          parts: [{ type: "error", message }],
        })
        yield { type: "error", message }
        yield { type: "finish", reason: "error", sessionId: session.id }
        return
      }

      if (toolCalls.length) {
        await this.options.sessions.appendMessage({
          sessionId: session.id,
          role: "assistant",
          parts: [
            ...(assistantText ? [{ type: "text" as const, text: assistantText }] : []),
            ...toolCalls.map((call) => ({ type: "tool_call" as const, id: call.id, name: call.name, input: stripToolActivityInput(call.input) })),
          ],
        })
        continuationMessages.length = 0
        draftContinuations = 0

        for (const call of toolCalls) {
          const signal = input.signal ?? this.options.signal
          if (signal?.aborted) {
            yield { type: "finish", reason: "cancelled", sessionId: session.id }
            return
          }
          const baseToolContext = this.options.toolContextForSession?.(session) ?? this.options.toolContext
          const toolContext = {
            ...baseToolContext,
            sessionId: session.id,
          }
          const cleanInput = stripToolActivityInput(call.input)
          const blockedResult = skillRouteGuardResult(skillRouteState, call.name, cleanInput)
          const result = blockedResult ?? await this.options.tools.execute(
            call.name,
            cleanInput,
            signal ? { ...toolContext, signal } : toolContext,
          )
          updateSkillRouteState(skillRouteState, call.name, cleanInput, result.ok, result.content, result.metadata)
          if (signal?.aborted) {
            yield { type: "finish", reason: "cancelled", sessionId: session.id }
            return
          }
          await this.options.sessions.appendMessage({
            sessionId: session.id,
            role: "tool",
            parts: [{ type: "tool_result", toolCallId: call.id, name: call.name, result }],
          })
          const toolEvent = {
            type: "tool_result",
            id: call.id,
            name: call.name,
            ok: result.ok,
            content: result.content,
          } satisfies AgentEvent
          yield result.metadata ? { ...toolEvent, metadata: result.metadata } : toolEvent
          const todoEvent = todoUpdatedEvent(session.id, result.ok, result.metadata)
          if (todoEvent) {
            await this.options.sessions.updateTodos(session.id, todoEvent.todos)
            yield todoEvent
          }
          const autoInstallEvents = await this.autoInstallManagedToolIfAllowed(skillRouteState, session, input.signal ?? this.options.signal)
          for (const autoInstallEvent of autoInstallEvents) yield autoInstallEvent
        }
        continue
      }

      const finalAnswer = parseFinalAnswer(assistantText)
      if (finalAnswer !== undefined) {
        await this.options.sessions.appendMessage({
          sessionId: session.id,
          role: "assistant",
          parts: [{ type: "text", text: finalAnswer }],
        })
        if (finalAnswer) yield { type: "llm_text_delta", text: finalAnswer }
        yield { type: "message", role: "assistant", content: finalAnswer }
        yield { type: "finish", reason: "stop", sessionId: session.id }
        return
      }

      if (!assistantText.trim()) {
        const message = "LLM returned an empty response without tool calls."
        await this.options.sessions.appendMessage({
          sessionId: session.id,
          role: "assistant",
          parts: [{ type: "error", message, code: "EMPTY_LLM_RESPONSE" }],
        })
        yield { type: "error", message }
        yield { type: "finish", reason: "error", sessionId: session.id }
        return
      }

      if (draftContinuations >= 1) {
        const fallbackAnswer = parseFinalAnswer(assistantText) ?? assistantText.trim()
        await this.options.sessions.appendMessage({
          sessionId: session.id,
          role: "assistant",
          parts: [{ type: "text", text: fallbackAnswer }],
        })
        yield { type: "llm_text_delta", text: fallbackAnswer }
        yield { type: "message", role: "assistant", content: fallbackAnswer }
        yield { type: "finish", reason: "stop", sessionId: session.id }
        return
      }

      draftContinuations += 1
      continuationMessages.push(
        { role: "assistant", content: assistantText },
        {
          role: "user",
          content:
            "Continue the task. Your previous response was not a final answer because it did not start with FINAL:. If work remains, call the appropriate tool now. If the task is already fully answered, reply with FINAL: followed by the answer.",
        },
      )
    }

    const message = `Stopped after maxSteps=${this.options.maxSteps}`
    await this.options.sessions.appendMessage({
      sessionId: session.id,
      role: "assistant",
      id: createID("msg"),
      parts: [{ type: "error", message, code: "MAX_STEPS" }],
    })
    yield { type: "error", message }
    yield { type: "finish", reason: "max_steps", sessionId: session.id }
  }

  private async createSession(input: { message: string; title?: string }) {
    const id = createID("session")
    const workspace = await this.options.createSessionWorkspace?.(id)
    return this.options.sessions.create({
      id,
      cwd: workspace?.cwd ?? this.options.toolContext.cwd,
      title: input.title ?? input.message.slice(0, 60),
      ...(workspace?.metadata ? { metadata: workspace.metadata } : {}),
    })
  }

  private async autoInstallManagedToolIfAllowed(
    state: SkillRouteState,
    session: SessionRecord,
    signal: AbortSignal | undefined,
  ): Promise<AgentEvent[]> {
    const blocker = state.blockers.find(
      (item): item is Extract<SkillRouteBlocker, { kind: "missing_managed_tool" }> =>
        item.kind === "missing_managed_tool" && item.skill === "agent-reach" && item.tool === "agent-reach",
    )
    if (!blocker || blocker.autoInstallAttempted) return []
    if (this.options.managedTools?.autoInstall !== "allow") return []
    const installAgentReach = this.options.managedTools.installAgentReach
    if (!installAgentReach) return []

    blocker.autoInstallAttempted = true
    const baseToolContext = this.options.toolContextForSession?.(session) ?? this.options.toolContext
    const id = createID("call")
    const input = {
      command: "pixiu tools install agent-reach --yes",
      purpose: "安装 Agent Reach 到 Pixiu 托管工具环境",
      _activity: {
        kind: "shell",
        title: "安装 Agent Reach",
        summary: "Installing Agent Reach into the Pixiu managed tool environment.",
        target: "agent-reach",
      },
    } satisfies JsonObject
    await this.options.sessions.appendMessage({
      sessionId: session.id,
      role: "assistant",
      parts: [{ type: "tool_call", id, name: "shell", input: stripToolActivityInput(input) }],
    })

    const install = await installAgentReach({ cwd: baseToolContext.cwd, ...(signal ? { signal } : {}) })
    const content = [install.stdout.trim(), install.stderr.trim()].filter(Boolean).join("\n") || `exitCode: ${install.exitCode ?? -1}`
    const ok = install.exitCode === 0
    const result = {
      ok,
      content,
      metadata: {
        command: input.command,
        exitCode: install.exitCode ?? -1,
        managedTool: "agent-reach",
        managedToolAutoInstall: true,
        blocker,
        activity: {
          kind: "shell",
          title: ok ? "Installed Agent Reach" : "Agent Reach install failed",
          summary: ok
            ? "Installed Agent Reach into the Pixiu managed tool environment."
            : "Could not install Agent Reach into the Pixiu managed tool environment.",
          command: input.command,
          target: "agent-reach",
          status: ok ? "success" : "error",
          details: {
            exitCode: install.exitCode ?? -1,
            managedTool: "agent-reach",
            autoInstall: true,
          },
        },
      },
    } satisfies {
      ok: boolean
      content: string
      metadata: JsonObject
    }

    updateSkillRouteState(state, "shell", stripToolActivityInput(input), result.ok, result.content, result.metadata)
    await this.options.sessions.appendMessage({
      sessionId: session.id,
      role: "tool",
      parts: [{ type: "tool_result", toolCallId: id, name: "shell", result }],
    })
    return [
      { type: "tool_call", id, name: "shell", input },
      { type: "tool_result", id, name: "shell", ok: result.ok, content: result.content, metadata: result.metadata },
    ]
  }
}

type SkillRouteState = {
  loadedSkills: Set<string>
  blockers: SkillRouteBlocker[]
}

type SkillRouteBlocker =
  | {
      kind: "missing_managed_tool"
      skill: string
      tool: string
      autoInstallAttempted?: boolean
    }
  | {
      kind: "user_action_required"
      skill: string
      category: "auth" | "captcha" | "approval" | "input" | "secret" | "environment" | "other"
      title: string
      reason: string
      instructions: string[]
      resumeHint: string
      signal: string
      tool?: string
    }

function createSkillRouteState(): SkillRouteState {
  return {
    loadedSkills: new Set(),
    blockers: [],
  }
}

function skillRouteGuardResult(state: SkillRouteState, toolName: string, input: JsonObject) {
  const blocker = activeSkillRouteBlocker(state)
  if (!blocker) return undefined
  if (toolName === "request_user_action") return undefined
  if (blocker.kind === "missing_managed_tool" && isAllowedAgentReachManagedInstall(toolName, input)) return undefined
  if (blocker.kind === "user_action_required") {
    return {
      ok: false,
      content: [
        blocker.title,
        blocker.reason,
        "Use `request_user_action` with the provided instructions instead of continuing with workaround commands.",
      ].join("\n"),
      metadata: {
        skillRouteBlocked: true,
        blocker,
        userActionRequired: true,
        category: blocker.category,
        title: blocker.title,
        reason: blocker.reason,
        instructions: blocker.instructions,
        resumeHint: blocker.resumeHint,
        activity: {
          kind: "permission",
          title: blocker.title,
          summary: blocker.reason,
          status: "skipped",
          details: {
            blocker,
            allowedNext: ["request_user_action"],
          },
        },
      },
    }
  }
  return {
    ok: false,
    content: [
      "Agent Reach is missing from the active tool environment.",
      "Use `request_user_action` to ask for installation approval, or run `pixiu tools install agent-reach --yes` to install it into Pixiu's managed tool environment.",
      "Do not continue with ad hoc scraping, private endpoint probing, browser automation experiments, or unrelated fallback commands while this blocker is active.",
    ].join("\n"),
    metadata: {
      skillRouteBlocked: true,
      blocker,
      userActionRequired: true,
      category: "environment",
      title: "需要安装 Agent Reach",
      reason: "Agent Reach 当前未安装到 Pixiu managed tool environment。",
      instructions: [
        "允许 Pixiu 安装 Agent Reach 到 managed tool environment，或手动运行 `pixiu tools install agent-reach --yes`。",
        "安装完成后回复继续，Pixiu 会重新运行 `agent-reach doctor --json`。",
      ],
      resumeHint: "完成安装后回复“继续”。",
      activity: {
        kind: "permission",
        title: "需要安装 Agent Reach",
        summary: "Agent Reach 缺失，等待安装授权或 managed env 安装。",
        status: "skipped",
        details: {
          blocker,
          allowedNext: ["request_user_action", "pixiu tools install agent-reach --yes"],
        },
      },
    },
  }
}

function activeSkillRouteBlocker(state: SkillRouteState) {
  return (
    state.blockers.find((item) => item.kind === "user_action_required" && item.skill === "agent-reach") ??
    state.blockers.find((item) => item.kind === "missing_managed_tool" && item.skill === "agent-reach")
  )
}

function updateSkillRouteState(
  state: SkillRouteState,
  toolName: string,
  input: JsonObject,
  ok: boolean,
  content: string,
  metadata: JsonObject | undefined,
) {
  if (toolName === "skill" && ok) {
    const skillName = stringJsonValue(metadata?.name) ?? stringJsonValue(input.name)
    if (skillName) state.loadedSkills.add(skillName)
  }
  if (toolName !== "shell") return
  const command = stringJsonValue(metadata?.command) ?? stringJsonValue(input.command)
  if (!command) return
  if (ok && (isAgentReachCommand(command) || isAllowedAgentReachManagedInstall(toolName, input))) {
    state.blockers = state.blockers.filter((item) => !(item.kind === "missing_managed_tool" && item.skill === "agent-reach" && item.tool === "agent-reach"))
    return
  }
  if (!state.loadedSkills.has("agent-reach")) return
  const userActionBlocker = detectUserActionBlocker(content, command)
  if (userActionBlocker) {
    upsertSkillRouteBlocker(state, userActionBlocker)
    return
  }
  if (!isAgentReachCommand(command)) return
  if (!isCommandNotFoundResult(content, metadata)) return
  upsertSkillRouteBlocker(state, { kind: "missing_managed_tool", skill: "agent-reach", tool: "agent-reach" })
}

function isAllowedAgentReachManagedInstall(toolName: string, input: JsonObject) {
  if (toolName !== "shell") return false
  const command = stringJsonValue(input.command)
  return Boolean(command && /\bpixiu\s+tools\s+install\s+agent-reach\b/.test(command))
}

function isAgentReachCommand(command: string) {
  return /(^|[\s;&|()])agent-reach(\s|$)/.test(command) || /\bcommand\s+-v\s+agent-reach\b/.test(command)
}

function isCommandNotFoundResult(content: string, metadata: JsonObject | undefined) {
  const exitCode = typeof metadata?.exitCode === "number" ? metadata.exitCode : undefined
  return exitCode === 127 || /(?:agent-reach|command): not found|not recognized/i.test(content)
}

function detectUserActionBlocker(content: string, command: string): SkillRouteBlocker | undefined {
  const text = [command, content].join("\n")
  if (/(captcha|验证码|安全验证|2fa|mfa|two[-\s]?factor|verification code|短信验证码)/i.test(text)) {
    return userActionBlocker({
      category: "captcha",
      signal: "captcha_or_2fa_required",
      title: "需要完成验证码或二次验证",
      reason: "平台返回了验证码、CAPTCHA 或 2FA 要求，Pixiu 不能独自完成该账号操作。",
      instructions: [
        "在对应平台或 Agent Reach 推荐的登录/授权界面完成验证码、CAPTCHA 或 2FA。",
        "不要把验证码、Cookie 或账号密码直接粘贴到普通对话里；优先使用 Agent Reach 的配置/登录命令保存本地授权。",
        "完成后回复“继续”，Pixiu 会重新检查可用状态并继续任务。",
      ],
    })
  }
  if (/(qr code|scan.*qr|扫码|二维码)/i.test(text)) {
    return userActionBlocker({
      category: "auth",
      signal: "qr_scan_required",
      title: "需要扫码登录或授权",
      reason: "平台要求扫码登录或浏览器授权，Pixiu 不能代替用户完成该账号操作。",
      instructions: [
        "在本地浏览器、二维码界面或 Agent Reach 推荐后端中完成扫码登录。",
        "如果当前服务器无法显示二维码，请在有浏览器能力的本地环境完成一次登录或导入授权。",
        "完成后回复“继续”，Pixiu 会重新运行诊断并继续。",
      ],
    })
  }
  if (/(cookie|session).*(missing|required|not found|expired|invalid)|(?:missing|required|not found|expired|invalid).*(cookie|session)/i.test(text)) {
    return userActionBlocker({
      category: "auth",
      signal: "cookie_or_session_required",
      title: "需要登录态或 Cookie",
      reason: "平台访问需要有效登录态、Cookie 或 session，Pixiu 不能自行获取用户账号授权。",
      instructions: [
        "通过 Agent Reach 的配置/登录流程导入对应平台的本地授权，或在本地完成一次登录。",
        "只使用专用小号或你确认可以授权的账号；不要在普通聊天里暴露完整 Cookie。",
        "完成后回复“继续”，Pixiu 会重新检查平台后端状态。",
      ],
    })
  }
  if (/(not logged in|login required|please log in|please login|run [`']?[^`'\n]*login[`']?|unauthorized|authentication required|auth required|需要登录|请先登录|未登录)/i.test(text)) {
    return userActionBlocker({
      category: "auth",
      signal: "login_required",
      title: "需要登录或授权",
      reason: "平台返回了未登录或需要授权的状态，Pixiu 不能绕过账号登录要求。",
      instructions: [
        "在 Agent Reach 推荐的后端或对应平台客户端完成登录/授权。",
        "如果需要扫码、Cookie 或浏览器扩展授权，请在本地完成，不要尝试私有接口绕过。",
        "完成后回复“继续”，Pixiu 会重新运行诊断并继续任务。",
      ],
    })
  }
  return undefined
}

function userActionBlocker(input: Omit<Extract<SkillRouteBlocker, { kind: "user_action_required" }>, "kind" | "skill" | "resumeHint"> & { resumeHint?: string }): SkillRouteBlocker {
  return {
    kind: "user_action_required",
    skill: "agent-reach",
    resumeHint: "完成后回复“继续”。",
    ...input,
  }
}

function upsertSkillRouteBlocker(state: SkillRouteState, blocker: SkillRouteBlocker) {
  if (state.blockers.some((item) => sameSkillRouteBlocker(item, blocker))) return
  state.blockers.push(blocker)
}

function sameSkillRouteBlocker(left: SkillRouteBlocker, right: SkillRouteBlocker) {
  if (left.kind !== right.kind || left.skill !== right.skill) return false
  if (left.kind === "missing_managed_tool" && right.kind === "missing_managed_tool") return left.tool === right.tool
  if (left.kind === "user_action_required" && right.kind === "user_action_required") return left.signal === right.signal
  return false
}

function stringJsonValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

const AGENT_COMPLETION_PROTOCOL = [
  "Completion protocol:",
  "If the user asks for work that requires files, commands, live data, or other external state, call tools instead of describing what you will do.",
  "For shell calls, include `purpose` when the command would otherwise render as noisy developer output. `purpose` is a concise user-visible intent, not a verified result, and it is not passed to the shell process.",
  "When calling a tool, you may include a Pixiu-only `_activity` object to describe the concise user-visible intent of that tool call. `_activity.title` should describe what you are trying to do, not the raw command. Keep it factual, omit secrets, and use it only when it improves readability. The runtime strips `_activity` before executing tools.",
  "When a loaded Skill gives hard stop, confirmation, install, credential, or user-collaboration rules, treat those rules as execution constraints for that Skill route. Do not route around them with generic scripts or alternate tools unless the user explicitly chooses that fallback.",
  "If the task is blocked by a required external user action such as login, QR scan, captcha, 2FA, browser authorization, cookie/session import, API key/token entry, account permission changes, or a user decision, call request_user_action with concrete instructions and a resume hint instead of repeatedly trying workaround commands.",
  "Examples: shell {\"command\":\"npm run typecheck\",\"purpose\":\"Running TypeScript type check\",\"_activity\":{\"kind\":\"shell\",\"title\":\"Running TypeScript type check\",\"summary\":\"Checking the project for TypeScript errors\"}}; shell {\"command\":\"agent-reach doctor --json\",\"purpose\":\"检查 Agent Reach 可用状态\",\"_activity\":{\"kind\":\"shell\",\"title\":\"检查 Agent Reach 可用状态\"}}; read {\"path\":\"src/agent/runner.ts\",\"_activity\":{\"kind\":\"file\",\"title\":\"Reading agent runner implementation\",\"summary\":\"Inspecting how Pixiu handles tool events\"}}.",
  "Only produce the final user-facing answer when the task is complete.",
  "Every final answer must begin with `FINAL:`. Text that does not begin with `FINAL:` is treated as a draft once; after one continuation request, the runner may use the next text response as the answer to avoid an endless loop.",
].join("\n")

function parseFinalAnswer(text: string) {
  const trimmed = text.trim()
  const match = trimmed.match(/(?:^|\n)(?:\*\*)?FINAL\s*[:：](?:\*\*)?\s*([\s\S]*)$/i)
  return match ? match[1]?.trimStart() ?? "" : undefined
}

function mergeSessionSummary(existing: string | undefined, next: string) {
  const current = existing?.trim()
  const incoming = next.trim()
  if (!current) return incoming
  if (!incoming) return current
  if (incoming.includes(current)) return incoming
  if (current.includes(incoming)) return current
  return `${current}\n\n${incoming}`
}

function isAbortError(error: unknown) {
  if (!error || typeof error !== "object") return false
  const item = error as { name?: unknown; code?: unknown }
  return item.name === "AbortError" || item.code === "ABORT_ERR" || item.code === "ERR_ABORTED"
}

function estimateLLMInputTokens(messages: LLMMessage[]) {
  return messages.reduce((total, message) => {
    const toolCallTokens = message.toolCalls?.reduce((sum, call) => sum + approximateTokens(`${call.name} ${JSON.stringify(call.input)}`), 0) ?? 0
    return total + approximateTokens(`${message.role}\n${message.content}`) + toolCallTokens
  }, 0)
}

function todoUpdatedEvent(sessionId: string, ok: boolean, metadata: JsonObject | undefined): Extract<AgentEvent, { type: "todo_updated" }> | undefined {
  if (!ok) return undefined
  const todos = todosFromMetadata(metadata)
  if (!todos) return undefined
  const currentTodo = todos.find((todo) => todo.status === "in_progress")
  return {
    type: "todo_updated",
    sessionId,
    todos,
    ...(currentTodo ? { currentTodoId: currentTodo.id } : {}),
  }
}

function todosFromMetadata(metadata: JsonObject | undefined): TodoItem[] | undefined {
  const value = metadata?.todos
  if (!Array.isArray(value)) return undefined
  const todos: TodoItem[] = []
  for (const item of value) {
    const todo = todoFromJson(item)
    if (!todo) return undefined
    todos.push(todo)
  }
  return todos
}

function todoFromJson(value: JsonValue): TodoItem | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const id = value.id
  const content = value.content
  const status = value.status
  const priority = value.priority
  if (typeof id !== "string" || typeof content !== "string") return undefined
  if (!isTodoStatus(status) || !isTodoPriority(priority)) return undefined
  return { id, content, status, priority }
}

function isTodoStatus(value: JsonValue | undefined): value is TodoStatus {
  return value === "pending" || value === "in_progress" || value === "completed" || value === "cancelled"
}

function isTodoPriority(value: JsonValue | undefined): value is TodoPriority {
  return value === "high" || value === "medium" || value === "low"
}
