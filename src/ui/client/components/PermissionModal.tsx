import { redactUiText } from "../redact"
import type { PermissionView } from "../types"

export function PermissionModal({ permission, answer }: { permission: PermissionView | undefined; answer(action: "allow" | "deny", scope: "once" | "sessionSimilar"): void }) {
  if (!permission) return null
  return (
    <div className="config open">
      <div className="config-panel permission-panel">
        <div className="config-head">
          <strong>Permission required</strong>
          <span className="pill">{permission.request.risk ?? "risk"}</span>
        </div>
        <div className="config-body">
          <div className="notice">{permission.decision.reason ?? ""}</div>
          <div className="preview">
            <strong>{permission.request.tool ?? "tool"}</strong>
            <pre>{redactUiText(JSON.stringify(permission.request.input ?? {}, null, 2))}</pre>
          </div>
          <div className="form-actions">
            <button className="danger" type="button" onClick={() => answer("deny", "once")}>Deny</button>
            <button className="ghost" type="button" onClick={() => answer("allow", "sessionSimilar")}>Allow similar</button>
            <button className="primary" type="button" onClick={() => answer("allow", "once")}>Allow once</button>
          </div>
        </div>
      </div>
    </div>
  )
}
