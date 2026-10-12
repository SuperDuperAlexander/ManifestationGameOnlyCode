# GAME DESIGN — Light Within: "The Lantern" (Anger proof of concept)

- Owner: Alexander. Written with Claude on 2026-10-11.
- Changed 2026-10-12: Thought Waves became comic **Thought Bubbles** (formerly Thought Wave). See `docs/DECISIONS.md`.
- Status: **binding** game design for the proof of concept (PoC = a small, complete test of the idea).
- Source: chat 2026-10-11 + `docs/concept/GAME_CONCEPT_V2_input.md` (brainstorm input, not binding).
- How to build it: `docs/BUILD_PLAN.md`. Rules for coding agents: `CLAUDE.md`.
- If code and this file disagree, this file wins. Mark the conflict for Alexander.

---

## 1. The idea in one paragraph

Every person carries an inner world. The inner world reflects the outer world, and the outer world reflects the inner world.
The player can **Look Within** at any time: the camera dives into the little red-cloak figure, and a whole valley opens inside.
In this PoC the player meets **Anger**. A stranger bumps into them in town. Their lantern falls and almost goes out.
Anger rises as **Thought Bubbles** ("I'm so angry...") that drift through both worlds. The town grows angrier with them.
Inside, a small **Anger Imp** rages at the roots of the Inner Tree and burns a root.
Pushing the bubbles away makes them stronger. Breathing lets them dissolve. But breathing alone does not end the anger.
The player must go back outside, see the **whole situation**, and help. Then the imp calms down.
**Its fire does not go out. It becomes warmth.** With that warm flame the player relights the lantern and brings it to the Old Tree.

## 2. Guiding rules (do not break these)

1. **No combat. No death. No time pressure.** Nothing can be lost for good.
2. **The imp is not an enemy.** It is a part of the player. It is never defeated, caught or removed.
3. **Anger is transformed, not deleted.** Fire becomes warmth. The town keeps its fire too (torches, lanterns).
4. **Push makes it stronger. Breathing lets it pass.** This is the core lesson and lives in the mechanic.
5. **Breathing is not an instant cure.** Breathing gives space. The real change needs an outer action and an inner return.
6. **Inner insight alone never completes the story.** Outer action alone never completes it either.
7. **Mirror both ways.** Every inner change shows outside. Every outer change shows inside. (See section 8.)
8. **People are not villains.** Angry citizens have their own reasons. Clothing colour never shows good or evil.
9. **No shame.** The player is never called wrong, bad or blocked. Failing an attempt only gives a soft hint.
10. **Recovery is always possible.** A big bubble can push the player, never trap them.
11. **Short text. Play first.** One line at a time. No lectures.
12. **All in-game text is English.** All lines live in `public/data/dialogue/en.json`. Lines marked *draft* need Alexander's OK.
13. **No health or therapy claims.** The game shows a symbolic journey. It does not diagnose or promise healing.

## 3. Core loop

Opening (Alexander, 2026-10-12): the player first feels the calm. Wake at the Town Edge → breathe once → walk to the market square (gold light guides) → First Look Within (inner world all calm) → back out. Then the bump happens on the square. Everything turns angry, inside and outside.

```
Outer event (the bump, on the square)
  → Anger starts (hidden value "anger", 0..1)
  → Thought Bubbles appear in both worlds; the town gets more agitated
  → Player chooses per bubble: breathe (it dissolves slowly) · push (short relief, comes back bigger, a citizen bumps into the player) · nothing (it hits, short stagger)
  → Look Within: meet the raging imp, see the burned root, get a clue
  → Back outside: walk toward the source, see the whole situation, help
  → Back inside: breathe with the imp → it calms, holds a warm flame
  → Relight the lantern → bring it to the Old Tree → both trees and both worlds change
```

## 4. Player, controls and the inner voice

### 4.1 Player
- The existing red-cloak figure (`src/player/PlayerVisual.ts`). Unchanged look.
- New: carries a **lantern** in one hand (code-made: small cage + glowing core). See 7.1.
- The gold diamond on the back is the **Look Within** marker. It glows softly when Look Within is available.

### 4.2 Controls

| Action | Keyboard | Touch |
|---|---|---|
| Walk | WASD / arrows | Drag on left half (joystick) |
| Look around | Drag mouse, wheel = zoom | Drag on right half |
| Breathe in | Hold Space | Hold the round light button |
| Breathe out | Hold Shift | Let go of the button |
| Push a bubble | E | Hand button |
| **Look Within / return** | **Q** | **Diamond button** (above the light button) |
| Interact (pick up, give, place) | Walk close + E when an object glows | Tap the glowing object |
| Debug overlay | F3 or `?debug` | `?debug` |

- E means "push" near a bubble and "interact" near a glowing object. Interaction wins when both are in range.

### 4.3 No companion — the inner voice
- **There is no fairy and no other companion.** Alexander removed her on 2026-10-11. Do not add a guide character.
- Guidance comes from a calm **inner voice**: one short line at the bottom of the screen (existing `DialogueSystem`, bottom line), then silence.
  No speaker name, no portrait. Story lines are in the first person ("My light is almost out."). Control hints are plain ("Hold Space to breathe in.").
- The inner voice never solves anything for the player.
- The world itself shows the way: the Old Tree is always visible, important objects glow softly, Thought Bubbles come from the direction of their source.

## 5. The two worlds

### 5.1 Outer World — the little town

A compact, enclosed town in a small valley basin, like the inner valley. Small enough to cross in about 30 seconds. It feels bigger through views over roofs, the cliffs and sky.
Built from code: houses = boxes with prism roofs, sandstone and ivory walls, olive and powder-blue shutters, simple market stalls, a fountain. Houses sit organic along the lanes, not in a grid.
Sandstone cliffs stand all around the basin. A stream comes down a waterfall at the Town Edge and crosses by a stone bridge. A low gate arch marks the way in.
Before the bump the whole town is calm. After the bump everyone is angry (see 7.4 and section 9).

```
                 sandstone cliffs (all around the basin)
            houses ── houses ── houses (organic lanes)
              |                    |
   ALLEY ── TOWN SQUARE (raised round terrace · Old Tree · fountain · 2 stalls)
  (narrow,          |
   the child)  MAIN STREET (curves uphill)
                    |
   TOWN EDGE / START (meadow · stream + waterfall + stone bridge · gate arch)
```

| Place | Purpose |
|---|---|
| **Town Edge (start)** | Quiet. Meadow strip, stream with waterfall, stone bridge, gate arch, view of roofs and the Old Tree crown. Wake-up, the task, first breathing. |
| **Main Street** | Curves uphill from the arch to the square. A few citizens. Gold light guides the player along it. |
| **Town Square** | Heart of the town, on a raised round terrace. The **Old Tree** (outer form of the Inner Tree), a **fountain**, 2 stalls, most citizens. First Look Within here. **The bump happens here.** |
| **Alley** | Narrow, curving side lane off the square. Shade. Where the stranger ran. The child and the spilled basket are here. |

- Map links are fixed. Exact distances are not. Start value: start → square ≈ 40 m.
- The town is closed on all sides by houses, cliffs and a low wall. No invisible walls in open space.
- The Old Tree is visible from almost everywhere. It is the main landmark.

### 5.2 Inner World — the valley inside

Reuse the existing valley (`src/valley/`): terrain with sandstone cliffs, pond, waterfall, sky, props. Make it smaller and rebuild the centre.

```
              INNER TREE (giant, same shape as the Old Tree)
             /        |          \
   IMP CLEARING    big roots     (calm side of the roots)
  (burned root)       |
                 SOURCE POND + waterfall
                      |
                  ENTRANCE (arrival light)
```

| Place | Purpose |
|---|---|
| **Entrance** | Where the player arrives. A soft column of light. Standing in it and pressing Q also returns. |
| **Source Pond** | The existing pond and waterfall. Water flows from here into the roots. |
| **Inner Tree** | Much larger than the Old Tree but the **same silhouette** (same crown shape, same lean), so the link is obvious. Huge roots above ground. |
| **Imp Clearing** | A clearing between two roots. Here the imp appears after the bump. One root is **burned** (dark, cracked, glowing embers). The imp wanders slowly in this clearing. **Inside, every Thought Wave comes visibly from the imp**: it roars, its flame flares, a fiery ring leaves its chest and a fire trail links it to the wave. Outside the same thoughts show as bubbles above the head (Alexander, 2026-10-12). |

- The inner world has more height and depth than the town: roots to walk along, a view down to the pond.
- **Reveal rule:** before the bump, the Imp Clearing is empty and the root is healthy. The imp does not exist yet. The world shows only what the player has lived through.

### 5.3 Switching worlds (Look Within)
- Press Q (or the diamond button). Available from beat 2 on (section 9), everywhere, at any time.
- Transition (about 1.6 s): the camera moves in toward the glowing diamond, a warm gold bloom fills the screen, the inner world fades in with the player standing at the Entrance.
- Return: Q again (anywhere inside). Reverse transition. The player is back at the exact spot they left.
- **Outer time pauses** while inside. Citizens freeze in place but the scene is hidden, so this is never seen.
- Thought Bubbles exist in both worlds while anger is active.
- The player never loses their place in the story by switching.

## 6. Characters

### 6.1 Citizens (outer world)
- Built from the **same figure code** as the player, with a variant config: other colours, **hood down** (simple head with short hair or a cap), no gold diamond, optional beard block.
- **Visual reference:** `assets/wütender Bürger mit Fackel und Dampf.png`. Take from it: olive tunic, cream sleeves, orange-brown scarf, brown boots, the **torch** and the **steam puffs with small lightning bolts** above the head. Do **not** copy the detailed face. Anger reads through posture, steam and torch, not facial detail.
- About **8 citizens** in the PoC (budget, see section 11). Colour sets: earthy (olive/brown), muted (grey/ivory), deep (dark red/umber). Mix all sets everywhere. None of them means good or bad.
- Some carry a **torch** (code: stick + flame particles). Torch flame height follows the town's anger.
- Behaviour states, driven by `agitation = personalBase + townAnger × weight`:

| Agitation | Behaviour |
|---|---|
| low | Walk slow loops, stop, look around, chat in pairs |
| medium | Stomp, fists, a steam puff now and then, torch raised |
| high | Steam often, short grumbling bubbles, two citizens **bump into each other** and shove apart, torch flares |

- Citizens never attack the player. At high anger one may brush past the player (small push, no harm). After each push of a bubble, a citizen walks into the player (see 7.3).
- Optional flavour: walking close shows one short bubble with their own reason ("My cart broke again!", "Nobody listens!"). *Drafts.*

### 6.2 The Stranger and the Child
- **The Stranger:** a citizen in neutral colours, no torch. In a hurry. He causes the bump.
- **The Child:** a small citizen figure (scale ≈ 0.6). Sits on the ground in the alley, crying, knee scraped. A spilled basket of apples around.
- The truth the player discovers: the stranger ran because his child fell. He did not see the player.

### 6.3 The Anger Imp (inner world)
- Built in code from simple shapes. Size: **five times its former size** (former size was about 1.5× the player, so now about 7.5× the player). Round body, cream belly, short legs, round fists, pointed ears, two dark curved horns, tail with a triangular tip.
- **Size follows the outer anger.** The imp grows, glows redder and throws more steam when anger is high. It shrinks and softens when anger is low. Mirror rule, see section 8.
- It is the player's own inner part. Hint at this: **in its calm form it wears a scarf like the player's.**

| State | Reference image | Look and motion |
|---|---|---|
| `raging` | `assets/Wutteufel, tobend.png` | Wide stance, fists up, stomping. Mouth open, angry brows. Steam clouds, small orange lightning bolts, small rocks thrown up. **Spits fire puffs** at the burned root and into the air. Sends out "I'm so angry..." bubbles. |
| `calming` | (between both) | Stomps less, steam thinner, fists lower, looks toward the player. Can fall back to `raging` while the story is not ready. |
| `calm` | `assets/Wutteufel, ruhig, mit warmer Flamme.png` | Standing straight, eyes closed, soft smile, scarf. Holds a **warm gold flame** in both hands. Small sparkles. No more bubbles. |

- Colours from the images: body warm orange-red (between `PALETTE.sandstone` and `PALETTE.cloak`), belly ivory, horns and hands dark umber, flame pale gold.
- The images are **concept references only**. The game does not load them. Do not rename or move them.

## 7. Mechanics

### 7.1 The Lantern
- A small lantern the player carries from the start. Code-made.
- `lanternLight`: 1.0 at start (bright white-gold). After the bump: 0.15 (a weak, flickering ember).
- At the Old Tree with a weak lantern: placing fails softly. The inner voice says the light is too weak and suggests looking within.
- After the imp transforms, it gives its flame. The lantern burns again — **warmer than before** (gold-orange instead of white). The anger's fire now lives in it.

### 7.2 Breathing (existing `BreathSystem`)
- Unchanged input and rhythm: about 4 s in, 4 s out. Rhythm guide on screen.
- New meaning: **breathing lets a Thought Bubble dissolve slowly**.
- While the player breathes in or out, a bubble that touches them **dissolves slowly**: its text fades, it loses its shape and drifts apart. More breathing calms the town (see 7.4).
- A full good breath near the imp counts as "breathing with the imp" (used in 7.6).
- Breathing also lowers anger a little (see 7.4), but never below the floor.

### 7.3 Thought Bubbles (formerly Thought Waves)
- **Look:** 3–4 small spheres rise from the player's head. They join and form **one big comic bubble** with the thought text inside. Ivory inside, a warm red-orange rim (colours from `SHADES`, section 11). Readable at any distance where it matters.
- **Text:** the bubble holds one line. Its text comes from `thoughts` in `en.json`, picked by anger level (0, 1 or 2). The bubble on its own is "I'm so angry..." (`waveText`).
- Bubbles exist only while anger is active. They come and go.
- **Where they come from:**
  - Outside: from the direction of the alley (where the stranger ran) and from agitated citizens. The direction itself is a clue.
  - Inside: from the imp.
- They drift toward and past the player at walking pace or slower. The path always stays visible.
- Three outcomes when a bubble reaches the player:

| Player does | What happens | Effect |
|---|---|---|
| **Breathes** (in or out while touched) | Bubble dissolves slowly | anger − small · town calms (fewer steam clouds, smaller and softer torch flames, less fire, less tumult) · `passStreak + 1` |
| **Pushes** (E / hand) | Bubble is shoved away with a hot flash. Short relief (a few seconds without bubbles). Then it **returns bigger, faster, text larger**. Shortly after the push a **citizen walks into the player**: soft bump, figure wobbles, no damage | anger + · town agitation flares · `pushLevel + 1` · citizen bump |
| **Nothing** | Bubble hits: figure staggers, walks slower for ~2 s, warm red tint at the screen edge | anger + tiny · no lasting harm |

- `pushLevel` makes all new bubbles bigger and stronger. A strong bubble can push the player 1–3 m off their path. Max `pushLevel` is capped.
- **Recovery:** every dissolved bubble lowers `pushLevel` by one. After 3 dissolves in a row bubbles return to normal size.
- After the first push the inner voice says: "It only came back stronger." Then the breathing hint (lines in section 10).

### 7.4 Anger value
- One hidden value `anger` (0..1), shared by both worlds. No bar on screen. The world shows it.
- It drives: bubble rate, bubble size, citizen agitation, torch height, world mood (reuse the valley mood system: haze colour, warmth, saturation), the imp's rage intensity and size, embers on the burned root.
- Start values (all in `TUNING.anger`): bump sets anger to 0.7. Push +0.08. Unhandled hit +0.02. Dissolved bubble −0.05.
- **Floor:** before the outer step (7.5) anger never goes below 0.35. Breathing helps but does not finish the story.
- After the imp transforms, anger goes to 0 over a few seconds and **bubbles stop for good**.

### 7.5 The outer step (help)
- Bubbles and the imp's clue point to the alley. The player walks there. Bubbles come thicker near it — approaching is part of play.
- In the alley: the child sits crying, the stranger kneels beside it, the basket is spilled. **5 apples** lie around.
- The player picks up the apples (walk close + E, each glows) and puts them back in the basket.
- The stranger stands up and speaks (section 10). The child stops crying and waves.
- Insight line (inner voice): "I only saw a part of it."
- Result: `story.helped = true`. The anger floor is removed. Anger drops one step. Bubbles outside become fewer. Inside, the imp can now calm.

### 7.6 The imp's transformation
- Before the outer step: breathing with the imp makes it go `calming` for a moment, then it flares up again. Inner voice: "It is still hurting. Something outside isn't finished."
- **Clue:** when the imp spits fire, the fire briefly shows a small shape falling (the child), and it points toward the alley side of the valley. Simple, symbolic, no text needed.
- After the outer step: the player stands near the imp and does **3 good breaths** while its bubbles dissolve. The imp goes `calming` → `calm`.
- On `calm`: water flows from the Source into the burned root, the root heals (dark → wood colour, embers → small green leaves). The imp opens its hands: the warm flame floats to the player's lantern.

### 7.7 Delivery and end
- Back outside, the town is calmer but **not** changed into something else: torches still burn (warmer, softer), some citizens are still grumpy, the alley still has shade. The stranger and the child wave.
- The player walks to the Old Tree and places the lantern in a niche in its trunk (E / tap).
- The Old Tree's dry branch heals and glows warm. Inside, the Inner Tree does the same at the same branch.
- End card (calm, short). The player can keep walking afterwards and Look Within to visit the calm imp.

## 8. The mirror rules (inner ↔ outer)

| Inner world | Outer world | Direction |
|---|---|---|
| The imp's rage and size | Town agitation, torch height, citizens bumping | both ways via `anger` |
| Burned root, embers | A dry, leafless branch on the Old Tree | inner → outer |
| Source Pond flows into the root | The town fountain runs clearer and higher | inner → outer |
| Thought Bubbles from the imp | Thought Bubbles from the alley and citizens | both |
| The imp calm with a warm flame | The lantern burns warm gold-orange | inner → outer |
| Healed root, small leaves | Healed branch, warm glow | both, at the same moment |
| The bump happens | The imp appears, the root starts burning | outer → inner |
| Helping in the alley | The imp can calm, its bubbles get fewer | outer → inner |

- Rule: when something important changes in one world, the matching thing changes in the other — even if the player cannot see it right now. When they switch, it is already there.
- Both trees share one silhouette definition in code. Branch/root index `k` outside = index `k` inside.

## 9. Story beats (state machine)

| # | Beat | Done when | Unlocks |
|---|---|---|---|
| 0 | **Wake** at Town Edge with the lantern. Task line: "Bring the lantern to the Old Tree." | Task line shown | Walking |
| 1 | **Breathe once** (taught, not blocking; no bubbles yet) | One full breath (or skipped) | — |
| 1b | **Walk to the square.** Gold light guides the way along Main Street. | Player reaches the square | — |
| 2 | **First Look Within** on the square (inner voice invites). Inner world all calm: tree, pond, empty clearing. Return. | Player went in and out | Q any time |
| 3 | **The bump** on the square. Lantern drops to ember. Stranger runs into the alley. Inner voice: "Now I am angry. I should look within." | Cutscene ends (≤ 4 s, player keeps control after) | Anger, bubbles, agitation |
| 4 | **Bubbles.** First push → inner voice line. Then the hint "breathe, let it pass". | Player let 1 bubble dissolve | — |
| 5 | **Soft block at the Old Tree** (optional for the player): weak lantern cannot light the tree. Inner voice suggests looking within. | — | — |
| 6 | **Imp revealed** on next Look Within. Rage, burned root, clue. Breathing calms it only for a moment. Back outside: "Everyone is angry now. Just like me." | Player saw the imp | — |
| 7 | **Alley.** See the whole situation. Gather 5 apples. Stranger's line, insight line. | Basket full | `helped` |
| 8 | **Transform.** Back inside, 3 good breaths with the imp. Calm, root heals, flame to lantern. | Lantern relit | Bubbles stop |
| 9 | **Deliver.** Outside, place lantern at the Old Tree. Both trees heal. End card. | Lantern placed | Free walk |

- Beats 4–7 can be done in any order once beat 3 happened (e.g. the player may go to the alley before looking within). The imp only transforms when **both** `helped` and the inner return (beat 8) are true.
- Save a small checkpoint per beat in `localStorage` (pattern of `src/valley/ValleySave.ts`). Storage may fail — the game must still run.

## 10. Text (English, all *drafts* for Alexander)

Speaker: the **inner voice** (bottom line) unless the row says otherwise. Control hints have a touch version.
Key names keep the old `wave…` prefix from the Thought Wave version. The keys stay as they are in `en.json`.

| Key (suggested) | Line |
|---|---|
| `taskLantern` | "Bring the lantern to the Old Tree." |
| `hintMove` | "Use W A S D to walk. Drag to look around." (touch: "Drag on the left side to walk.") |
| `hintBreathe` | "Hold Space to breathe in. Hold Shift to breathe out." (touch: "Hold the light button to breathe in. Let go to breathe out.") |
| `firstBreath` | "Calm. I am here." |
| `hintLookWithin` | "There is a whole world inside me. Press Q to look within." (touch: "Tap the diamond to look within.") |
| `innerFirst` | "This is my inner valley. The big tree is mine too." |
| `bumpAfter` | "Hey! … My light is almost out." |
| `angryLookWithin` | "Now I am angry. I should look within." |
| `outerAngry` | "Everyone is angry now. Just like me." |
| `waveText` (exact, in the bubble) | **"I'm so angry..."** |
| `thoughts` (in the bubble, by anger level 0 / 1 / 2) | Level 0: "Why does nobody listen to me?", "This always happens to me.", "I can't stand this.", "Nobody sees how hard I try." · Level 1: "They do this on purpose!", "Why is everyone against me?", "I've had enough of this!", "They never respect me." · Level 2: "I'm so angry I could scream!", "Everything is falling apart!", "I can't take it anymore!", "They'll pay for this!" *(drafts by Claude)* |
| `wavePushed` / `thoughtPushed` | "It only came back stronger." |
| `waveBreathe` | "Breathe. Let it pass through." |
| `wavePassed` / `thoughtPassed` | "It passed." *(`thoughtPassed` is the new line for a dissolved bubble)* |
| `treeTooWeak` | "My light is too weak now. Maybe I should look within." |
| `impFirst` | "Someone is very angry in here." |
| `impNotYet` | "It is still hurting. Something outside isn't finished." |
| `alleyArrive` | "Look closer." |
| `strangerSorry` (spoken by the Stranger, speech bubble) | "I'm sorry. I didn't see you. My little one fell." |
| `insight` | "I only saw a part of it." |
| `impCalm` | "The fire is still there. Now it warms." |
| `lanternRelit` | "My light is back. Warmer than before." |
| `endTitle` / `endLine` | "The Lantern" / "I carried my fire home." |

## 11. Visual direction

- Basis: the current valley look (soft toon shader, warm light from the right, cool lavender shade, distance haze) and `docs/style-reference.png`.
- Palette tokens from `src/config/palette.ts` everywhere. New anger colours (heat orange, ember red, smoke ivory) go into `SHADES`, not as loose hex values.
- Everything in code with Babylon.js: primitives, procedural meshes, thin instances, particles, shaders. **No image files and no GLB models in the game** for this PoC.
- The three images in `assets/` are references for shape, colour and mood only.
- Anger shows as **heat**: warmer and redder haze, shimmer, higher flames, steam. Never dark horror.
- The calm ending is **not** golden everywhere. Shade, quiet corners and torches stay.

## 12. Out of scope for this PoC

- The package, money, Fear, Attachment, Exchange House, reflection questions with typed answers (ideas from the concept input; maybe later chapters).
- A start menu to choose a theme (later, when there are several themes).
- Music files (synth sounds via `src/core/Sound.ts` are fine).
- More than one town, more than one trait.

## 13. Open questions for Alexander (none blocks the build)

1. Approve or change the texts in section 10.
2. Should citizens show their own short reasons when you walk close (6.1, optional)?
