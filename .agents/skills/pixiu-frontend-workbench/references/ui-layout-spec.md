# Pixiu Workbench UI Layout Spec

This reference file describes the target Pixiu frontend layout in more concrete detail.

## Page structure

Use a desktop-first three-pane layout:

```txt
┌──────────────────────────────────────────────────────────────┐
│ Top Bar: project, model, permission mode, status              │
├───────────────┬────────────────────────────┬─────────────────┤
│ Left Sidebar  │ Center Workbench           │ Right Inspector │
│               │                            │                 │
│ Projects      │ Chat messages              │ Activity        │
│ Sessions      │ Assistant cards            │ Tools           │
│ Skills        │ Artifacts                   │ Skills          │
│ MCP           │ File changes                │ Evidence        │
│ Workspace     │ Composer                    │ Workspace       │
└───────────────┴────────────────────────────┴─────────────────┘
```

## Left Sidebar

The sidebar should help users understand where they are.

Recommended sections:

1. Primary actions

   * New chat
   * Search sessions

2. Navigation

   * Projects
   * Skills
   * MCP
   * Workspace
   * Settings

3. Projects

   * KVenture
   * Maze
   * pixiu

4. Sessions for selected project

   * 260614 pixiu skills
   * frontend redesign
   * systematic debugging
   * skill architecture refactor
   * MCP integration plan

5. User area

   * avatar
   * account/name
   * settings dropdown

## Center Workbench

The center area is the main task surface.

A good assistant response may include:

1. Short natural-language response
2. Structured summary cards
3. Artifact preview
4. File changes
5. Verification status

Example summary cards:

### Skills used

Show loaded or relevant skills:

* systematic-debugging
* frontend-design
* skill-creator

Each row may include:

* skill name
* short description
* status
* version or source path if available

### Files changed / proposed

Show proposed or modified files:

* `layout/workbench.tsx`
* `components/Sidebar.tsx`
* `components/ChatPane.tsx`
* `components/RightInspector.tsx`
* `styles/tokens.css`

Each row may include:

* file path
* status: added, updated, deleted, unchanged
* whether it is mock-only or real integration

### MCP & Tools

Show tool usage:

* read_file
* edit
* shell
* web_fetch
* MCP server calls

Each row may include call count and status.

### Artifact preview

Show generated UI preview, report, document, image, or code artifact.

Useful actions:

* Copy
* Save as Artifact
* Open
* View full size
* Download if applicable

## Right Inspector

The right inspector is Pixiu's observability surface.

Recommended tabs:

* Activity
* Tools
* Skills
* Evidence
* Workspace

### Activity tab

Show a timeline of structured execution events.

Example:

1. Parsed task
2. Selected skill: frontend-design
3. Loaded SKILL.md
4. Loaded reference: ui-guidelines.md
5. Called tool: read_file
6. Generated layout proposal
7. Waiting for user confirmation

Each event should have:

* icon or status
* label
* optional timestamp
* optional detail count
* status: pending, running, success, failed, blocked

### Tools tab

Show tool calls grouped by tool name.

Example:

* read_file: 12 calls
* edit: 8 calls
* shell: 2 calls
* web_fetch: 2 calls

For repeated calls, group them and allow expansion later.

### Skills tab

Show selected, loaded, and available skills.

Example:

* frontend-design: loaded
* skill-creator: available
* systematic-debugging: used previously

The UI should make it clear that a skill guides behavior but does not directly execute actions.

### Evidence tab

Show supporting evidence:

* files read
* logs
* command output
* screenshots
* generated artifacts
* citations if web tools were used

### Workspace tab

Show local workspace status:

* root directory
* current branch
* changed files
* artifacts
* session workspace path
* permission mode

## Top Bar

Recommended top bar elements:

* current project name
* current model
* permission mode
* run status
* share/export
* more menu

Example status labels:

* Ready
* Running
* Waiting for permission
* Failed
* Completed

## Composer

The bottom composer should support:

* text input
* file attachment
* slash commands
* send button
* optional microphone button
* visible placeholder

Example placeholder:

“给 Pixiu 设计一个新的前端页面...”

## Visual style

Prefer:

* light theme first
* white cards
* soft gray borders
* subtle shadows
* blue or teal primary accent
* small orange/gold Pixiu accent
* clear status colors
* 8px or 12px radius
* consistent spacing
* readable font size

Avoid:

* heavy gradients
* excessive mascot decoration
* crowded text
* unclear icons
* too many colors
* hidden important state

## Responsive behavior

First optimize for desktop 16:9.

Minimum responsive behavior:

* left sidebar can collapse
* right inspector can collapse
* center workbench remains readable
* cards stack if width is limited

## Implementation notes

If real runtime data is not available yet, use mock data.

Keep mock data easy to replace:

* `mockProjects`
* `mockSessions`
* `mockMessages`
* `mockSkills`
* `mockActivityEvents`
* `mockToolCalls`
* `mockWorkspace`
* `mockArtifacts`

Do not hard-code mock data deeply inside presentation components if avoidable.
