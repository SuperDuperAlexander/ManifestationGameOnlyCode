/**
 * Keyboard, mouse, touch and virtual joystick input.
 *
 * Desktop: WASD or the arrow keys walk, mouse drag rotates the camera,
 * hold Space to breathe in and release to breathe out, E pushes, Esc pauses.
 * Mobile: a virtual joystick on the left, a large breath button on the right,
 * a small push button above it, drag on empty screen to rotate.
 */
export class InputState {
  /** -1 to 1, left to right. */
  moveX = 0;
  /** -1 to 1, back to forward. */
  moveY = 0;
  /** True while the breathe-in key or button is held. */
  breathInHeld = false;
  /** True while the breathe-out key or button is held. */
  breathOutHeld = false;
  /** Camera turn asked for this frame, in radians. */
  yawDelta = 0;
  pitchDelta = 0;
  /** True on the frame the push button went down. */
  pushPressed = false;
  /** True on the frame the interact button went down. */
  interactPressed = false;
  /** True on the frame the pause key went down. */
  pausePressed = false;
  /** True once any pointer, key or touch has been used. Audio waits for this. */
  hasInteracted = false;

  private readonly keys = new Set<string>();
  private dragPointer: number | null = null;
  private lastX = 0;
  private lastY = 0;
  private joystickPointer: number | null = null;
  private joyBaseX = 0;
  private joyBaseY = 0;
  private readonly disposers: (() => void)[] = [];
  private enabled = true;
  /** Set by the virtual joystick and the on-screen buttons. */
  touchMoveX = 0;
  touchMoveY = 0;
  touchBreathIn = false;
  touchBreathOut = false;

  /** Called when the joystick moves, so the UI can draw the knob. */
  onJoystick: ((x: number, y: number, active: boolean) => void) | null = null;

  attach(target: HTMLElement, joystickZone: HTMLElement): void {
    const onKeyDown = (e: KeyboardEvent): void => {
      this.hasInteracted = true;
      if (!this.enabled) return;
      // Let the browser handle tabbing so the UI stays keyboard friendly.
      if (e.key === 'Tab') return;
      this.keys.add(e.code);
      if (e.code === 'Space') e.preventDefault();
      // Holding Shift must not start the browser's text selection mode.
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') e.preventDefault();
      if (e.code === 'KeyE') this.pushPressed = true;
      if (e.code === 'Escape') this.pausePressed = true;
      if (e.code === 'Enter' && e.target === document.body) this.interactPressed = true;
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      this.keys.delete(e.code);
    };
    const onBlur = (): void => {
      this.keys.clear();
      this.dragPointer = null;
      this.joystickPointer = null;
    };

    const onPointerDown = (e: PointerEvent): void => {
      this.hasInteracted = true;
      if (!this.enabled) return;
      if (joystickZone.contains(e.target as Node)) return;
      // A tap on a UI control must not rotate the camera.
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      this.dragPointer = e.pointerId;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const onPointerMove = (e: PointerEvent): void => {
      if (e.pointerId === this.joystickPointer) {
        this.updateJoystick(e.clientX, e.clientY);
        return;
      }
      if (e.pointerId !== this.dragPointer) return;
      this.yawDelta -= e.clientX - this.lastX;
      this.pitchDelta -= e.clientY - this.lastY;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    };
    const onPointerUp = (e: PointerEvent): void => {
      if (e.pointerId === this.dragPointer) this.dragPointer = null;
      if (e.pointerId === this.joystickPointer) this.endJoystick();
    };

    const onJoyDown = (e: PointerEvent): void => {
      this.hasInteracted = true;
      if (!this.enabled) return;
      this.joystickPointer = e.pointerId;
      const rect = joystickZone.getBoundingClientRect();
      this.joyBaseX = rect.left + rect.width / 2;
      this.joyBaseY = rect.top + rect.height / 2;
      // Hold on to the finger. A thumb on a small pad slides off it almost at
      // once, and without this the browser is free to hand the pointer to
      // something else the moment it leaves — which reads as a joystick that
      // lets go by itself.
      try {
        joystickZone.setPointerCapture(e.pointerId);
      } catch {
        // Some browsers refuse capture for a pointer that has already gone.
      }
      this.updateJoystick(e.clientX, e.clientY);
      e.preventDefault();
    };

    target.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    joystickZone.addEventListener('pointerdown', onJoyDown);
    // With the pointer captured, its moves and its end are delivered to the
    // pad rather than to the window, so the pad has to listen for them too.
    joystickZone.addEventListener('pointermove', onPointerMove);
    joystickZone.addEventListener('pointerup', onPointerUp);
    joystickZone.addEventListener('pointercancel', onPointerUp);

    this.disposers.push(() => {
      target.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      joystickZone.removeEventListener('pointerdown', onJoyDown);
      joystickZone.removeEventListener('pointermove', onPointerMove);
      joystickZone.removeEventListener('pointerup', onPointerUp);
      joystickZone.removeEventListener('pointercancel', onPointerUp);
    });
  }

  private updateJoystick(cx: number, cy: number): void {
    const maxDist = 52;
    let dx = cx - this.joyBaseX;
    let dy = cy - this.joyBaseY;
    const d = Math.hypot(dx, dy);
    if (d > maxDist) {
      dx = (dx / d) * maxDist;
      dy = (dy / d) * maxDist;
    }
    this.touchMoveX = dx / maxDist;
    this.touchMoveY = -dy / maxDist;
    this.onJoystick?.(dx, dy, true);
  }

  private endJoystick(): void {
    this.joystickPointer = null;
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.onJoystick?.(0, 0, false);
  }

  /** While a panel is open the world must not react to input. */
  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.keys.clear();
      this.dragPointer = null;
      this.endJoystick();
      this.touchBreathIn = false;
      this.touchBreathOut = false;
    }
  }

  /** Reads the keys and the touch controls into the movement values. */
  sample(): void {
    if (!this.enabled) {
      this.moveX = 0;
      this.moveY = 0;
      this.breathInHeld = false;
      this.breathOutHeld = false;
      return;
    }
    let x = this.touchMoveX;
    let y = this.touchMoveY;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    this.moveX = x;
    this.moveY = y;
    // Space breathes in, either Shift breathes out. Two keys, because the
    // out-breath is an action of its own, not the absence of one.
    this.breathInHeld = this.keys.has('Space') || this.touchBreathIn;
    this.breathOutHeld =
      this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') || this.touchBreathOut;
  }

  /** Clears the one-frame flags. Call at the end of each frame. */
  endFrame(): void {
    this.yawDelta = 0;
    this.pitchDelta = 0;
    this.pushPressed = false;
    this.interactPressed = false;
    this.pausePressed = false;
  }

  dispose(): void {
    for (const d of this.disposers) d();
    this.disposers.length = 0;
  }
}
