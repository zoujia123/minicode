export function TopBar({
  chatTitle,
  cwd,
  model,
  permissionMode,
  runStatus,
  providerReady,
  inspectorCollapsed,
  onOpenStatus,
  onOpenActivity,
  onConfigureApi,
}: {
  chatTitle: string
  cwd: string | undefined
  model: string | undefined
  permissionMode: string
  runStatus: string
  providerReady: boolean
  inspectorCollapsed: boolean
  onOpenStatus(): void
  onOpenActivity(): void
  onConfigureApi(): void
}) {
  return (
    <header className="topbar workbench-topbar">
      <div className="conversation-title">
        <strong>{chatTitle}</strong>
        <span className="pill topbar-path" title={cwd ?? "project"}>{cwd ?? "project"}</span>
        <span className="pill">{model ?? "model"}</span>
        <span className="pill">perm {permissionMode}</span>
        <span className="pill">run {runStatus}</span>
        <span className={`pill ${providerReady ? "ok" : "warn"}`}>{providerReady ? "API ready" : "API key missing"}</span>
      </div>
      <div className="top-actions">
        <button className="ghost" onClick={onOpenStatus}>Status</button>
        <button className="ghost" onClick={onOpenActivity}>Activity</button>
        {inspectorCollapsed ? <button className="ghost inspector-toggle" onClick={onOpenActivity}>Inspector</button> : null}
        <button className="ghost" onClick={onConfigureApi}>API</button>
      </div>
    </header>
  )
}
