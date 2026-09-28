import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation';
import type { Scene } from '@babylonjs/core/scene';

export interface DebugStats {
  fps: number;
  drawCalls: number;
  activeMeshes: number;
  totalMeshes: number;
  loadedZones: string[];
  textures: number;
  scaling: number;
  extra: Record<string, string | number>;
}

/** F3 overlay: fps, draw calls, active meshes, loaded zones. */
export class DebugOverlay {
  private readonly el: HTMLDivElement;
  private readonly instr: SceneInstrumentation;
  private visible = false;
  private timer = 0;
  /** Filled by the game each frame. */
  loadedZones: string[] = [];
  extra: Record<string, string | number> = {};

  constructor(
    private readonly scene: Scene,
    parent: HTMLElement,
  ) {
    this.instr = new SceneInstrumentation(scene);
    this.el = document.createElement('div');
    this.el.className = 'debug-overlay';
    this.el.hidden = true;
    parent.appendChild(this.el);
    this.visible = new URLSearchParams(location.search).has('debug');
    this.el.hidden = !this.visible;
  }

  toggle(): void {
    this.visible = !this.visible;
    this.el.hidden = !this.visible;
  }

  stats(): DebugStats {
    const engine = this.scene.getEngine();
    return {
      fps: Math.round(engine.getFps()),
      drawCalls: this.instr.drawCallsCounter.current,
      activeMeshes: this.scene.getActiveMeshes().length,
      totalMeshes: this.scene.meshes.length,
      loadedZones: this.loadedZones,
      textures: this.scene.textures.length,
      scaling: engine.getHardwareScalingLevel(),
      extra: this.extra,
    };
  }

  update(dt: number): void {
    if (!this.visible) return;
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = 0.25;
    const s = this.stats();
    const lines = [
      `fps          ${s.fps}`,
      `draw calls   ${s.drawCalls}`,
      `active mesh  ${s.activeMeshes} / ${s.totalMeshes}`,
      `textures     ${s.textures}`,
      `scaling      ${s.scaling.toFixed(2)}`,
      `zones        ${s.loadedZones.join(', ') || '-'}`,
      ...Object.entries(s.extra).map(([k, v]) => `${k.padEnd(12)} ${v}`),
    ];
    this.el.textContent = lines.join('\n');
  }
}
