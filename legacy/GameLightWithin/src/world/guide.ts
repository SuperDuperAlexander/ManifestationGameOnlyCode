import { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import type { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { GUIDE, LIGHT } from '../content/chapter1';
import { PALETTE } from '../content/palette';
import { clamp01, damp } from '../core/math';
import { colorState } from '../render/colorRestore';
import { sphereGeo } from '../render/geometry';
import type { Group } from '../render/scene3d';
import { group, linearColor, mesh as makeMesh, mixColorTo } from '../render/scene3d';
import { makeMoteMaterial } from './effects';

const COOL = linearColor(PALETTE.skyGrey);
const WARM = linearColor(PALETTE.receiveGold);

/** One speck left behind in the trail, and how much of its life is left. */
interface Speck {
  mesh: Mesh;
  life: number;
}

/**
 * The guide: a small light that travels with the player.
 *
 * She is never a face and never a body. What she looks like is a reading of
 * how far the player has come: she starts small and cold, and she grows and
 * warms with the light they carry and with the colour returning to the
 * valley. Nothing about her has to be explained, because there is nothing
 * to read — only something to notice.
 *
 * How she moves is most of her character. She circles slowly, hangs back
 * when the player sets off and catches up afterwards, and drifts in close
 * when they stand still. She is never exactly where she was put; she is
 * always arriving.
 */
export class Guide {
  readonly group: Group;
  private readonly core: Mesh;
  private readonly coreMaterial: StandardMaterial;
  private readonly halo: Mesh;
  private readonly haloMaterial: StandardMaterial;
  private readonly aura: Mesh[] = [];
  private readonly trail: Speck[] = [];
  private readonly free: Mesh[] = [];
  private readonly want = new Vector3();
  private readonly colour = new Color3();
  private angle = 0;
  private clock = 0;
  private sinceSpeck = 0;
  /** 0 nothing carried, 1 as much light as the player can hold. */
  private brightness = 0;
  /** Rises while she is saying something, so she is easy to find. */
  private speaking = 0;
  /** Somewhere she is pointing the player, or null. */
  private leadTo: Vector3 | null = null;

  constructor() {
    this.group = group('guide');

    this.coreMaterial = makeMoteMaterial(WARM.clone());
    this.core = makeMesh('guideCore', sphereGeo(1, 12, 10));
    this.core.material = this.coreMaterial;
    this.core.isPickable = false;
    this.core.parent = this.group;

    // A wider, fainter shell around the core. Together with the bloom it
    // reads as a light rather than as a small white ball.
    this.haloMaterial = makeMoteMaterial(WARM.clone());
    this.haloMaterial.alpha = 0.35;
    this.halo = makeMesh('guideHalo', sphereGeo(1, 10, 8));
    this.halo.material = this.haloMaterial;
    this.halo.scaling.setAll(2.6);
    this.halo.isPickable = false;
    this.halo.parent = this.group;

    // A few light motes orbit the core. They make her read as a small living
    // presence, while she remains only light: never a face or a body.
    const auraMaterial = makeMoteMaterial(WARM.clone());
    auraMaterial.alpha = 0.72;
    for (let i = 0; i < 5; i++) {
      const mote = makeMesh(`guideAura-${String(i)}`, sphereGeo(1, 6, 5));
      mote.material = auraMaterial;
      mote.isPickable = false;
      mote.parent = this.group;
      mote.setEnabled(false);
      this.aura.push(mote);
    }

    // The trail is a small pool of specks, laid down behind her and fading.
    // They are not parented to her: once dropped, a speck stays where it was.
    const speckMaterial = makeMoteMaterial(WARM.clone());
    const first = makeMesh('guideSpeck', sphereGeo(1, 6, 5));
    first.material = speckMaterial;
    first.isPickable = false;
    first.setEnabled(false);
    this.free.push(first);
    for (let i = 1; i < GUIDE.trail; i++) {
      const copy = first.clone(`guideSpeck-${String(i)}`);
      copy.setEnabled(false);
      this.free.push(copy);
    }
  }

  /** Puts her beside the player at the start, with no flight across the map. */
  snapTo(player: Vector3): void {
    this.desired(player, 0, this.want);
    this.group.position.copyFrom(this.want);
  }

  /** How much light the player is carrying. She grows and warms with it. */
  setLight(count: number): void {
    this.brightness = clamp01(count / LIGHT.max);
  }

  /** True while she is saying something. She brightens so she is easy to find. */
  setSpeaking(on: boolean): void {
    this.speaking = on ? 1 : 0;
  }

  /**
   * Sends her out ahead toward a point, to show the way.
   *
   * She goes and waits there rather than pointing at it, which is the only
   * kind of directions this game gives. Pass null and she comes back.
   */
  lead(target: Vector3 | null): void {
    this.leadTo = target ? target.clone() : null;
  }

  /** Where she would like to be, given where the player is and how fast. */
  private desired(player: Vector3, speed: number, out: Vector3): Vector3 {
    if (this.leadTo) {
      // Out ahead, hovering, waiting to be followed.
      out.set(this.leadTo.x, this.leadTo.y + GUIDE.orbitHeight, this.leadTo.z);
      return out;
    }
    // Close in when the player is still, further out when they are walking.
    const moving = clamp01(speed / 2);
    const radius = GUIDE.restRadius + (GUIDE.orbitRadius - GUIDE.restRadius) * moving;
    out.set(
      player.x + Math.sin(this.angle) * radius,
      player.y + GUIDE.orbitHeight + Math.sin(this.clock * 0.9) * 0.1,
      player.z + Math.cos(this.angle) * radius,
    );
    return out;
  }

  update(dt: number, player: Vector3, speed: number): void {
    this.clock += dt;
    this.angle += dt * GUIDE.orbitSpeed;

    // She is always arriving, never placed. The lag is what makes her alive.
    this.desired(player, speed, this.want);
    const here = this.group.position;
    here.x = damp(here.x, this.want.x, GUIDE.followLambda, dt);
    here.y = damp(here.y, this.want.y, GUIDE.followLambda, dt);
    here.z = damp(here.z, this.want.z, GUIDE.followLambda, dt);

    // Size and colour are the whole of what she says about the journey.
    const warmth = clamp01(this.brightness * 0.6 + colorState.globalColor * 0.6);
    const pulse = 1 + Math.sin(this.clock * 1.7) * 0.06;
    const size =
      (GUIDE.sizeMin + (GUIDE.sizeMax - GUIDE.sizeMin) * this.brightness) *
      pulse *
      (1 + this.speaking * 0.38);
    this.core.scaling.setAll(size);
    this.halo.scaling.setAll(size * (2.6 + this.speaking * 0.45));
    mixColorTo(this.colour, COOL, WARM, warmth);
    this.coreMaterial.emissiveColor = this.colour;
    this.haloMaterial.emissiveColor = this.colour;
    this.haloMaterial.alpha = 0.28 + this.speaking * 0.24;
    for (let i = 0; i < this.aura.length; i++) {
      const mote = this.aura[i];
      if (!mote) continue;
      mote.setEnabled(this.speaking > 0);
      const phase = this.clock * (0.7 + i * 0.08) + i * 1.27;
      const radius = size * (1.9 + (i % 2) * 0.55 + this.speaking * 0.45);
      mote.position.set(
        Math.cos(phase) * radius,
        Math.sin(phase * 1.6) * size * 1.15,
        Math.sin(phase) * radius,
      );
      mote.scaling.setAll(size * (0.18 + this.speaking * 0.08));
    }

    this.dropSpecks(dt, size);
  }

  /** Lays a speck down behind her and lets the old ones fade. */
  private dropSpecks(dt: number, size: number): void {
    this.sinceSpeck += dt;
    const gap = GUIDE.trailSeconds / Math.max(1, GUIDE.trail);
    if (this.sinceSpeck >= gap) {
      this.sinceSpeck = 0;
      const mesh = this.free.pop();
      if (mesh) {
        mesh.position.copyFrom(this.group.position);
        mesh.setEnabled(true);
        this.trail.push({ mesh, life: GUIDE.trailSeconds });
      }
    }
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const speck = this.trail[i];
      if (!speck) continue;
      speck.life -= dt;
      const t = clamp01(speck.life / GUIDE.trailSeconds);
      // A speck shrinks and drifts up as it goes out, like an ember.
      speck.mesh.scaling.setAll(size * 0.55 * t);
      speck.mesh.position.y += dt * 0.12;
      if (t <= 0) {
        speck.mesh.setEnabled(false);
        this.free.push(speck.mesh);
        this.trail.splice(i, 1);
      }
    }
  }

  /** Where the head should look to find her. */
  get position(): Vector3 {
    return this.group.position;
  }
}
