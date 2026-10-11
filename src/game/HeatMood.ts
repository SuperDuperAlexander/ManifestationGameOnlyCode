import { Color3 } from '@babylonjs/core/Maths/math.color';
import { VALLEY_UNIFORMS } from '../inner/valleyShader';
import { SHADES } from '../config/palette';
import { TUNING } from '../config/tuning';

/*
 * Anger as heat (GAME_DESIGN.md section 11): the valley's haze colour slowly
 * warms toward orange as anger rises. Both targets are bright, so the world
 * never gets dark.
 */
const SMOKE_MIX = TUNING.heat.smokeMix;
const HEAT_MIX = TUNING.heat.heatMix;

const SMOKE = Color3.FromHexString(SHADES.smokeIvory);
const HEAT = Color3.FromHexString(SHADES.heatOrange);

/**
 * Blends the shared haze colour toward heat. At anger 0 the base colour is
 * restored and left untouched. If another system resets the haze colour
 * (e.g. InnerValley.applyMood), that new value becomes the new base.
 */
export class HeatMood {
  private readonly base = new Color3();
  private readonly written = new Color3();
  private hasWritten = false;
  private readonly tmp = new Color3();

  apply(anger: number): void {
    const f = VALLEY_UNIFORMS.fogColor;
    const external = !this.hasWritten || !f.equalsWithEpsilon(this.written);
    if (external) this.base.copyFrom(f);

    const k = Math.min(1, Math.max(0, anger));
    if (k <= 0) {
      if (this.hasWritten && !external) f.copyFrom(this.base);
      this.hasWritten = false;
      return;
    }

    Color3.LerpToRef(this.base, SMOKE, SMOKE_MIX * k, this.tmp);
    Color3.LerpToRef(this.tmp, HEAT, HEAT_MIX * k, f);
    this.written.copyFrom(f);
    this.hasWritten = true;
  }
}
