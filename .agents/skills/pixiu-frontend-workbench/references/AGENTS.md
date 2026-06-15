# AGENTS.md

## Project

Pixiu is a local-first, self-evolving agent system for real work. It is not only a chat UI.

Pixiu emphasizes:

* project and session isolation
* local workspace execution
* reusable Skills as procedural knowledge
* built-in tools and MCP integration
* permission-aware execution
* activity trace and agent observability
* artifacts, evidence, and file changes

When modifying Pixiu, preserve this product direction.

## Frontend direction

When implementing or redesigning Pixiu's frontend, treat it as an Agent Workbench.

The UI should make the following concepts visible:

* Projects
* Sessions
* Skills
* Tools
* MCP servers
* Workspace
* Artifacts
* Evidence
* Permission mode
* Activity trace

The frontend should not be a generic ChatGPT clone. Chat is the main interaction surface, but Pixiu's differentiator is that users can observe how the agent uses skills, tools, MCP, files, and workspace state.

## Preferred layout

Prefer a three-pane desktop layout:

1. Left sidebar

   * project navigation
   * session list
   * Skills entry
   * MCP entry
   * Workspace entry
   * settings

2. Center workbench

   * user and assistant messages
   * structured assistant cards
   * artifact previews
   * file change summaries
   * bottom composer

3. Right inspector

   * activity timeline
   * tool calls
   * loaded skills
   * evidence
   * workspace status
   * permission requests

## Engineering rules

Before editing code:

1. Inspect the current project structure.
2. Identify the frontend entry point, routing, and component organization.
3. Read `package.json` to understand available scripts and dependencies.
4. Avoid adding dependencies unless necessary.
5. Prefer small, named components over one large component.
6. Keep mock data isolated so it can later be replaced by real runtime data.
7. Preserve existing behavior unless the task explicitly asks to change it.

After editing code:

1. Run typecheck/build/test commands if available.
2. Summarize changed files.
3. Explain how to verify the UI.
4. Mention any remaining mock data or integration TODOs.

## UI quality bar

The UI should feel like a real developer product:

* clean hierarchy
* readable typography
* restrained colors
* clear status indicators
* visible execution state
* useful empty states
* reviewable file/tool/skill activity
* no excessive decoration
* no fake complexity that cannot be implemented

## Important distinction

In Pixiu:

* Skill means procedural guidance and workflow knowledge.
* Tool means a directly callable built-in action.
* MCP means an external service or capability interface.
* Workspace means the local execution and artifact context.
* Activity trace means a structured summary of what the agent did.

Do not hide these concepts inside plain chat text.
