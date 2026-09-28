import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem';
import '@babylonjs/core/Particles/particleSystemComponent';
import { Color4 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Scene } from '@babylonjs/core/scene';
import { damp } from '../core/Random';
import { createPaperMaterial, setPaperColor, type PaperMaterial } from '../shaders/paperShader';
import { procTexture } from '../world/ProceduralTextures';
import type { BreathSystem } from './BreathSystem';

/**
 * What breathing looks like around the player:
 * a light ring on the ground that grows while inhaling, and light that flows out while exhaling,
 * toward the nearest fog when there is one.
 */
export class BreathVisuals {
  private readonly ring: Mesh;
  private readonly ringMat: PaperMaterial;
  private readonly stream: ParticleSystem;
  private readonly emitter = new Vector3();
  /** Where exhaled light flows. Null = outward in all directions. */
  target: Vector3 | null = null;
  private ringAlpha = 0;
  private ringRadius = 1;
  /** Smoothed glow for the figure, 0..1. */
  glow = 0;

  constructor(scene: Scene) {
    this.ringMat = createPaperMaterial('breath.ringMat', scene, {
      texture: procTexture(scene, 'ring'),
      additive: true,
    });
    this.ring = MeshBuilder.CreateGround('breath.ring', { width: 2, height: 2 }, scene);
    this.ring.material = this.ringMat;
    this.ring.isPickable = false;
    this.ring.alwaysSelectAsActiveMesh = true;
    this.ring.isVisible = false;

    const ps = new ParticleSystem('breath.stream', 260, scene);
    ps.particleTexture = procTexture(scene, 'dot');
    ps.emitter = this.emitter;
    ps.blendMode = ParticleSystem.BLENDMODE_ADD;
    ps.minSize = 0.12;
    ps.maxSize = 0.3;
    ps.minLifeTime = 0.9;
    ps.maxLifeTime = 1.4;
    ps.emitRate = 0;
    ps.color1 = new Color4(1, 0.95, 0.8, 1);
    ps.color2 = new Color4(0.92, 0.77, 0.48, 1);
    ps.colorDead = new Color4(0.92, 0.77, 0.48, 0);
    ps.minEmitPower = 1;
    ps.maxEmitPower = 1;
    ps.updateSpeed = 1 / 60;
    ps.startPositionFunction = (_m, pos) => {
      const a = Math.random() * Math.PI * 2;
      const r = 0.25 + Math.random() * 0.3;
      pos.set(this.emitter.x + Math.cos(a) * r, this.emitter.y + Math.random() * 0.6, this.emitter.z + Math.sin(a) * r);
    };
    ps.startDirectionFunction = (_m, dir, particle) => {
      if (this.target) {
        // Flow toward the fog, arriving in about one lifetime.
        const dx = this.target.x - particle.position.x;
        const dy = this.target.y - particle.position.y;
        const dz = this.target.z - particle.position.z;
        const life = particle.lifeTime || 1.2;
        dir.set(dx / life + (Math.random() - 0.5) * 0.8, dy / life + 0.4, dz / life + (Math.random() - 0.5) * 0.8);
      } else {
        const a = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 1.5;
        dir.set(Math.cos(a) * speed, 0.5 + Math.random() * 0.6, Math.sin(a) * speed);
      }
    };
    ps.start();
    this.stream = ps;
  }

  update(dt: number, breath: BreathSystem, playerPos: Vector3): void {
    // Glow: rises with the in-breath, softens while breathing out.
    const inhaling = breath.state === 'inhale';
    const glowTarget = inhaling ? 0.35 + breath.breathLevel * 0.65 : breath.breathLevel * 0.45;
    this.glow += (glowTarget - this.glow) * damp(6, dt);

    // Ring on the ground: its size is the light radius.
    const ringTarget = breath.state === 'idle' ? breath.breathLevel * 0.5 : 0.35 + breath.breathLevel * 0.65;
    this.ringAlpha += (ringTarget - this.ringAlpha) * damp(5, dt);
    this.ringRadius += (breath.lightRadius - this.ringRadius) * damp(5, dt);
    this.ring.isVisible = this.ringAlpha > 0.02;
    this.ring.position.set(playerPos.x, playerPos.y + 0.05, playerPos.z);
    this.ring.scaling.set(this.ringRadius, 1, this.ringRadius);
    setPaperColor(this.ringMat, new Color4(1, 1, 1, this.ringAlpha * 0.6));

    // Light stream while exhaling.
    this.emitter.set(playerPos.x, playerPos.y + 0.5, playerPos.z);
    const exhaling = breath.state === 'exhale' && breath.breathLevel > 0.001;
    this.stream.emitRate = exhaling ? 70 + 90 * breath.rhythmScore : 0;
  }

  dispose(): void {
    this.stream.dispose(false);
    this.ring.dispose();
    this.ringMat.dispose(false, false);
  }
}
