import { redactUiText } from "../redact"
import type { TraceItem } from "../types"

export function TraceList({ trace }: { trace: TraceItem[] }) {
  if (!trace.length) return <div className="empty-panel">Tool calls and run events appear here.</div>
  return (
    <div className="tab-panel active">
      {trace.map((item) => (
        <details className={`trace-item ${item.failed ? "failed" : ""}`} key={item.id} open={false}>
          <summary className="trace-title">
            <span>{item.title}</span>
            {item.kind ? <span className="trace-kind">{item.kind}</span> : null}
          </summary>
          {item.detail ? <pre>{redactUiText(item.detail)}</pre> : null}
        </details>
      ))}
    </div>
  )
}
