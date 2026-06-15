# 260615 Skills Enhance TODO

## Goal

Make Pixiu Skills faster to discover, clearer to diagnose, cleaner to present to the agent, and ready for future retrieval-based selection without making the local skill authoring path heavy.

The near-term work should improve the existing local Skills layer. SkillHub-scale retrieval and richer skill contracts are valid directions, but they should remain incremental and opt-in until the small local workflow is solid.

## Current State

- `SkillLoader.list()`, `diagnostics()`, `search()`, `find()`, and `load()` can trigger repeated filesystem discovery.
- `renderSkillSystemPrompt(loader)` currently injects every discovered skill name and description into the agent system prompt.
- Skill metadata currently requires only `name` and `description`.
- Skill diagnostics are available through `skill list --json`, `skill doctor`, and UI status counts, but startup prompt rendering can silently degrade when discovery fails.
- Reference file listing is bounded to 50 files, but it does not yet filter noisy directories, binary files, generated output, or oversized files.
- Duplicate skills keep the first discovered source, but the configured precedence should be documented more explicitly.

## Slice 1: Discovery Cache And Invalidation

- [x] Add a small in-memory discovery cache to `SkillLoader`.
  - [x] Cache `skills` and `diagnostics` together so `list()` and `diagnostics()` observe the same discovery result.
  - [x] Make `find()`, `load()`, `files()`, and `search()` use the cached discovery path.
  - [x] Keep the cache per `SkillLoader` instance, not global process state.
- [x] Add explicit cache controls.
  - [x] `refresh()` forces a filesystem rescan and replaces the cache.
  - [x] `invalidate()` clears the cached discovery result.
  - [x] Keep mtime-based invalidation as a later enhancement unless a real stale-cache issue appears.
- [x] Invalidate or refresh after local skill mutations.
  - [x] Current CLI mutations run in short-lived processes, so stale in-process cache is not retained.
  - [x] Runtime APIs now expose `invalidate()` and `refresh()` for chat/UI or future long-lived mutation flows.
- [x] Add tests.
  - [x] Repeated `list()` / `diagnostics()` calls use the warm cache.
  - [x] `refresh()` picks up a newly created skill.
  - [x] `invalidate()` makes the next call rescan.

## Slice 2: Cleaner Reference File Listing

- [x] Filter reference files before returning them from skill loading.
  - [x] Ignore noisy directories: `.git`, `node_modules`, `dist`, `build`, `coverage`, `.next`, `.turbo`, `.cache`.
  - [x] Ignore common binary or non-text assets by extension: images, archives, videos, audio, fonts, lock databases, compiled objects.
  - [x] Ignore hidden metadata files that are unlikely to help the agent, except known useful provenance such as `.source.json`.
  - [x] Skip files above a conservative size limit.
- [x] Keep the reference list deterministic.
  - [x] Sort by relative path.
  - [x] Apply the existing max count after filtering.
  - [x] Keep `SKILL.md` excluded.
- [x] Add tests.
  - [x] Markdown/reference text files are listed.
  - [x] `node_modules`, `.git`, build output, images, and oversized files are not listed.
  - [x] Safe explicit `skill` tool reads still work for allowed reference files.

## Slice 3: Diagnostics Visibility

- [x] Preserve the current startup behavior: skill discovery failure must not prevent the agent from starting.
- [x] Make degraded skill discovery visible.
  - [x] Log prompt-render discovery failures through the runtime logger.
  - [x] Surface discovery diagnostics in `doctor` and `skill doctor` with enough path/source context to act on them.
  - [x] Keep UI status diagnostics wired to the same loader result used by the CLI.
- [x] Consider returning a compact warning in the skill system prompt only when it helps the agent choose behavior.
  - [x] Avoid leaking large local paths or noisy stack traces into the model prompt.
  - [x] Prefer user-facing CLI/UI diagnostics for detailed errors.
- [x] Add tests.
  - [x] Invalid skills still appear in diagnostics.
  - [x] Startup prompt rendering remains non-fatal when discovery fails.
  - [x] `skill doctor` exits non-zero when diagnostics exist.

## Slice 4: Document Skill Precedence And Duplicates

- [x] Document default skill source precedence.
  - [x] Project `.pixiu/skills`
  - [x] Project `.opencode/skills`
  - [x] User `~/.claude/skills`
  - [x] User `~/.agents/skills`
- [x] Explain duplicate handling.
  - [x] First discovered skill name wins.
  - [x] Later duplicates are ignored and reported in diagnostics.
  - [x] Configured `skills.paths` order controls root precedence.
  - [x] Within one root, discovery order is deterministic by sorted `SKILL.md` path.
- [x] Improve diagnostic output if needed.
  - [x] Include ignored path, active path, and source root index.
  - [x] Keep JSON output script-friendly.
- [x] Update docs.
  - [x] `README.md`
  - [x] `docs/usage.md`
  - [x] `pixiu.example.jsonc` comments if appropriate.

## Slice 5: Optional Skill Contract Metadata

- [x] Extend frontmatter parsing without making authoring heavier.
  - [x] Keep `name` and `description` required.
  - [x] Parse optional fields when present: `triggers`, `when_to_use`, `when_not_to_use`, `required_tools`, `risk`, `version`, `dependencies`, `inputs`, `outputs`, `quality_checks`.
  - [x] Preserve unknown metadata only if there is a clear use for display or diagnostics.
- [x] Use optional metadata carefully.
  - [x] Include compact contract fields in `skill show`.
  - [x] Include high-signal fields in local search ranking.
  - [x] Do not dump large metadata blocks into the default system prompt.
- [x] Add validation diagnostics.
  - [x] Invalid optional fields warn where possible, not make the skill unusable.
  - [x] Invalid required fields still fail the skill.
- [x] Add tests.
  - [x] Required metadata remains compatible with current skills.
  - [x] Optional contract fields parse correctly.
  - [x] Malformed optional fields produce useful diagnostics.

## Slice 6: Skill Search And Top-K Retrieval

- [x] Add local retrieval only after the baseline cache/filtering work is stable.
- [x] Consider a built-in `skill_search` tool.
  - [x] Query local installed skills by name, description, source path, triggers, and `when_to_use`.
  - [x] Return top-k compact summaries with source metadata.
  - [x] Keep risk low and read-only.
- [x] Avoid prompt bloat when many skills exist.
  - [x] Below a small threshold, keep listing available skills in the system prompt.
  - [x] Above the threshold, tell the agent to call `skill_search` before loading a skill.
  - [x] Keep remote SkillHub search explicit and opt-in; do not let the default agent search/install remote skills automatically.
- [x] Add tests.
  - [x] Local search ranks direct name/trigger matches above weak description matches.
  - [x] Large skill sets produce a compact system prompt.
  - [x] Agent can discover a relevant local skill through `skill_search` and then call `skill`.

## Suggested Order

1. Implement discovery cache, `refresh()`, and `invalidate()`.
2. Filter noisy reference files.
3. Make diagnostics more visible without making startup fragile.
4. Document precedence and duplicate behavior.
5. Add optional contract metadata.
6. Add `skill_search` / top-k retrieval when local skill counts justify it.

## Non-goals

- No automatic remote SkillHub search by the default agent.
- No remote skill install/update/uninstall workflow changes in this slice, except cache invalidation after confirmed install.
- No mandatory rich contract schema for all existing skills.
- No vector database or embedding dependency for the first retrieval implementation.
- No broad plugin architecture changes.

## Verification

```bash
PATH=.tools/bun/bin:$PATH bun run typecheck
PATH=.tools/bun/bin:$PATH bun test
```
