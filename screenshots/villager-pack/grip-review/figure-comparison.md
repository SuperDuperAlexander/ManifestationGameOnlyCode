# Figure comparison, 2026-10-14

- Runtime Babylon geometry; no production files changed.
- Player full body: 10 meshes, 3638 vertices, 6558 triangles. Includes cloak, emblem, scarf wrap, hood, legs, boots and both scene-root scarf tails. One shared body material; nominal 10 body draws. Shadow and halo bring total geometry to 12 meshes, 3646 vertices, 6562 triangles; halo can be hidden.
- Cap/beard villager body: 1 mesh, 4052 vertices, 2120 triangles, 1 body draw. Citizens share one body material and one batched shadow draw per scene (64 vertices, 32 triangles reserved for16 figures). Torch excluded from body counts. Each torch adds2 draws, shared stick/flame materials.
- Eight town villager bodies: 30686 vertices, 16260 triangles, 8 body draws. Four torches add8 draws; batched shadows add1. Effects add further draws.
- Near posing rewrites every vertex position and normal. At60 updates/second, all8 bodies process1841160 vertices/second and supply~44.2 MB/second position+normal buffer data. This is a source-based workload estimate, not a CPU or GPU timing.
- Far posing runs at no more than12 updates/second; all8 far would process up to368232 vertices/second (~8.84 MB/second buffers). Far figures retain the same geometry; there is no reduced-mesh far variant here.
- Runtime source sampling: Chromium headless, ANGLE D3D11, 24 debug readings at250ms/state, after3.5s warmup; fixed town view at(0,32), calm and angry. Sequential tests; no other agent browser tests active.
- Results: see town-frame-summary.json. Desktop1280x720; phone viewport412x915/device pixel ratio2.6, actual canvas856x1903 after adaptive render scaling.
- This is Windows desktop hardware at a phone screen size, not a physical phone. It does not measure phone heat, battery, sustained frame rate, or GPU timings.
- Visual comparison uses live player scale1.2 and actual villager scale1.05*1.1 in the same toon scene. The scarf, boots, warm palette, light direction and childlike body proportions fit. The villager face is more explicit and faceted than the simple smooth player. The user already approved extra expression; no art change is proposed.
- Saved evidence: player-villager-same-scale.png, figure-counts.json, and town-frame-summary.json. Temporary diagnostic files and their dev server were removed after measurement.
