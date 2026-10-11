# ORCHESTRATION — how Claude Code builds "The Lantern"

The main Claude Code session is the **orchestrator**. It plans, delegates, reviews, commits and reports.
Workers are subagents. Their role files are in `docs/agents/` (copy them to `.claude/agents/` once, see `docs/START_PROMPT.md`).
If the named agents are not available in the session, start a general-purpose subagent with `model: haiku` or `model: sonnet` and tell it in the brief: "Follow the rules in docs/agents/<role>.md". Goal: **save tokens, keep the game quality high.**

## 1. Roles

| Who | Model | Does | Never does |
|---|---|---|---|
| **Orchestrator** (main session) | session model | Reads the docs once. Splits each build step into small tasks. Writes briefs. Reviews results. Looks at screenshots itself. Commits. Reports to Alexander in German. | Writes big code itself (only small fixes ≤ ~30 lines). Re-reads whole files a worker already handled. |
| `lw-helper` | **Haiku** | Small, clear tasks: move files, JSON/text, tuning values, docs, simple one-file changes that follow a pattern. | Design decisions, shaders, multi-file systems. |
| `lw-builder` | **Sonnet** | New systems, several files, shaders, camera, wave behaviour, procedural figures (imp, citizens, trees), Look Within transition. | Work outside its brief. |
| `lw-checker` | **Haiku** | Build + browser scenario + console + fps/draw calls + screenshot paths. Read-only. | Edit code. Judge the look. |

## 2. Which model for which task

- **Default: Haiku** (`lw-helper`).
- **Sonnet** (`lw-builder`) when the task has any of: new system across ≥ 2 files · shader code · 3D math (camera, transitions, wave motion, collisions) · procedural character or tree mesh · Haiku failed twice.
- **Never** start an Opus subagent.
- Sonnet failed twice → the orchestrator fixes it itself if small, otherwise asks Alexander (max 2 options + recommendation).

## 3. The task brief (keep it short and complete)

Every brief contains exactly this:

```
TASK: <one sentence>
DESIGN: docs/GAME_DESIGN.md section <n> (read only this section)
FILES TO READ: <paths>
FILES TO CHANGE/CREATE: <paths>
REUSE: <existing classes/functions to build on>
DONE WHEN: <2–4 checkable points>
CHECK: npm run build [+ scenario name and address]
OUT OF SCOPE: <what not to touch>
```

- One brief = one task = one worker. Small tasks (≈ 1 file or 1 system part).
- Parallel workers only when they change **different files** and do not depend on each other.
- Follow-up fixes on the same task: continue the **same** worker with SendMessage. Do not spawn a new one.

## 4. Review loop per task

1. Worker returns its short report (≤ 15 lines).
2. Orchestrator checks with `git diff --stat` and reads only the changed parts that matter (not whole files).
3. `lw-checker` runs build + scenario.
4. Orchestrator opens the screenshots and judges the look against `docs/style-reference.png` and the reference images in `assets/`.
5. Quality gate (all must be true):
   - build passes, no console errors
   - scenario passes
   - draw calls < 100 on mobile in the tested world
   - the design rules in `docs/GAME_DESIGN.md` section 2 still hold (no combat, imp not an enemy, push → stronger, breathing alone does not finish, mirror both ways, no fairy)
   - it looks calm and fits the style
6. Gate passed → commit (`<step>: <what>`), tick the task. Gate failed → precise fix brief to the same worker.

## 5. Token rules

- Read the docs **once** at the start. Later read only the section you need.
- Workers get section numbers and paths, never pasted file contents.
- Workers answer with short reports, never full files or diffs.
- Use `Grep`/`Glob` and line ranges before reading whole files.
- Do not re-run passing checks without a code change.
- Screenshots: look at 2–4 per step, not all.
- Keep the task list (TaskCreate/TaskUpdate) as the memory of progress instead of long notes.

## 6. Reporting to Alexander

After each build step from `docs/BUILD_PLAN.md` (not after each small task):
- German, short, TL;DR first, simple words, abbreviations explained in brackets.
- What was done · did it work (numbers: fps, draw calls) · what he does now (e.g. a link to try, or nothing).
- Decisions: max 2 options, context, recommendation.
- Write new decisions into `docs/DECISIONS.md` (L11, L12, …) and update `docs/HANDOVER.md` section 2.

## 7. When to stop and ask Alexander

- A change would break a rule in `docs/GAME_DESIGN.md` section 2.
- A design point is unclear and a wrong guess is expensive.
- A step still fails after the escalation in section 2.
Otherwise keep going step by step.
