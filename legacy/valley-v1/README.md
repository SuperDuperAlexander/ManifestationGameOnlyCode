# Valley v1 (archived 2026-10-11)

The playable valley level and the paper-diorama game, as they were before the restart.
Kept so Alexander can look at them again later.

## What is here

| Path | What it is |
|---|---|
| `docs/` | The old `CLAUDE.md`, `README.md`, `HANDOVER.md`, `DECISIONS.md` (D1–D29) |
| `src/` | The old valley code (`src/valley/`) and diorama code, moved here in Step 0 of `docs/BUILD_PLAN.md` |
| `playable/` | A frozen production build. It never breaks, even when the new game changes shared code |

## Play the old version

```
npx vite preview --outDir legacy/valley-v1/playable --port 4174
```

Then open:
- `http://localhost:4174/` — the valley level (2 fogs, light bridge, arch)
- `http://localhost:4174/diorama.html` — the older paper-diorama game

## Get the full old code back

The git tag `archive/valley-v1` points to the last commit before the restart:

```
git checkout archive/valley-v1
```

Go back to the new game with `git checkout main`.
