# Light Within — chapter 1 "Receive"

Completion report. Everything in this report was measured on this machine.

---

## 1. What was built, per milestone

### M0 Setup

Vite, TypeScript in strict mode, a 3D engine (Three.js at first, Babylon.js
since — see section C3), ESLint, Prettier, Vitest and Playwright. `CLAUDE.md` in the project root holds the content rules,
the stack, the performance budget and the art rules, so later chapters follow
the same rules. Debug URL parameters work: `?debug=1`, `?scene=N`,
`?autobreathe=1`, plus two I added (see section 5).

All player-facing text lives in `src/content/strings.en.ts` behind a
`GameStrings` interface and a `LOCALES` map. A German file is one new file plus
one line in that map. All tunable numbers live in `src/content/chapter1.ts`.
The six logic systems (breath, calm, light, transform, manifest, checks) import
nothing from the engine at all, so they run in plain Vitest.

### M1 World

One valley, all made in code. A heightfield with a wandering path, a wide field
at scene 3, a narrow pinch at scene 4 and a side path at scene 5. Soft borders:
the hills rise and the mist thickens, and the player is turned back gently.
There are no invisible walls.

The gap at scene 5 is a real hole in the terrain mesh. The ground check finds
nothing there, so the player cannot cross until the bridge exists. The bridge
deck carries the player once it has risen.

The ground height, the slope limit and prop collision all read the heightfield
the terrain was built from, so the answer is the height of the very triangle
that is drawn. Walking into a rock slides along it instead of stopping dead.

Props, all procedural: rounded rocks, stylised trees (a trunk plus clustered
soft blobs), stone spring basins, the carved sign stone, the arched bridge.
Grass and flowers are camera-facing cards with a brush-stroke alpha made in the
shader; they lean, sway, and bend away from the fog. The player is a soft,
faceless figure with a cloak, a calm glow, a blob shadow and orbiting light
motes. The camera follows gently and never jumps.

### M2 Look

A Kuwahara-style painting filter (a 5 by 5 window, four sectors, lowest
variance wins), then a pass with procedural paper grain and a soft vignette.
The same pass also does the screen darkening used inside the fog.

The grey-to-colour system is one shader chunk shared by every world material,
injected with `onBeforeCompile`. A `vec4` uniform array holds up to eight
restored zones as centre, radius and strength. Inside a zone the material shows
full colour; outside it is desaturated and pulled toward blue-grey. Zones grow
over 2 to 4 seconds. A global value lifts the whole valley at the end.

Three quality tiers, picked automatically from a short frame-time probe at
start and changeable in settings.

### M3 Breath

The breath circle sits in the lower centre: a dashed ring showing the target
rhythm and a filled disc following what the player is actually holding. One
breath is one hold plus one release. A breath is calm when both durations are
inside the preset tolerance. Breathing counts only while standing still;
walking resets the breath in progress and nothing bad happens.

Three rhythm presets. The hidden calm value rises with calm breaths and falls
slowly otherwise, and is never shown. The player's glow follows it, and a soft
bell sounds on every calm breath, so the cue is visual **and** audio.
`circleStrength` is kept as a parameter, 1.0 in chapter 1.

All sound is generated with the Web Audio API: an evolving pad that warms as
colour returns, filtered noise that rises on the in-breath and falls on the
out-breath, a calm bell, a water shimmer and a chime per mote, a low fog drone
with a muffle filter over the whole mix, a dull thud for the push, rising tones
for the seed and a warm chord for the finished bridge. Audio starts only after
the first user interaction.

### M4 Receive

Springs give one light per calm breath inside 3 m, up to their own limit. Light
rises from the spring and flows into the player as motes. Hidden springs stay
invisible until two calm breaths have been taken within 6 m. An empty spring
keeps a gentle glow and leaves a colour zone. Walking stops the flow and
nothing else. Scenes 1 to 3 and the bird hint work.

### M5 Transform

One soft fog on the narrow path, in three steps that cannot be skipped.
**See it:** inside 8 m the thought appears inside the fog in a handwritten
style over four seconds. **Feel it:** inside 5 m a soft wind bends the grass,
the breath circle trembles, a low drone plays, and two calm breaths are needed.
**Become one:** in the middle the screen darkens softly and the sound is
muffled; after three calm breaths the fog dissolves into motes that flow into
the player, the path opens and a colour zone appears.

Running away grows the fog by 10 percent, up to 30 percent, drifts it one metre
toward the player and resets the current step. Push is offered near the fog, it
plays a thud, makes the fog denser and adds a calm breath to the last step, up
to two. Push never works.

### M6 Manifest

A seed spot at the edge of the gap. The choice panel offers Bridge; Tree, House
and Well are shown and disabled for later chapters. Planting costs 5 light. The
seed grows only while the player is more than 15 m away and needs 25 seconds of
away time; coming back pauses growth, dims the sprout and adds 3 seconds, up to 9. The bridge then rises over 3 seconds. The heart-or-mind decision sits in the
code at a calm value of 0.6; chapter 1 always creates a heart seed. The side
path to the third spring gives more than enough away time. The butterfly hint
works.

### M7 Thanks and ending

Three calm breaths on the finished bridge turn it golden and animate the global
colour to 1 over six seconds. Then the learning cycle: Reflect with three
answers that all get the same reply, the Understand card, the Apply card, the
two closing questions, and the chapter end screen with Chapter 2 shown as
coming soon. Progress is saved per scene in `localStorage`, and the start
screen offers to continue.

### M8 Polish

Sound pass, mobile control pass (joystick, large breath button, small push
button, pause in the corner), accessibility pass, and a performance pass that
cut the painting filter from a 7 by 7 window to a 5 by 5 one with a wider step
and made distant grass collapse to nothing. Together those gave about 60 percent
more frames.

---

## 2. Screenshots

All in `screenshots/`, one set per scene, desktop 1280 x 720 and mobile
390 x 844. The mobile pictures show the touch controls.

| Scene               | Desktop                            | Mobile                            |
| ------------------- | ---------------------------------- | --------------------------------- |
| Start screen        | `start-screen-desktop.png`         | `start-screen-mobile.png`         |
| Settings            | `settings-desktop.png`             | `settings-mobile.png`             |
| Start questions     | `start-questions-desktop.png`      | `start-questions-mobile.png`      |
| 1 Wake up           | `scene1-wake-desktop.png`          | `scene1-wake-mobile.png`          |
| 2 The dry spring    | `scene2-dry-spring-desktop.png`    | `scene2-dry-spring-mobile.png`    |
| 3 The hidden spring | `scene3-hidden-spring-desktop.png` | `scene3-hidden-spring-mobile.png` |
| 4 The first fog     | `scene4-fog-desktop.png`           | `scene4-fog-mobile.png`           |
| 5 The seed spot     | `scene5-seed-spot-desktop.png`     | `scene5-seed-spot-mobile.png`     |
| 5 The planted seed  | `scene5-seed-planted-desktop.png`  | `scene5-seed-planted-mobile.png`  |
| 5 The seed choice   | `seed-choice-desktop.png`          | `seed-choice-mobile.png`          |
| 6 The bridge        | `scene6-bridge-desktop.png`        | `scene6-bridge-mobile.png`        |
| 6 Full colour       | `scene6-full-colour-desktop.png`   | `scene6-full-colour-mobile.png`   |
| Pause               | `pause-desktop.png`                | `pause-mobile.png`                |
| Reflect             | `after1-reflect-desktop.png`       | `after1-reflect-mobile.png`       |
| Reflect reply       | `after1-reflect-reply-desktop.png` | `after1-reflect-reply-mobile.png` |
| Understand          | `after2-understand-desktop.png`    | `after2-understand-mobile.png`    |
| Apply               | `after3-apply-desktop.png`         | `after3-apply-mobile.png`         |
| Chapter end         | `after4-chapter-end-desktop.png`   | `after4-chapter-end-mobile.png`   |

_Updated for chapter 2:_ the closing questions moved to the end of the last
chapter in the build, so chapter 1 goes from Apply straight to its end screen,
and that screen now offers the walk on into chapter 2. The old
`after4-end-questions` and `after5-chapter-end` files are gone.

The full play-through writes its own set as well, so there is a picture of every
scene taken during a real, uninterrupted play: `scene0-start`, `scene0-questions`,
`scene1-wake`, `scene2-spring`, `scene3-hidden-spring`, `scene4-fog`,
`scene4-fog-center`, `scene5-seed-spot`, `scene5-seed-choice`,
`scene5-side-path`, `scene6-bridge`, `scene6-full-colour`, and the five
`after` panels, each with a `-desktop` and a `-mobile` suffix. Those are the
low-tier pictures described in section 5.

50 files in total.

---

## 3. Test results

### Unit tests, Vitest

**86 passed, 0 failed**, in 8 files.

| File                | Tests | What it covers                                                                                                                                                                                 |
| ------------------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `breath.test.ts`    | 10    | Tolerance in and out, both edges of the band, walking resets the breath, no breath starts while walking, a tap that is too short is ignored, each preset uses its own values                   |
| `calm.test.ts`      | 9     | Rises with calm breaths, falls with non-calm ones, falls slowly while walking, stays inside 0 and 1, the 0.6 threshold is reachable                                                            |
| `light.test.ts`     | 8     | Never above 12, never below 0, a seed cannot be planted with 4 light, can be with 5, chapter 1 gives 11 light in total                                                                         |
| `transform.test.ts` | 13    | Step order cannot be skipped, the text cannot be skipped, running away grows the fog and caps at +30 percent, push caps at +2 breaths and never works, breaths outside the middle do not count |
| `manifest.test.ts`  | 12    | No growth within 15 m, completes after 25 s away, the return penalty caps at +9 s, the bridge rise, the 0.6 heart threshold, chapter 1 always plants a heart seed                              |
| `save.test.ts`      | 10    | Restores the right scene and light, survives a broken entry, clamps out-of-range values, settings round-trip, learning checks and their JSON export                                            |

### Browser tests, Playwright

**62 passed, 0 failed**, run on desktop 1280 x 720 and on a Pixel 7 profile at
390 x 844.

| Spec                    | Per project | What it covers                                                                                                                                                                                                                                       |
| ----------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chapter1.spec.ts`      | 1           | A full run with `?autobreathe=1`, from the start screen to the chapter end screen, through all six scenes and the whole learning cycle. It also checks that push does not dissolve the fog, that Tree is disabled, and that no page error was logged |
| `screenshots.spec.ts`   | 9           | One picture per scene plus every panel                                                                                                                                                                                                               |
| `network.spec.ts`       | 3           | No request leaves the origin, the font is served from `/fonts/`, and a report of what is downloaded                                                                                                                                                  |
| `accessibility.spec.ts` | 3           | The first control is focused when a panel opens, Tab reaches the next control, the focus outline is visible, Enter activates, settings are stored, and every panel button is at least 48 px tall                                                     |
| `perf.spec.ts`          | 5           | Real frames per second per tier                                                                                                                                                                                                                      |

The full run takes about 4 minutes 40 seconds of play with the easy rhythm and
automatic breathing. A person at the normal rhythm, reading and walking at their
own pace, lands inside the 10 to 15 minute target.

---

## 4. Bundle size and frame rate

### Download, measured in the browser

|                                     | Bytes                   |
| ----------------------------------- | ----------------------- |
| `index.html`                        | 575                     |
| JavaScript                          | 709,461                 |
| CSS                                 | 7,096                   |
| Work Sans regular                   | 188,916                 |
| Work Sans bold                      | 191,304                 |
| **Initial download, uncompressed**  | **1,097,352 (1.05 MB)** |
| Handwriting font, loaded at the fog | 32,020                  |
| **Total, uncompressed**             | **1,129,372 (1.08 MB)** |

Gzipped, as a static host would serve it: JavaScript 185 KB, CSS 2.2 KB,
HTML 0.3 KB, the two TrueType fonts about 100 KB each, so roughly **390 KB
initial**.

**Budget: 6 MB initial, 15 MB total. Both are met with a lot of room.**
There are no model or texture files; all art is made in code. The only outside
assets are the three self-hosted fonts, all under the SIL Open Font License,
with their licences shipped next to them.

### Frame rate, measured

**This machine has no GPU.** Chromium falls back to SwiftShader, which runs the
fragment shaders on the CPU. These numbers are a floor, not what a real device
gives, and I could not verify the 60 fps and 30 fps targets here.

Real frames per second over a ten-second window, standing in scene 1:

| Tier                      | Desktop 1280 x 720 | Mobile 390 x 844 at DPR 2 |
| ------------------------- | ------------------ | ------------------------- |
| high                      | 1.2                | 1.2                       |
| medium                    | 1.5                | 2.0                       |
| low                       | 3.3                | 4.3                       |
| low, painting filter off  | 5.5                | 6.3                       |
| high, painting filter off | 1.6                | 2.9                       |

Repeated runs vary by roughly 30 percent, because the machine is shared and the
whole picture is drawn on the CPU. The order of the tiers is stable.

What the numbers show: the painting filter roughly doubles the frame time, and
the grass cards cost about as much again. On a real GPU both are cheap work,
but I am not going to claim a number I did not measure.

The automatic probe does the right thing here: it measures about 1 fps and
picks the low tier.

Device pixel ratio is capped at 1.5 on touch devices and 2 elsewhere.

---

## 5. Where I changed the brief, and why

1. **Two extra debug parameters.** `?nopaint=1` turns the painting filter off
   and `?quality=low|medium|high` pins a tier instead of measuring it. I needed
   both to find out what was slow and to take sharp screenshots on a machine
   that measures 1 fps and therefore always picks the low tier. They are
   documented in `CLAUDE.md`.

2. **The scene screenshots use `?scene=N`, not the full run.** The brief asks
   for a picture per scene and a full run. Both exist, but they are separate
   tests. The full run at one frame per second produces soft pictures because
   the low tier renders at half resolution; the per-scene pictures use the
   documented scene jump at the high tier so each scene is sharp. The full run
   still takes its own pictures.

3. **A fixed simulation step.** The brief does not mention one. I added it after
   finding that the world ran on the raw frame delta: at one frame per second
   the breath rhythm and the 25 second seed timer ran about sixteen times too
   slow. The loop now steps a fixed 1/60 second and catches up to one second of
   real time per frame, so the rhythm is the same on a fast and a slow machine.

4. **The low tier drops the whole post-processing resolution, not only the
   filter.** The brief asks for the painting filter at half resolution. Running
   the filter alone at half resolution would still cost a full-resolution scene
   render, which is where most of the time goes. The low tier renders the scene
   and the filter at half resolution and upscales; the medium tier uses 0.85.
   The brush step widens with the tier as well, so the painted patches stay the
   same size on screen.

5. **The push and plant buttons are shown on desktop too.** The brief puts the
   push button on the mobile layout. On desktop E and Enter do the same thing,
   but a key with nothing on screen is invisible, so the buttons are shown with
   the key printed on them.

6. **A short control label under the breath circle.** "Hold to breathe in" and
   "Release to breathe out" follow the target rhythm. The brief wants no text
   before the player has experienced something; this is a control label, not an
   explanation, and it is the only way to teach the hold-and-release with no
   companion character.

7. **Scene 1 ends after three calm breaths, wherever the player stands.**
   The brief says the glow appears and the player can walk after three calm
   breaths, but does not say what ends the scene. I made the same three breaths
   end scene 1 and start scene 2.

8. **The gap is a hole in the mesh.** The brief does not say how to stop the
   player crossing. Leaving the triangles out means the ground raycast finds
   nothing, so no invisible wall is needed anywhere.

9. **A frame-rate watchdog on top of the start probe.** The brief asks for the
   tier to be picked from a short frame-time test at start. That test runs in
   the first second, before the player has walked anywhere or reached the fog,
   so it can read a device as faster than it turns out to be. The watchdog keeps
   checking during play and only ever steps down. The brief's behaviour is
   unchanged; this only catches the case where the start reading was wrong.

10. **A restored area is brighter, not only more colourful.** The brief
    describes the grey side as desaturated and slightly blue-grey. That tint
    lifts dark colours, which meant a grey meadow could be _brighter_ than the
    restored one, so someone who cannot see the colour change had no cue at
    all. The grey side is now also held below the restored side in brightness.
    It reads as light returning, which suits the chapter, and it is tested.

---

## 5b. What the first real play test found

The automated run played the whole chapter and passed. A person played it and
almost nothing worked. Both were true, and the gap between them is the most
useful thing to come out of this project so far.

1. **Every mechanic except breathing was gated behind a scene counter, and the
   counter was gated behind the _hidden_ spring.**
   `runScene` ran the fog only in scene 4, the seed only in scene 5 and the
   thanks only in scene 6. The scene number moved from 3 to 4 only when the
   second spring was emptied, and that spring is invisible until the player
   takes two calm breaths within 6 m of it, in a wide field, with no cue for
   the first two minutes. A player who walked past it reached a fog that did
   nothing at all, and behind that fog no seed, no bridge and no ending.
   The valley is one open place with one real barrier in it, the gap in the
   ground. Nothing else should ever have been gated. Every system now runs
   every frame, wherever the player is standing, and the scene number only
   records how far they have come. Two browser tests cover it: one walks
   straight past the hidden spring and dissolves the fog anyway, one plants the
   seed while nominally still in scene 2.

2. **There was no path.** The brief says "a path leads to a dry spring". The
   valley had a walkable corridor but nothing to see, so the player stood in an
   even grey meadow with no reason to go one way rather than another. There is
   now a walked track down the valley, with a branch to the dry spring and the
   side path out to the third spring. It is painted into the terrain's vertex
   colours and keeps the grass off itself, so it costs no geometry. There is
   deliberately no track to the hidden spring; that one is still found by
   stopping.

3. **A and D were swapped.** The camera's right vector was the negative of
   `forward` crossed with up, so pressing right walked left. The browser tests
   never caught it because they steered the player with a world-space helper
   that skips the camera-relative step entirely. There is now a spec that
   presses the real keys, and a unit test on the camera basis; both fail on the
   old code.

4. **The touch controls showed on a laptop.** The joystick and the big breath
   button appeared on any device reporting touch points, which includes a
   laptop with a touchscreen. They now wait for a finger to actually be used.

## 6. Known problems, worst first

1. **The frame rate targets are still unverified.** 60 fps on a mid-range laptop
   and 30 fps on a mid-range Android phone cannot be measured here, because this
   machine renders on the CPU. Section 4 gives the software numbers. This still
   needs one run on real hardware before the budget can be called met. It is the
   only item on this list that nothing in the code can settle.

2. **Mobile frame rate: now guarded, still not proven.** Three things changed
   since the first report:
   - A **watchdog** watches the real frame rate during play and steps the tier
     down when a device cannot keep up (below 24 fps on touch, 45 fps
     elsewhere, measured over five seconds with a six second cooldown). It only
     ever steps **down**, so it cannot oscillate, and it switches off the moment
     the player picks a tier by hand.
   - Changing the tier used to do nothing to the grass, because the cards were
     counted when the world was built. The grass is now built once at the
     highest count and the tier decides how many are drawn and how close they
     fade, so a quality change takes effect immediately.
   - The low tier now fades grass out at 24 m instead of 48 m.

   A slow phone therefore settles itself instead of staying slow. The targets
   still need checking on real hardware.

3. **Colour is no longer the only cue for the grey-to-colour change.** The grey
   side is now held below the restored side in brightness, so a restored area
   reads as brighter even with the colour removed. A browser test screenshots
   the same view grey and restored, converts both to greyscale and fails if the
   difference is too small. The blue-grey tint used to _lift_ dark colours,
   which made the grey side brighter than the restored one for dark greens —
   exactly backwards. That is fixed.

4. **The colour zone array holds eight zones.** Chapter 1 creates four, so it
   never overflows. A later chapter with more springs will start dropping the
   oldest zone. The limit is `COLOR.maxZones`; raising it costs shader time in a
   loop that runs per pixel. Left as it is on purpose.

5. **The valley is one mesh with no chunking.** About 27,000 triangles, which is
   fine for this chapter. A larger world will need splitting before the bounds
   tree and the draw call become a problem. Left as it is on purpose.

6. **Fixed: the bridge turning golden.** It used to nudge shared material
   colours by a small step every frame, which was frame-rate dependent and
   destroyed the original colours. The bridge now keeps its own colours and the
   blend is set from the whole amount, so the result is the same however many
   frames it took and it can be put back.

7. **Fixed: a storage write per learning check.** Changes are now held in memory
   and written every five seconds, when a scene ends, and when the page is
   hidden or closed. Writing a value that has not changed does nothing.

8. **Fixed: audio after the page was hidden.** The game now resumes the audio
   context when the page comes back, and saves progress when it goes away. This
   still could not be tried on a real iOS device.

9. **`skyStrokes` and `treeBlobs` follow the tier the game starts with.** They
   are baked into the sky shader and the tree geometry at world build, so a
   quality change during play does not alter them. Both are cheap; the grass,
   the painting filter and the resolution are where the cost is, and all three
   do change at once.

## 7. Open questions

1. **The title.** "Light Within" is the working title from the brief and it sits
   in one constant, `GAME_TITLE`. Do you want to keep it, or shall I prepare a
   shortlist?

2. **The closing questions.** They are the same two questions as at the start,
   at the end of chapter 1, as the brief says "for now". Do you want them moved
   to the end of the last chapter later, and the chapter 1 answers kept only as
   a mid-point reading?

3. **German.** The structure is ready: one new file that satisfies
   `GameStrings`, plus one line in `LOCALES`. Do you want me to write the German
   file now, and if so, formal "Sie" or informal "du"?

4. **The reflect answers.** All three get "Thank you for noticing." Should the
   answer still be recorded in the learning checks? Right now it is not stored
   at all, which is the most private reading of the brief, but it is also the
   one thing about the player's inner state that never gets written down.

5. **Chapter 2 and the mind seed.** The mind seed rules are in the code and
   tested at the threshold, but nothing in chapter 1 can create one. Do you want
   a debug way to try a mind seed now, so you can feel whether the
   two-times-faster-then-fades behaviour reads the way you meant it?

   _Answered by chapter 2._ The mind seed is switched on there, and `?calm=0.2`
   forces one. See the chapter 2 report below.

---

---

# Light Within — chapter 2 "Be aware"

Completion report for the second chapter. Everything here was measured on this
machine. Chapter 1 still works; its tests were run again and pass.

---

## C2.1 What was built, per milestone

### C2-M0 Chapter system

The game now holds more than one chapter.

- A registry in `src/content/chapters.ts`. Each chapter is one entry: how many
  scenes it has, how much light it starts with, how strongly the breath circle
  is drawn, and whether it is built. Chapter 3 is already listed and locked.
- `ChapterRunner` in `src/core/chapterRunner.ts` is the whole contract between
  the router and a chapter: `begin`, `update`, `testApi`, `onLeaveToChapter`.
- The save file moved to version 2. Progress is per chapter, and a version 1
  file is migrated into chapter 1's slot, so nobody part way through chapter 1
  loses their walk.
- The start screen lists the chapters and locks the ones not reached. Replaying
  chapter 1 resets only chapter 1.
- The chapter 1 end screen button is now "Walk on", into chapter 2.
- The closing questions follow `LAST_AVAILABLE_CHAPTER`, so they are asked once,
  after the last chapter in the build, not after every chapter.
- The breath circle's strength is now a chapter's choice. Chapter 1 draws it
  fully, chapter 2 at 0.6, because chapter 2 helps less.

### C2-M1 World

The valley of chapter 1 and the meadows of chapter 2 are now two **places**
behind one interface, `src/world/place.ts`. A place owns its height, its
borders, its path, its terrain build and its props. Grass, props, the ground
checks and the border push all read the active place, so the second chapter is
a second place and not a second copy of the world code.

The meadows are wide where the valley was narrow: the floor is 30 m half-width
almost everywhere, the hills are low, and the horizon is closed by two bands of
distant violet mountains rather than by valley sides. The ground climbs about
11 m from the first scene to the last, so every scene looks back down over the
one before it. The path winds the whole length and branches once, up the slope
of the four body stones.

The sky gained a slow day and a night. `uDay` sinks the sun and warms the
horizon over one play of the chapter; `uNight` turns the dome to the night blue
with stars and a moon. Night is not darkness: the sun dims but the sky light in
the environment map is turned **up**, and every world material and the grass
cool toward the night blue while keeping the colour they have won. That is what
makes a moonlit meadow read as moonlit instead of as a dark photograph of a day.

Chapter 2 starts at 0.55 global colour. A player who has learned to receive does
not arrive somewhere grey again.

### C2-M2 Body stones and body glow

Four rounded standing stones up a slope, each with a symbol cut into its face
and drawn in code: two footprints, a circle, a downward point, a ringed circle.
Only the next stone in the order glows. Three calm breaths at a stone light the
matching point on the player's body and give one light. After the fourth, the
four lit points show together for three seconds, with no text.

The four points live on the player figure itself (`setBodyPoint`), so they stay
lit for the rest of the chapter and travel with the player.

### C2-M3 Feeling weather and naming

`FeelingWeather` in `src/systems/weather.ts` is the reusable entity the brief
asked for: type, intensity, size, and whether it follows. It knows nothing about
how it is drawn. `WeatherView` draws it, and the three are told apart by shape
and movement as well as colour:

- **sadness** sits low and heavy and rains straight down,
- **anger** is a taller bank that gusts and pulses slowly in colour,
- **worry** is many small wisps circling fast.

A weather that follows chases at 90 percent of a walk, so the player can put
distance between them slowly, which is what running from a feeling feels like.

The naming panel opens after three seconds standing still nearby with at least
one calm breath done. The three answers are shuffled every time. A name that
fits takes 40 percent off. A name that does not is never called wrong: the reply
is "Look again.", the panel closes for four seconds, and the weather shows its
signature a little more strongly. Every attempt is recorded.

Scene 3 is a sadness cloud that follows the player: stop, name, two calm breaths
under the rain, and it lets go into a rainbow, two light and a colour zone.

### C2-M4 Sound breath and the storm

A tall stone hums when the player stands by it. The first calm out-breath at
full length beside it plays together with the stone, and the sound breath is the
player's from then on. There is no text; the stone's hum and the player's own
note carry it.

From then on every calm, full-length out-breath makes a tone. The tones climb a
pentatonic scale, so however many the player makes, the row is pleasant. Each
tone sends a ring of light out from the player and takes 20 percent off nearby
anger and worry. **Sadness is not changed by a tone** — it is not a thing to be
quietened, only felt through — and there is a unit test that holds that.

The storm on the ridge does not follow. Its five steps cannot be skipped: see
it, name it, feel it, quieten it with five tones, then stand in the middle and
breathe three times. Running away makes it grow, and pushing costs one more
breath, with the same caps as the chapter 1 fog.

### C2-M5 Two seeds, the mind seed and the light well

Two seed spots. Spot A sits where the storm stood, and the leftover wind takes
calm twice as fast there; spot B is a quiet hollow. The heart and mind branch
that chapter 1 carried in code is switched on here: calm at or above 0.6 plants
a heart seed, below it a mind seed.

A mind tree grows in half the away time, stands for sixty seconds, then fades
and gives two light back. A heart tree stays. No text judges either one.

The light well between the two spots gives one light per calm breath, without
limit, but only while the player has fewer than five. It is a floor, not a tap:
a player who spends everything on a tree that fades can always try again.

### C2-M6 Night, the dream and the ending

Night falls once a heart tree stands. Three calm breaths of thanks under it turn
the meadows to full colour, moonlit.

The player lies down in the grass, and the dream fades in over the top of them
settling. The dream is a flat silhouette overlay: a village on a hill under
stars, one lit window per house, and one bird that crosses the same roof twice. There is no
text. It is drawn as an SVG overlay rather than in the world on purpose — a
dream should not look like the place the player is standing in, and building a
second village in three dimensions to show for thirteen seconds would cost more
than the whole chapter.

Then the learning cycle: "Which weather did you meet most today?" with the same
reply for every answer including "None", the Understand card naming
Dr. Rulin Xiu, the Apply card, and the end screen.

### C2-M7 Polish

Sound: the sound breath tones and the singing stone's hum, and three
continuous layers the player stands inside rather than hears as events — the
weather they are in (soft rain low down, the storm's wind lower still, the
worry whisper high), and at night a low pad with crickets over it. Thunder
rolls every seven to sixteen seconds while the storm still stands and the
player is close enough for it to be about them; it is a rumble that swells
over most of a second and never a crack, because a sharp sound would make the
storm a threat and the storm is a feeling. A "Soft storm sounds" setting drops
the thunder and the storm's wind to about a third.

Accessibility: the anger pulse is a colour pulse at 1.6 rad/s and the worry
shimmer at 8 rad/s in the shader — both well under three flashes a second, and
neither changes brightness. Reduced motion slows all weather movement and stops
the shader clock, so the pulses become steady colour. The naming panel is three
ordinary buttons, so it works from the keyboard like every other panel. The
breath label became a frosted pill instead of a glowing outline, because dark
text with a pale halo disappears against a night meadow.

---

## C2.2 Screenshots

All written by `npm run e2e` into `screenshots/`. Each is taken twice: desktop
(1280 × 720) and mobile (Pixel 7, 390 × 844). The file names end in `-desktop`
or `-mobile`.

| Scene                                   | File                             |
| --------------------------------------- | -------------------------------- |
| 1 Over the bridge, the meadows          | `c2-scene1-meadows-*.png`        |
| 2 The four body stones                  | `c2-scene2-body-stones-*.png`    |
| 3 The rain cloud, with the naming panel | `c2-scene3-rain-*.png`           |
| 3 The rainbow, when the rain lets go    | `c2-scene3-rainbow-*.png`        |
| 4a The singing stone                    | `c2-scene4a-singing-stone-*.png` |
| 4 The storm ridge                       | `c2-scene4-storm-*.png`          |
| 5 Two seeds                             | `c2-scene5-seeds-*.png`          |
| 6 Night                                 | `c2-scene6-night-*.png`          |
| The dream                               | `c2-dream-*.png`                 |
| The end screen                          | `c2-end-*.png`                   |

---

## C2.3 Test results

### Unit tests, Vitest

166 tests in 14 files, all passing. 68 of them are new for chapter 2.

| File                  | Tests | What it holds                                                           |
| --------------------- | ----- | ----------------------------------------------------------------------- |
| `weather.test.ts`     | 17    | Follow rule, naming, intensity caps, the tone rule per feeling          |
| `seeds2.test.ts`      | 15    | Heart and mind seeds, growth, fade, return, the light well              |
| `storm.test.ts`       | 11    | The five steps, the order, five tones, running and pushing              |
| `soundBreath.test.ts` | 9     | Unlock, calm and length, the pentatonic row, the near miss              |
| `body.test.ts`        | 9     | Four stones, the fixed order, the silhouette, the timing                |
| `router.test.ts`      | 7     | Which chapter opens, and what a hand-over carries                       |
| `save.test.ts`        | 22    | Per-chapter save, version 1 migration, unlocking, the closing questions |
| The chapter 1 files   | 76    | Unchanged, still passing                                                |

The rules the brief asked for by name are each a test:

- a correct name takes 40 percent off; a wrong one locks the panel for four
  seconds and changes nothing else,
- only a calm out-breath of full length makes a tone; each tone takes 20 percent
  off anger and worry and leaves sadness alone,
- the storm's steps cannot be skipped and five tones open it,
- calm below 0.6 gives a mind seed, which grows in half the away time, fades
  after sixty seconds and returns two light,
- the light well gives only while the player has fewer than five light,
- the save is per chapter, and the closing questions follow
  `LAST_AVAILABLE_CHAPTER`.

### Browser tests, Playwright

Every one runs twice, on desktop (1280 × 720) and on a Pixel 7 (390 × 844).

| Test                                                          | Result |
| ------------------------------------------------------------- | ------ |
| Chapter 2 from the meadows to the end screen                  | passes |
| A low calm plants a mind seed, and the chapter still finishes | passes |
| The light well gives light only while the player is short     | passes |
| The naming panel opens, and never says wrong                  | passes |
| The start screen lists and locks the chapters                 | passes |
| Finishing chapter 1 unlocks and opens chapter 2               | passes |
| Chapter 2 starts with its own light                           | passes |
| No request to any outside origin, in every chapter 2 scene    | passes |
| All chapter 1 tests                                           | pass   |

**80 of 80 browser tests pass**, on desktop and on mobile, in one clean run
that takes about an hour and a quarter on this machine.

The software renderer slows from about four frames a second to well under one while
it is busy. That made six control tests fail in a long run and pass on their
own. They no longer read a speed off a stopwatch: a key is held until the player
has actually moved, and the stride test measures the time to cover three metres
rather than the distance covered in two and a half seconds. A time to cover a
distance means the same thing at any frame rate.

---

## C2.4 Bundle size and frame rate

### Bundle size

| File                      | Bytes         | Gzipped |
| ------------------------- | ------------- | ------- |
| `index.js`                | 787,858       | 209,086 |
| `index.css`               | 8,553         | —       |
| Two font files            | 380,220       | —       |
| **Everything in `dist/`** | **1,218,172** | —       |

The budget is 6 MB for the first download and 15 MB in total. Chapter 2 added
about 51 kB of JavaScript and no assets at all, because the meadows, the
weather, the stones and the dream are all made in code.

### Frame rate

**Still unverified, and it is the first problem in the list below.** This
machine has no GPU; it renders with SwiftShader, in software. Chapter 2
measures 2 to 5 fps here, the same range chapter 1 measured, which tells you
the two chapters cost about the same and nothing at all about a real device.

What is known about the cost rather than measured:

- The meadows draw the same grass, the same particles and the same one shadow
  map as the valley, and the terrain has the same segment count.
- The two extra draw calls are the mountain band (one mesh, no lighting, no
  fog) and whichever weather is on screen: about twenty soft spheres sharing
  one material, plus 240 rain points.
- The one thing that really was expensive was found and fixed: night was
  re-filtering the sky into the environment map once per frame. See C2.5.

The quality tiers, the start probe and the watchdog work exactly as they do in
chapter 1, because they belong to the game and not to a chapter.

---

## C2.5 What the first automatic run found

Two real faults, both found by running the game rather than by reading it.

**The light well made the seeds impossible.** The brief says the well sits
between the two seed spots. I put it there: spot A at 11 m, spot B at 12 m. A
seed only grows while the player is outside its 15 m away radius, so standing
at the well — the one place a player short of light has to stand — stopped both
seeds from growing. The run timed out with a mind seed stuck at "growing" and 39
calm breaths taken. The spots are now about 20 m from the well and 40 m from
each other, and the layout file says why in a comment so nobody closes the gap
again.

**No breath was ever long enough to sing.** The sound breath asked for an
out-breath at least as long as the target, exactly. Nobody lets go of a key on
the exact frame, so almost no breath qualified and the storm could never be
quietened. It now asks for 0.95 of the target, with a test for the near miss.

**The end screen named the wrong chapter.** Chapter 2 finished with a
"Chapter 2, coming soon" button — the chapter the player had just played. The
label was a fixed string written for chapter 1's end screen. It reads the
registry now, and a browser test holds it.

**The height function was recomputing what it already knew.** The ground
check, the slope check and the collision slide all call it several times per
simulation step, and the terrain build calls it about thirty thousand times.
It eases the ground flat around each place the player has to stand still, and
it worked out the height of each of those centres inside that loop — which is
three noise evaluations per centre, paid on every call that lands inside one.
That is every call the player is ever actually standing on, because the
flattened places are exactly where the scenes are. The meadows have ten of
them. The centres are constants; they are worked out once at load now, in both
chapters.

**The chapter could finish while the player was still walking.** The auto-walk
helper the browser tests steer with was left running when the chapter ended, so
the walk never reported that it had arrived. A player would not have noticed,
because the screen is on the learning cycle by then — but the moment anything
unpaused the world they would have set off again. Both chapters now stop the
walk when they stop playing.

**Night fall stalled the renderer.** `setNight` re-filtered the sky into the
environment map on every call, and night falls over eight seconds, so that was
one full filtering pass per frame. The frame rate went to zero and night stopped at
0.66. It now refreshes in steps of 0.12, the same way the colour drift does.
This would have been much worse on a real device than it was here, because here
it only cost a stalled test.

---

## C2.6 Where I changed the brief, and why

1. **The chapter hand-over reloads the page.** The brief says "the screen fades,
   and chapter 2 loads". It fades, and then the page reloads at `?chapter=2`.
   A chapter owns a whole world — terrain, materials, shaders, an environment
   map — and tearing one down in place to build another is a long tail of leaks
   and half-disposed state. The build is about 1 MB and served locally, so the
   reload costs less than that risk. The player sees a fade either way.

2. **Chapter 2 does not start grey.** The brief does not say either way. Chapter
   1 starts in full grey because learning to receive is what brings the colour
   back; arriving somewhere grey again would undo that. The meadows start at
   0.55 colour and this chapter's moments lift them the rest of the way.

3. **Sadness does not answer to a sound breath.** The brief says a tone reduces
   "nearby anger or worry", which I read as deliberate, and I built it that way
   and wrote a test for it. Saying it plainly because it is a content decision:
   sadness is not a thing to be quietened, only felt through.

4. **The dream is a flat overlay, not a place.** The brief asks for a short
   dream of a village where the same bird crosses the same roof twice. It is an
   SVG silhouette over the darkened game rather than a second world. A dream
   should not look like the place the player is standing in.

5. **The naming panel needs one calm breath, not a count of them.** The brief
   says "has completed 1 calm breath", which I took to mean at any point in the
   chapter rather than at that weather. Requiring a breath at the weather as
   well as three seconds of standing still would be asking twice, which the
   accessibility rules forbid.

6. **The light well is in scene 5 only in the sense of where it stands.** Like
   every other mechanic in both chapters, it runs every frame wherever the
   player is. A player who wanders back to it from scene 6 still gets light.

---

## C2.7 Known problems, worst first

1. **The frame rate targets are still unverified.** This machine renders with
   SwiftShader; there is no GPU. Measured frame rates here are 2 to 5 fps and
   say nothing about a real device. The budget in `CLAUDE.md` — 60 fps on a
   mid-range laptop, 30 on a mid-range Android — has not been tested on real
   hardware for either chapter. This is the same problem chapter 1 ended with.

2. **The meadows cost more than the valley.** The floor is about half again
   the area, so the same grass budget spreads thinner. Two things were done
   about it: the cards are bunched toward the middle of the floor where the
   player walks, and a place can now ask for its own grass density against the
   tier's count. The meadows ask for 1.3. That takes back most of the
   difference and leaves chapter 2 drawing about a third more grass than
   chapter 1 on the same tier, which is a real cost on a real device. The
   quality watchdog can still step it down.

3. **A weather can sit between the player and the camera.** The rain cloud
   follows and settles above the player, which sooner or later puts it between
   them and the lens. It now thins out as it passes within a few metres of the
   camera, the way real weather does when you walk into it, rather than being
   moved somewhere it has no business being. It has not been tuned against a
   player turning the camera hard while standing in it.

4. **The storm is visible from the first scene.** From the start of the meadows
   you can see the dark bank on the ridge about ninety metres off. I think that
   is right — you should see what is coming — but it is a choice, not an
   accident, and it puts anger in view before the player has met sadness.

5. **The dream is not timed to the music.** It runs for a fixed thirteen
   seconds and the bird crosses twice inside that. The night pad and the
   crickets carry on underneath it, which is enough to make it feel like the
   same night, but nothing in the sound marks the dream as a dream.

---

## C2.8 Open questions

1. **How long should the meadows take?** The brief says 12 to 18 minutes. An
   automatic run with the easy rhythm is well under that because it never
   stops to look at anything. I have not timed a real, human walk. Do you want
   me to add distance between the scenes, or leave the pacing to the player?

2. **Should the mind tree be planted twice?** Right now there are two spots and
   nothing stops a player planting a mind seed at both and running out of
   light — the light well covers it, but the lesson lands harder if the second
   seed is the one they get right. Do you want the second spot to be easier?

3. **Naming a weather that is not there.** The panel opens for whichever
   weather the player is standing with. If both the cloud and the storm are in
   reach, the cloud wins because the storm needs its thought shown first. Is
   that the order you want, or should the nearer one always win?

4. **The pause text.** Chapter 2's pause says "Take all the time you need. It
   is okay to stop here." Chapter 1's still says what it said. Should chapter 1
   get the softer wording too, now that both exist?

5. **Chapter 3.** The registry has a slot for it with a lower breath-circle
   strength already set. Do you want to write its brief next, or play these two
   first?

---

---

# C3 The move to Babylon.js

The game was built on Three.js. It now runs on Babylon.js. Nothing else was
meant to change, and the test for that was not an opinion: the old revision
was built in a git worktree, served on a second port, and the two were opened
side by side at the same address, on the same machine, in the same second.
`tools/ab.mjs` does that and prints the average brightness of five regions of
the picture and the real frame rate for each. Every number below came out of
it.

## C3.1 What moved

| Was                                             | Is now                                                                              |
| ----------------------------------------------- | ----------------------------------------------------------------------------------- |
| `THREE.WebGLRenderer`, `THREE.Scene`            | Babylon `Engine` and `Scene`, right-handed so every position and angle is unchanged |
| `MeshStandardMaterial` + `onBeforeCompile`      | `PBRMaterial` + a `MaterialPluginBase`, injecting at the engine's own hook points   |
| `EffectComposer` + two `ShaderPass`             | Two Babylon `PostProcess` passes on the camera                                      |
| `PMREMGenerator` over a second sky              | A `ReflectionProbe` that draws the sky into a small cube                            |
| `three-mesh-bvh` raycast for the ground         | The heightfield the terrain was built from, read directly                           |
| `InstancedBufferGeometry` grass                 | Thin instances of one card, with one extra per-blade buffer                         |
| 320 cloned tree groups                          | Thin instances of fourteen originals                                                |
| `THREE.PerspectiveCamera` inside `FollowCamera` | `FollowCamera` holds only maths; the game copies it onto a `TargetCamera`           |
| Three's primitive geometries                    | `src/render/geometry.ts`, generating the same shapes                                |

The chapter flow, the systems, the UI, the audio, the save format and every
tunable number are untouched. `src/chapter1.ts` and `src/chapter2.ts` changed
by four lines each, all of them an import.

## C3.2 The two faults that cost the most

**Front faces.** Babylon defaults a mesh to clockwise front faces. The world
is right-handed and every shape it is made of winds counter-clockwise, so
every surface in the game was being culled the wrong way round. Closed shapes
survive that almost invisibly — a sphere seen from the inside is still a
sphere, only lit from the wrong side — but the valley floor is not closed, and
it simply was not there. What was on screen was the clear colour, which is the
same pale grey as the sky, so it read as a hazy, over-exposed valley rather
than as a missing one. It took a red clear colour to prove that the ground was
absent rather than pale. `FRONT_FACE` in `src/render/scene3d.ts` is now set on
every mesh built there and on every material that culls, and the reason is
written next to it.

**The sky light stopped following the sky.** The light a surface receives from
every direction at once is worked out from the sky cube and then cached, and
Babylon does not throw that cache away when the cube is drawn again. Night
fell, the sky went dark blue and filled with stars, the mountains went dark —
and the meadow went on being lit by a grey morning. The night scene measured
0.36 average brightness against the old build's 0.14. The cube is now asked to
work it out again on the frame after it has been drawn, so it reads the new
sky. It is also only 64 pixels a side, because working it out means reading
the cube back off the graphics card, and what is taken from it is very smooth.

Neither fault would have been found by reading the code. Both were found by
putting the two builds next to each other.

## C3.3 What the side-by-side says now

Average brightness of the picture, Babylon first, Three second. Same address,
same machine, same seed.

| Scene                        | all           | ground        | mid           | trees         | sky           |
| ---------------------------- | ------------- | ------------- | ------------- | ------------- | ------------- |
| ch1 scene 1, the waking mist | 0.643 / 0.646 | 0.588 / 0.595 | 0.714 / 0.704 | 0.508 / 0.516 | 0.765 / 0.765 |
| ch1 scene 3, the wide field  | 0.367 / 0.372 | 0.354 / 0.351 | 0.393 / 0.404 | 0.151 / 0.169 | 0.659 / 0.661 |
| ch1 scene 4, the fog         | 0.376 / 0.373 | 0.340 / 0.337 | 0.395 / 0.386 | 0.252 / 0.260 | 0.771 / 0.771 |
| ch1 scene 6, the bridge      | 0.302 / 0.314 | 0.341 / 0.340 | 0.197 / 0.208 | 0.257 / 0.271 | 0.771 / 0.771 |
| ch2 scene 2, the body stones | 0.338 / 0.342 | 0.298 / 0.292 | 0.334 / 0.332 | 0.252 / 0.264 | 0.600 / 0.602 |
| ch2 scene 6, night           | 0.126 / 0.138 | 0.089 / 0.103 | 0.186 / 0.203 | 0.104 / 0.105 | 0.130 / 0.137 |

Nothing is out by more than two hundredths, which on a 0 to 1 scale is about
four steps of an eight-bit grey. The tree corner sits about a hundredth dark
in every scene: that corner is the dark canopy against the sky, and the light
filling the shaded underside of a leaf comes from the sky cube, which Babylon
and Three work out by different means. It is below what anyone will see and I
left it rather than bending a number to hide it.

Two things were found by this table rather than by looking, and both were
wrong in a way I would have called "close enough" from a screenshot.

The **middle band** was three hundredths low everywhere: that band is where
the distance haze does its work, and the engine's own fog ramps straight and
measures distance from the eye, while the original eased in and out and
measured depth into the screen. The world materials now do the haze
themselves, so the curve and the depth are the ones the valley was built
with. It barely moved the average — which is the point: it was never an
average, it was a hill starting to haze at a hard line and the corners of the
frame hazing more than the middle.

The **waking mist** was five hundredths thin, and the trees behind it nearly
two tenths. The fog on the path and the mist the player wakes in look like the
same effect and are not: one thins away from its middle, the other holds
together much further out. I had merged them into one shader on one curve. At
the halfway angle that curve gave 0.34 where the mist wanted 0.62, so the
first thing the player ever sees was half as thick as it should be. Both
curves are back.

The one number that needed setting by hand was the sun. Babylon and Three do
not scale a directional light the same way, and there is no conversion worth
trusting between them, so it was measured: `LIGHTING.sunIntensity` is 2.1
because that is where the ground, the middle band and the trees all landed on
the old build's readings at once.

## C3.4 What got cleaner

**One dependency fewer, and a faster answer.** The ground check no longer
fires a ray at the terrain mesh. The terrain is a grid of quads the game
generated itself, so `HeightField` reads back the very triangle that is drawn,
in constant time, with nothing to build and nothing to keep in step.
`three-mesh-bvh` is gone. The bridge deck is an arch of known shape and
answers for itself the same way. The ground, the slope limit and the collision
slide all run several times per simulation step, so this is the hottest path
in the game.

**The grey-to-colour system is no longer string surgery.** It was a set of
`onBeforeCompile` replacements that had to find `#include <color_fragment>` in
Three's shader and paste around it. It is now a material plugin that declares
its own uniform block and hands code to the engine's own injection points. It
also lost a varying: Babylon's shader already carries the world position, so
the vertex stage needed no change at all.

**Every shape is in one file.** `src/render/geometry.ts` generates the plane,
disc, ring, sphere, box, cylinder, cone, torus, icosahedron, capsule and lathe
the world is made of. That was not done to avoid the engine's own builders but
because three shaders read texture coordinates that the builders lay out
differently — the rainbow across its arc, the tone ring across its band, the
blob shadow out from its middle — and a shape whose coordinates run the other
way is a different picture, not a different mesh library.

**The camera is testable again.** `FollowCamera` holds no engine object now.
It works out where the eye should be and what it should look at, and the game
copies those two points onto the camera that draws. The basis tests run in
plain Vitest with no canvas, which is what they were always trying to be.

## C3.5 What got faster

The wood was 320 cloned tree groups of about ten parts each: roughly three
thousand objects to place, cull, sort and draw one at a time, every frame.
Fourteen originals are now built and every tree on the hillside is a thin
instance of their parts, so the whole wood costs about what the originals
cost. The grass went the same way: one card, sixty thousand thin instances,
and the tier still decides how many are drawn.

It shows. Before that change the top tier measured 0.6 frames per second here
against the old build's 1.2 — half speed. After it, on the same machine and in
the same minute:

| Tier                     | Babylon | Three |
| ------------------------ | ------- | ----- |
| high                     | 0.56    | 0.44  |
| medium                   | 0.89    | 0.78  |
| low                      | 2.00    | 1.78  |
| low, painting filter off | 2.00    | 2.33  |

These are SwiftShader numbers on a shared machine running two servers and a
browser, so they are well below the figures in section 4 and they wander by
about a third between runs. They are worth exactly one thing: the two builds
are in the same place, and they were not before.

## C3.6 What it costs to download

| Measured in the browser, uncompressed | Three     | Babylon   |
| ------------------------------------- | --------- | --------- |
| JavaScript                            | 709,461   | 1,693,983 |
| CSS                                   | 7,096     | 8,628     |
| `index.html`                          | 575       | 1,758     |
| The two Work Sans fonts               | 380,220   | 380,220   |
| **Initial download**                  | 1,097,352 | 2,084,671 |

**The budget is 6 MB initial and 15 MB total. Both are still met with room.**

It did nearly double, and that is worth saying plainly rather than burying:
the game used a thin slice of Three.js and uses a thicker slice of Babylon.
About 350 KB of the growth is shader source that Babylon ships as code — the
physically based fragment shader alone is 133 KB — and which a build cannot
tree-shake away because the engine assembles it at run time. Gzipped, as a
static host serves it, that is roughly 500 KB against 390 KB.

Nothing was added to the download that is not engine. There are still no
model, image or audio files, and `npm run build` still writes a `dist/` that
any static host can serve with no server behind it.

## C3.7 What got better to look at

One thing, and it is tier-gated. On the top tier the sun's shadow now hardens
at the point where a thing touches the ground and softens as it stands away
from it, which is what an outdoor shadow does and what the old one could not
do. The middle tier keeps the cheaper filtered edge and the low tier keeps the
blob, exactly as before. `SHADOW.contactHardeningFrom` is the switch.

**I could not measure what it costs.** On this machine the top tier reads
between 0.5 and 0.8 frames per second with it and between 0.5 and 0.75
without, which is noise. On a real graphics card it is a real cost and a small
one, but that is a claim about hardware I do not have. The tier it sits in is
only chosen on a device that measured fast, and the watchdog can still step
down off it, so the risk is bounded — but it is a risk and not a measurement.

**No outside assets were added.** The brief allows them where they raise the
quality, under a licence that permits commercial use without attribution and
bundled rather than fetched. Nothing in this world wants a texture or a model:
the art direction is procedural geometry, vertex-baked light and a painting
filter, and the one thing a bought asset would have improved — surface detail
— is deliberately absent. Adding one would have been a change to the art
direction dressed up as a technical improvement.

## C3.8 What this migration did not fix

The frame rate targets are still unverified, for the same reason as before:
this machine has no graphics card. The Babylon build is now level with the
Three build here, which means it is probably level with it there, but "level
with the thing that was also never measured on real hardware" is all that can
honestly be said. The device report and safe mode both still work and are
still the way to find out.

---

---

# C4 The guide, the walk, and a better-looking valley

A second pass over the picture, and the one companion the game now has. The
rules in `CLAUDE.md` were rewritten first, because four of them said this
work was not allowed, and a rule that is quietly broken is worse than no rule.

## C4.1 What the rules now say

| Was                                                  | Is now                                                                                          |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| No companion or helper character                     | Exactly one: the guide. No chapter adds another                                                 |
| Text only after the player has experienced something | Still true of the game's writing, and now the rule the guide is held to as well                 |
| Dr. Rulin named in third person, on one card only    | Plus one exception: she may speak for herself in a recorded teaching the guide carries          |
| No network requests of any kind                      | No request ever leaves the origin. Fetching from the game's own files, after the start, is fine |
| Total download 15 MB                                 | 15 MB not counting teaching videos, which are fetched at the blockage they belong to            |

The last two matter more than they look. The rule as written forbade the very
thing the handwriting font already does, so it was not a rule anybody was
keeping. What is actually wanted is that nothing reaches outside, and that the
first download stays small. That is now what it says.

## C4.2 The guide

She is a light. She grows and warms with the light the player carries and with
the colour returning to the valley, so what she looks like is a reading of how
far they have come, and there is nothing to explain.

The part worth writing down is what stops her becoming the thing everyone
remembers her ancestors for. `GuideSystem` has no engine in it and it is
eleven unit tests long, and every one of those tests is about when she is
quiet:

- She never speaks over a breath. The breath is the whole game.
- She leaves a gap between anything she says, so two things never run together.
- She says a thing once.
- She offers the way on only after a long time getting nowhere, and only to
  somebody who is actually walking about. Somebody sitting still is not lost.

The light motes moved house. Light used to fly from a spring into the player's
chest and orbit them; it now flows to the guide. That way she is not one more
thing on screen — she gathers up something that was already there.

## C4.3 The teaching slot

A teaching is `{ text, video? }`. Today every one of them is text. When a film
of Dr. Rulin is dropped into `public/teachings`, the guide opens it at its
blockage and the words stay underneath it: a muted phone, a slow connection or
a screen reader loses the picture and nothing else. The film is
`preload="none"` and nothing ever plays on its own.

Two numbers are still open and will need deciding when the first film exists:
how long, and how many. At 720p, six megabytes buys roughly half a minute.

## C4.4 The walk

The figure had no arms and no legs. It has both now, and still no skeleton:
the cloak was shortened to above the knee, and the limbs hang off the same
number the body always used, which is the distance walked.

- The legs swing from the hip, half a stride apart, and the knees fold only
  backwards.
- The arms swing against the leg on the same side.
- Standing still, the weight shifts slowly from one foot to the other and the
  chest rises and falls with the player's own breath, taken straight from
  `breath.playerRing`.
- The head turns toward the guide while she is speaking, and no further than a
  person can turn without their shoulders.

Everything is in `WALK` and `BODY_SHAPE` in `src/content/chapter1.ts`. There is
no animation file to re-export; "the walk has more swagger" is one number.

## C4.5 The picture

**The sky meets the ground.** The horizon now takes the colour of the distance
haze, so the two stop being near misses of each other. Above the two cloud
layers there is a third, high and slow, on the tiers that can afford it, and
cloud near the sun is lit from behind.

**Water.** A pool ripples from two crossing noise fields and reflects the sky —
the same sky cube the world is already lit by, because rendering the scene
again for a basin a metre across would cost more than the basin. It follows the
grey-to-colour rule and the haze like every other surface.

**Bloom.** Two passes at a quarter of the width and height, after the painting
filter and not before it: before it, the filter breaks a halo into brush
patches, which is the one thing a halo must not do. It is deliberately weak.
Turned up it lays a veil over the whole picture and softens the brush edges,
which is the opposite of what both effects are for.

**The sun is a thing now.** It was a few lines in the sky shader. It is also a
soft disc turned toward the camera, standing at the same angle, adding to the
painted one rather than covering it. One direction feeds both, so the paint and
the object cannot drift apart.

## C4.6 What was cut, and why

**Light through the trees.** It was on the plan, it was built, and it works. It
is also gone.

The camera in this game cannot be tilted far up — it follows the player and it
is meant to look at the valley. With the sun where the sky shader painted it,
the sun sat above the top of the frame at all times. Lowering it by two degrees
brought it into shot, and then the second problem showed: rays need something
dark standing in front of a bright source, and from this camera the sun is in
open sky above the treeline. The effect ran correctly, cost a render pass of
its own, and put almost nothing on the screen.

It was named in the plan as the first thing to cut if the numbers did not
justify it, and they did not. What it needed — the sun as an object — was worth
having on its own and stayed.

## C4.7 Performance

Everything new is tied to a tier that can afford it.

| Effect                       | low | medium | high |
| ---------------------------- | --- | ------ | ---- |
| Softer sky, horizon join     | yes | yes    | yes  |
| Third cloud layer            | no  | yes    | yes  |
| Water ripple, sky reflection | yes | yes    | yes  |
| The guide and her trail      | yes | yes    | yes  |
| Arms, legs, breathing        | yes | yes    | yes  |
| Bloom                        | no  | yes    | yes  |
| Contact-hardening shadows    | no  | no     | yes  |

The picture measures the same as before this pass: 0.370 average brightness
against 0.372 for the build all of this started from. That is the point. The
additions are light and movement, not a change of key.

The download grew by 52 KB, to 2,136,260 bytes. That is the guide, the water,
the bloom passes and the limbs together, and it is all code — there is still
no model, image or audio file in the game. The budget is 6 MB for the first
download and it is still met with room.

177 unit tests and 82 browser tests pass, desktop and mobile.

---

---

# Mobile

A note on what a real phone found, and what I could not find from here.

## What was wrong

The game rendered a **black sky** on an Android phone while looking correct on
every machine I can test on. The cause is worth writing down because it will
happen again:

**A desktop driver and a software renderer both treat `mediump` as full
precision.** A shader a mobile GPU cannot run therefore compiles and looks
right here. Five of the game's fragment shaders were on `mediump`, including
the sky, the final paper pass and the grass. At `mediump` a float holds about
three digits and tops out near 65504, and those shaders carry the usual noise
idiom, `fract(sin(dot(p, k)) * 43758.5453)`. The maths does not degrade there;
it collapses.

The moon made it certain: it was drawn with `pow(m, 900.0)`. An exponent in
the hundreds is at the mercy of the driver — some clamp it, some return `inf`
— and one `inf` in the sky colour turns the whole dome black. The sky dome
covers everything above the horizon, which is what the phone showed.

Every custom shader now declares `precision highp float;` in both stages, the
moon is an angle and two smoothsteps, and `CLAUDE.md` carries the rule so the
next shader starts right.

## What else the phone showed

- **The two breath buttons were not level.** The in-breath sat above the
  joystick on the left; the out-breath sat in the bottom-right corner, about
  160 px lower. They are two halves of one breath. They are level now, one per
  thumb, with push and plant where the right thumb already rests.
- **The joystick let go of the finger.** A thumb slides off a small pad almost
  at once, and without pointer capture the browser is free to hand the pointer
  elsewhere when it leaves.
- **The border pushed the wrong way in the meadows.** It read chapter 1's
  world bounds and pushed toward x = 0. The chapter 1 valley runs down the
  middle so that worked by accident; the meadows path wanders up to twelve
  metres off centre.

## How to find out next time

Two things exist now because none of this can be reproduced from here.

**`?debug=1` opens with a device report.** The GPU as the driver names it, the
WebGL version, whether fragment shaders really have high precision, whether
half-float buffers can be rendered and filtered, the canvas size against the
pixels actually drawn, and anything the driver said while compiling a shader.
It is first in the panel and the panel is clipped to fit a phone, so one
screenshot from the device answers the question.

**`?safe=1` draws the scene straight to the canvas**, with no post-processing
at all; the renderer does the tone mapping and the move into sRGB that the
paper pass normally does. It is a way out and a way to find out: a device that
is black through the composer and right in safe mode has a problem with the
render targets, and one that is black either way has a problem with the
world's own shaders. Either answer takes one tap. A browser test holds it on
both projects, reading the picture back from a page screenshot — reading the
canvas directly gives nothing back, because it has no `preserveDrawingBuffer`,
so a test written that way passes on an empty image.

## What is still unknown

Whether the phone is fixed. The precision faults were real and are repaired,
but they were found by reading, not by reproducing, and this machine has no
GPU to reproduce them on. The device report and safe mode are there so the
next round is measurement rather than argument.

---

## How to run it

```
npm install
npm run dev          # http://localhost:5173
npm run check        # typecheck, lint and 166 unit tests
npm run build        # typecheck and production build into dist/
npm run e2e          # Playwright, writes screenshots/
```

Deploy `dist/` to any static host. There is no server and no network call.

Chapter 2 opens from the start screen once chapter 1 is finished, or directly
at `?chapter=2`. A single scene: `?chapter=2&scene=4`.
