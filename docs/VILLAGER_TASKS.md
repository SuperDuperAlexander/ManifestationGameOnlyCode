# Villager pack tasks

- [x] Appearance: six stable colour sets and live colour controls.
- [x] Figure: calm and angry poses keep the same face and clothes.
- [x] Pack: live game exports, preview page, and usage notes.
- [x] Checks: source review, full build, browser tests, and visual review.

## Passed checks

- Final full build: `npm run build` passed on source commit `f916e2d`.
- Preview: desktop and phone emulation passed with zero browser errors.
- Preview: 8 draw calls, 4,906 triangles, and 12 pooled steam slots.
- Six colour sets and four live colour controls changed both figures without replacing their meshes.
- Calm to angry to calm kept the same identity and colours. The torch arm moved with each state.
- Final fire and steam are visible. The full flame fits the view.
- Town: desktop 48 calm / 63 angry draw calls. Phone emulation 48 calm / 61 angry draw calls.
- Full lantern story: passed and reached the end card with zero console problems.
- Evidence: `screenshots/villager-pack/`. Pack test log: `checks.log`.

## Open check

- Test on a real phone. Phone emulation does not measure phone hardware.
