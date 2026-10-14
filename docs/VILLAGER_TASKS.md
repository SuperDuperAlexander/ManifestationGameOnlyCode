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

## Grip depth and figure cost review

- [x] Extend the torch handle below the fist to make the grip clear.
- [x] Check the grip in close front and side views.
- [x] Compare the live player and villager shape counts and game render cost.

- Handle depth is 0.11. Wood shows above and below the fist in the close views.
- Full build and desktop/phone pack tests passed with zero browser errors and 8 draw calls.
- Player body: 6,558 triangles in 10 meshes. Cap/beard villager body: 2,120 triangles in one mesh.
- Town sampling held 60 frames per second on this PC in desktop and phone screen tests. Phone screen tests still use the PC chip.
- Colour, light, scarf, and boots fit the player. The villager face has more detail. No art change was made.
- Full measurements and images: `screenshots/villager-pack/grip-review/`. A real phone test remains open.

## Women and men residents

- [x] Add a woman figure with the same state, colour, and torch controls.
- [x] Use four women and four men in the town.
- [x] Add Woman and Man choices to the pack preview.
- [x] Check both figures, repeated choice changes, and the town.

- Full build and desktop/phone preview checks passed with zero errors.
- Ten Woman/Man switches per view kept the same mesh count, colours, and mood state.
- Woman preview: 8 draw calls and 4,786 triangles, with the same pooled steam and held torch.
- Town has four women and four men. The phone view passed at 48 calm / 61 angry draw calls.
- Front and side views passed visual review. Evidence: `screenshots/villager-pack/women/`.
