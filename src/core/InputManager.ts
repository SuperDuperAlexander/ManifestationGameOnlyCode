/**
 * All player input in one place.
 * Desktop: WASD / arrows walk, Space = inhale, Shift = exhale, E = push, F3 = debug.
 * Touch devices feed the same fields through the joystick and the breath button.
 */
export class InputManager {
  /** Walk direction, -1..1. x = east, y = north. */
  moveX = 0;
  moveY = 0;
  inhaleHeld = false;
  exhaleHeld = false;
  /** True for one frame after E (or a tap near fog). */
  pushPressed = false;
  debugTogglePressed = false;
  /** True after the first key or touch. Audio may start after this. */
  hasInteracted = false;
  /** Input is ignored while false (intro, chapter transition). */
  enabled = true;

  /** Set by the touch joystick. */
  touchMoveX = 0;
  touchMoveY = 0;
  /** Set by the touch breath button: held = inhale, released = exhale (see BreathSystem). */
  touchBreathHeld = false;
  touchBreathUsed = false;

  private readonly keys = new Set<string>();
  private readonly listeners: [string, EventListener][] = [];
  private readonly interactCallbacks: (() => void)[] = [];

  attach(): void {
    const down = (e: KeyboardEvent): void => {
      this.markInteracted();
      if (e.code === 'F3') {
        e.preventDefault();
        this.debugTogglePressed = true;
        return;
      }
      if (e.code === 'Space' || e.code.startsWith('Shift') || e.code.startsWith('Arrow')) e.preventDefault();
      if (!e.repeat && e.code === 'KeyE') this.pushPressed = true;
      this.keys.add(e.code);
    };
    const up = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };
    const blur = (): void => this.keys.clear();
    this.on('keydown', down as EventListener);
    this.on('keyup', up as EventListener);
    this.on('blur', blur);
    this.on('pointerdown', () => this.markInteracted());
  }

  onFirstInteraction(cb: () => void): void {
    if (this.hasInteracted) cb();
    else this.interactCallbacks.push(cb);
  }

  markInteracted(): void {
    if (this.hasInteracted) return;
    this.hasInteracted = true;
    for (const cb of this.interactCallbacks.splice(0)) cb();
  }

  private on(type: string, fn: EventListener): void {
    window.addEventListener(type, fn, { passive: false });
    this.listeners.push([type, fn]);
  }

  /** Call once per frame before the game reads input. */
  update(): void {
    const k = this.keys;
    let x = 0;
    let y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    x += this.touchMoveX;
    y += this.touchMoveY;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    const on = this.enabled;
    this.moveX = on ? x : 0;
    this.moveY = on ? y : 0;
    this.inhaleHeld = on && (k.has('Space') || this.touchBreathHeld);
    this.exhaleHeld = on && (k.has('ShiftLeft') || k.has('ShiftRight'));
  }

  /** Call once per frame after the game has read the one-frame presses. */
  endFrame(): void {
    this.pushPressed = false;
    this.debugTogglePressed = false;
  }

  dispose(): void {
    for (const [type, fn] of this.listeners) window.removeEventListener(type, fn);
    this.listeners.length = 0;
  }
}
