import { t } from '../content/strings.en';
import type { Diagnostics } from '../core/diagnostics';
import type { LearningChecks } from '../core/save';
import { el } from './dom';

export interface DebugInfo {
  calm: number;
  light: number;
  scene: number;
  fps: number;
  tier: string;
  fogStep: number;
  seed: string;
  checks: LearningChecks;
  /** One free line, for whatever the current chapter needs to watch. */
  extra?: string;
  /** What this device's graphics really are. Read once, at the start. */
  diagnostics?: Diagnostics;
}

/**
 * What the device says about itself.
 *
 * These lines exist so a screenshot from a phone answers the question that
 * cannot be answered from a desktop: what the graphics really are, whether
 * the canvas and the picture are the same size, and what the driver refused.
 */
function diagnosticRows(d: Diagnostics | undefined): [string, string][] {
  if (!d) return [];
  return [
    ['gpu', d.gpu],
    ['webgl', String(d.webgl)],
    ['highp frag', String(d.highpFragment)],
    ['halfFloat', `${String(d.halfFloat)}/${String(d.halfFloatLinear)}`],
    ['canvas css', d.cssSize],
    ['canvas buffer', d.bufferSize],
    ['pixelRatio', `${d.pixelRatio.toFixed(2)} of ${d.devicePixelRatio.toFixed(2)}`],
    ['window', d.viewport],
    ...d.shaderErrors.map((e, i): [string, string] => [`shader ${String(i + 1)}`, e]),
  ];
}

/**
 * The debug panel behind `?debug=1`. "Export results" downloads a JSON file.
 * Nothing is ever sent anywhere.
 */
export class DebugPanel {
  readonly root: HTMLElement;
  private readonly list: HTMLElement;

  constructor(exportJson: () => string) {
    this.list = el('dl', {});
    const btn = el('button', { type: 'button', 'data-ui': '1' }, t().debug.exportResults);
    btn.addEventListener('click', () => {
      const blob = new Blob([exportJson()], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = el('a', { href: url, download: 'light-within-chapter1.json' });
      a.click();
      URL.revokeObjectURL(url);
    });
    this.root = el('div', { class: 'lw-debug', id: 'lw-debug' }, this.list, btn);
  }

  update(info: DebugInfo): void {
    const rows: [string, string][] = [
      // The device report comes first: on a phone the panel is clipped, and
      // these are the lines somebody is reading it to find.
      ...diagnosticRows(info.diagnostics),
      ['fps', String(info.fps)],
      ['tier', info.tier],
      ['scene', String(info.scene)],
      ['calm', info.calm.toFixed(3)],
      ['light', `${info.light}/12`],
      ['fog step', String(info.fogStep)],
      ...(info.extra ? ([['extra', info.extra]] as [string, string][]) : []),
      ['seed', info.seed],
      ['noHintFind', String(info.checks.stoppedWithoutHint)],
      ['pushCount', String(info.checks.pushCount)],
      ['leftFog', String(info.checks.leftFogCount)],
      ['awayFromSeed', String(info.checks.walkedAwayFromSeed)],
      ['sceneTimes', JSON.stringify(info.checks.timePerScene)],
    ];
    this.list.replaceChildren(
      ...rows.flatMap(([k, v]) => [
        el('dt', {}, k),
        el('dd', { id: `dbg-${k.replace(/\s/g, '')}` }, v),
      ]),
    );
  }
}
