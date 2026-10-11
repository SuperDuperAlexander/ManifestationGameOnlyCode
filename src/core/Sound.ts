import { TUNING } from '../config/tuning';

/**
 * Sound hooks. Only soft synthesized tones and noise (no audio files).
 * Game cues live in src/game/SoundCues.ts. Everything fails silently without audio.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  get ready(): boolean {
    return this.ctx !== null && this.master !== null;
  }

  /** Browsers only allow audio after a key press or tap. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume().catch(() => undefined);
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = TUNING.sound.master;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  /** Soft filtered noise that sweeps from one frequency to another (a breath of wind). */
  sweep(from: number, to: number, start: number, length: number, gain: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    try {
      if (!this.noiseBuf) {
        const n = Math.floor(ctx.sampleRate * 1.0);
        this.noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
      }
      const t = ctx.currentTime + start;
      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 1.2;
      filter.frequency.setValueAtTime(from, t);
      filter.frequency.exponentialRampToValueAtTime(to, t + length);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(gain, t + length * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + length);
      src.connect(filter).connect(g).connect(this.master);
      src.start(t);
      src.stop(t + length + 0.05);
    } catch {
      /* silent */
    }
  }

  tone(freq: number, start: number, length: number, gain: number, type: OscillatorType = 'sine'): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const t = ctx.currentTime + start;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  /** Soft two-note bell. */
  chime(): void {
    this.tone(1318.5, 0, 1.6, 0.18);
    this.tone(1975.5, 0.09, 1.4, 0.1);
    this.tone(2637, 0.09, 0.8, 0.03);
  }

  /** Warm rising chord: a fog became light. */
  release(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.tone(f, i * 0.12, 2.4 - i * 0.2, 0.12));
  }

  /** A dull, low thud: force meets the fog. */
  push(): void {
    this.tone(98, 0, 0.9, 0.22, 'triangle');
    this.tone(73.4, 0.04, 1.2, 0.16, 'sine');
  }

  /** Very soft tone when a plank of light appears. */
  plank(index: number): void {
    const scale = [587.33, 659.25, 783.99, 880, 987.77, 1174.66];
    this.tone(scale[index % scale.length]!, 0, 1.8, 0.14);
    this.tone(scale[index % scale.length]! * 2, 0.02, 1.0, 0.04);
  }

  /** Big, slow chord for the chapter gate. */
  gate(): void {
    [261.63, 392, 523.25, 659.25, 783.99].forEach((f, i) => this.tone(f, i * 0.18, 4 - i * 0.3, 0.11));
  }
}
