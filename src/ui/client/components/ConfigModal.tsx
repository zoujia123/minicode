import type { ProviderConfigPayload } from "../api"
import { ENDPOINTS } from "../constants"

export function ConfigModal(props: {
  open: boolean
  close(): void
  notice: { text: string; kind?: "ok" | "error" }
  form: ProviderConfigPayload
  setForm(updater: (form: ProviderConfigPayload) => ProviderConfigPayload): void
  endpointPreset: keyof typeof ENDPOINTS | "custom"
  setEndpointPreset(value: keyof typeof ENDPOINTS | "custom"): void
  save(): void
  test(): void
}) {
  if (!props.open) return null
  const update = (patch: Partial<ProviderConfigPayload>) => props.setForm((current) => ({ ...current, ...patch }))
  return (
    <div className="config open">
      <div className="config-panel">
        <div className="config-head">
          <strong>Provider configuration</strong>
          <button className="ghost" type="button" onClick={props.close}>Close</button>
        </div>
        <form className="config-body" onSubmit={(event) => { event.preventDefault(); props.save() }}>
          <div className="config-grid">
            <div className="field">
              <label htmlFor="endpointPreset">Endpoint</label>
              <select
                id="endpointPreset"
                value={props.endpointPreset}
                onChange={(event) => {
                  const value = event.currentTarget.value as keyof typeof ENDPOINTS | "custom"
                  props.setEndpointPreset(value)
                  if (value !== "custom") update({ baseURL: ENDPOINTS[value] })
                }}
              >
                <option value="siliconflow">SiliconFlow</option>
                <option value="openai">OpenAI</option>
                <option value="deepseek">DeepSeek</option>
                <option value="custom">Custom URL</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="model">Model</label>
              <input id="model" value={props.form.model} onChange={(event) => update({ model: event.currentTarget.value })} placeholder="provider/model" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="baseURL">Base URL</label>
            <input id="baseURL" value={props.form.baseURL} onChange={(event) => update({ baseURL: event.currentTarget.value })} placeholder="https://api.example.com/v1" />
          </div>
          <div className="config-grid">
            <div className="field">
              <label htmlFor="credential">Credential</label>
              <select id="credential" value={props.form.credential} onChange={(event) => update({ credential: event.currentTarget.value as "apiKey" | "apiKeyEnv" })}>
                <option value="apiKey">API key</option>
                <option value="apiKeyEnv">Environment variable</option>
              </select>
            </div>
            {props.form.credential === "apiKeyEnv" ? (
              <div className="field">
                <label htmlFor="apiKeyEnv">API key env var</label>
                <input id="apiKeyEnv" value={props.form.apiKeyEnv ?? ""} onChange={(event) => update({ apiKeyEnv: event.currentTarget.value })} placeholder="OPENAI_API_KEY" />
              </div>
            ) : null}
          </div>
          {props.form.credential === "apiKey" ? (
            <div className="field">
              <label htmlFor="apiKey">API key</label>
              <input id="apiKey" type="password" value={props.form.apiKey ?? ""} onChange={(event) => update({ apiKey: event.currentTarget.value })} placeholder="Leave blank to keep the existing key" />
            </div>
          ) : null}
          <div className={`notice ${props.notice.kind ?? ""}`}>{props.notice.text}</div>
          <div className="form-actions">
            <button className="ghost" type="button" onClick={props.test}>Save and test</button>
            <button className="primary" type="submit">Save provider</button>
          </div>
        </form>
      </div>
    </div>
  )
}
