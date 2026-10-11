/**
 * Sound hooks. For now only soft synthesized tones (no audio files):
 * a chime when the fairy shows something, and a warm chord when a fog is released.
 * Music, breath sounds and real samples can plug in here later.
 */
export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  /** Browsers only allow audio after a key press or tap. */
  unlock(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.32;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, start: number, length: number, gain: number, type: OscillatorType = 'sine'): void {
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
