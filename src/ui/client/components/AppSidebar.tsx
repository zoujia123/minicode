import type { UiSessionSummary } from "../../shared/api"
import { shortDate } from "../helpers"

function SidebarToggleIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" />
      <path d="M10 5v14" />
    </svg>
  )
}

function NewChatIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5H7a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-5" />
      <path d="M14 4h6v6" />
      <path d="M10 14 20 4" />
    </svg>
  )
}

function ApiIcon() {
  return (
    <svg className="rail-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 4v4" />
      <path d="M12 16v4" />
      <path d="M4 12h4" />
      <path d="M16 12h4" />
      <circle cx="12" cy="12" r="4" />
    </svg>
  )
}

export function AppSidebar({
  sessions,
  sessionId,
  providerReady,
  workspace,
  collapsed,
  onToggleCollapsed,
  onNewChat,
  onConfigureApi,
  onLoadSession,
}: {
  sessions: UiSessionSummary[]
  sessionId: string | undefined
  providerReady: boolean
  workspace: string | undefined
  collapsed: boolean
  onToggleCollapsed(): void
  onNewChat(): void
  onConfigureApi(): void
  onLoadSession(sessionId: string): void
}) {
  return (
    <aside className="sidebar workbench-sidebar">
      <div className="brand">
        <div className="brand-mark">P</div>
        <div className="brand-text">Pixiu</div>
        <button className="icon-button sidebar-toggle" type="button" title={collapsed ? "Expand sidebar" : "Collapse sidebar"} onClick={onToggleCollapsed}>
          <SidebarToggleIcon />
        </button>
      </div>
      <div className="sidebar-actions">
        <button className="side-button" onClick={onNewChat} title="New chat">
          <span className="side-icon"><NewChatIcon /></span>
          <span className="label">New chat</span>
        </button>
        <button className="side-button" onClick={onConfigureApi} title="Configure API">
          <span className="side-icon"><ApiIcon /></span>
          <span className="label">Configure API</span>
        </button>
      </div>
      <div className="side-section">
        <div className="side-title">Chats</div>
        {sessions.map((session) => (
          <button
            className={`session ${session.id === sessionId ? "active" : ""}`}
            key={session.id}
            title={session.title ?? session.id}
            onClick={() => onLoadSession(session.id)}
          >
            <span className="session-name">{session.title ?? "Untitled chat"}</span>
            <span className="session-meta">{shortDate(session.updatedAt)}{session.workspaceDir ? ` · ${session.workspaceDir}` : ""}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer">
        <div className="rail-avatar">P</div>
        <div className="status-card">
          <div className="status-row">
            <span><span className={`dot ${providerReady ? "ok" : "warn"}`} />Provider</span>
            <span>{providerReady ? "ready" : "missing key"}</span>
          </div>
          <div className="status-row">
            <span>Workspace</span>
            <span>{workspace ?? "loading"}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
