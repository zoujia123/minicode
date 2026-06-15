# 260615 UI Enhance TODO

## Goal

Redesign Pixiu's browser UI from a simple chat page into a three-pane Agent Workbench. The workbench should make sessions, skills, tools, MCP, workspace state, evidence, artifacts, and permission-aware execution visible without hiding the main chat workflow.

The visual target is `docs/updates/260615_ui_enhance/pixiu.png`, plus the local workbench skill at `.agents/skills/pixiu-frontend-workbench`.

## Current State

- UI entry point is `src/ui/client/App.tsx`.
- Styling is centralized in `src/ui/client/styles.css`.
- Server routes live in `src/ui/server/server.ts`.
- Shared API types live in `src/ui/shared/api.ts`.
- Client API wrapper lives in `src/ui/client/api.ts`.
- Current layout is left sidebar + center chat + right slide-out panel.
- Current app already supports provider config, sessions, chat runs, SSE events, permission prompts, uploads, file previews, evidence, and basic status.
- Current app is too monolithic: most UI state, handlers, views, and helper functions are in one large `App.tsx`.

## References

- `docs/updates/260615_ui_enhance/pixiu.png`: visual target.
- `.agents/skills/pixiu-frontend-workbench/SKILL.md`: product direction.
- `.agents/skills/pixiu-frontend-workbench/references/ui-layout-spec.md`: layout spec.
- `.agents/skills/pixiu-frontend-workbench/references/AGENTS.md`: frontend product rules.

## Slice 1: Componentize Without Behavior Changes

- [ ] Split `src/ui/client/App.tsx` into small named components.
  - [ ] `WorkbenchLayout`
  - [ ] `AppSidebar`
  - [ ] `TopBar`
  - [ ] `ChatPane`
  - [ ] `Composer`
  - [ ] `RightInspector`
  - [ ] `ActivityTimeline`
  - [ ] `WorkspaceFiles`
  - [ ] `EvidencePanel`
  - [ ] `StatusPanel`
  - [ ] `ConfigModal`
  - [ ] `PermissionModal`
- [ ] Keep existing data flow and API calls working.
  - [ ] Provider setup still opens when API key is missing.
  - [ ] Existing chat run flow still works.
  - [ ] Permission modal still blocks and resumes risky tools.
  - [ ] File upload and preview still work.
  - [ ] Session loading still restores messages, trace, evidence, and files.
- [ ] Move pure helper functions to a local helper module if useful.
  - [ ] date/size formatting
  - [ ] session message conversion
  - [ ] trace extraction from session messages
  - [ ] tool/event display labels

## Slice 2: Three-Pane Workbench Shell

- [ ] Replace the current two-column + slide-out panel with a desktop-first three-pane shell.
  - [ ] Left sidebar: fixed navigation and session list.
  - [ ] Center workbench: chat, structured cards, composer.
  - [ ] Right inspector: always visible on desktop.
- [ ] Keep responsive fallback.
  - [ ] On narrower screens, collapse left sidebar to icons.
  - [ ] On mobile/tablet, let right inspector behave like a drawer.
- [ ] Add a top bar matching the workbench model.
  - [ ] current project / cwd
  - [ ] current model
  - [ ] permission mode
  - [ ] run status
  - [ ] provider status
  - [ ] settings/API action
- [ ] Preserve text fitting and no-overlap behavior across common viewports.

## Slice 3: Left Sidebar Navigation

- [ ] Redesign the sidebar around Pixiu concepts.
  - [ ] Pixiu brand / mascot area.
  - [ ] New chat primary action.
  - [ ] Search sessions placeholder.
  - [ ] Navigation entries: Projects, Skills, MCP, Workspace, Settings.
  - [ ] Project list with current project highlighted.
  - [ ] Session list for the current project.
  - [ ] User/profile footer.
- [ ] Use real data where available.
  - [ ] Use current `cwd` as the active project.
  - [ ] Use `/api/sessions` for session list.
  - [ ] Use provider/workspace status from `/api/status`.
- [ ] Use clearly marked mock data only where backend data does not exist yet.
  - [ ] Example project names.
  - [ ] Placeholder user/profile state.

## Slice 4: Center Workbench And Structured Cards

- [ ] Keep chat as the main interaction surface.
  - [ ] User messages remain visually distinct.
  - [ ] Assistant answers remain readable and redacted.
  - [ ] Composer remains fixed at the bottom of the center pane.
- [ ] Add structured assistant cards derived from current run/session state.
  - [ ] Skills used / searched.
  - [ ] Files changed or generated.
  - [ ] MCP & tools summary.
  - [ ] Artifact preview.
  - [ ] Verification summary.
- [ ] Use existing data first.
  - [ ] Derive tool cards from `AgentEvent` and saved message parts.
  - [ ] Derive artifacts and sources from `SessionEvidence`.
  - [ ] Derive files from session file list.
- [ ] Avoid hidden chain-of-thought.
  - [ ] Show task progress and tool activity summaries.
  - [ ] Keep raw tool JSON collapsible in inspector, not front-and-center.

## Slice 5: Right Inspector

- [ ] Replace the current slide-out Activity panel with a right inspector.
- [ ] Add tabs or sections.
  - [ ] Activity
  - [ ] Tools
  - [ ] Skills
  - [ ] Evidence
  - [ ] Workspace
- [ ] Activity tab.
  - [ ] Show timeline events from live `AgentEvent`.
  - [ ] Include permission requests and results.
  - [ ] Include run finished/error/cancelled states.
- [ ] Tools tab.
  - [ ] Group tool calls by tool name.
  - [ ] Show counts and success/failure status.
  - [ ] Keep raw arguments/results expandable.
- [ ] Skills tab.
  - [ ] Show `skill_search` calls.
  - [ ] Show loaded `skill` calls.
  - [ ] Distinguish `SKILL.md` from reference-file loads.
- [ ] Evidence tab.
  - [ ] Show artifacts, sources, shell commands, and generated files from existing evidence.
- [ ] Workspace tab.
  - [ ] Show cwd/root.
  - [ ] Show session workspace.
  - [ ] Show file list and preview action.
  - [ ] Show MCP summary and permission mode.

## Slice 6: Optional API Enhancements

Do this only after the first UI pass proves which data is missing.

- [ ] Add `GET /api/skills`.
  - [ ] installed skill summaries
  - [ ] diagnostics
  - [ ] duplicate info
- [ ] Add `GET /api/mcp`.
  - [ ] server status
  - [ ] tool names
  - [ ] error summaries
- [ ] Add `GET /api/tools`.
  - [ ] built-in tool definitions
  - [ ] MCP-imported tool definitions
- [ ] Add `GET /api/workspace/status`.
  - [ ] project root
  - [ ] session workspace path
  - [ ] git branch when available
  - [ ] changed files when available
  - [ ] artifact count

## Slice 7: Visual System

- [ ] Replace the current plain chat look with a production developer-tool style.
  - [ ] light theme first
  - [ ] soft gray borders
  - [ ] white cards
  - [ ] restrained blue primary accent
  - [ ] small warm Pixiu accent
  - [ ] clear green/yellow/red status colors
  - [ ] 8px or 12px radii
  - [ ] dense but readable spacing
- [ ] Avoid decorative clutter.
  - [ ] No landing page.
  - [ ] No oversized hero.
  - [ ] No purely decorative gradient/orb backgrounds.
- [ ] Consider adding icons.
  - [ ] Prefer `lucide-react` if adding a dependency is acceptable.
  - [ ] If not, use restrained text/symbol labels for the first pass.
- [ ] Keep UI text concise and product-like.

## Slice 8: Verification

- [ ] Build and typecheck.
  - [ ] `PATH=.tools/bun/bin:$PATH bun run typecheck`
  - [ ] `PATH=.tools/bun/bin:$PATH bun run ui:build`
- [ ] Run UI tests.
  - [ ] `PATH=.tools/bun/bin:$PATH bun test test/ui`
- [ ] Run focused CLI smoke if UI server routes changed.
  - [ ] `PATH=.tools/bun/bin:$PATH bun test test/cli/smoke.test.ts`
- [ ] Manual browser check.
  - [ ] `PATH=.tools/bun/bin:$PATH bun run src/cli/index.ts ui --no-open`
  - [ ] Open printed local URL.
  - [ ] Verify desktop three-pane layout.
  - [ ] Verify responsive collapse.
  - [ ] Verify provider setup.
  - [ ] Verify new session, run, permission prompt, file upload, file preview, evidence view.

## Suggested Order

1. Componentize the current app without behavior changes.
2. Build the three-pane layout shell.
3. Implement the left sidebar and top bar.
4. Rework the center chat into an Agent Workbench with structured cards.
5. Convert the right drawer into a persistent inspector.
6. Polish visual system against `pixiu.png`.
7. Add backend API enhancements only for data that cannot be derived from existing routes.
8. Run build, tests, and manual viewport checks.

## Non-goals

- No Electron/Desktop work in this slice.
- No remote sharing or cloud sync.
- No hidden chain-of-thought display.
- No broad backend rewrite before the UI proves what data it needs.
- No dependency additions unless they clearly improve UI quality or reduce code complexity.
- No replacing the existing provider/session/run/permission API flow unless necessary.
