import type { Scene } from '@babylonjs/core/scene';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import '@babylonjs/core/Meshes/thinInstanceMesh';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { PALETTE, SHADES, color3 } from '../config/palette';
import { TUNING } from '../config/tuning';
import { CitizenVisual } from '../npc/CitizenVisual';
import { TOWN, type CitizenDef } from './townLayout';

const CHILD_DEF: CitizenDef = {
  colors: 'earthy', head: 'hair', beard: false, torch: false,
  personalBase: 0, loop: 0, start: 0, scale: TUNING.story.childScale, seed: 21,
};

const SIT_Y = 0.75;
const KNEEL_Y = 0.82;
const TEARS = 3;
const APPLE_Y = 0.14;

function unlit(name: string, scene: Scene, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.diffuseColor = color3(hex);
  m.emissiveColor = color3(hex);
  m.specularColor = new Color3(0, 0, 0);
  return m;
}

/**
 * The alley scene (GAME_DESIGN 6.2, 7.5): crying child, kneeling stranger, spilled basket, 5 apples.
 * Hidden until showAfterBump(). Draw calls: child 1, basket 1, apples 1 (thin instances), tears 1.
 * The stranger figure is the one from BumpSequence (passed in).
 */
export class Alley {
  private readonly group: TransformNode;
  private readonly child: CitizenVisual;
  private readonly basket: Mesh;
  private readonly apples: Mesh;
  private readonly tears: Mesh;
  private readonly appleM = new Float32Array(5 * 16);
  private readonly appleC = new Float32Array(5 * 4);
  private readonly tearM = new Float32Array(TEARS * 16);
  private readonly glow = [0, 0, 0, 0, 0];
  private readonly picked = [false, false, false, false, false];
  private shown = false;
  private time = 0;
  private crying = true;
  private waving = false;
  private strangerStanding = false;
  private readonly red = color3(PALETTE.cloak);
  private readonly gold = color3(PALETTE.gold);
  private readonly tmp = Vector3.Zero();
  private readonly one = new Vector3(1, 1, 1);

  constructor(scene: Scene, private readonly stranger: CitizenVisual) {
    const L = TOWN.alleyStory;
    this.group = new TransformNode('alley.group', scene);
    this.child = new CitizenVisual(scene, CHILD_DEF);
    this.child.root.parent = this.group;
    this.child.root.position.set(L.child.x, 0.02, L.child.z);

    this.basket = MeshBuilder.CreateCylinder('alley.basket', { diameterTop: 0.6, diameterBottom: 0.42, height: 0.32, tessellation: 10 }, scene);
    this.basket.material = unlit('alley.basketMat', scene, SHADES.umber);
    this.basket.parent = this.group;
    this.basket.position.set(L.basket.x, 0.2, L.basket.z);
    this.basket.rotation.z = 1.25;
    this.basket.isPickable = false;

    const appleMat = new StandardMaterial('alley.appleMat', scene);
    appleMat.disableLighting = true;
    appleMat.diffuseColor = new Color3(1, 1, 1);
    appleMat.emissiveColor = new Color3(1, 1, 1);
    appleMat.specularColor = new Color3(0, 0, 0);
    this.apples = MeshBuilder.CreateSphere('alley.apples', { diameter: 0.26, segments: 8 }, scene);
    this.apples.material = appleMat;
    this.apples.parent = this.group;
    this.apples.isPickable = false;
    for (let i = 0; i < 5; i++) this.writeApple(i, 1);
    this.apples.thinInstanceSetBuffer('matrix', this.appleM, 16, false);
    this.apples.thinInstanceSetBuffer('color', this.appleC, 4, false);
    this.apples.alwaysSelectAsActiveMesh = true;

    this.tears = MeshBuilder.CreateSphere('alley.tears', { diameter: 0.05, segments: 4 }, scene);
    this.tears.material = unlit('alley.tearMat', scene, PALETTE.powder);
    this.tears.parent = this.group;
    this.tears.isPickable = false;
    this.tears.thinInstanceSetBuffer('matrix', this.tearM, 16, false);
    this.tears.alwaysSelectAsActiveMesh = true;

    this.group.setEnabled(false);
  }

  /** Makes the alley contents visible: child, kneeling stranger, basket, apples. */
  showAfterBump(): void {
    if (this.shown) return;
    this.shown = true;
    this.group.setEnabled(true);
    const S = TOWN.alleyStory.stranger;
    this.stranger.root.setEnabled(true);
    this.stranger.root.position.set(S.x, 0.02, S.z);
    this.strangerStanding = false;
  }

  /** Index of the nearest apple still on the ground within pick radius, else null. */
  nearestPickable(playerPos: { x: number; z: number }): number | null {
    if (!this.shown) return null;
    let best: number | null = null;
    let bd: number = TUNING.story.applePickRadius;
    TOWN.alleyStory.apples.forEach((a, i) => {
      if (this.picked[i]) return;
      const d = Math.hypot(a[0] - playerPos.x, a[1] - playerPos.z);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    return best;
  }

  /** Puts apple i into the basket. The basket stands up when the last one is in. */
  pickApple(i: number): void {
    if (i < 0 || i > 4 || this.picked[i]) return;
    this.picked[i] = true;
    if (this.applesLeft() === 0) {
      this.basket.rotation.z = 0;
      this.basket.position.y = 0.16;
    }
    for (let k = 0; k < 5; k++) this.writeApple(k, 1);
  }

  applesLeft(): number {
    return this.picked.filter((p) => !p).length;
  }

  /** The stranger stands; the child stops crying and waves. */
  standUpAndWave(): void {
    this.strangerStanding = true;
    this.crying = false;
    this.waving = true;
    this.tears.setEnabled(false);
  }

  /** Where the stranger's speech line is anchored (above his head). */
  strangerSpeechAnchor(): Vector3 {
    const p = this.stranger.root.position;
    return new Vector3(p.x, p.y + (this.strangerStanding ? 1.9 : 1.5), p.z);
  }

  update(dt: number, px: number, pz: number): void {
    if (!this.shown) return;
    this.time += dt;
    const L = TOWN.alleyStory;
    const T = TUNING.story;

    // Child: sits, sobs (small bob), or waves (right arm up).
    const c = this.child.root;
    const sob = this.crying ? Math.max(0, Math.sin((this.time / T.sobPeriodS) * Math.PI * 2)) : 0;
    this.child.update(dt, { speed: 0, heading: L.child.heading, agitation: 0.25, far: false, torchRaised: this.waving });
    c.scaling.y = c.scaling.x * SIT_Y;
    c.position.y = 0.02 + sob * 0.015;
    c.rotation.x = this.crying ? 0.12 + sob * 0.06 : 0.02;
    c.rotation.z = this.waving ? Math.sin(this.time * 5) * 0.04 : 0;

    // Stranger: kneels facing the child, or stands.
    const s = this.stranger;
    s.update(dt, { speed: 0, heading: L.stranger.heading, agitation: this.strangerStanding ? 0 : 0.2, far: false, torchRaised: false });
    s.root.scaling.y = s.root.scaling.x * (this.strangerStanding ? 1 : KNEEL_Y);
    s.root.position.y = 0.02;

    // Tears: small drops from the cheek, falling.
    if (this.crying) {
      const h = L.child.heading;
      const hx = L.child.x + Math.sin(h) * 0.08;
      const hz = L.child.z + Math.cos(h) * 0.08;
      for (let t = 0; t < TEARS; t++) {
        const ph = (this.time / T.tearFallS + t / TEARS) % 1;
        const side = t % 2 === 0 ? 0.05 : -0.05;
        this.tmp.set(hx + Math.cos(h) * side, 0.5 - ph * 0.3, hz - Math.sin(h) * side);
        this.one.setAll(Math.max(0.01, Math.sin(ph * Math.PI)));
        Matrix.Compose(this.one, Quaternion.Identity(), this.tmp).copyToArray(this.tearM, t * 16);
      }
      this.tears.thinInstanceBufferUpdated('matrix');
    }

    // Apples glow softly when the player is near.
    for (let i = 0; i < 5; i++) {
      if (this.picked[i]) continue;
      const a = L.apples[i]!;
      const d = Math.hypot(a[0] - px, a[1] - pz);
      const want = d < T.appleGlowRadius ? 1 - Math.max(0, (d - T.applePickRadius) / (T.appleGlowRadius - T.applePickRadius)) * 0.6 : 0;
      this.glow[i]! += (want - this.glow[i]!) * Math.min(1, dt * 4);
      this.writeApple(i, 1 + this.glow[i]! * 0.12 * (0.5 + 0.5 * Math.sin(this.time * 4 + i)));
    }
    this.apples.thinInstanceBufferUpdated('matrix');
    this.apples.thinInstanceBufferUpdated('color');
  }

  private writeApple(i: number, scale: number): void {
    const L = TOWN.alleyStory;
    if (this.picked[i]) {
      // In the basket: a loose pile.
      const n = this.picked.slice(0, i).filter(Boolean).length;
      this.tmp.set(L.basket.x + ((n % 3) - 1) * 0.12, 0.3 + (n > 2 ? 0.1 : 0), L.basket.z + (n % 2 ? 0.06 : -0.06));
    } else {
      const a = L.apples[i]!;
      this.tmp.set(a[0], APPLE_Y, a[1]);
    }
    this.one.setAll(scale);
    Matrix.Compose(this.one, Quaternion.Identity(), this.tmp).copyToArray(this.appleM, i * 16);
    const g = this.picked[i] ? 0 : this.glow[i]!;
    this.appleC[i * 4] = this.red.r + (this.gold.r - this.red.r) * g;
    this.appleC[i * 4 + 1] = this.red.g + (this.gold.g - this.red.g) * g;
    this.appleC[i * 4 + 2] = this.red.b + (this.gold.b - this.red.b) * g;
    this.appleC[i * 4 + 3] = 1;
  }
}
