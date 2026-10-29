import { TUNING } from '../config/tuning';
import type { Joystick } from './Joystick';

/** What the router drives for the camera finger. */
export interface LookTarget {
  dragStart(x: number, y: number): void;
  dragMove(x: number, y: number, speed?: number): void;
  dragEnd(): void;
  /** Multiplies the camera distance (pinch). Below 1 = closer. */
  zoomBy(factor: number): void;
}

type Role = 'pending' | 'walk' | 'look' | 'pinch' | 'dead';

interface Finger {
  role: Role;
  sx: number;
  sy: number;
  x: number;
  y: number;
  t: number;
  timer: number;
}

/**
 * One full-screen touch zone. How a finger lands decides what it does:
 * - rests briefly, then slides: walks (joystick under it);
 * - moves fast right away: turns the camera;
 * - two moving fingers: pinch zoom.
 * A walking finger and a looking finger work together. Mouse is ignored.
 */
export class TouchRouter {
  private readonly fingers = new Map<number, Finger>();
  private pinchDist = 0;

  constructor(
    zone: HTMLElement,
    private readonly stick: Joystick,
    private readonly look: LookTarget,
  ) {
    const T = TUNING.touch;
    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.fingers.has(e.pointerId)) return;
      e.preventDefault();
      zone.setPointerCapture(e.pointerId);
      const f: Finger = { role: 'pending', sx: e.clientX, sy: e.clientY, x: e.clientX, y: e.clientY, t: performance.now(), timer: 0 };
      this.fingers.set(e.pointerId, f);
      if (!this.has('walk')) this.stick.preview(f.sx, f.sy);
      f.timer = window.setTimeout(() => this.decideHold(f), T.holdMs);
    });
    zone.addEventListener('pointermove', (e) => {
      const f = this.fingers.get(e.pointerId);
      if (!f) return;
      e.preventDefault();
      f.x = e.clientX;
      f.y = e.clientY;
      if (f.role === 'pending') {
        if (Math.hypot(f.x - f.sx, f.y - f.sy) > T.swipeStartPx) {
          if (performance.now() - f.t <= T.holdMs) this.decideMove(f);
          else this.decideHold(f);
        }
        return;
      }
      if (f.role === 'walk') this.stick.moveTo(f.x, f.y);
      else if (f.role === 'look') this.look.dragMove(f.x, f.y, T.lookSpeed);
      else if (f.role === 'pinch') this.pinchMove();
    });
    const end = (e: PointerEvent): void => {
      const f = this.fingers.get(e.pointerId);
      if (!f) return;
      this.fingers.delete(e.pointerId);
      window.clearTimeout(f.timer);
      if (f.role === 'walk') this.stick.end();
      else if (f.role === 'look') this.look.dragEnd();
      else if (f.role === 'pinch') {
        for (const o of this.fingers.values()) if (o.role === 'pinch') o.role = 'dead';
      }
      this.syncPreview();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  private has(role: Role): boolean {
    for (const f of this.fingers.values()) if (f.role === role) return true;
    return false;
  }

  /** Shows the faint ring only while a finger could still become a walker. */
  private syncPreview(): void {
    if (this.has('walk')) return;
    for (const f of this.fingers.values()) {
      if (f.role === 'pending') {
        this.stick.preview(f.sx, f.sy);
        return;
      }
    }
    this.stick.hidePreview();
  }

  /** The finger rested: it walks (if nobody else walks). */
  private decideHold(f: Finger): void {
    if (f.role !== 'pending') return;
    window.clearTimeout(f.timer);
    if (this.has('walk')) {
      f.role = 'dead';
      this.syncPreview();
      return;
    }
    f.role = 'walk';
    this.stick.begin(f.sx, f.sy);
    this.stick.moveTo(f.x, f.y);
  }

  /** The finger moved fast: it turns the camera, or pinches with another looking finger. */
  private decideMove(f: Finger): void {
    window.clearTimeout(f.timer);
    let other: Finger | null = null;
    for (const o of this.fingers.values()) if (o !== f && o.role === 'look') other = o;
    if (other) {
      this.look.dragEnd();
      other.role = 'pinch';
      f.role = 'pinch';
      this.pinchDist = Math.hypot(other.x - f.x, other.y - f.y);
    } else if (this.has('pinch') || this.has('look')) {
      f.role = 'dead';
    } else {
      f.role = 'look';
      this.look.dragStart(f.sx, f.sy);
      this.look.dragMove(f.x, f.y, TUNING.touch.lookSpeed);
    }
    this.syncPreview();
  }

  private pinchMove(): void {
    const p = [...this.fingers.values()].filter((f) => f.role === 'pinch');
    if (p.length < 2) return;
    const d = Math.hypot(p[0]!.x - p[1]!.x, p[0]!.y - p[1]!.y);
    if (d < 1 || this.pinchDist < 1) return;
    this.look.zoomBy(Math.pow(this.pinchDist / d, TUNING.touch.pinchSensitivity));
    this.pinchDist = d;
  }
}
