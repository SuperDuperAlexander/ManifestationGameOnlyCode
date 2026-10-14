# Villager kit

This preview uses the same villager figure, toon shader, torch, and pooled steam as the game. It re-exports the live code from `src/npc/`. It does not copy or ship a second model.

## Run the preview

From the game repo root, run:

```bash
npm run dev
```

Open [http://localhost:5173/villager-kit/](http://localhost:5173/villager-kit/). Drag the mouse to orbit. Use the wheel to zoom. Choose Woman or Man under **Resident**. The preview starts with Woman. You can also open `/villager-kit/?gender=male` or `/villager-kit/?gender=female`.

The selector changes both figures. It keeps the camera, colour set, custom colours, and peaceful/angry swap. Both figures keep the same seed and look. This selector is only for the preview. Game code can set gender on `CitizenDef`:

```ts
import type { CitizenDef, CitizenGender } from '../outer/townLayout';

const gender: CitizenGender = 'female';
const def: CitizenDef = {
  gender,
  colors: 'earthy', head: 'hair', beard: false, torch: false,
  personalBase: 0, loop: 0, start: 0, scale: 1, seed: 7,
};
```

The game uses the same `CitizenVisual` code as this preview.

The angry state raises a live torch and emits pooled white steam. The game keeps a torch burning gently after anger fades. It has no combat.

## Use the live villager

From a TypeScript file in `src/npc/`, import the live code:

```ts
import { CitizenVisual, citizenAppearance, SteamPool, Torch } from '../../villager-kit/src';
import type { CitizenDef } from '../outer/townLayout';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';

const def: CitizenDef = {
  colors: 'earthy', head: 'hair', beard: true, torch: false,
  personalBase: 0, loop: 0, start: 0, scale: 1, seed: 7,
};
const look = citizenAppearance(def.colors, def.seed, { tunic: '#7d7f5a' });
const villager = new CitizenVisual(scene, def, look);
const torch = new Torch(scene, villager.torchMount);
const steam = new SteamPool(scene, 8);
const steamAt = new Vector3();
let steamTimer = 0;

// Each frame.
villager.update(dt, {
  speed: 0,
  heading: 0,
  agitation: 0.8,
  far: false,
  torchRaised: true,
});
torch.setVisible(true);
torch.setIntensity(0.8);
torch.update(dt);
steamTimer -= dt;
if (steamTimer <= 0) {
  steamAt.set(villager.root.position.x, villager.root.position.y + 1.45, villager.root.position.z);
  steam.puff(steamAt, 0.8);
  steamTimer = 0.6;
}
steam.update(dt);

// Change colours while the villager stays in the scene.
villager.setAppearance({ scarf: '#9fb8d6' });

// When you remove the villager and its effects.
torch.dispose();
steam.dispose();
villager.dispose();
```

`CitizenVisual`, `Torch`, and `SteamPool` come from the game source. Keep this folder inside the repo so its imports can reach `src/npc/`, the toon shader, and the shared palette. This is a reusable in-repo entry point. It is not a standalone package.

## Test

From the repo root, build the game and preview the production files:

```bash
npm run build
npm run preview -- --port 4173
```

In a second terminal, run the villager and town checks:

```bash
node scripts/check-villagers.mjs http://localhost:4173
node scripts/check-browser.mjs http://localhost:4173 --scenario town
node scripts/check-browser.mjs http://localhost:4173 --scenario town --mobile
node scripts/check-browser.mjs http://localhost:4173 --scenario lantern
```

Desktop and phone emulation checks passed. The final torch and steam fit the preview. A check on a real phone remains open.
