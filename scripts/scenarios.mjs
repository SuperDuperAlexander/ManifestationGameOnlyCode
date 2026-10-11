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
  return {
    /** Look-within check: outer town -> inner world -> outer town, position and draw calls. */
    async lookwithin() {
      let failed = false;
      // Dismiss the start screen, if there is one.
      await page.keyboard.press('Enter');
      await wait(1000);
      await page.waitForFunction(() => !!window.__lw, null, { timeout: 30000 });
      await shot('outer-start');
      await hold('KeyW', 1500);
      await wait(500);
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
