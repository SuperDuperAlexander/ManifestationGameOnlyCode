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

## Torch hold follow-up

- [x] Pose: bend the elbow, relax the shoulder, and align the wrist and grip.
- [x] Check: build, desktop and phone preview, side view, and town smoke test.

- Natural hold: full build and desktop/phone pack checks passed. The preview remains at 8 draw calls and 4,906 triangles.
- Front, side, and phone images were reviewed. The shaft stays beside the face and the elbow bends.
- Town phone check passed at 48 calm / 61 angry draw calls with zero console errors.
- Anger-to-calm sequence had zero console errors. The wide town view did not resolve the lowered flame in detail.
- Evidence: `screenshots/villager-pack/torch-hold/`.
