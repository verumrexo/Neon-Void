/**
 * Web Audio API synthesizer for minimalist retro neon soundscapes.
 * All sound is generated procedurally with gentle pentatonic scales and warm envelopes.
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isMuted: boolean = false;
  private volume: number = 0.35;
  private lastChimeTime: number = 0;
  private lastLaserTime = 0;

  // Soothing pentatonic scale frequencies
  private readonly scale = [
    261.63, // C4
    293.66, // D4
    329.63, // E4
    392.00, // G4
    440.00, // A4
    523.25, // C5
    587.33, // D5
    659.25, // E5
    783.99, // G5
    880.00, // A5
    1046.50 // C6
  ];

  constructor() {
    const savedMute = localStorage.getItem('nvm_muted');
    if (savedMute !== null) {
      this.isMuted = savedMute === 'true';
    }
    const savedVol = localStorage.getItem('nvm_volume');
    if (savedVol !== null) {
      const parsed = parseFloat(savedVol);
      if (!isNaN(parsed)) this.volume = Math.max(0, Math.min(1, parsed));
    }
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    localStorage.setItem('nvm_muted', String(muted));
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    localStorage.setItem('nvm_volume', String(this.volume));
    if (this.masterGain && this.ctx && !this.isMuted) {
      this.masterGain.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  public getVolume(): number {
    return this.volume;
  }

  public toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Played when the laser pulses against a block.
   */
  public playLaserHit() {
    if (this.isMuted) return;
    const timestamp = performance.now();
    if (timestamp - this.lastLaserTime < 80) return;
    this.lastLaserTime = timestamp;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(420, now);
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.04);

      gain.gain.setValueAtTime(0.06, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.04);
    } catch {
      // AudioContext handling safety
    }
  }

  /**
   * Played when an asteroid block is destroyed into resources.
   * Uses pentatonic pitch based on mineral tier or random note to create calm melodic flow.
   */
  public playBlockShatter(tier: number = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      // Prevent sound flooding on rapid multi-destructions
      if (now - this.lastChimeTime < 0.035) return;
      this.lastChimeTime = now;

      const baseIdx = Math.min(this.scale.length - 1, (tier - 1) * 2 + Math.floor(Math.random() * 3));
      const freq = this.scale[baseIdx] || 440;

      // Primary chime
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = tier >= 4 ? 'sine' : 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      // Subtle harmonic overtone for rare gems
      if (tier >= 3) {
        const overtone = this.ctx.createOscillator();
        const overGain = this.ctx.createGain();
        overtone.type = 'sine';
        overtone.frequency.setValueAtTime(freq * 1.5, now);
        overGain.gain.setValueAtTime(0.05, now);
        overGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        overtone.connect(overGain);
        overGain.connect(this.masterGain);
        overtone.start(now);
        overtone.stop(now + 0.18);
      }

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.22);
    } catch {
      // ignore
    }
  }

  /**
   * Quantum Singularity warp resonance
   */
  public playSingularity() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      [220, 277.18, 329.63, 440, 554.37, 659.25, 880].forEach((freq, idx) => {
        if (!this.ctx || !this.masterGain) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.08);

        gain.gain.setValueAtTime(0.001, now + idx * 0.08);
        gain.gain.exponentialRampToValueAtTime(0.1, now + idx * 0.08 + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 0.7);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start(now + idx * 0.08);
        osc.stop(now + idx * 0.08 + 0.75);
      });
    } catch {
      // ignore
    }
  }

  /**
   * Clean UI click / upgrade sound
   */
  public playUpgradeSound() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.06); // A5

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.16);
    } catch {
      // ignore
    }
  }

  /**
   * Played when floating mineral gem is collected by the ship or drone magnet.
   * Soft, glistening crystal chime.
   */
  public playCollectMineral(tier: number = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      // Throttling to prevent audio overload when multiple crystals are collected at once
      if (now - this.lastChimeTime < 0.045) return;
      this.lastChimeTime = now;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      const freqs = [659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98];
      const note = freqs[Math.min(freqs.length - 1, tier - 1)] || 880;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(note, now);
      osc.frequency.exponentialRampToValueAtTime(note * 1.33, now + 0.08);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch {
      // ignore
    }
  }
}

export const sound = new SoundEngine();
