import type { Joystick } from './Joystick';

/** What the router drives for the camera finger. */
export interface LookTarget {
  dragStart(x: number, y: number): void;
  dragMove(x: number, y: number): void;
  dragEnd(): void;
}

/**
 * One full-screen touch zone. The first finger walks (joystick under it),
 * a finger that arrives while one walks turns the camera. Mouse is ignored.
 */
export class TouchRouter {
  private readonly roles = new Map<number, 'walk' | 'look'>();

  constructor(
    zone: HTMLElement,
    private readonly stick: Joystick,
    private readonly look: LookTarget,
  ) {
    zone.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || this.roles.has(e.pointerId)) return;
      e.preventDefault();
      const roles = [...this.roles.values()];
      if (!roles.includes('walk')) {
        this.roles.set(e.pointerId, 'walk');
        this.stick.begin(e.clientX, e.clientY);
      } else if (!roles.includes('look')) {
        this.roles.set(e.pointerId, 'look');
        this.look.dragStart(e.clientX, e.clientY);
      } else return;
      zone.setPointerCapture(e.pointerId);
    });
    zone.addEventListener('pointermove', (e) => {
      const role = this.roles.get(e.pointerId);
      if (!role) return;
      e.preventDefault();
      if (role === 'walk') this.stick.moveTo(e.clientX, e.clientY);
      else this.look.dragMove(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent): void => {
      const role = this.roles.get(e.pointerId);
      if (!role) return;
      this.roles.delete(e.pointerId);
      if (role === 'walk') this.stick.end();
      else this.look.dragEnd();
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }
}
