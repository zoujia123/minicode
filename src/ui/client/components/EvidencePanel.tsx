import type { SessionEvidence } from "../../../session/evidence"
import { shortDate } from "../helpers"

export function EvidencePanel({ evidence }: { evidence: SessionEvidence | undefined }) {
  if (!evidence) return <div className="empty-panel">Evidence appears after a run uses tools.</div>
  const items = [
    ...evidence.artifacts.map((item) => ({ title: item.path, meta: `artifact via ${item.tool}` })),
    ...evidence.sources.map((item) => ({ title: item.title ?? item.url ?? item.query ?? "source", meta: `${item.tool}${item.accessedAt ? ` · ${shortDate(item.accessedAt)}` : ""}` })),
    ...evidence.shellCommands.map((item) => ({ title: item.command, meta: `shell${item.exitCode === undefined ? "" : ` · exit ${item.exitCode}`}` })),
  ]
  if (!items.length) return <div className="empty-panel">No artifacts, sources, or shell commands yet.</div>
  return (
    <div className="tab-panel active">
      {items.map((item, index) => (
        <div className="trace-item" key={`${item.title}_${index}`}>
          <div className="trace-title">{item.title}</div>
          <div className="file-meta">{item.meta}</div>
        </div>
      ))}
    </div>
  )
}
