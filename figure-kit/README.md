# Cloak Figure

The red-cloak figure from *Light Within*, as a folder that works on its own.
Made only in code with Babylon.js. No model file, no Blender.

## Start the demo

```bash
npm install
npm run dev
```

Then open http://localhost:5174/?demo

- WASD = walk, Space = breathe in
- Drag with the mouse = look around, wheel = zoom
- P = demo walk on or off

## Use the figure in your own Babylon.js project

1. Copy the folder `src/figure/` into your project.
2. Your project needs `@babylonjs/core` (version 9).
3. Build the figure once, then update it every frame:

```ts
import { PlayerVisual } from './figure';

// Once, when the scene starts.
const figure = new PlayerVisual(scene);

// Every frame.
figure.root.position.copyFrom(playerPosition);
figure.update(dt, {
  speed,                          // m/s
  speedRatio: speed / walkSpeed,  // 0 = standing, 1 = full walk speed
  heading,                        // facing angle around Y, 0 = +z
  breathLevel,                    // 0..1, how full the breath is
  glow,                           // 0..1, warm glow while breathing in
  awake: 1,                       // 1 = standing, 0 = lying on the grass
});

// When you remove it.
figure.dispose();
```

The figure does the rest by itself: steps, cloak swing, scarf physics, leaning, nodding, looking around.
It needs no lights in the scene. Its light comes from the upper right, painted in its own shader.

## Change the look or the motion

All numbers and colours are in `src/figure/config.ts`:
size, colours, step speed, how much the cloak swings, scarf length, wind.

## Files

| File | What it does |
|---|---|
| `src/figure/PlayerVisual.ts` | The figure: cloak, hood, scarf wrap, legs, boots and all animation |
| `src/figure/ScarfTail.ts` | One scarf tail: a chain of points with physics, drawn as a ribbon |
| `src/figure/toonShader.ts` | Soft two-tone light for the figure |
| `src/figure/glowShader.ts` | Blob shadow under the figure and the halo while breathing in |
| `src/figure/config.ts` | All numbers and colours |
| `src/figure/math.ts` | Small helpers |
| `src/demo.ts` | The demo page (not needed in your project) |

Note: this is a copy. The game uses its own version in `src/player/`.
If you change one, the other stays as it is.
