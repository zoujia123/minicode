---

name: pixiu-frontend-workbench
description: Use this skill when designing, implementing, or refactoring Pixiu's frontend Agent Workbench, including session isolation, Skills, MCP, activity trace, workspace, artifacts, and permission-aware execution.
--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------

# Pixiu Frontend Workbench Skill

Use this skill when the user asks to design, implement, refactor, or polish Pixiu's web frontend.

The goal is not to create a generic chat page. The goal is to build a clear Agent Workbench for a local-first agent system.

## Core product idea

Pixiu's frontend should help users understand and control an agent that can:

* read and edit local files
* call tools
* use MCP servers
* load Skills
* maintain sessions
* produce artifacts
* record evidence
* request permissions
* expose execution activity

The UI should make these agent-system concepts visible and reviewable.

## When to use this skill

Use this skill for tasks such as:

* redesigning the Pixiu web UI
* implementing a three-pane workbench layout
* adding project/session navigation
* adding a Skills panel or Skills Center
* adding an Activity or Run Trace panel
* adding tool-call visualization
* adding MCP server status
* adding workspace and artifact views
* improving permission prompts
* refactoring frontend components for clarity

## Target layout

Prefer a three-pane desktop layout.

### 1. Left Sidebar

Purpose: navigation and isolation.

It should include:

* Pixiu brand/logo
* New chat
* Search sessions
* Projects
* Sessions for the current project
* Skills
* MCP
* Workspace
* Settings
* user/profile area

The selected project and selected session should be visually obvious.

### 2. Center Workbench

Purpose: main interaction and output.

It should include:

* user messages
* assistant responses
* structured response cards
* artifact previews
* file change summaries
* tool/skill summaries when useful
* bottom input composer

Assistant responses should be allowed to contain structured cards, for example:

* Skills used
* Files changed / proposed
* MCP & Tools
* Artifact preview
* Verification summary

### 3. Right Inspector

Purpose: observability and review.

It should include tabs or sections such as:

* Activity
* Tools
* Skills
* Evidence
* Workspace

This panel should show what the agent did, not hidden chain-of-thought.

Good activity events include:

* parsed task
* selected skill
* loaded SKILL.md
* loaded reference file
* called tool
* requested permission
* read file
* edited file
* ran command
* created artifact
* completed task

## Pixiu-specific UI requirements

The UI should clearly show:

1. Session isolation

   * The user can distinguish projects and sessions.
   * A session belongs to a project/workspace context.

2. Skills as first-class objects

   * Skills should not be hidden as plain text.
   * The UI should show which skill was selected or loaded.
   * The UI should distinguish SKILL.md from reference files.

3. Tool and MCP activity

   * Built-in tools and MCP servers should be visible as execution capabilities.
   * Tool calls should be grouped and countable when repeated.

4. Workspace state

   * Current root, branch, changed files, and artifacts should be visible.
   * File changes should be reviewable.

5. Permission mode

   * The current permission mode should be visible.
   * Permission requests should be reviewable before risky actions.

6. Evidence and artifacts

   * Generated files, screenshots, logs, and other evidence should be easy to inspect.

## Design principles

* Make the UI feel like a production developer tool.
* Prefer clarity over decoration.
* Use concise labels.
* Use cards for structured agent state.
* Use status icons for pending/running/success/failed/blocked states.
* Keep raw logs collapsible.
* Avoid exposing hidden chain-of-thought.
* Show structured execution summaries instead.

## Implementation workflow

When asked to implement this UI, follow this workflow:

1. Inspect the existing frontend stack.
2. Locate the UI entry point, routes, and main components.
3. Identify available styling approach and existing design tokens.
4. Propose a minimal component plan before large edits.
5. Implement the three-pane layout shell first.
6. Add mock data for sessions, skills, tools, activity, workspace, and artifacts if real APIs are not ready.
7. Keep mock data in a separate file or clearly marked section.
8. Implement left sidebar.
9. Implement center chat/workbench.
10. Implement right inspector.
11. Run typecheck/build.
12. Summarize changed files and verification steps.

## Suggested components

Use names like these if they fit the existing codebase:

* `WorkbenchLayout`
* `AppSidebar`
* `ProjectList`
* `SessionList`
* `ChatPane`
* `MessageCard`
* `AssistantSummaryCards`
* `ArtifactPreview`
* `RightInspector`
* `ActivityTimeline`
* `ToolCallSummary`
* `SkillUsageCard`
* `WorkspaceSummary`
* `PermissionModeBadge`
* `Composer`

Do not force these names if the project already has a better component structure.

## Mock data model

If backend integration is not ready, use realistic mock data for:

* projects
* sessions
* messages
* skills
* loaded skill files
* tool calls
* MCP servers
* activity events
* workspace state
* artifacts
* file changes

Mock data should be easy to replace later.

## Done when

The task is complete when:

* the Pixiu UI shows a clear three-pane Agent Workbench
* the selected project and session are visible
* Skills, Tools, MCP, Workspace, Activity, and Artifacts are visible as first-class concepts
* the right panel shows a believable execution trace
* the center panel supports chat plus structured workbench cards
* the layout works well on a desktop 16:9 screen
* available typecheck/build commands pass
* changed files and verification steps are summarized

## Reference files

If more detail is needed, load the following reference file through the skill tool:

* `references/ui-layout-spec.md`
