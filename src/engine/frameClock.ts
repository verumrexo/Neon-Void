/** Fixed-rate gameplay with smooth rendering at the display's refresh rate. */
export const SIMULATION_STEP = 1 / 60;
export const MAX_FRAME_TIME = 0.1;

export class FixedStepClock {
  private previousTime: number | null = null;
  private accumulator = 0;

  public reset() { this.previousTime = null; this.accumulator = 0; }

  public advance(nowMs: number, update: (dt: number) => void): { alpha: number; elapsed: number } {
    if (this.previousTime === null) { this.previousTime = nowMs; return { alpha: 0, elapsed: 0 }; }
    const elapsed = Math.min(MAX_FRAME_TIME, Math.max(0, (nowMs - this.previousTime) / 1000));
    this.previousTime = nowMs;
    this.accumulator += elapsed;
    // Keep fractional time. Dropping it makes 60 Hz displays produce ~20 Hz motion.
    let steps = 0;
    while (this.accumulator + 1e-9 >= SIMULATION_STEP && steps < 6) {
      update(SIMULATION_STEP);
      this.accumulator = Math.max(0, this.accumulator - SIMULATION_STEP);
      steps++;
    }
    return { alpha: Math.min(1, this.accumulator / SIMULATION_STEP), elapsed };
  }
}

type Update = (dt: number) => void;
type Render = (now: number, alpha: number, elapsed: number) => void;

class GameFrameLoop {
  private updates = new Set<Update>();
  private renders = new Set<Render>();
  private clock = new FixedStepClock();
  private frame: number | null = null;
  private listening = false;

  public subscribeUpdate(callback: Update) { return this.subscribe(this.updates, callback); }
  public subscribeRender(callback: Render) { return this.subscribe(this.renders, callback); }

  private subscribe<T>(listeners: Set<T>, callback: T) {
    listeners.add(callback);
    if (!this.listening) {
      document.addEventListener('visibilitychange', this.visibilityChanged);
      this.listening = true;
    }
    this.start();
    return () => {
      listeners.delete(callback);
      if (!this.updates.size && !this.renders.size) {
        this.stop();
        document.removeEventListener('visibilitychange', this.visibilityChanged);
        this.listening = false;
      }
    };
  }

  private start() {
    if (this.frame === null && !document.hidden) this.frame = requestAnimationFrame(this.tick);
  }
  private stop() {
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.frame = null;
    this.clock.reset();
  }
  private visibilityChanged = () => { this.stop(); this.start(); };
  private tick = (now: number) => {
    this.frame = null;
    const { alpha, elapsed } = this.clock.advance(now, dt => {
      for (const update of this.updates) update(dt);
    });
    // Always simulate first, then draw the same frame. No competing RAF loops.
    for (const render of this.renders) render(now, alpha, elapsed);
    if (this.updates.size || this.renders.size) this.start();
  };
}

export const gameFrames = new GameFrameLoop();
