// Extra browser-check scenarios. Loaded by scripts/check-browser.mjs.
// The old valley/diorama scenarios were removed (archived in legacy/valley-v1/).
export default function scenarios({ wait, shot, hold, page }) {
  const lw = (fn, arg) => page.evaluate(fn, arg);
  const waitWorld = (world) =>
    page.waitForFunction(
      (w) => window.__lw.world() === w && !window.__lw.transitioning(),
      world,
      { timeout: 20000 },
    );
  /** Fails with a clear message if a test hook is missing on window.__lw. */
  const requireHooks = async (names, scenario) => {
    const missing = await page.evaluate(
      (list) => list.filter((n) => typeof window.__lw?.[n] !== 'function'),
      names,
    );
    if (missing.length) {
      console.error(`FAIL (${scenario}): missing test hook(s) on window.__lw: ${missing.join(', ')}`);
      process.exitCode = 3;
      return false;
    }
    return true;
  };
  // ---- The Lantern (PoC): full playthrough of beats 0-9 (docs/GAME_DESIGN.md section 9). ----
  const LANTERN_HOOKS = [
    'world', 'toggle', 'transitioning', 'teleport', 'anger', 'beat', 'flags', 'lanternLight',
    'debugBreath', 'interact', 'alleyApplePositions', 'bumpTrigger', 'oldTreeNiche', 'impPos',
    'endCardVisible', 'line', 'clearSave', 'drawCalls',
  ];
  const STEP_MS = 15000;
  const waitFor = async (label, fn, arg = null, timeout = STEP_MS) => {
    try {
      await page.waitForFunction(fn, arg, { timeout, polling: 200 });
    } catch {
      throw new Error(`timeout (${timeout / 1000} s) waiting for: ${label}`);
    }
  };
  const expect = (ok, msg) => {
    if (!ok) throw new Error(`check failed: ${msg}`);
  };
  const waitWorldStable = (w) =>
    waitFor(`world "${w}"`, (x) => window.__lw.world() === x && !window.__lw.transitioning(), w);
  const toggleTo = async (w) => {
    await lw(() => window.__lw.toggle());
    await waitWorldStable(w);
    await wait(500);
  };
  const teleportTo = async (p) => {
    await lw((q) => window.__lw.teleport(q.x, q.z), p);
    await wait(300);
  };
  const interactAt = async (p) => {
    await teleportTo(p);
    await lw(() => window.__lw.interact());
    await wait(300);
  };
  const snapChecked = async (name) => {
    await shot(name);
    const dc = await lw(() => window.__lw.drawCalls());
    console.log(`draw calls at ${name}: ${dc}`);
    expect(dc < 100, `draw calls at ${name} = ${dc} (limit < 100)`);
  };
  const breathGood = async (n) => {
    for (let i = 0; i < n; i++) {
      await lw(() => window.__lw.debugBreath());
      await wait(300);
    }
  };
  const flagsNow = () => lw(() => window.__lw.flags());
  const bootFresh = async () => {
    await lw(() => window.__lw.clearSave());
    await page.reload({ waitUntil: 'load' });
    await page.keyboard.press('Enter'); // dismiss the start screen, if there is one
    await wait(1000);
    await waitFor('game hooks after reload', () => !!window.__lw, null, 30000);
    await waitWorldStable('outer');
    await wait(500);
  };
  // New opening: walk to the Square, Look Within (calm), come back, then the bump happens on the Square.
  const squareStep = async () => {
    await teleportTo(await lw(() => window.__lw.bumpTrigger()));
    await waitFor('beat >= 1 (Square reached, Look Within invited)', () => window.__lw.beat() >= 1);
    await wait(1500);
    await snapChecked('b1-square-calm');
    await toggleTo('inner');
    await snapChecked('b2-inner-calm');
    await toggleTo('outer');
    await waitFor('beat >= 2 (first Look Within)', () => window.__lw.beat() >= 2);
  };
  const bumpStep = async () => {
    await waitFor('bump (flags().bumped and lanternLight() < 0.3)', () =>
      window.__lw.flags().bumped && window.__lw.lanternLight() < 0.3);
    await snapChecked('b3-bump');
    await wait(3000);
    await snapChecked('b4-waves');
  };
  const treeWeakStep = async () => {
    await interactAt(await lw(() => window.__lw.oldTreeNiche()));
    expect(!(await flagsNow()).delivered, 'lantern delivered while still weak at the Old Tree');
    await snapChecked('b5-tree-weak');
  };
  const impSeeStep = async () => {
    const p = await lw(() => window.__lw.impPos());
    await teleportTo({ x: p.x + 1.5, z: p.z });
    await wait(2000);
    expect((await flagsNow()).sawImp, 'imp not seen on Look Within near the imp');
    await snapChecked('b6-imp');
  };
  const alleyStep = async () => {
    const apples = await lw(() => window.__lw.alleyApplePositions());
    for (const a of apples) await interactAt(a);
    await waitFor('flags().helped (5 apples)', () => window.__lw.flags().helped);
    await snapChecked('b7-alley');
  };
  const transformStep = async () => {
    const p = await lw(() => window.__lw.impPos());
    await teleportTo({ x: p.x + 1.5, z: p.z });
    await breathGood(3);
    await waitFor('flags().lanternRelit (10 s)', () => window.__lw.flags().lanternRelit, null, 10000);
    await snapChecked('b8-calm');
  };
  const deliverStep = async () => {
    await interactAt(await lw(() => window.__lw.oldTreeNiche()));
    await waitFor('end card (endCardVisible)', () => window.__lw.endCardVisible());
    expect((await flagsNow()).delivered, 'flags().delivered is false after placing the lantern');
    await snapChecked('b9-end');
  };
  const playLantern = async (alt) => {
    const tag = alt ? 'lantern-alt' : 'lantern';
    if (!(await requireHooks(LANTERN_HOOKS, tag))) return;
    try {
      await bootFresh();
      await waitFor('beat >= 0 (wake)', () => window.__lw.beat() >= 0);
      await snapChecked('b0-wake');
      if (!alt) {
        await breathGood(1);
        await wait(500);
      }
      await squareStep();
      await bumpStep();
      await treeWeakStep();
      await toggleTo('inner');
      await impSeeStep();
      if (!alt) {
        await breathGood(3);
        expect(!(await flagsNow()).impCalm, 'imp calmed before the alley was helped');
        await toggleTo('outer');
        await shot('b6-outer-angry');
        await alleyStep();
        await toggleTo('inner');
      } else {
        await toggleTo('outer');
        await alleyStep();
        await toggleTo('inner');
      }
      await transformStep();
      await toggleTo('outer');
      await deliverStep();
      console.log(`${tag}: PASS`);
    } catch (e) {
      console.error(`FAIL (${tag}): ${e.message}`);
      process.exitCode = 3;
    }
  };
  return {
    /** Full PoC playthrough, beats 0-9 in the normal order. Screenshots: b0..b9. */
    async lantern() {
      await playLantern(false);
    },
    /** Same playthrough, but without the first breath (the Square must not be blocked) and alley after the imp. */
    async 'lantern-alt'() {
      await playLantern(true);
    },
    /** Look-within check: outer town -> inner world -> outer town, position and draw calls. */
    async lookwithin() {
      let failed = false;
      // Dismiss the start screen, if there is one.
      await page.keyboard.press('Enter');
      await wait(1000);
      await page.waitForFunction(() => !!window.__lw, null, { timeout: 30000 });
      await shot('outer-start');
      await hold('KeyW', 1500);
      // Q is locked until the player reaches the Square (invitation): walk there.
      await lw((q) => window.__lw.teleport(q.x, q.z), await lw(() => window.__lw.bumpTrigger()));
      await wait(1000);
      const P = await lw(() => window.__lw.playerPos());
      console.log('outer player position P:', JSON.stringify(P));
      const dc1 = await lw(() => window.__lw.drawCalls());
      console.log('draw calls outer:', dc1);

      await page.keyboard.press('KeyQ');
      await waitWorld('inner');
      await wait(500);
      await shot('inner');
      const dc2 = await lw(() => window.__lw.drawCalls());
      console.log('draw calls inner:', dc2);

      await page.keyboard.press('KeyQ');
      await waitWorld('outer');
      await wait(500);
      await shot('outer-back');
      const B = await lw(() => window.__lw.playerPos());
      console.log('outer player position back:', JSON.stringify(B));

      const d = Math.max(Math.abs(B.x - P.x), Math.abs(B.y - P.y), Math.abs(B.z - P.z));
      console.log(`position drift: ${d.toFixed(3)} m (limit 0.05)`);
      if (d > 0.05) {
        console.error(`FAIL: player position changed by ${d.toFixed(3)} m`);
        failed = true;
      }
      if (dc1 >= 100 || dc2 >= 100) {
        console.error(`FAIL: draw calls outer=${dc1} inner=${dc2} (limit < 100)`);
        failed = true;
      }
      if (failed) process.exitCode = 3;
      else console.log('lookwithin: PASS');
    },
    /** Touch UI: buttons visible in portrait and landscape (run with --mobile and ?touch). */
    async touchui() {
      await page.keyboard.press('Enter');
      await wait(1000);
      await page.waitForFunction(() => !!window.__lw, null, { timeout: 30000 });
      await lw(() => window.__lw.debugBreath());
      await wait(2500);
      await shot('touch-portrait');
      await page.setViewportSize({ width: 915, height: 412 });
      await wait(1500);
      await shot('touch-landscape');
      const bad = await lw(() => {
        const r = (c) => document.querySelector(c)?.getBoundingClientRect();
        const line = r('.dialogue-line');
        if (!line) return 'no dialogue line';
        for (const c of ['.hand-button', '.breath-button', '.look-button']) {
          const b = r(c);
          if (!b) return `missing ${c}`;
          if (b.width < 48 || b.height < 48) return `${c} smaller than 48 px`;
          if (b.left < line.right && b.right > line.left && b.top < line.bottom && b.bottom > line.top) return `${c} overlaps text line`;
        }
        return '';
      });
      if (bad) { console.error(`FAIL: ${bad}`); process.exitCode = 3; } else console.log('touchui: PASS');
    },
    /** Breathing: inhale 4 s, exhale 4 s, two rounds. */
    async breath() {
      await page.keyboard.down('Space');
      await wait(2000);
      await shot('b1-inhale-2s');
      await wait(2000);
      await shot('b2-inhale-4s');
      await page.keyboard.up('Space');
      await page.keyboard.down('ShiftLeft');
      await wait(1200);
      await shot('b3-exhale');
      await wait(3000);
      await page.keyboard.up('ShiftLeft');
      await wait(500);
      await shot('b4-after');
      await hold('KeyW', 600);
    },
    /** Thought Bubble look: form above the head, then a push and the citizen bump. */
    async bubble() {
      await page.keyboard.press('Enter');
      await wait(1000);
      await page.waitForFunction(() => !!window.__lw, null, { timeout: 30000 });
      await waitWorld('outer');
      await page.waitForFunction(() => window.__lw.bubbles() > 0, null, { timeout: 30000 });
      await wait(700);
      await shot('bubble-forming');
      await wait(1800);
      await shot('bubble-formed');
      await page.keyboard.press('KeyE');
      await wait(350);
      await shot('bubble-pushed');
      await page.waitForFunction(() => window.__lw.bumps() > 0, null, { timeout: 12000 }).catch(() => {});
      console.log('bump arrived:', await lw(() => window.__lw.bumps()) > 0);
      console.log('bumps:', await lw(() => window.__lw.bumps()), 'pushLevel:', await lw(() => window.__lw.pushLevel()));
      await shot('bubble-bump');
    },
    /** Thought waves: breathe to lower anger, push to grow waves, reset, and get shoved. */
    async waves() {
      const failures = [];
      const check = (ok, msg) => {
        if (!ok) {
          console.error(`FAIL: ${msg}`);
          failures.push(msg);
        }
      };
      const getWaves = () => lw(() => window.__lw.waves());
      const getPush = () => lw(() => window.__lw.pushLevel());
      const getAnger = () => lw(() => window.__lw.anger());
      const getPos = () => lw(() => window.__lw.playerPos());
      const snap = async (name) => {
        await shot(name);
        const dc = await lw(() => window.__lw.drawCalls());
        console.log(`draw calls at ${name}: ${dc}`);
        check(dc < 100, `draw calls at ${name} = ${dc} (limit < 100)`);
      };
      // One breath round = inhale (Space) 4 s, then exhale (ShiftLeft) 4 s.
      // Samples waves() every 500 ms and counts drops as passed waves.
      const breathe = async ({ until = null, passGoal = null, maxMs = 40000 }) => {
        const t0 = Date.now();
        let prev = await getWaves();
        let passes = 0;
        const done = async () => {
          if (passGoal !== null && passes >= passGoal) return true;
          return until ? await until() : false;
        };
        while (Date.now() - t0 < maxMs) {
          for (const key of ['Space', 'ShiftLeft']) {
            await page.keyboard.down(key);
            for (let i = 0; i < 8; i++) {
              await wait(500);
              const w = await getWaves();
              if (w < prev) passes += prev - w;
              prev = w;
              if (await done()) break;
            }
            await page.keyboard.up(key);
            if (await done()) return { passes, done: true };
          }
        }
        return { passes, done: false };
      };

      // Dismiss the start screen, if there is one.
      await page.keyboard.press('Enter');
      await wait(1000);
      await page.waitForFunction(() => !!window.__lw, null, { timeout: 30000 });
      await waitWorld('outer');
      await wait(500);

      // (a) Breathing lowers anger.
      const anger0 = await getAnger();
      console.log('anger start:', anger0.toFixed(3));
      await page.waitForFunction(() => window.__lw.waves() > 0, null, { timeout: 40000 }).catch(() => {});
      check((await getWaves()) > 0, 'no wave appeared within 40 s (step a)');
      const ra = await breathe({ passGoal: 3 });
      console.log(`step a: passes=${ra.passes}, done=${ra.done}`);
      const anger1 = await getAnger();
      console.log('anger after breathing:', anger1.toFixed(3));
      check(anger1 < anger0, `anger did not decrease (${anger0.toFixed(3)} -> ${anger1.toFixed(3)})`);
      check(anger1 >= 0.35, `anger fell below 0.35 (${anger1.toFixed(3)})`);
      await snap('a-breathe');

      // (b) Three pushes (KeyE every 2 s) when a wave is near.
      for (let i = 0; i < 3; i++) {
        await page.waitForFunction(() => window.__lw.pushable(), null, { timeout: 20000 }).catch(() => {});
        await page.keyboard.press('KeyE');
        if (i < 2) await wait(500);
      }
      await wait(300);
      const push = await getPush();
      console.log('pushLevel after 3 pushes:', push);
      check(push >= 2, `pushLevel ${push} < 2 after 3 pushes (step b)`);
      await snap('b-pushed');

      // (c) Breathing until the push level resets to 0.
      const rc = await breathe({ until: async () => (await getPush()) === 0 });
      const pushEnd = await getPush();
      console.log(`step c: done=${rc.done}, pushLevel=${pushEnd}`);
      check(pushEnd === 0, `pushLevel is ${pushEnd}, not 0, after 40 s of breathing (step c)`);
      await snap('c-reset');

      // (d) Large wave shoves the player; the player can still walk.
      await lw((v) => window.__lw.setAnger(v), 1);
      await wait(1500);
      const base = await getPos();
      for (let i = 0; i < 4; i++) {
        await page.waitForFunction(() => window.__lw.pushable(), null, { timeout: 20000 }).catch(() => {});
        await page.keyboard.press('KeyE');
        if (i < 3) await wait(500);
      }
      console.log('step d: pushLevel', await getPush());
      // Wait for the wave to hit (player displaced by > 0.2 m without input).
      const hitStart = Date.now();
      let hit = false;
      while (Date.now() - hitStart < 40000) {
        const p = await getPos();
        const dist = Math.hypot(p.x - base.x, p.z - base.z);
        if (dist > 0.2) {
          hit = true;
          break;
        }
        await wait(200);
      }
      check(hit, 'no wave hit the player within 40 s (step d)');
      await wait(300);
      const P = await getPos();
      console.log('player position after hit:', JSON.stringify(P));
      await hold('KeyW', 2000);
      await wait(300);
      const Q = await getPos();
      const moved = Math.hypot(Q.x - P.x, Q.z - P.z);
      console.log(`player moved ${moved.toFixed(3)} m while holding W`);
      check(moved > 1, `player moved only ${moved.toFixed(3)} m (limit > 1)`);
      await snap('d-shove');

      // Inner world: one run of (a).
      await lw(() => window.__lw.toggle());
      await waitWorld('inner');
      await wait(500);
      const innerAnger0 = await getAnger();
      await page.waitForFunction(() => window.__lw.waves() > 0, null, { timeout: 40000 }).catch(() => {});
      check((await getWaves()) > 0, 'no wave appeared in the inner world within 40 s');
      const ri = await breathe({ passGoal: 3 });
      const innerAnger1 = await getAnger();
      console.log(`inner: passes=${ri.passes}, anger ${innerAnger0.toFixed(3)} -> ${innerAnger1.toFixed(3)}`);
      check(innerAnger1 < innerAnger0, 'inner anger did not decrease');
      await snap('inner-waves');
      await lw(() => window.__lw.toggle());
      await waitWorld('outer');

      if (failures.length) {
        process.exitCode = 3;
        console.error(`waves: FAIL (${failures.length} problem(s))`);
      } else {
        console.log('waves: PASS');
      }
    },
    /** Town square (Step 3): calm anger vs. high anger, draw calls per shot. */
    async town() {
      const failures = [];
      const check = (ok, msg) => {
        if (!ok) {
          console.error(`FAIL: ${msg}`);
          failures.push(msg);
        }
      };
      if (!(await requireHooks(['world', 'toggle', 'drawCalls', 'setAnger', 'teleport'], 'town'))) return;
      const snap = async (name) => {
        await shot(name);
        const dc = await lw(() => window.__lw.drawCalls());
        console.log(`draw calls at ${name}: ${dc}`);
        check(dc < 100, `draw calls at ${name} = ${dc} (limit < 100)`);
      };

      // Dismiss the start screen, if there is one.
      await page.keyboard.press('Enter');
      await wait(1000);
      await page.waitForFunction(() => !!window.__lw, null, { timeout: 30000 });
      await waitWorld('outer');
      await wait(500);

      // Calm square.
      await lw((v) => window.__lw.setAnger(v), 0);
      await lw(() => window.__lw.teleport(0, 32));
      await wait(3000);
      await snap('square-calm');

      // Angry square.
      await lw((v) => window.__lw.setAnger(v), 0.9);
      await wait(5000);
      await snap('square-angry');

      if (failures.length) {
        process.exitCode = 3;
        console.error(`town: FAIL (${failures.length} problem(s))`);
      } else {
        console.log('town: PASS');
      }
    },
    /** Anger Imp and burned root (Step 4): imp states and root health 0 -> 1. */
    async imp() {
      const failures = [];
      const check = (ok, msg) => {
        if (!ok) {
          console.error(`FAIL: ${msg}`);
          failures.push(msg);
        }
      };
      if (
        !(await requireHooks(
          ['world', 'toggle', 'drawCalls', 'reveal', 'teleport', 'setImpState', 'setRootHealth'],
          'imp',
        ))
      )
        return;
      const snap = async (name) => {
        await shot(name);
        const dc = await lw(() => window.__lw.drawCalls());
        console.log(`draw calls at ${name}: ${dc}`);
        check(dc < 100, `draw calls at ${name} = ${dc} (limit < 100)`);
      };

      // Dismiss the start screen, if there is one.
      await page.keyboard.press('Enter');
      await wait(1000);
      await page.waitForFunction(() => !!window.__lw, null, { timeout: 30000 });
      await waitWorld('outer');
      await wait(500);

      // Go to the inner world and stage the imp. Q is locked until the first breath.
      await lw(() => window.__lw.debugBreath());
      await wait(300);
      await lw(() => window.__lw.toggle());
      await waitWorld('inner');
      await lw(() => window.__lw.reveal());
      await lw(() => window.__lw.teleport(-7, 4));
      await wait(2000);

      // Imp states.
      for (const state of ['raging', 'calming', 'calm']) {
        await lw((s) => window.__lw.setImpState(s), state);
        await wait(2000);
        await snap(`imp-${state}`);
      }

      // Root health 0 -> 1 over 3 s in 100 ms steps.
      await lw(() => window.__lw.setRootHealth(0));
      await snap('root-0');
      for (let i = 1; i <= 30; i++) {
        await lw((v) => window.__lw.setRootHealth(v), i / 30);
        await wait(100);
      }
      await snap('root-1');

      if (failures.length) {
        process.exitCode = 3;
        console.error(`imp: FAIL (${failures.length} problem(s))`);
      } else {
        console.log('imp: PASS');
      }
    },
    /** Close-up of the figure at fixed screen clip (walk and breath). */
    async closeup() {
      const outDir = process.argv[process.argv.indexOf('--out') + 1];
      const clip = { x: 490, y: 300, width: 300, height: 260 };
      await page.screenshot({ path: `${outDir}/c1-idle.png`, clip });
      await page.keyboard.down('KeyS');
      await wait(700);
      await page.screenshot({ path: `${outDir}/c2-walk-south.png`, clip });
      await page.keyboard.up('KeyS');
      await page.keyboard.down('KeyW');
      await wait(700);
      await page.screenshot({ path: `${outDir}/c3-walk-north.png`, clip });
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyD');
      await wait(700);
      await page.screenshot({ path: `${outDir}/c4-walk-east.png`, clip });
      await page.keyboard.up('KeyD');
      await page.keyboard.down('Space');
      await wait(3000);
      await page.screenshot({ path: `${outDir}/c5-inhale.png`, clip });
      await page.keyboard.up('Space');
    },
  };
}
