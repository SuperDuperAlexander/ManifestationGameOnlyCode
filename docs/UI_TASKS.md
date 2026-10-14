# Interface refresh — 2026-10-14

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
