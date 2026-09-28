import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe';
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture';
import type { Color3 } from '@babylonjs/core/Maths/math.color';
import { Vector3 } from '@babylonjs/core/Maths/math.vector';
import { Scene } from '@babylonjs/core/scene';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial';
import { LIGHTING, PLAYER, SHADOW, TIERS } from '../content/chapter1';
import { PALETTE } from '../content/palette';
import type { QualitySettings } from '../core/quality';
import { ColorRestoreState, colorState, touchColorState } from '../render/colorRestore';
import { linearColor, mixColor, mixColorTo } from '../render/scene3d';
import type { Group } from '../render/scene3d';
import { buildAtmosphere, setAtmosphereCount, updateAtmosphere } from './atmosphere';
import { buildGrass, setGrassDensity, updateGrass } from './grass';
import { Ground } from './ground';
import { place } from './place';
import type { Place } from './place';
import { Guide } from './guide';
import { PlayerFigure } from './player';
import { bridgeSurface, buildBridge } from './props';
import { updateMountains } from './props2';
import { buildSky, buildSunDisc, setSkyDay, setSkyNight, updateSky } from './sky';
import { clearWater, updateWater } from './water';

const GOLD = linearColor(PALETTE.receiveGold);
const COLD_RIM = linearColor(PALETTE.skyGrey);
const WARM_RIM = linearColor(PALETTE.warmSky);
const HAZE_WARM = mixColor(linearColor(PALETTE.farHillsViolet), linearColor(PALETTE.warmSky), 0.55);
const NIGHT_HAZE = linearColor(PALETTE.night);

/**
 * Builds and holds the valley: terrain, sky, props, grass, the player figure
 * and the ground checks. It knows nothing about the chapter flow.
 */
export class World {
  readonly ground: Ground;
  readonly player = new PlayerFigure();
  /** The light that travels with the player. Every chapter has exactly one. */
  readonly guide = new Guide();
  readonly color = new ColorRestoreState();
  /** Named things that stand in this place, looked up by the chapter. */
  readonly anchors = new Map<string, Group>();
  readonly bridge: Group | null = null;
  /** The place this world is built from. */
  readonly place: Place;
  private readonly sky: Mesh;
  /** The sun as a thing in the world, not only as paint in the sky. */
  readonly sunDisc: Mesh;
  private readonly grass: Mesh;
  private readonly atmosphere: Mesh;
  private readonly mountains: Mesh | null = null;
  private readonly bridgeSurfaceAdded = { done: false };
  /** The bridge's own colours, kept so the golden blend stays reversible. */
  private readonly bridgeColors: { material: PBRMaterial; base: Color3 }[] = [];
  private bridgeGold = -1;
  private clock = 0;
  private readonly sun: DirectionalLight;
  private shadows: ShadowGenerator | null = null;
  private readonly casters: Mesh[] = [];
  /** The direction the light comes from, kept so the shadow box can follow. */
  private readonly sunDir = new Vector3(38, 44, -62).normalize();
  private shadowTexelSize = 0;
  private probe: ReflectionProbe | null = null;
  private envColorAtBuild = -1;
  private envNightAtBuild = -1;
  /** The chapter writes the player's ground speed here for the walk cycle. */
  playerSpeed = 0;
  /** 0 day, 1 night. Chapter 2 turns this up for its last scene. */
  private night = 0;
  /** 0 morning, 1 evening. */
  private day = 0;

  constructor(
    readonly scene: Scene,
    quality: QualitySettings,
  ) {
    const here = place();
    this.place = here;

    // Aerial perspective. Distant ground fades into the sky, which is what
    // gives an open valley its depth. The colour follows the sky as the valley
    // returns to colour, so the haze never stays a cold grey over warm hills.
    // The world materials do it themselves, in `colorRestore`, so the engine's
    // own fog is off.
    scene.fogMode = Scene.FOGMODE_NONE;
    colorState.hazeStart = LIGHTING.hazeStart;
    colorState.hazeEnd = LIGHTING.hazeEnd;
    colorState.hazeColor.copyFrom(COLD_RIM);

    const terrain = here.buildTerrain();
    this.ground = new Ground([terrain.surface]);
    for (const extra of terrain.extras) {
      const found = extra.getChildMeshes(false).find((m) => m.name === 'mountains');
      if (found instanceof Mesh) this.mountains = found;
    }

    this.sky = buildSky(quality.skyStrokes);
    this.sunDisc = buildSunDisc(this.sky);

    // One soft directional light. It stays near neutral so the valley reads
    // grey at the start; the warmth comes from the grey-to-colour system,
    // not from the lamp. There is no ambient fill on top of it: the sky
    // light below is the fill, and a flat one only washes the contrast out.
    this.sun = new DirectionalLight('sun', this.sunDir.scale(-1), scene);
    this.sun.position.set(38, 44, -62);
    this.sun.diffuse = linearColor(LIGHTING.sunColor);
    this.sun.specular = linearColor(LIGHTING.sunColor);
    this.sun.intensity = LIGHTING.sunIntensity;
    this.sun.autoUpdateExtends = false;
    this.sun.shadowMinZ = SHADOW.near;
    this.sun.shadowMaxZ = SHADOW.far;
    this.sun.orthoLeft = -SHADOW.boxSize / 2;
    this.sun.orthoRight = SHADOW.boxSize / 2;
    this.sun.orthoTop = SHADOW.boxSize / 2;
    this.sun.orthoBottom = -SHADOW.boxSize / 2;

    // The sky light is set up before anything that stands in the place is
    // built, because a pool reflects it and has to be able to ask for it.
    this.initEnvironment();

    const props = here.buildProps(quality.treeBlobs);
    for (const b of props.blockers) this.ground.addBlocker(b.x, b.z, b.radius);

    // The grass is always built at the highest count. The tier only decides
    // how many of those cards are drawn, so a quality change during play takes
    // effect at once instead of needing the world rebuilt.
    this.grass = buildGrass(TIERS.high.grassCards);
    this.atmosphere = buildAtmosphere(TIERS.high.particles);

    const fixtures = here.buildFixtures();
    for (const [id, anchor] of fixtures.anchors) this.anchors.set(id, anchor);
    for (const b of fixtures.blockers) this.ground.addBlocker(b.x, b.z, b.radius);

    if (here.bridge) {
      const bridge = buildBridge();
      bridge.position.set(
        here.bridge.x,
        here.height(here.bridge.x, here.bridge.deckZ) - 7,
        here.bridge.z,
      );
      bridge.visible = false;
      this.bridge = bridge;
      for (const part of bridge.getChildMeshes(false)) {
        const material = part.material as PBRMaterial | null;
        if (material?.albedoColor && !this.bridgeColors.some((b) => b.material === material)) {
          this.bridgeColors.push({ material, base: material.albedoColor.clone() });
        }
      }
    }

    // Who casts and who receives. The ground only receives, the props do both,
    // and the grass does neither: 60,000 alpha-tested cards in a shadow pass
    // would cost more than every other thing in the valley put together.
    terrain.mesh.receiveShadows = true;
    for (const source of [props.group, fixtures.group, this.bridge]) {
      if (!source) continue;
      for (const part of source.getChildMeshes(false)) {
        if (!(part instanceof Mesh)) continue;
        part.receiveShadows = true;
        this.casters.push(part);
      }
    }
    for (const part of this.player.castingMeshes()) this.casters.push(part);

    // Nothing in the scatter, the fixtures or the ground ever moves again.
    // Saying so once saves working out where they are on every frame.
    for (const still of [props.group, fixtures.group, ...terrain.extras]) {
      for (const part of still.getChildMeshes(false)) part.freezeWorldMatrix();
      still.freezeWorldMatrix();
    }

    this.applyQuality(quality);
  }

  /**
   * The time of day.
   *
   * `night` is the whole amount, not a step, so a chapter can set it straight
   * to 1 or ease it and the result is the same. Everything that reads as
   * daylight follows it: the sun, the haze and the sky light itself, because
   * a night sky filtered into the environment map is what makes a moonlit
   * meadow read as moonlit rather than as a dark photograph of a day.
   */
  setNight(night: number): void {
    const n = Math.max(0, Math.min(1, night));
    if (Math.abs(n - this.night) < 0.001) return;
    this.night = n;
    setSkyNight(this.sky, n, this.sunDisc);
    colorState.night = n;
    touchColorState();
    this.sun.intensity = LIGHTING.sunIntensity * (1 - n * 0.55);
    this.sun.diffuse = linearColor(n > 0.5 ? LIGHTING.moonColor : LIGHTING.sunColor);
    // The sky light is what makes a moonlit meadow read as moonlit rather
    // than as a dark photograph of a day, so it is turned up, not down.
    this.scene.environmentIntensity = LIGHTING.skyLight + n * LIGHTING.skyLightNight;
    // Re-filtering the sky is the single most expensive thing this class can
    // do. Night falls over several seconds, so refreshing on every step meant
    // one full pass per frame and the renderer stopped keeping up. It is done
    // in steps large enough to see, like the colour drift below.
    if (Math.abs(n - this.envNightAtBuild) > 0.12 || n === 0 || n === 1) {
      this.refreshEnvironment();
    }
  }

  /** 0 morning, 1 evening. The chapter 2 sky runs one slow day. */
  setDay(day: number): void {
    const d = Math.max(0, Math.min(1, day));
    if (Math.abs(d - this.day) < 0.004) return;
    this.day = d;
    setSkyDay(this.sky, d, this.sunDisc);
  }

  /**
   * Blends the bridge toward gold. `t` is the whole amount, not a step, so the
   * result is the same however many frames it took to get there and the bridge
   * can be put back by passing 0.
   */
  setBridgeGold(t: number): void {
    const amount = Math.max(0, Math.min(1, t));
    if (amount === this.bridgeGold) return;
    this.bridgeGold = amount;
    for (const entry of this.bridgeColors) {
      entry.material.albedoColor = mixColor(entry.base, GOLD, amount);
    }
  }

  /**
   * Builds the image-based light.
   *
   * The sky is filtered into an environment map. That map lights the shadowed
   * side of every surface with real sky light instead of a flat ambient
   * guess, and because it comes from the game's own sky it greys and warms
   * with the valley for free.
   */
  private initEnvironment(): void {
    // Half float and linear: the sky is drawn in the light the rest of the
    // world is drawn in, and the sun in it is brighter than white.
    const probe = new ReflectionProbe(
      'skyLight',
      LIGHTING.skyProbeSize,
      this.scene,
      true,
      true,
      true,
    );
    probe.renderList?.push(this.sky);
    probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE;
    this.probe = probe;
    this.scene.environmentTexture = probe.cubeTexture;
    this.refreshEnvironment();
  }

  /**
   * Re-filters the sky into the environment map.
   *
   * Drawing the sky into the cube again is only half of it. The light a
   * surface receives from all directions at once is worked out from that
   * cube and then kept, and it is kept until something says otherwise — so
   * a sky that has turned to night goes on lighting the meadow like a grey
   * morning until the working-out is asked for again. It is asked for on
   * the frame after the cube has been drawn, so it reads the new sky and
   * not the old one.
   */
  private refreshEnvironment(): void {
    if (!this.probe) return;
    const cube = this.probe.cubeTexture;
    // The dome is centred on the player, so the probe has to stand inside it.
    this.probe.position.copyFrom(this.sky.position);
    cube.resetRefreshCounter();
    this.scene.onAfterRenderObservable.addOnce(() => {
      cube.forceSphericalPolynomialsRecompute();
    });
    this.scene.environmentIntensity = LIGHTING.skyLight + this.night * LIGHTING.skyLightNight;
    this.envColorAtBuild = this.color.globalColor;
    this.envNightAtBuild = this.night;
  }

  /** Applies a quality tier to everything that can change during play. */
  applyQuality(quality: QualitySettings): void {
    setGrassDensity(this.grass, quality.grassCards * this.place.grassDensity, quality.grassFade);
    this.setShadows(quality.shadowMap);
    setAtmosphereCount(this.atmosphere, quality.particles);
  }

  /**
   * Turns real shadows on at the given map size, or off when it is zero.
   *
   * Shadows are what tell the eye where a thing sits on the ground. Without
   * them a tree is a shape floating in front of a meadow. The map covers only
   * a box around the player, so it stays sharp however big the valley is.
   */
  setShadows(mapSize: number): void {
    const on = mapSize > 0;
    // The blob shadow stands in for the real one on the cheapest tier.
    this.player.setBlobShadow(!on);
    if (!on) {
      this.shadows?.dispose();
      this.shadows = null;
      return;
    }
    if (this.shadows && this.shadows.mapSize === mapSize) return;
    this.shadows?.dispose();
    const shadows = new ShadowGenerator(mapSize, this.sun);
    // A shadow outdoors is not a hard edge: it is sharp where a thing touches
    // the ground and soft where it stands away from it. The top tier draws it
    // that way; the middle tier keeps the cheaper filtered edge.
    if (mapSize >= SHADOW.contactHardeningFrom) {
      shadows.useContactHardeningShadow = true;
      shadows.contactHardeningLightSizeUVRatio = SHADOW.sunSize;
      shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    } else {
      shadows.usePercentageCloserFiltering = true;
      shadows.filteringQuality = ShadowGenerator.QUALITY_MEDIUM;
    }
    shadows.bias = SHADOW.bias;
    shadows.normalBias = SHADOW.normalBias;
    shadows.transparencyShadow = false;
    shadows.forceBackFacesOnly = false;
    for (const caster of this.casters) shadows.addShadowCaster(caster, false);
    this.shadows = shadows;
    this.shadowTexelSize = SHADOW.boxSize / mapSize;
  }

  /**
   * Keeps the shadow box over the player.
   *
   * The centre is snapped to whole shadow texels. Without that the shadows
   * crawl and shimmer with every step, which is far more distracting than
   * having no shadows at all.
   */
  private followShadow(target: Vector3): void {
    if (!this.shadows) return;
    const step = this.shadowTexelSize || 1;
    const cx = Math.round(target.x / step) * step;
    const cz = Math.round(target.z / step) * step;
    this.sun.position.set(
      cx + this.sunDir.x * SHADOW.distance,
      target.y + this.sunDir.y * SHADOW.distance,
      cz + this.sunDir.z * SHADOW.distance,
    );
  }

  /** The height the player's feet rest at, or null where there is no ground. */
  groundAt(x: number, z: number): number | null {
    return this.ground.heightAt(x, z);
  }

  /** Raises the bridge into place over the gap. Places without one ignore it. */
  setBridgeRise(t: number): void {
    const spot = this.place.bridge;
    if (!this.bridge || !spot) return;
    const top = this.place.height(spot.x, spot.deckZ);
    this.bridge.visible = t > 0;
    const eased = t * t * (3 - 2 * t);
    this.bridge.position.y = top - 7 + eased * 7;
    if (t >= 1 && !this.bridgeSurfaceAdded.done) {
      this.bridgeSurfaceAdded.done = true;
      this.ground.addSurface(bridgeSurface(this.bridge));
    }
  }

  update(
    dt: number,
    calm: number,
    light: number,
    windStrength: number,
    windRadius: number,
    fogX: number,
    fogZ: number,
  ): void {
    this.clock += dt;
    this.color.update(dt);
    // The rim light warms with the valley, so the edges pick up the returning
    // sun instead of staying a cold grey all the way to the end.
    mixColorTo(colorState.rimColor, COLD_RIM, WARM_RIM, this.color.globalColor);
    mixColorTo(colorState.hazeColor, COLD_RIM, HAZE_WARM, this.color.globalColor);
    if (this.night > 0) {
      mixColorTo(colorState.hazeColor, colorState.hazeColor, NIGHT_HAZE, this.night);
    }
    touchColorState();
    // The sky changes slowly, so the environment map is only re-filtered when
    // it has drifted far enough to see. Doing it every frame would cost more
    // than everything else in the valley.
    if (Math.abs(this.color.globalColor - this.envColorAtBuild) > 0.08) {
      this.refreshEnvironment();
    }
    updateSky(this.sky, this.clock);
    updateWater(this.clock, LIGHTING.hazeStart, LIGHTING.hazeEnd);
    updateGrass(this.grass, this.clock, windStrength, windRadius, fogX, fogZ);
    updateAtmosphere(this.atmosphere, this.clock, this.player.group.position);
    if (this.mountains) updateMountains(this.mountains);
    this.followShadow(this.player.group.position);
    this.player.setGlow(calm);
    this.player.setLight(light);
    this.guide.setLight(light);
    this.guide.update(dt, this.player.group.position, this.playerSpeed);
    const gy = this.groundAt(this.player.group.position.x, this.player.group.position.z);
    this.player.update(dt, gy ?? this.player.group.position.y, this.playerSpeed);
    // The sky dome follows the camera so it never runs out.
    this.sky.position.copyFrom(this.player.group.position);
  }

  /** Puts the player on the ground at a point and returns the height used. */
  placePlayer(x: number, z: number): number {
    const y = this.groundAt(x, z) ?? this.place.height(x, z);
    this.player.setPosition(x, y, z);
    // The guide arrives with them rather than flying across the valley.
    this.guide.snapTo(this.player.group.position);
    return y;
  }

  get playerPosition(): Vector3 {
    return this.player.group.position;
  }

  get playerEye(): Vector3 {
    return new Vector3(
      this.player.group.position.x,
      this.player.group.position.y + PLAYER.height * 0.5,
      this.player.group.position.z,
    );
  }

  dispose(): void {
    this.shadows?.dispose();
    this.probe?.dispose();
    clearWater();
  }
}
