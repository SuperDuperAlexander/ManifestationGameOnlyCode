# Interface refresh — 2026-10-15

## Reference revision

Reference: `D:\MyDrive\ALEXANDER\PROJEKTE\ChatGPTManifestationGame` and Alexander's new screenshots.

- [x] Read the real reference start screen, action pills and modal.
- [x] Replace the boxed menu and key grid with the reference screen style. (Luna)
- [x] Add an always-available menu with close and return controls. (Luna)
- [x] Finish closed-dialog, landscape, and full-story checks. (Luna checker)
- [x] Review screenshots, add final metrics, and commit.

Scope: Screens and menu only. Keep the Lantern story, worlds, saves and two-second breath rhythm. The reference repository stays read-only.
Results: Build and full desktop/mobile Lantern stories pass. Peak: 55 draw calls. Console errors: 0. Menu open/close/Return/Escape, keyboard focus, native button activation, Begin/Continue, keyboard/touch actions, closed-menu hiding, and layout checks pass. Checked portrait, landscape and desktop views include 320×568, 390×844, 568×320, 800×600 and 1280×720. Final proof: `screenshots/ui-reference/after/final-proof/`.

Review: `http://127.0.0.1:5185/`. Real phone testing remains open.

## Earlier revision

Scope: Live start menu and game interface only. Keep all game actions, saves, text, and story rules.

- [x] 1. Map the live interface and check the baseline build. (Luna explorer + Luna checker)
- [x] 2. Refresh the shared visual style and screen layouts. (Sol builder; build and narrow-desktop checks passed)
- [x] 3. Refresh control symbols and accessible names. (Luna helper; build passed)
- [x] 4. Keep character speech text inside the screen. (Luna helper; build passed)
- [x] 5. Check each change and fix any errors. (Luna checkers; label clipping and two test-setup faults fixed)
- [x] 6. Check the full build and game flow, review screenshots, update records, and commit.

Checks: Desktop, phone portrait, phone landscape, fresh Begin, Continue, keyboard, touch, end card, and browser console.

Results: Build passed. Browser checks passed at 320×568, 390×844, 568×320, 844×390, 800×600, 1024×768 and 1280×720. Keys, touch, Begin/Continue, both story orders, speech bounds and settled end card passed. Peak: 55 draw calls. No browser errors in the final isolated run.

Concurrent work: Separate villager edits blocked the final shared runtime check. They remain untouched. Final checks used `build/ui-refresh-check-20261014`, base `1a7b348` plus identical interface/test files. Review: `http://127.0.0.1:5180/`.

Open check: A real phone test by Alexander.
