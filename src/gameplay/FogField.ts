import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { TUNING } from '../config/tuning';
import type { Events } from '../core/Events';
import type { BreathSystem } from '../player/BreathSystem';
import type { PlayerController } from '../player/PlayerController';
import { curveDrop } from '../shaders/paperShader';
import type { Walkability } from '../world/Walkability';
import { FogBlockade, type FogBlockadeData } from './FogBlockade';

/**
 * All fog clouds of the loaded zones. Decides which fog the breath reaches,
 * notices pushes, and reports releases.
 */
export class FogField {
  private readonly fogs = new Map<string, FogBlockade>();
  private readonly released = new Set<string>();
  private readonly met = new Set<string>();
  private pushCooldown = 0;
  private pushedOnce = false;
  /** The fog the exhaled light flows to this frame (for the light stream). */
  readonly streamTarget = new Vector3();
  hasTarget = false;
  /** The closest active fog and its distance (for the rhythm guide and the fairy). */
  nearest: FogBlockade | null = null;
  nearestDistance = Infinity;

  constructor(
    private readonly scene: Scene,
    private readonly walk: Walkability,
    private readonly events: Events,
  ) {}

  /** Adds a fog. A fog that was already released stays gone. */
  add(data: FogBlockadeData): FogBlockade | null {
    if (this.released.has(data.id) || this.fogs.has(data.id)) return this.fogs.get(data.id) ?? null;
    const fog = new FogBlockade(this.scene, data);
    this.fogs.set(data.id, fog);
    this.walk.colliders.push(fog.collider);
    return fog;
  }

  remove(id: string): void {
    const fog = this.fogs.get(id);
    if (!fog) return;
    fog.dispose();
    this.fogs.delete(id);
    const i = this.walk.colliders.indexOf(fog.collider);
    if (i >= 0) this.walk.colliders.splice(i, 1);
  }

  get(id: string): FogBlockade | undefined {
    return this.fogs.get(id);
  }

  isReleased(id: string): boolean {
    return this.released.has(id);
  }

  /** Marks fogs as released without playing anything (loading a save). */
  markReleased(ids: Iterable<string>): void {
    for (const id of ids) this.released.add(id);
  }

  get releasedIds(): string[] {
    return [...this.released];
  }

  update(dt: number, player: PlayerController, breath: BreathSystem, pushPressed: boolean): void {
    this.pushCooldown = Math.max(0, this.pushCooldown - dt);
    const px = player.position.x;
    const pz = player.position.z;

    let nearest: FogBlockade | null = null;
    let nearestD = Infinity;
    for (const fog of this.fogs.values()) {
      fog.update(dt);
      if (!fog.active || fog.data.breathable === false) continue;
      const d = Math.hypot(fog.position.x - px, fog.position.z - pz) - fog.collider.r;
      if (d < nearestD) {
        nearestD = d;
        nearest = fog;
      }
      if (d < 6 && !this.met.has(fog.id)) {
        this.met.add(fog.id);
        this.events.emit('fogMet', { id: fog.id, x: fog.position.x, z: fog.position.z });
      }
    }
    this.nearest = nearest;
    this.nearestDistance = nearestD;

    // Force: walking into the fog, or pressing E close to it.
    if (nearest && this.pushCooldown <= 0) {
      const dx = nearest.position.x - px;
      const dz = nearest.position.z - pz;
      const len = Math.hypot(dx, dz) || 1;
      // The collider stops the body, so use where the player wants to go, not the velocity.
      const toward = (player.intent.x * dx + player.intent.z * dz) / len;
      const walkedInto = nearestD < TUNING.fog.pushDistance && toward > 0.6;
      const struck = pushPressed && nearestD < TUNING.fog.strikeDistance;
      if (walkedInto || struck) {
        nearest.push();
        this.pushCooldown = TUNING.fog.pushCooldown;
        this.events.emit('fogPushed', { id: nearest.id, first: !this.pushedOnce });
        this.pushedOnce = true;
      }
    }

    // Breath: exhaled light flows to the nearest fog in reach.
    this.hasTarget = false;
    if (nearest && nearestD < TUNING.breath.reach) {
      const s = nearest.data.size ?? 1;
      this.streamTarget.set(nearest.position.x, 1.2 * s - curveDrop(nearest.position.z), nearest.position.z);
      this.hasTarget = true;
      if (breath.lightThisFrame > 0) {
        // Full strength up close, gently less at the edge of reach.
        const falloff = 1 - 0.4 * Math.max(0, nearestD / TUNING.breath.reach);
        const done = nearest.receiveLight(breath.lightThisFrame * falloff);
        this.events.emit('fogBreathed', { id: nearest.id, density: nearest.density });
        if (done) this.release(nearest);
      }
    }
  }

  /** Test helper: releases a breathable fog as if it was breathed away. */
  debugRelease(id: string): boolean {
    const fog = this.fogs.get(id);
    if (!fog || !fog.active || fog.data.breathable === false) return false;
    fog.receiveLight(100);
    this.release(fog);
    return true;
  }

  /** Opens a fog by story (fog walls, the gate). */
  open(id: string): void {
    const fog = this.fogs.get(id);
    if (fog && fog.active) {
      fog.open();
      this.released.add(id);
    } else {
      this.released.add(id);
    }
  }

  private release(fog: FogBlockade): void {
    this.released.add(fog.id);
    this.events.emit('blockadeReleased', {
      id: fog.id,
      points: fog.data.points,
      release: fog.data.release,
      x: fog.position.x,
      z: fog.position.z,
    });
  }

  dispose(): void {
    for (const id of [...this.fogs.keys()]) this.remove(id);
  }
}
