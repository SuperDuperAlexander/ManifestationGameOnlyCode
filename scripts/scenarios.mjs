// Extra browser-check scenarios. Loaded by scripts/check-browser.mjs.
export default function scenarios({ wait, shot, hold, page }) {
  const breathe = async (n) => {
    for (let i = 0; i < n; i++) {
      await page.keyboard.down('Space');
      await wait(4000);
      await page.keyboard.up('Space');
      await page.keyboard.down('ShiftLeft');
      await wait(4100);
      await page.keyboard.up('ShiftLeft');
    }
  };
  const tp = async (x, z) => {
    await page.evaluate(([x, z]) => {
      const g = window.__lw.game;
      g.player.teleport(x, z);
      g.rig.snapTo(g.player.position);
    }, [x, z]);
    await wait(1800);
  };
  const pz = () => page.evaluate(() => window.__lw.game.player.position.z);
  let cdp = null;
  const touch = async (type, points) => {
    cdp ??= await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
  };
  const vtp = async (x, z, heading) => {
    await page.evaluate(([x, z, h]) => window.__lw.teleport(x, z, h), [x, z, heading]);
    await wait(1200);
  };
  const drag = async (dx, dy) => {
    await page.mouse.move(640, 360);
    await page.mouse.down();
    for (let i = 1; i <= 10; i++) await page.mouse.move(640 + (dx * i) / 10, 360 + (dy * i) / 10);
    await page.mouse.up();
  };
  return {
    /** Test valley MVP (valley.html?autostart&debug): the whole level, start to end. */
    async valley() {
      const st = () => page.evaluate(() => window.__lw.state());
      const reach = () => page.evaluate(() => window.__lw.reach());
      const breatheUntilFree = async (id) => {
        for (let i = 0; i < 6; i++) {
          await breathe(1);
          const s = await st();
          if (s.fogs.find((f) => f.id === id).state !== 'solid') return i + 1;
        }
        return -1;
      };
      await wait(9000);
      await shot('v01-intro');
      console.log('reach at start (fog 1 solid):', JSON.stringify(await reach()));
      await vtp(0, -12.5, 0);
      await wait(6000);
      await shot('v02-fog1');
      for (let i = 0; i < 3; i++) {
        await page.keyboard.press('KeyE');
        await wait(i === 0 ? 350 : 1300);
        if (i === 0) await shot('v03-push-flash');
      }
      await shot('v04-pushed-dark');
      console.log('after 3 pushes:', JSON.stringify((await st()).fogs[0]), 'mood', (await st()).mood);
      const n1 = await breatheUntilFree('worthy');
      console.log('fog 1 released after breaths:', n1);
      await wait(900);
      await shot('v05-release-beam');
      await wait(4000);
      await shot('v06-after-release');
      console.log('reach after fog 1:', JSON.stringify(await reach()));
      await vtp(5, 17, 0);
      await wait(5000);
      await shot('v07-fog2');
      const n2 = await breatheUntilFree('angry');
      console.log('fog 2 released after breaths:', n2);
      await wait(1000);
      await shot('v08-release2');
      console.log('state:', JSON.stringify(await st()));
      console.log('reach after fog 2:', JSON.stringify(await reach()));
      await vtp(0, 36, 0);
      await wait(7000);
      await shot('v09-bridge');
      console.log('bridge:', (await st()).bridge);
      await hold('KeyW', 6500);
      await wait(3500);
      await shot('v10-end');
      console.log('end:', JSON.stringify(await st()));
      console.log('stats', JSON.stringify(await page.evaluate(() => window.__lw.stats())));
    },
    /** Scenic views of the valley for a look check. */
    async valleyviews() {
      await wait(3000);
      const views = [
        [-6, -34, 0.3, 'w01-south-meadow'],
        [8, -16, -0.6, 'w02-river'],
        [-12, 2, 0.9, 'w03-oak-monolith'],
        [5, 15, 0, 'w04-ridge-pass'],
        [0, 37, 0, 'w05-chasm'],
        [-8, 38, 1.2, 'w06-chasm-side'],
        [4, -46, 0, 'w07-start'],
      ];
      for (const [x, z, h, name] of views) {
        await vtp(x, z, h);
        await wait(3500);
        await shot(name);
        const s = await page.evaluate(() => window.__lw.stats());
        console.log(name, 'fps', s.fps, 'draws', s.drawCalls, 'scale', s.scaling.toFixed(2));
      }
      await vtp(2, 39, 0.3);
      await drag(0, 160);
      await wait(1200);
      await shot('w08-chasm-look-down');
      console.log('stats', JSON.stringify(await page.evaluate(() => window.__lw.stats())));
    },
    async play() {
      // Intro, then walk into the forest and dissolve the first fog by real breathing.
      await wait(22000);
      await shot('x1-after-intro');
      await tp(-50, 40);
      await wait(4000);
      await hold('KeyW', 500);
      await wait(6000);
      await shot('x2-teaching');
      await breathe(3);
      await wait(1500);
      const light = await page.evaluate(() => window.__lw.game.lightPoints.total);
      console.log('light after 3 real breaths:', light, '(expect 10)');
      await shot('x3-released');
      for (const [x, z] of [[-44, 40], [0, 44], [40, 44]]) {
        await tp(x, z);
        await page.evaluate(() => window.__lw.game.debugReleaseLoaded());
      }
      await tp(80, 0);
      await wait(14000);
      await hold('KeyW', 8000);
      await wait(1500);
      await shot('x4-gate');
      await wait(4000);
      await shot('x5-card');
      const card = await page.evaluate(() => document.querySelector('.transition')?.className);
      console.log('transition state:', card);
    },
    async mobile() {
      const vp = page.viewportSize();
      await shot('m1-start');
      // Joystick: press on the left, drag up.
      const jx = vp.width * 0.25;
      const jy = vp.height * 0.7;
      await touch('touchStart', [[jx, jy]]);
      for (let i = 1; i <= 6; i++) {
        await touch('touchMove', [[jx, jy - i * 10]]);
        await wait(30);
      }
      await wait(1500);
      await shot('m2-joystick');
      const z1 = await page.evaluate(() => window.__lw.game.player.position.z);
      await touch('touchEnd', []);
      console.log('walked north with joystick to z =', z1.toFixed(2));
      // Breath button: hold 4 s, then let go.
      const b = await page.evaluate(() => {
        const r = document.querySelector('.breath-button').getBoundingClientRect();
        return [r.left + r.width / 2, r.top + r.height / 2];
      });
      await touch('touchStart', [b]);
      await wait(3500);
      await shot('m3-inhale');
      const s1 = await page.evaluate(() => [window.__lw.game.breath.state, window.__lw.game.breath.breathLevel]);
      await touch('touchEnd', []);
      await wait(1500);
      const s2 = await page.evaluate(() => [window.__lw.game.breath.state, window.__lw.game.breath.breathLevel]);
      await shot('m4-exhale');
      console.log('holding button:', JSON.stringify(s1), 'after letting go:', JSON.stringify(s2));
      await wait(3000);
      const st = await page.evaluate(() => window.__lw.stats());
      console.log('mobile stats', st.fps, 'fps', st.drawCalls, 'draws, scaling', st.scaling.toFixed(3));
    },
    async partial() {
      await tp(-20, 44);
      const n = await page.evaluate(() =>
        ['b_worthy', 'b_angry', 'b_enough', 'b_afraid'].filter((id) => window.__lw.game.fogs.debugRelease(id)).length,
      );
      console.log('released planks', n);
      await tp(80, 0);
      await wait(9000);
      await hold('KeyW', 4000);
      console.log('with 4 planks, z =', (await pz()).toFixed(2), '(must stay below 9)');
      await shot('p1-four-planks');
      await page.evaluate(() => window.__lw.game.fogs.debugRelease('b_alone'));
      await wait(4000);
      await shot('p2-five-planks');
      await hold('KeyW', 4500);
      console.log('with 5 planks, z =', (await pz()).toFixed(2), '(must be above 17)');
      await shot('p3-crossed');
    },
    async finale() {
      // Release all blockades zone by zone (test helper), then walk to the gate.
      for (const [x, z] of [[-44, 40], [0, 44], [40, 44]]) {
        await tp(x, z);
        const n = await page.evaluate(() => window.__lw.game.debugReleaseLoaded());
        console.log('released', n);
        await wait(1500);
      }
      await shot('g0-last-release');
      await tp(80, 0);
      await wait(3000);
      await shot('g1-at-chasm');
      await wait(8000);
      await shot('g2-planks');
      await wait(6000);
      await shot('g3-bridge-done');
      await hold('KeyW', 2600);
      await shot('g4-on-bridge');
      await hold('KeyW', 2600);
      await shot('g5-far-side');
      await wait(3000);
      await shot('g6-gate-open');
      await hold('KeyW', 2500);
      await wait(1200);
      await shot('g7-transition');
      await wait(4000);
      await shot('g8-card');
      const st = await page.evaluate(() => window.__lw.stats());
      console.log('finale', JSON.stringify(st.extra));
    },
    async meshes() {
      await tp(0, 8);
      const names = await page.evaluate(() => window.__lw.game.scene.getActiveMeshes().data.slice(0, window.__lw.game.scene.getActiveMeshes().length).map((m) => m.name));
      const groups = {};
      for (const n of names) {
        const k = n.split(':')[0] + (n.includes(':') ? ':' + n.split(':')[1] : '');
        groups[k] = (groups[k] || 0) + 1;
      }
      console.log(JSON.stringify(groups, null, 0));
      const st = await page.evaluate(() => window.__lw.stats());
      console.log('draw', st.drawCalls, 'active', st.activeMeshes);
    },
    async tour() {
      const spots = [
        ['t1-meadow', -51, -3],
        ['t2-meadow-east', -38, 0],
        ['t3-clearing', 0, -6],
        ['t4-clearing-north', 0, 8],
        ['t5-avenue', 0.5, 26],
        ['t6-forest', -40, 38],
        ['t7-forest-center', -44, 44],
        ['t8-ruins', 0, 42],
        ['t9-ruins-center', 0, 50],
        ['t10-river', 36, 40],
        ['t11-river-ford', 44, 46],
        ['t12-chasm-path', 40, -3],
        ['t13-chasm', 80, 0],
        ['t14-chasm-edge', 80, 6],
      ];
      for (const [name, x, z] of spots) {
        await tp(x, z);
        await shot(name);
        const st = await page.evaluate(() => window.__lw.stats());
        console.log(name, 'draw', st.drawCalls, 'fps', st.fps, 'zones', st.loadedZones.join(','));
      }
    },
    async closeup() {
      const clip = { x: 490, y: 300, width: 300, height: 260 };
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c1-idle.png`, clip });
      await page.keyboard.down('KeyS');
      await wait(700);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c2-walk-south.png`, clip });
      await page.keyboard.up('KeyS');
      await page.keyboard.down('KeyW');
      await wait(700);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c3-walk-north.png`, clip });
      await page.keyboard.up('KeyW');
      await page.keyboard.down('KeyD');
      await wait(700);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c4-walk-east.png`, clip });
      await page.keyboard.up('KeyD');
      await page.keyboard.down('Space');
      await wait(3000);
      await page.screenshot({ path: `${process.argv[process.argv.indexOf('--out') + 1]}/c5-inhale.png`, clip });
      await page.keyboard.up('Space');
    },
    async intro() {
      await shot('i1-lying');
      await wait(4200);
      await shot('i2-awake');
      await wait(3500);
      await shot('i3-fairy-arrives');
      await wait(5000);
      await shot('i4-intro-line');
      await wait(9000);
      await shot('i5-intro-end');
      await hold('KeyW', 1800);
      await wait(2500);
      await shot('i6-teaching');
      await wait(6000);
      await shot('i7-teaching-2');
    },
    async fog() {
      await shot('f1-start');
      await hold('KeyW', 1300);
      await shot('f2-near-fog');
      await hold('KeyW', 900);
      await wait(300);
      await shot('f3-pushed');
      await page.keyboard.press('KeyE');
      await wait(400);
      await shot('f4-struck');
      await hold('KeyS', 300);
      await breathe(1);
      await shot('f5-after-one-breath');
      await breathe(1);
      // Third breath: dissolves early in the exhale.
      await page.keyboard.down('Space');
      await wait(4000);
      await page.keyboard.up('Space');
      await page.keyboard.down('ShiftLeft');
      await page.waitForFunction(() => window.__lw.game.lightPoints.total > 0, null, { timeout: 8000 });
      await wait(300);
      await shot('f6-dissolving');
      await wait(1200);
      await shot('f7-release-text');
      await page.keyboard.up('ShiftLeft');
      await wait(3500);
      await shot('f8-after');
    },
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
  };
}
