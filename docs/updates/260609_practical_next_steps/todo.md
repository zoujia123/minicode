# 260609 Practical Next Steps TODO

## Goal

Improve pixiu for practical day-to-day use before adding more broad product surface. The next slice should help the agent stay useful in longer sessions, research current information reliably, and leave better evidence for generated artifacts.

## Priorities

- [x] Build real `/compact` and session context management
  - [x] Keep recent turns in full detail.
  - [x] Summarize older turns into session metadata.
  - [x] Feed the saved summary back into later model requests.
  - [x] Make `/clear` remain visual-only and keep `/compact` as the context-management command.

- [x] Add generic web search and fetch tools
  - [x] Provide `web_search` for current information lookup.
  - [x] Provide `web_fetch` for reading specific pages or papers.
  - [x] Route both tools through permission prompts.
  - [x] Return concise, source-aware summaries that fit the existing trace renderer.

- [x] Track evidence for task artifacts
  - [x] Record search queries, fetched URLs, access time, output file path, and session id.
  - [x] Make research-style Markdown outputs easy to audit later.
  - [x] Keep provenance lightweight so it does not turn into a heavy project database too early.

- [ ] Continue polishing chat ergonomics
  - [x] Expand `/session` to show workspace, generated artifacts, and recent tool activity.
  - [ ] Consider `/open` for recently generated files.
  - [ ] Consider `/export` for the current answer or session summary.
  - [ ] Keep the first screen focused on the usable chat experience, not a landing page.

## Implemented in this slice

- `/compact` now writes a session summary into metadata while leaving JSONL messages intact.
- Saved summaries are fed into later model requests, including summaries created by explicit `/compact`.
- `web_search` and `web_fetch` are built-in tools and use the existing permission flow.
- `/session` now reports the active workspace, summary/compaction status, generated artifacts, web sources, and recent shell commands.

## Suggested Order

1. Implement `/compact` first because it determines whether long sessions remain stable.
2. Add `web_search` and `web_fetch` next because they unlock real research workflows like paper collection.
3. Add artifact evidence tracking once web tools exist, so sources can be recorded naturally.
4. Polish chat commands around the workflows that users actually repeat.
