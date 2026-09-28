# Light Within

A calm 3D browser game that teaches Dr. Rulin Xiu's teaching on how to manifest.

Chapter 1 is "Receive": one small grey valley, a breath rhythm, three springs,
one soft fog, one seed and a bridge. No enemies, no score, no timers.

Built with TypeScript, Vite and Babylon.js. Every shape, texture and sound is
generated in code; there are no model, image or audio files.

- `CLAUDE.md` — the content, stack, performance and art rules for every chapter
- `REPORT.md` — what was built, test results, measured sizes and frame rates

## Run it

```
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck, lint, unit tests
npm run build        # production build into dist/
npm run e2e          # browser tests, writes screenshots/
```

## Put it on a URL

Any static host works. There is no server and no network call.

- **Vercel** — import the repository. `vercel.json` sets the build and the
  cache headers; nothing else to configure.
- **Netlify** — import the repository. `netlify.toml` does the same.
- **Anything else** — run `npm run build` and upload `dist/`. Paths are
  relative, so it works from a subfolder too.

A real URL is the only way to check the performance budget: 60 fps on a
mid-range laptop and 30 fps on a mid-range Android phone. Open it with
`?debug=1` and read the `fps` and `tier` lines in the panel. If the tier drops
on its own, the watchdog decided the device could not keep up at that tier.

## Controls

|                 | Keyboard       | Touch                 |
| --------------- | -------------- | --------------------- |
| Walk            | WASD or arrows | Joystick, bottom left |
| Breathe in      | Hold space     | Breathe in button     |
| Breathe out     | Hold shift     | Breathe out button    |
| Turn the camera | Drag the mouse | Drag the screen       |
| Push            | E              | Push button           |
| Plant           | Enter          | Plant button          |
| Pause           | Esc            | Pause button          |

You can walk from the first second. Your stride is short until your first
finished breath, then it opens up and stays open.

A light travels with you. She names what you have just met and, at a
blockage, opens a teaching. She never talks over a breath and she never says
the same thing twice. A teaching that waits for you is closed with its own
button; everything else goes on its own.

Teaching films, when there are any, live in `public/teachings` and are fetched
at the blockage they belong to, never at the start. Every one of them has the
same words written underneath it, so a muted phone or a screen reader loses
the picture and nothing else.

## Debug

| Parameter                    | What it does                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `?debug=1`                   | Debug panel with calm, light, scene, fps, tier, learning checks and an export button |
| `?scene=N`                   | Start at scene 1 to 6 with the right amount of light                                 |
| `?autobreathe=1`             | Breathe automatically with calm breaths, for the browser tests                       |
| `?nopaint=1`                 | Turn the painting filter off                                                         |
| `?quality=low\|medium\|high` | Pin a quality tier instead of measuring one, and turn the watchdog off               |

## Licences

Code in this repository is the project's own. The three fonts in `public/fonts`
are under the SIL Open Font License; their licence files sit next to them.
