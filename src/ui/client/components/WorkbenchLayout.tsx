import type { ReactNode } from "react"

export function WorkbenchLayout({
  sidebar,
  topBar,
  children,
  configModal,
  permissionModal,
  sidebarCollapsed,
  inspectorCollapsed,
}: {
  sidebar: ReactNode
  topBar: ReactNode
  children: ReactNode
  configModal: ReactNode
  permissionModal: ReactNode
  sidebarCollapsed: boolean
  inspectorCollapsed: boolean
}) {
  return (
    <div className={`app workbench-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${inspectorCollapsed ? "inspector-collapsed" : ""}`}>
      {sidebar}
      <main className="main workbench-main">
        {topBar}
        <section className="content">{children}</section>
      </main>
      {configModal}
      {permissionModal}
    </div>
  )
}
