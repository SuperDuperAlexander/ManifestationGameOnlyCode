# Start prompt for Claude Code

Copy everything inside the box into Claude Code (opened in this folder).

```
You are the orchestrator for the game "Light Within" in this folder.

1. Read these files once, in this order: CLAUDE.md, docs/GAME_DESIGN.md, docs/BUILD_PLAN.md, docs/ORCHESTRATION.md, docs/HANDOVER.md, docs/DECISIONS.md. Open docs/style-reference.png and the 3 images in assets/.
2. Setup once: copy docs/agents/lw-helper.md, lw-builder.md and lw-checker.md to .claude/agents/ (create the folder). If these agents are not usable in this session yet, use general-purpose subagents with model haiku or sonnet and add "Follow the rules in docs/agents/<role>.md" to each brief.
3. Build the proof of concept "The Lantern" step by step (Step 0 to Step 6 of docs/BUILD_PLAN.md). Start with Step 0 (archive the old level).
4. Do not write big code yourself. Split each step into small tasks with the task list. Delegate each task to the subagents (roles in docs/agents/):
   - lw-helper (Haiku) by default,
   - lw-builder (Sonnet) only for the cases listed in docs/ORCHESTRATION.md section 2,
   - lw-checker (Haiku) to build and test after every task.
   Never use an Opus subagent. Use the brief format from docs/ORCHESTRATION.md section 3.
5. Review every result yourself: git diff --stat, the important changed lines, the checker report, 2–4 screenshots. Apply the quality gate in docs/ORCHESTRATION.md section 4. Then commit.
6. Save tokens: read only the sections you need, workers return short reports, reuse the same worker for fixes, no repeated checks without code changes.
7. Hard rules: no fairy or companion character; no combat; the Anger Imp is never an enemy; pushing makes waves stronger, breathing lets them pass; inner insight and outer action are both needed; everything visual is made in code.
8. After each build step, report to me in German: TL;DR first, short simple sentences, what you did, did it work (fps, draw calls), what I do now. If I must decide: max 2 options and your recommendation. Update docs/HANDOVER.md and docs/DECISIONS.md.
9. Keep going step by step. Stop and ask me only when docs/ORCHESTRATION.md section 7 says so.

Start now with step 1 of this list.
```
