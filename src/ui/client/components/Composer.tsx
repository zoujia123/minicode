import type { RefObject } from "react"

import { maybeSend } from "../helpers"

export function Composer({
  prompt,
  setPrompt,
  sendPrompt,
  fileInputRef,
  uploadFiles,
  permissionMode,
  setPermissionMode,
  runStatus,
  runId,
  cancelRun,
}: {
  prompt: string
  setPrompt(value: string): void
  sendPrompt(): Promise<void>
  fileInputRef: RefObject<HTMLInputElement | null>
  uploadFiles(fileList: FileList | null): Promise<void>
  permissionMode: string
  setPermissionMode(value: string): void
  runStatus: string
  runId: string | undefined
  cancelRun(): Promise<void>
}) {
  return (
    <div className="composer-shell">
      <div className="composer">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.currentTarget.value)}
          onKeyDown={(event) => void maybeSend(event, sendPrompt)}
          placeholder="Message Pixiu"
          rows={2}
        />
        <div className="composer-row">
          <div className="composer-tools">
            <input ref={fileInputRef} type="file" multiple hidden onChange={(event) => void uploadFiles(event.currentTarget.files)} />
            <button className="icon-button" type="button" title="Upload files" onClick={() => fileInputRef.current?.click()}>+</button>
            <select className="select" value={permissionMode} onChange={(event) => setPermissionMode(event.currentTarget.value)} title="Permission mode">
              <option value="acceptEdits">accept edits</option>
              <option value="default">default</option>
              <option value="plan">plan</option>
              <option value="bypassPermissions">bypass</option>
            </select>
            {permissionMode === "bypassPermissions" ? <span className="warning">bypass enabled</span> : null}
            <span className="run-status">{runStatus}</span>
          </div>
          {runId ? <button className="ghost" type="button" onClick={() => void cancelRun()}>Cancel</button> : null}
          <button className="send" type="button" title="Send" disabled={!prompt.trim() || Boolean(runId)} onClick={() => void sendPrompt()}>↑</button>
        </div>
      </div>
    </div>
  )
}
