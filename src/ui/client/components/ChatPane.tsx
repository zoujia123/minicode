import type { RefObject } from "react"

import { SUGGESTIONS } from "../constants"
import { redactUiText } from "../redact"
import type { ChatMessage } from "../types"
import { Composer } from "./Composer"

export function ChatPane({
  messages,
  messageEndRef,
  setPrompt,
  prompt,
  sendPrompt,
  fileInputRef,
  uploadFiles,
  permissionMode,
  setPermissionMode,
  runStatus,
  runId,
  cancelRun,
}: {
  messages: ChatMessage[]
  messageEndRef: RefObject<HTMLDivElement | null>
  setPrompt(value: string): void
  prompt: string
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
    <div className="chat-wrap workbench-chat">
      <div className="messages">
        {!messages.length ? (
          <div className="empty">
            <h1>How can Pixiu help?</h1>
            <div className="suggestions">
              {SUGGESTIONS.map(([label, value]) => (
                <button className="suggestion" key={label} onClick={() => setPrompt(value)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message, index) => (
            <div className={`message ${message.role}`} key={`${message.role}_${index}`}>
              <div className="role">{message.role === "user" ? "You" : "Pixiu"}</div>
              <div className={`bubble ${message.pending ? "pending" : ""}`}>{redactUiText(message.text)}</div>
            </div>
          ))
        )}
        <div ref={messageEndRef} />
      </div>
      <Composer
        prompt={prompt}
        setPrompt={setPrompt}
        sendPrompt={sendPrompt}
        fileInputRef={fileInputRef}
        uploadFiles={uploadFiles}
        permissionMode={permissionMode}
        setPermissionMode={setPermissionMode}
        runStatus={runStatus}
        runId={runId}
        cancelRun={cancelRun}
      />
    </div>
  )
}
