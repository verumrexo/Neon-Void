import { Particle, FloatingText } from '../types/game';

export class ParticleSystem {
  public particles: Particle[] = [];
  public floatingTexts: FloatingText[] = [];

  /**
   * Spawns a spray of neon sparks when the laser hits a block.
   */
  public spawnLaserHitSparks(x: number, y: number, color: string, glow: string, count: number = 3) {
    if (this.particles.length > 250) return; // Cap for silky 60fps performance
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 25 + Math.random() * 55;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 1.5 + Math.random() * 1.5,
        color,
        glow,
        alpha: 1,
        life: 0,
        maxLife: 0.2 + Math.random() * 0.15,
        shape: 'circle',
      });
    }
  }

  /**
   * Spawns a subtle glowing thruster ember behind the ship while flying.
   */
  public spawnThrusterMote(x: number, y: number, angle: number) {
    if (this.particles.length > 250) return;
    const spread = (Math.random() - 0.5) * 0.4;
    const speed = 15 + Math.random() * 25;
    this.particles.push({
      x: x + (Math.random() - 0.5) * 2,
      y: y + (Math.random() - 0.5) * 2,
      vx: -Math.cos(angle + spread) * speed,
      vy: -Math.sin(angle + spread) * speed,
      size: 1.2 + Math.random() * 1.4,
      color: Math.random() > 0.5 ? '#00f0ff' : '#ffffff',
      glow: 'rgba(0, 240, 255, 0.8)',
      alpha: 0.85,
      life: 0,
      maxLife: 0.18 + Math.random() * 0.12,
      shape: 'circle',
    });
  }

  /**
   * Spawns an explosion of luminous shards, debris, and sparks when a block is destroyed.
   */
  public spawnBlockShatter(x: number, y: number, color: string, glow: string, tier: number = 1) {
    const sparkCount = Math.min(Math.max(0, 180 - this.particles.length), 12 + Math.min(18, tier * 3));
    for (let i = 0; i < sparkCount; i++) {
      const angle = (i / sparkCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const speed = 40 + Math.random() * 120 * (0.8 + tier * 0.2);
      this.particles.push({
        x: x + (Math.random() - 0.5) * 8,
        y: y + (Math.random() - 0.5) * 8,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: 2 + Math.random() * 3,
        color: Math.random() > 0.4 ? color : '#ffffff', // Crisp white mixed with vivid neon
        glow,
        alpha: 1,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.35,
        shape: Math.random() > 0.5 ? 'shard' : 'square',
      });
    }
  }

  /**
   * Spawns floating resource count text (e.g. "+1 Quartz", "+12 Basalt").
   */
  public spawnFloatingText(x: number, y: number, text: string, color: string) {
    this.floatingTexts.push({
      id: `${Date.now()}-${Math.random()}`,
      x,
      y: y - 5,
      text,
      color,
      alpha: 1,
      life: 0,
      maxLife: 0.9,
    });
  }

  /**
   * Updates all particles and floating text.
   */
  public update(dt: number, shipX: number, shipY: number, magnetRadius: number) {
    // 1. Update particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      // Magnet pull toward ship if within collection radius
      const dx = shipX - p.x;
      const dy = shipY - p.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < magnetRadius && dist > 1) {
        const pull = 300 * (1 - dist / magnetRadius);
        p.vx += (dx / dist) * pull * dt;
        p.vy += (dy / dist) * pull * dt;
      }

      p.vx *= 0.92;
      p.vy *= 0.92;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      p.alpha = Math.max(0, 1 - p.life / p.maxLife);
    }

    // 2. Update floating text
    for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
      const t = this.floatingTexts[i];
      t.life += dt;
      if (t.life >= t.maxLife) {
        this.floatingTexts.splice(i, 1);
        continue;
      }
      t.y -= 24 * dt; // Drift upward
      t.alpha = Math.max(0, 1 - Math.pow(t.life / t.maxLife, 1.6));
    }
  }

  /**
   * Renders particles and text with high-glow additive blending.
   */
  public render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // Render particles
    for (const p of this.particles) {
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = 0;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'shard') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.vx + p.vy) * 0.05);
        ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
        ctx.restore();
      } else {
        ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }

    ctx.restore();

    // Render floating texts with crisp outline
    if (this.floatingTexts.length > 0) {
      ctx.save();
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';

      for (const t of this.floatingTexts) {
        ctx.globalAlpha = t.alpha;
        ctx.shadowColor = t.color;
        ctx.shadowBlur = 0;
        ctx.fillStyle = t.color;
        ctx.fillText(t.text, t.x, t.y);
      }
      ctx.restore();
    }
  }

  public clear() {
    this.particles = [];
    this.floatingTexts = [];
  }
}

export const particleSystem = new ParticleSystem();
