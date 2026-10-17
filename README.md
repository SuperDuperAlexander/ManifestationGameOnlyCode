# Transform Karma – The Lantern

A calm spiritual browser game in Babylon.js. Proof of concept: one theme (Anger), an outer town and an inner world.

`CLAUDE.md` is the source of truth. `docs/GAME_DESIGN.md` is the binding design. `docs/DECISIONS.md` lists every decision made while building.

## Run it

```
npm install
npm run dev       # http://localhost:5173
npm run build     # production build into dist/
```

Open http://localhost:5173/?debug to see the debug overlay (fps, draw calls, world, anger, pushLevel, wave count).

## Controls

| Action | Keyboard | Touch |
|---|---|---|
| Walk | WASD / arrows | Drag on left half (joystick) |
| Look around | Drag mouse, wheel = zoom | Drag on right half |
| Breathe in | Hold Space | Hold the round light button |
| Breathe out | Hold Shift | Let go of the button |
| Push a wave | E | Hand button |
| Look Within / return | Q | Diamond button (above the light button) |
| Interact (pick up, give, place) | Walk close + E when an object glows | Tap the glowing object |
| Debug overlay | F3 or `?debug` | `?debug` |

## The old version

The first version (valley and paper diorama) is archived. It is not part of the new game.

- Git tag: `archive/valley-v1` (`git checkout archive/valley-v1` to see the old code, `git checkout main` to return).
- Playable copy: `legacy/valley-v1/playable/`. Start it with `npx vite preview --outDir legacy/valley-v1/playable --port 4174`, then open http://localhost:4174/ (valley) or http://localhost:4174/diorama.html (diorama).
- Old code: `legacy/valley-v1/` (details in `legacy/valley-v1/README.md`).
