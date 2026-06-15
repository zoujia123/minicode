import { useEffect, useMemo, useRef, useState } from "react"
import { createRoot } from "react-dom/client"

import type { AgentEvent } from "../../agent/events"
import type { SessionEvidence } from "../../session/evidence"
import type { UiFileSummary, UiProviderSummary, UiSessionSummary } from "../shared/api"
import { createUiApiClient, type ProviderConfigPayload } from "./api"
import { AppSidebar } from "./components/AppSidebar"
import { ChatPane } from "./components/ChatPane"
import { ConfigModal } from "./components/ConfigModal"
import { PermissionModal } from "./components/PermissionModal"
import { RightInspector } from "./components/RightInspector"
import { TopBar } from "./components/TopBar"
import { WorkbenchLayout } from "./components/WorkbenchLayout"
import { ENDPOINTS } from "./constants"
import { errorMessage, presetForBaseURL, sessionMessages, traceFromMessages } from "./helpers"
import type { ChatMessage, InspectorTab, PermissionView, StatusSummary, TraceItem } from "./types"
import "./styles.css"

declare global {
  interface Window {
    __PIXIU_UI_TOKEN__?: string
  }
}

function App() {
  const token = window.__PIXIU_UI_TOKEN__
  const api = useMemo(() => createUiApiClient(token ?? ""), [token])
  const [provider, setProvider] = useState<UiProviderSummary>()
  const [sessions, setSessions] = useState<UiSessionSummary[]>([])
  const [sessionId, setSessionId] = useState<string>()
  const [chatTitle, setChatTitle] = useState("New chat")
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState("")
  const [permissionMode, setPermissionMode] = useState("acceptEdits")
  const [runId, setRunId] = useState<string>()
  const [runStatus, setRunStatus] = useState("Ready")
  const [trace, setTrace] = useState<TraceItem[]>([])
  const [files, setFiles] = useState<UiFileSummary[]>([])
  const [preview, setPreview] = useState<{ path: string; content: string }>()
  const [evidence, setEvidence] = useState<SessionEvidence>()
  const [panelOpen, setPanelOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [inspectorCollapsed, setInspectorCollapsed] = useState(false)
  const [activeTab, setActiveTab] = useState<InspectorTab>("trace")
  const [configOpen, setConfigOpen] = useState(false)
  const [configNotice, setConfigNotice] = useState<{ text: string; kind?: "ok" | "error" }>({
    text: "Use env var mode to keep secrets out of pixiu.jsonc, or save a local key for quick setup. Responses redact secrets.",
  })
  const [providerForm, setProviderForm] = useState<ProviderConfigPayload>({
    baseURL: ENDPOINTS.siliconflow,
    model: "",
    credential: "apiKey",
    apiKeyEnv: "OPENAI_API_KEY",
  })
  const [endpointPreset, setEndpointPreset] = useState<keyof typeof ENDPOINTS | "custom">("siliconflow")
  const [permission, setPermission] = useState<PermissionView>()
  const [status, setStatus] = useState<StatusSummary>()
  const messageEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void refresh()
    void loadFiles()
  }, [])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" })
  }, [messages])

  async function refresh() {
    const nextStatus = await api.status()
    setProvider(nextStatus.provider)
    setStatus({
      cwd: nextStatus.cwd,
      workspace: nextStatus.workspace.workspaceDir,
      sessionsPath: nextStatus.sessionsPath,
      skills: nextStatus.skills.diagnostics,
      mcp: nextStatus.mcp,
      providerKeyPresent: nextStatus.provider.keyPresent,
    })
    setProviderForm((current) => ({
      ...current,
      baseURL: nextStatus.provider.baseURL ?? "",
      model: nextStatus.provider.model ?? "",
      credential: nextStatus.provider.credential === "apiKeyEnv" ? "apiKeyEnv" : "apiKey",
      apiKeyEnv: nextStatus.provider.apiKeyEnv ?? "OPENAI_API_KEY",
      apiKey: "",
    }))
    setEndpointPreset(presetForBaseURL(nextStatus.provider.baseURL))
    if (!nextStatus.provider.keyPresent) {
      setConfigNotice({ text: "Add an API key to start chatting." })
      setConfigOpen(true)
    }
    await loadSessions()
  }

  async function loadSessions() {
    const data = await api.listSessions()
    setSessions(data.sessions.slice(0, 18))
  }

  async function loadSession(id: string) {
    const data = await api.getSession(id)
    setSessionId(data.session.id)
    setChatTitle(data.session.title ?? "Chat")
    setMessages(sessionMessages(data.messages))
    setTrace(traceFromMessages(data.messages))
    setEvidence(data.evidence)
    setFiles(data.files)
    setPreview(undefined)
    await loadSessions()
  }

  async function createSession(title = "New chat") {
    const data = await api.createSession({ title })
    setSessionId(data.session.id)
    setChatTitle(data.session.title ?? "New chat")
    setMessages([])
    setTrace([])
    setEvidence(undefined)
    setFiles(data.files)
    setPreview(undefined)
    await loadSessions()
    return data.session.id
  }

  async function ensureSession(title?: string) {
    if (sessionId) return sessionId
    return await createSession(title)
  }

  async function loadFiles(seed?: UiFileSummary[]) {
    if (seed) {
      setFiles(seed)
      return
    }
    if (!sessionId) return
    const data = await api.listFiles(sessionId)
    setFiles(data.files)
  }

  async function previewFile(path: string) {
    if (!sessionId) return
    const data = await api.previewFile(sessionId, path)
    setPreview({ path: data.path, content: data.content })
    setActiveTab("files")
    setPanelOpen(true)
  }

  async function uploadFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    const id = await ensureSession("Uploaded files")
    const data = await api.uploadFiles(id, fileList)
    setFiles(data.files)
    pushTrace({ title: "Uploaded files", detail: data.files.map((file) => file.path).join("\n") })
    setPrompt((current) => {
      const prefix = current.trim() ? `${current.trim()}\n` : ""
      return `${prefix}Uploaded files:\n${data.files.map((file) => `- ${file.path}`).join("\n")}`
    })
    setActiveTab("files")
    setPanelOpen(true)
  }

  async function saveProvider(closeAfter: boolean) {
    setConfigNotice({ text: "Saving..." })
    const baseURL = endpointPreset === "custom" ? providerForm.baseURL : ENDPOINTS[endpointPreset]
    const saved = await api.saveProvider({ ...providerForm, baseURL })
    setProvider(saved.provider)
    setProviderForm((current) => ({ ...current, apiKey: "" }))
    setConfigNotice({ text: "Provider saved.", kind: "ok" })
    await refresh()
    if (closeAfter) setConfigOpen(false)
  }

  async function testProvider() {
    try {
      await saveProvider(false)
      setConfigNotice({ text: "Testing provider..." })
      const result = await api.testProvider()
      setConfigNotice({ text: `Provider test passed: ${result.text || result.model || "ok"}`, kind: "ok" })
    } catch (error) {
      setConfigNotice({ text: errorMessage(error), kind: "error" })
    }
  }

  async function sendPrompt() {
    const message = prompt.trim()
    if (!message || runId) return
    if (provider && !provider.keyPresent) {
      setConfigNotice({ text: "Add an API key before sending." })
      setConfigOpen(true)
      return
    }
    setPrompt("")
    setMessages((current) => [...current, { role: "user", text: message }, { role: "assistant", text: "Thinking...", pending: true }])
    setRunStatus("Starting")
    try {
      const started = await api.startRun({ message, ...(sessionId ? { sessionId } : {}), permissionMode })
      setRunId(started.runId)
      await subscribeRun(started.runId)
    } catch (error) {
      replacePending(`Error: ${errorMessage(error)}`)
      pushTrace({ title: "Error", detail: errorMessage(error), failed: true })
      setPanelOpen(true)
    } finally {
      setRunId(undefined)
      setRunStatus("Ready")
    }
  }

  function subscribeRun(id: string) {
    return new Promise<void>((resolve, reject) => {
      const source = api.eventSource(id)
      source.addEventListener("run", (event) => {
        const data = JSON.parse(event.data) as { status?: string }
        setRunStatus(data.status ?? "Running")
      })
      source.addEventListener("agent_event", (event) => applyAgentEvent(JSON.parse(event.data) as AgentEvent))
      source.addEventListener("permission_request", (event) => {
        setPermission(JSON.parse(event.data) as PermissionView)
      })
      source.addEventListener("permission_result", (event) => {
        pushTrace({ title: "permission", detail: JSON.stringify(JSON.parse(event.data), null, 2), kind: "permission" })
      })
      source.addEventListener("result", (event) => {
        const result = JSON.parse(event.data) as { sessionId?: string; answer?: string; status: string; finishReason?: string }
        source.close()
        if (result.sessionId) {
          setSessionId(result.sessionId)
          void api.getSession(result.sessionId).then((detail) => {
            setChatTitle(detail.session.title ?? "Chat")
            setEvidence(detail.evidence)
            setFiles(detail.files)
          })
        }
        replacePending(result.answer || "(no answer)")
        pushTrace({
          title: "Run finished",
          detail: `status: ${result.status}\nfinishReason: ${result.finishReason ?? "unknown"}\nsessionId: ${result.sessionId ?? "new"}`,
        })
        void loadSessions()
        resolve()
      })
      source.onerror = () => {
        source.close()
        reject(new Error("Run event stream disconnected."))
      }
    })
  }

  function applyAgentEvent(event: AgentEvent) {
    if (event.type === "session_created") {
      setSessionId(event.sessionId)
      setChatTitle("Working chat")
      void loadSessions()
    }
    if (event.type === "llm_text_delta") appendAssistantDelta(event.text)
    if (event.type === "message") replacePending(event.content)
    if (event.type === "context_usage") setRunStatus(`${event.source} tokens ${event.inputTokens}`)
    if (event.type === "assistant_progress_delta") pushTrace({ title: "progress", detail: event.text, kind: "thinking" })
    if (event.type === "tool_call") {
      pushTrace({ title: `tool ${event.name}`, detail: JSON.stringify(event.input, null, 2), kind: "call" })
      setActiveTab("trace")
      setPanelOpen(true)
    }
    if (event.type === "tool_result") pushTrace({ title: `${event.ok ? "ok" : "failed"} ${event.name}`, detail: event.content, kind: "result", failed: !event.ok })
    if (event.type === "error") pushTrace({ title: "agent error", detail: event.message, failed: true })
    if (event.type === "finish") setSessionId(event.sessionId)
  }

  function appendAssistantDelta(text: string) {
    setMessages((current) => {
      const next = [...current]
      const last = next[next.length - 1]
      if (!last || last.role !== "assistant") return [...next, { role: "assistant", text }]
      next[next.length - 1] = { role: "assistant", text: last.pending ? text : `${last.text}${text}` }
      return next
    })
  }

  function replacePending(text: string) {
    setMessages((current) => {
      const next = [...current]
      const last = next[next.length - 1]
      if (!last || last.role !== "assistant") return [...next, { role: "assistant", text }]
      next[next.length - 1] = { role: "assistant", text }
      return next
    })
  }

  function pushTrace(item: Omit<TraceItem, "id">) {
    setTrace((current) => [{ id: `${Date.now()}_${Math.random().toString(36).slice(2)}`, ...item }, ...current].slice(0, 80))
  }

  async function answerPermission(action: "allow" | "deny", scope: "once" | "sessionSimilar") {
    if (!permission) return
    const id = permission.id
    setPermission(undefined)
    await api.answerPermission(id, { action, scope })
  }

  async function cancelRun() {
    if (!runId) return
    await api.cancelRun(runId)
    setRunStatus("Cancelling")
  }

  const providerReady = provider?.keyPresent === true

  function openInspector(tab: InspectorTab) {
    setActiveTab(tab)
    setInspectorCollapsed(false)
    setPanelOpen(true)
  }

  return (
    <WorkbenchLayout
      sidebarCollapsed={sidebarCollapsed}
      inspectorCollapsed={inspectorCollapsed}
      sidebar={
        <AppSidebar
          sessions={sessions}
          sessionId={sessionId}
          providerReady={providerReady}
          workspace={status?.workspace}
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => setSidebarCollapsed((collapsed) => !collapsed)}
          onNewChat={() => void createSession("New chat")}
          onConfigureApi={() => setConfigOpen(true)}
          onLoadSession={(id) => void loadSession(id)}
        />
      }
      topBar={
        <TopBar
          chatTitle={chatTitle}
          cwd={status?.cwd}
          model={provider?.model}
          permissionMode={permissionMode}
          runStatus={runStatus}
          providerReady={providerReady}
          inspectorCollapsed={inspectorCollapsed}
          onOpenStatus={() => openInspector("status")}
          onOpenActivity={() => openInspector("trace")}
          onConfigureApi={() => setConfigOpen(true)}
        />
      }
      configModal={
        <ConfigModal
          open={configOpen}
          close={() => setConfigOpen(false)}
          notice={configNotice}
          form={providerForm}
          setForm={setProviderForm}
          endpointPreset={endpointPreset}
          setEndpointPreset={setEndpointPreset}
          save={() => void saveProvider(true)}
          test={() => void testProvider()}
        />
      }
      permissionModal={<PermissionModal permission={permission} answer={(action, scope) => void answerPermission(action, scope)} />}
    >
      <ChatPane
        messages={messages}
        messageEndRef={messageEndRef}
        setPrompt={setPrompt}
        prompt={prompt}
        sendPrompt={sendPrompt}
        fileInputRef={fileInputRef}
        uploadFiles={uploadFiles}
        permissionMode={permissionMode}
        setPermissionMode={setPermissionMode}
        runStatus={runStatus}
        runId={runId}
        cancelRun={cancelRun}
      />
      <RightInspector
        open={panelOpen}
        collapsed={inspectorCollapsed}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        close={() => { setPanelOpen(false); setInspectorCollapsed(true) }}
        trace={trace}
        files={files}
        preview={preview}
        evidence={evidence}
        status={status}
        onPreview={(path) => void previewFile(path)}
      />
    </WorkbenchLayout>
  )
}

const root = document.getElementById("root")
if (root) createRoot(root).render(<App />)
