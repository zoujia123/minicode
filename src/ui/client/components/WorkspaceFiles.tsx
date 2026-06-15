import type { UiFileSummary } from "../../shared/api"
import { formatSize } from "../helpers"
import { redactUiText } from "../redact"

export function WorkspaceFiles(props: { files: UiFileSummary[]; preview: { path: string; content: string } | undefined; onPreview(path: string): void }) {
  if (!props.files.length) return <div className="empty-panel">No files in this workspace yet.</div>
  return (
    <div className="tab-panel active">
      {props.files.slice(0, 40).map((file) => (
        <div className="file-row" key={file.path}>
          <button className="file-item" type="button" onClick={() => props.onPreview(file.path)}>
            <span className="file-name">{file.path}</span>
            <span className="file-meta">{file.kind} · {formatSize(file.size)}</span>
          </button>
          <button className="copy-button" type="button" onClick={() => void navigator.clipboard?.writeText(file.path)}>copy</button>
        </div>
      ))}
      {props.preview ? (
        <div className="preview">
          <strong>{props.preview.path}</strong>
          <pre>{redactUiText(props.preview.content)}</pre>
        </div>
      ) : null}
    </div>
  )
}
