import type { SessionEvidence } from "../../../session/evidence"
import type { UiFileSummary } from "../../shared/api"
import type { InspectorTab, StatusSummary, TraceItem } from "../types"
import { EvidencePanel } from "./EvidencePanel"
import { StatusPanel } from "./StatusPanel"
import { TraceList } from "./TraceList"
import { WorkspaceFiles } from "./WorkspaceFiles"

export function ActivityPanel(props: {
  open: boolean
  collapsed: boolean
  activeTab: InspectorTab
  setActiveTab(tab: InspectorTab): void
  close(): void
  trace: TraceItem[]
  files: UiFileSummary[]
  preview: { path: string; content: string } | undefined
  evidence: SessionEvidence | undefined
  status: StatusSummary | undefined
  onPreview(path: string): void
}) {
  return (
    <aside className={`workspace-panel workbench-inspector ${props.open ? "open" : ""} ${props.collapsed ? "inspector-collapsed-panel" : ""}`}>
      <div className="inspect-head">
        <strong>Activity</strong>
        <button className="icon-button inspector-toggle inspector-close" type="button" title="Close inspector" onClick={props.close}>x</button>
      </div>
      <div className="tabs">
        {(["trace", "files", "evidence", "status"] as const).map((tab) => (
          <button className={`tab ${props.activeTab === tab ? "active" : ""}`} type="button" key={tab} onClick={() => props.setActiveTab(tab)}>
            {tab}
          </button>
        ))}
      </div>
      <div className="panel-body">
        {props.activeTab === "trace" ? <TraceList trace={props.trace} /> : null}
        {props.activeTab === "files" ? <WorkspaceFiles files={props.files} preview={props.preview} onPreview={props.onPreview} /> : null}
        {props.activeTab === "evidence" ? <EvidencePanel evidence={props.evidence} /> : null}
        {props.activeTab === "status" ? <StatusPanel status={props.status} /> : null}
      </div>
    </aside>
  )
}
