import { Engine } from '@babylonjs/core/Engines/engine';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PALETTE } from '../config/palette';
import { isTouchDevice, Performance } from '../core/Performance';
import { InnerValley } from '../inner/InnerValley';
import { VALLEY_UNIFORMS } from '../inner/valleyShader';
import { Town } from '../outer/Town';
import { WORLD_UNIFORMS } from '../shaders/paperShader';
import { LookWithin } from '../transition/LookWithin';
import { DebugOverlay } from '../ui/DebugOverlay';
import { LookWithinButton } from '../ui/LookWithinButton';
import type { World, WorldId } from './World';

/** One Engine, two worlds (two Scenes). Renders and updates only the active world. */
export class Game {
  readonly engine: Engine;
  readonly outer: Town;
  readonly inner: InnerValley;
  private current: World;
  private readonly transition: LookWithin;
  private readonly perf: Performance;
  private readonly overlays = new Map<WorldId, DebugOverlay>();
  private debugOn: boolean;

  constructor(canvas: HTMLCanvasElement, ui: HTMLElement) {
    this.engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance', audioEngine: false });
    const touch = isTouchDevice();
    this.perf = new Performance(this.engine, touch);
    this.outer = new Town(this.engine, canvas, ui);
    this.inner = new InnerValley(this.engine, canvas, ui);
    this.current = this.outer;
    this.applyShared(this.outer);
    this.outer.setActive(true);

    this.transition = new LookWithin(
      ui,
      (to) => {
        to.setActive(true);
        this.current = to;
        this.applyShared(to);
        this.showOverlay(to.id);
      },
      (w) => this.syncCamera(w),
    );
    if (touch || new URLSearchParams(location.search).has('touch')) {
      document.body.classList.add('touch');
      new LookWithinButton(ui, () => this.toggle());
    }

    this.debugOn = new URLSearchParams(location.search).has('debug');
    this.overlays.set('outer', new DebugOverlay(this.outer.scene, document.body));
    this.overlays.set('inner', new DebugOverlay(this.inner.scene, document.body));
    this.showOverlay('outer');

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (e.code === 'KeyQ') this.toggle();
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugOn = !this.debugOn;
        this.showOverlay(this.current.id);
      }
    });
    window.addEventListener('resize', () => this.engine.resize());

    this.engine.runRenderLoop(() => this.frame());
    this.installHooks();
  }

  toggle(): void {
    if (this.transition.active) return;
    this.transition.start(this.current, this.current === this.outer ? this.inner : this.outer);
  }

  private showOverlay(id: WorldId): void {
    for (const [k, o] of this.overlays) o.setVisible(this.debugOn && k === id);
  }

  /** Shared global values must match the shown world. */
  private applyShared(w: World): void {
    if (w.id === 'inner') {
      const f = VALLEY_UNIFORMS.fogColor;
      w.scene.clearColor.set(f.r, f.g, f.b, 1);
    } else {
      const c = Color3.FromHexString(PALETTE.powder);
      w.scene.clearColor.set(c.r, c.g, c.b, 1);
    }
    WORLD_UNIFORMS.pivotZ = 1e6;
  }

  private syncCamera(w: World): void {
    if (w.id === 'inner') VALLEY_UNIFORMS.camPos.copyFrom(w.camera.position);
  }

  private frame(): void {
    const dt = Math.min(0.05, this.engine.getDeltaTime() / 1000);
    this.perf.update(dt);
    let shown: World | null = this.transition.update(dt);
    if (!shown) {
      shown = this.current;
      shown.update(dt);
    }
    shown.scene.render();
    const o = this.overlays.get(shown.id);
    if (o) {
      o.extra = { world: shown.id, ...shown.debugInfo() };
      o.update(dt);
    }
  }

  private installHooks(): void {
    const w = window as unknown as { __lw: unknown };
    w.__lw = {
      world: () => this.current.id,
      transitioning: () => this.transition.active,
      playerPos: () => {
        const p = this.current.playerPosition();
        return { x: p.x, y: p.y, z: p.z };
      },
      toggle: () => this.toggle(),
      drawCalls: () => this.overlays.get(this.current.id)?.stats().drawCalls ?? 0,
    };
  }
}
