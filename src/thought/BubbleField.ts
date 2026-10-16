import { TUNING } from '../config/tuning';
import { Random } from '../core/Random';
import type { Anger } from '../game/Anger';
import type { World } from '../game/World';
import { createBubbleKit, ThoughtBubble, type BubbleHooks } from './ThoughtBubble';

/** What the Game needs from the Thought field of a world. */
export interface ThoughtField {
  readonly count: number;
  push(): boolean;
  update(dt: number): void;
  setText(text: string): void;
}

export interface ThoughtLine {
  level: number;
  text: string;
}

interface BumpWorld {
  citizenBump?: () => boolean;
}

/**
 * The comic Thought Bubbles of one world (GAME_DESIGN 7.3). One bubble at a time (one more may fly away).
 * Breathe = it dissolves, push (E) = shoved away, comes back bigger and a citizen bumps in, nothing = it bursts.
 */
export class BubbleField implements ThoughtField, BubbleHooks {
  private readonly bubbles: ThoughtBubble[] = [];
  private readonly rng = new Random(0xb0b);
  private fallback = '';
  private lines: ThoughtLine[] = [];
  private lastText = '';
  private gap: number = TUNING.bubbles.firstGap;
  private relief = 0;
  private wasUnlocked = false;
  /** Test hook: how many pushes shoved a bubble. */
  pushes = 0;
  /** Story gate: bubbles only come once this returns true (the bump has happened). */
  unlocked: () => boolean = () => true;

  constructor(
    private readonly world: World,
    private readonly anger: Anger,
  ) {
    const kit = createBubbleKit(world.scene);
    for (let i = 0; i < 2; i++) this.bubbles.push(new ThoughtBubble(world.scene, kit, i));
  }

  /** Fallback text (en.json `waveText`), used when `thoughts` is missing. */
  setText(text: string): void {
    this.fallback = text;
  }

  /** The `thoughts` list of en.json. */
  setThoughts(lines: ThoughtLine[]): void {
    this.lines = lines;
  }

  get count(): number {
    let n = 0;
    for (const b of this.bubbles) if (b.alive) n++;
    return n;
  }

  /** A bubble is ready to be pushed (test hook). */
  get pushable(): boolean {
    return this.pushCandidates().length > 0;
  }

  private pushCandidates(): ThoughtBubble[] { return this.bubbles.filter((b) => b.pushable); }

  /** Identities of actionable thoughts; empty during push relief. */
  get pushCueToken(): string {
    return this.pushCandidates().map((b) => b.pushCueId).join(',');
  }

  push(): boolean {
    const b = this.pushCandidates()[0];
    if (!b) return false;
    const p = this.world.playerPosition();
    b.push(b.x - p.x, b.z - p.z);
    this.anger.pushed();
    this.relief = TUNING.bubbles.pushRelief;
    this.pushes++;
    (this.world as unknown as BumpWorld).citizenBump?.();
    return true;
  }

  update(dt: number): void {
    const p = this.world.playerPosition();
    const cam = this.world.camera.position;
    const B = TUNING.bubbles;
    // Camera-right on the ground: the bubble floats to that side so it never hides the figure.
    let fx = p.x - cam.x;
    let fz = p.z - cam.z;
    const fl = Math.hypot(fx, fz) || 1;
    fx /= fl;
    fz /= fl;
    const breathing = this.world.breathState() !== 'idle';
    const head = { x: p.x, y: p.y + B.headY, z: p.z };
    for (const b of this.bubbles) {
      if (!b.alive) continue;
      b.update(dt, head, p.x + fz * b.size * B.side, p.y + B.headY + B.lift + b.size * 0.3, p.z - fx * b.size * B.side, breathing, this);
      if (b.alive) b.faceCamera(cam.x, cam.z);
    }

    if (!this.anger.active || !this.unlocked()) {
      this.wasUnlocked = false;
      for (const b of this.bubbles) b.dissolve(true);
      return;
    }
    if (!this.wasUnlocked) {
      // Just unlocked (the bump): the first thought forms right away.
      this.wasUnlocked = true;
      this.gap = 0;
      this.relief = 0;
    }
    if (this.relief > 0) this.relief -= dt;
    if (this.bubbles.some((b) => b.holding)) return;
    this.gap -= dt;
    if (this.gap > 0 || this.relief > 0) return;
    const free = this.bubbles.find((b) => !b.alive);
    if (!free) return;
    const size = B.width * (1 + (this.anger.waveScale() - 1) * B.growShare);
    const cx = p.x + fz * size * B.side;
    const cz = p.z - fx * size * B.side;
    free.spawn(this.pickText(), size, cx, p.y + B.headY + B.lift, cz);
    this.gap = B.gapCalm + (B.gapAngry - B.gapCalm) * this.anger.value;
  }

  // --- BubbleHooks ---

  passed(): void {
    this.anger.passed();
  }

  burst(): void {
    this.anger.hit();
    const B = TUNING.bubbles;
    const k = this.anger.pushLevel / TUNING.waves.maxPushLevel;
    const shove = B.hitShoveMin + (B.bigShove - B.hitShoveMin) * k;
    const cam = this.world.camera.position;
    const p = this.world.playerPosition();
    // Stagger backwards, away from the camera side that the bubble came from.
    let dx = p.x - cam.x;
    let dz = p.z - cam.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    this.world.shove(-dx * shove, -dz * shove);
    this.world.slow(B.hitSlowFactor, B.hitSlowTime);
  }

  // --- Text ---

  private pickText(): string {
    const B = TUNING.bubbles;
    if (this.lines.length === 0) return this.fallback;
    const score = this.anger.value + this.anger.pushLevel * B.pushScore;
    const level = score >= B.level2Above ? 2 : score >= B.level1Above ? 1 : 0;
    let pool = this.lines.filter((l) => l.level === level && l.text !== this.lastText);
    if (pool.length === 0) pool = this.lines.filter((l) => l.text !== this.lastText);
    if (pool.length === 0) pool = this.lines;
    const text = pool[Math.floor(this.rng.next() * pool.length)]!.text;
    this.lastText = text;
    return text;
  }
}
