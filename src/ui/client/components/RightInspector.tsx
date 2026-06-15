import type { SessionEvidence } from "../../../session/evidence"
import type { UiFileSummary } from "../../shared/api"
import type { InspectorTab, StatusSummary, TraceItem } from "../types"
import { ActivityPanel } from "./ActivityPanel"

export function RightInspector(props: {
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
  return <ActivityPanel {...props} />
}
