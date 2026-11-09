import { AsteroidWorld, BLOCK_SIZE } from './world';
import type { ShipPhysicsState } from './physics';
import type { BlockData } from '../types/game';
import type { WeaponId, WingRole, AsteroidType } from '../game/content';
import type { LegendaryPowerKey } from '../types/equipment';
import { particleSystem } from './particles';

export type HitSource = 'laser' | 'explosion' | 'rail' | 'arc' | 'gravity' | 'meteor' | 'collapse';
export interface DestroyedHit { block: BlockData; source: HitSource; mult: number }
export type CombatEvent =
  | { type: 'banner'; text: string; color: string }
  | { type: 'steal' }
  | { type: 'rivalKilled' }
  | { type: 'gearDrop'; rarity: string; name: string };

export interface CombatConfig {
  /** Laser DPS from upgrades; every weapon scales from it so progression stays shared. */
  power: number;
  equipped: Set<WeaponId>;
  levels: Record<WeaponId, number>;
  mods: Set<string>;
  damageMult: number;
  salvo: number;
  rocketRate: number;
  radiusMult: number;
  relic: string | null;
  roles: (WingRole | null)[];
  overheats: boolean;
  vault: boolean;
  asteroid: AsteroidType;
  // Gear bonuses
  critChance?: number;
  critDamageMult?: number;
  salvoChargeMult?: number;
  overheatBuffer?: number;
  legendaryPowers?: Set<LegendaryPowerKey>;
}

interface Rocket { x: number; y: number; vx: number; vy: number; tx: number; ty: number; life: number; small: boolean; drill: number; manual: boolean; trail: number }
interface Blast { x: number; y: number; r: number; life: number; max: number; color: string }
interface Fire { gx: number; gy: number; life: number }
interface Line { points: { x: number; y: number }[]; life: number; max: number; color: string; width: number }
interface Well { x: number; y: number; r: number; life: number; max: number; small: boolean }
interface Meteor { x: number; y: number; tx: number; ty: number; life: number }
interface Rival { x: number; y: number; hp: number; maxHp: number; life: number; angle: number; tx: number; ty: number }
interface PendingBlast { x: number; y: number; r: number; dmg: number; depth: number; source: HitSource; volatile?: boolean }

const CENTER = BLOCK_SIZE / 2;
const MAX_ROCKETS = 70;

export class CombatSystem {
  rockets: Rocket[] = [];
  blasts: Blast[] = [];
  fires: Fire[] = [];
  lines: Line[] = [];
  wells: Well[] = [];
  meteors: Meteor[] = [];
  rival: Rival | null = null;
  events: CombatEvent[] = [];

  shake = 0;
  heat = 0;
  overheated = 0;
  overdrive = 0;
  overdriveTimer = 0;
  railCharge = 0;
  collapse = 0;
  event: { type: 'meteors' | 'flare' | 'rival'; time: number } | null = null;
  eventCooldown = 50;
  manualCharge = 0;
  manualCooldown = 0;
  private manualTarget: { x: number; y: number } | null = null;
  private charging = false;

  private timers = new Map<string, number>();
  private pending: PendingBlast[] = [];
  private destroyed: DestroyedHit[] = [];
  private cfg!: CombatConfig;
  private world!: AsteroidWorld;

  reset() {
    this.rockets = []; this.blasts = []; this.fires = []; this.lines = []; this.wells = []; this.meteors = [];
    this.rival = null; this.event = null; this.eventCooldown = 50; this.heat = 0; this.overheated = 0;
    this.collapse = 0; this.pending = []; this.timers.clear(); this.manualCharge = 0; this.charging = false;
  }

  // ─── Player input ──────────────────────────────────────────────────────────
  canAim(cfg: CombatConfig | undefined = this.cfg) {
    return !!cfg && (cfg.equipped.has('rockets') || cfg.roles.includes('frigate'));
  }
  beginCharge(x: number, y: number, cfg?: CombatConfig) {
    if (cfg) this.cfg = cfg;
    if (this.canAim(cfg)) { this.charging = true; this.manualCharge = 0; this.manualTarget = { x, y }; }
  }
  moveCharge(x: number, y: number) { if (this.charging) this.manualTarget = { x, y }; }
  releaseCharge(ship: ShipPhysicsState) {
    if (!this.charging || !this.manualTarget) return;
    this.charging = false;
    if (this.manualCooldown > 0 || this.overheated > 0) return;
    const count = this.salvoSize() + Math.floor(this.manualCharge / 1.5 * this.salvoSize() * 2);
    for (let i = 0; i < count; i++) this.launch(ship, this.manualTarget.x + (Math.random() - 0.5) * 30, this.manualTarget.y + (Math.random() - 0.5) * 30, false, true);
    this.manualCooldown = 1.2;
    this.manualCharge = 0;
  }
  get isCharging() { return this.charging; }
  get chargeTarget() { return this.manualTarget; }
  private salvoSize() { return 2 + (this.cfg?.salvo || 0); }

  // ─── Simulation ────────────────────────────────────────────────────────────
  /** Multiplier the laser engine applies this frame (flares, overdrive, overheat). */
  laserMultiplier(): number {
    if (this.overheated > 0) return 0;
    let mult = 1;
    if (this.overdrive > 0) mult *= 3;
    if (this.event?.type === 'flare' && this.cfg?.relic !== 'cold_fusion') mult *= 0.3;
    if (this.collapse > 0) mult *= 3;
    return mult;
  }

  update(fleet: ShipPhysicsState[], world: AsteroidWorld, dt: number, cfg: CombatConfig): DestroyedHit[] {
    this.cfg = cfg; this.world = world;
    this.destroyed = [];
    this.shake = Math.max(0, this.shake - dt * 18);
    this.manualCooldown = Math.max(0, this.manualCooldown - dt);
    if (this.charging) this.manualCharge = Math.min(1.5, this.manualCharge + dt * (this.cfg.salvoChargeMult || 1));

    // Overheat: the Overcharged Core trade-off.
    const maxHeat = 5 + (this.cfg.overheatBuffer || 0);
    if (cfg.overheats && cfg.relic !== 'cold_fusion') {
      if (this.overheated > 0) {
        this.overheated -= dt;
        if (this.overheated <= 0) this.heat = 0;
      } else {
        this.heat += dt;
        if (this.heat >= maxHeat) { this.overheated = 3; this.events.push({ type: 'banner', text: 'OVERHEATED: weapons offline', color: '#ff3366' }); }
      }
    } else { this.heat = 0; this.overheated = 0; }

    if (cfg.mods.has('laser.overdrive')) {
      this.overdriveTimer += dt;
      if (this.overdriveTimer >= 8) { this.overdriveTimer = 0; this.overdrive = 2; }
    }
    this.overdrive = Math.max(0, this.overdrive - dt);

    const armed = this.overheated <= 0;
    const lvl = (id: WeaponId) => Math.pow(1.22, (cfg.levels[id] || 1) - 1);
    const power = cfg.power * cfg.damageMult * (this.collapse > 0 ? 3 : 1);

    if (armed) {
      fleet.forEach((ship, index) => {
        const role = index === 0 ? null : cfg.roles[index - 1] ?? null;
        // Rockets
        const frigate = role === 'frigate';
        if (cfg.equipped.has('rockets') || frigate) {
          const interval = 2.4 / cfg.rocketRate / (frigate ? 2 : 1);
          if (this.tick(`rocket${index}`, dt, interval)) {
            const target = this.pickTarget(ship, 9);
            if (target) for (let i = 0; i < this.salvoSize(); i++) this.launch(ship, target.x, target.y, false, false);
          }
        }
        // Gravity
        if (cfg.equipped.has('gravity') && index === 0 && this.tick('gravity', dt, 7)) {
          for (let i = 0; i < (cfg.mods.has('gravity.twin') ? 2 : 1); i++) {
            const target = this.pickTarget(ship, 7);
            if (target) this.wells.push({ x: target.x, y: target.y, r: (cfg.mods.has('gravity.horizon') ? 3.3 : 2.2) * BLOCK_SIZE, life: 2, max: 2, small: false });
          }
        }
        if (role === 'tug' && this.tick(`tug${index}`, dt, 5)) {
          const target = this.pickTarget(ship, 6);
          if (target) this.wells.push({ x: target.x, y: target.y, r: 1.6 * BLOCK_SIZE, life: 1.5, max: 1.5, small: true });
        }
        // Arc
        if (cfg.equipped.has('arc') && index === 0 && this.tick('arc', dt, 2.2)) {
          const target = this.pickTarget(ship, 6, true);
          if (target) this.arc(ship.x, ship.y, target.gx, target.gy, power * 2.5 * lvl('arc'));
        }
      });

      // Railgun charges on the main ship only.
      if (cfg.equipped.has('railgun')) {
        this.railCharge += dt / (cfg.mods.has('railgun.capacitor') ? 2.4 : 4);
        if (this.railCharge >= 1) { this.railCharge = 0; this.fireRail(fleet[0], power * 9 * lvl('railgun')); }
      } else this.railCharge = 0;
    }

    this.updateRockets(dt, power * 2.4 * lvl('rockets'));
    this.updateWells(dt, power * lvl('gravity'));
    this.updateFires(dt, power * 0.8 * lvl('rockets'));
    this.updateEvents(fleet, dt, power);
    this.updateCollapse(fleet, dt, power);
    this.resolveBlasts();

    for (const blast of this.blasts) blast.life -= dt;
    this.blasts = this.blasts.filter(blast => blast.life > 0);
    for (const line of this.lines) line.life -= dt;
    this.lines = this.lines.filter(line => line.life > 0);
    return this.destroyed;
  }

  private tick(key: string, dt: number, interval: number): boolean {
    const value = (this.timers.get(key) ?? interval * Math.random()) + dt;
    if (value >= interval) { this.timers.set(key, value - interval); return true; }
    this.timers.set(key, value);
    return false;
  }

  /** Finds a surface block near a ship, preferring the rival, volatile crystals and armored cores. */
  private pickTarget(ship: ShipPhysicsState, radius: number, ore = false): { x: number; y: number; gx: number; gy: number } | null {
    if (this.rival && Math.hypot(this.rival.x - ship.x, this.rival.y - ship.y) < radius * BLOCK_SIZE * 1.5) {
      return { x: this.rival.x, y: this.rival.y, gx: Math.floor(this.rival.x / BLOCK_SIZE), gy: Math.floor(this.rival.y / BLOCK_SIZE) };
    }
    const sx = Math.floor(ship.x / BLOCK_SIZE), sy = Math.floor(ship.y / BLOCK_SIZE);
    let best: { gx: number; gy: number; score: number } | null = null;
    for (let attempt = 0; attempt < 70; attempt++) {
      const gx = sx + Math.round((Math.random() * 2 - 1) * radius);
      const gy = sy + Math.round((Math.random() * 2 - 1) * radius);
      if (!this.world.isSurfaceBlock(gx, gy)) continue;
      const block = this.world.getBlock(gx, gy);
      if (!block) continue;
      let score = Math.random();
      if (block.volatile) score += 3;
      if (block.armored) score += 2;
      if (ore && block.type !== 'basalt') score += 2;
      if (!best || score > best.score) best = { gx, gy, score };
    }
    return best ? { gx: best.gx, gy: best.gy, x: (best.gx + 0.5) * BLOCK_SIZE, y: (best.gy + 0.5) * BLOCK_SIZE } : null;
  }

  // ─── Damage core ───────────────────────────────────────────────────────────
  private hit(gx: number, gy: number, damage: number, source: HitSource, mult = 1) {
    if (this.world.isMined(gx, gy) || damage <= 0) return;
    const before = this.world.getBlock(gx, gy);
    if (!before) return;
    if (before.armored && this.cfg.relic === 'boss_hunter') damage *= 3;
    if (this.cfg.legendaryPowers?.has('deep_resonator') && Math.hypot(gx, gy) >= 8) damage *= 1.6;

    // Critical strike roll
    const isCrit = Math.random() < (this.cfg.critChance || 0.05);
    if (isCrit) {
      damage *= (this.cfg.critDamageMult || 1.5);
      if (this.cfg.legendaryPowers?.has('quantum_magnet')) mult *= 3;
      if (this.cfg.legendaryPowers?.has('sunstone_infusion') && this.fires.length < 80) {
        this.fires.push({ gx, gy, life: 3 });
      }
      if (this.cfg.legendaryPowers?.has('chain_crits') && Math.random() < 0.6) {
        this.arc((gx + 0.5) * BLOCK_SIZE, (gy + 0.5) * BLOCK_SIZE, gx, gy, damage * 0.4);
      }
      if (damage > 12) {
        particleSystem.spawnLaserHitSparks((gx + 0.5) * BLOCK_SIZE, (gy + 0.5) * BLOCK_SIZE, '#ffb800', 'rgba(255,184,0,0.9)', 4);
      }
    }

    const result = this.world.damageBlock(gx, gy, damage);
    if (!result.destroyed) return;
    this.destroyed.push({ block: result.block, source, mult });
    if (result.block.volatile) {
      this.pending.push({ x: (gx + 0.5) * BLOCK_SIZE, y: (gy + 0.5) * BLOCK_SIZE, r: (this.cfg.vault ? 3.6 : 2.2) * BLOCK_SIZE,
        dmg: Math.max(60, this.cfg.power * 6), depth: 0, source: 'explosion', volatile: true });
    }
    if (result.block.armored) {
      this.shake = Math.min(14, this.shake + 10);
      this.events.push({ type: 'banner', text: 'ARMORED CORE CRACKED', color: '#ffb800' });
    }
  }

  /** Lets the laser engine and relics feed destroyed volatile blocks back into chain reactions. */
  notifyDestroyed(block: BlockData) {
    if (block.volatile) this.pending.push({ x: (block.x + 0.5) * BLOCK_SIZE, y: (block.y + 0.5) * BLOCK_SIZE,
      r: (this.cfg?.vault ? 3.6 : 2.2) * BLOCK_SIZE, dmg: Math.max(60, (this.cfg?.power || 10) * 6), depth: 0, source: 'explosion', volatile: true });
  }

  explode(x: number, y: number, radius: number, damage: number, source: HitSource = 'explosion', depth = 0) {
    this.pending.push({ x, y, r: radius, dmg: damage, depth, source });
  }

  private resolveBlasts() {
    let budget = 40;
    while (this.pending.length && budget-- > 0) {
      const blast = this.pending.shift()!;
      const radius = blast.r * this.cfg.radiusMult;
      let damage = blast.dmg;
      if (this.cfg.asteroid === 'metallic' && !blast.volatile) damage *= 0.5;
      const mult = blast.source === 'explosion' && this.cfg.mods.has('rockets.magnet') ? 2 : blast.source === 'meteor' ? 1.5 : 1;
      const r = Math.ceil(radius / BLOCK_SIZE);
      const cx = Math.floor(blast.x / BLOCK_SIZE), cy = Math.floor(blast.y / BLOCK_SIZE);
      for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) {
        const distance = Math.hypot((gx + 0.5) * BLOCK_SIZE - blast.x, (gy + 0.5) * BLOCK_SIZE - blast.y);
        if (distance > radius) continue;
        this.hit(gx, gy, damage * (1 - distance / radius * 0.6), blast.source, mult);
      }
      if (this.rival && Math.hypot(this.rival.x - blast.x, this.rival.y - blast.y) < radius + 14) this.damageRival(damage);
      this.blasts.push({ x: blast.x, y: blast.y, r: radius, life: 0.45, max: 0.45, color: blast.volatile ? '#ff3b1f' : blast.source === 'meteor' ? '#ffd27a' : '#ff8a3d' });
      particleSystem.spawnBlockShatter(blast.x, blast.y, blast.volatile ? '#ff3b1f' : '#ff8a3d', 'rgba(255,120,40,0.9)', 4);
      this.shake = Math.min(14, this.shake + (blast.volatile ? 5 : 2.2) * radius / BLOCK_SIZE / 2);
      if (this.cfg.relic === 'chain_master' && blast.depth < 3 && Math.random() < 0.4) {
        const angle = Math.random() * Math.PI * 2;
        this.pending.push({ ...blast, x: blast.x + Math.cos(angle) * radius, y: blast.y + Math.sin(angle) * radius, depth: blast.depth + 1, volatile: false });
      }
    }
    if (this.pending.length > 120) this.pending.length = 120;
  }

  // ─── Rockets ───────────────────────────────────────────────────────────────
  private launch(ship: ShipPhysicsState, tx: number, ty: number, small: boolean, manual: boolean, from?: { x: number; y: number }) {
    if (this.rockets.length >= MAX_ROCKETS) return;
    const origin = from || ship;
    const angle = from ? Math.random() * Math.PI * 2 : ship.angle + (Math.random() - 0.5) * 2.4 + Math.PI;
    const speed = small ? 160 : 90;
    this.rockets.push({ x: origin.x, y: origin.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, tx, ty,
      life: small ? 0.9 : 3, small, drill: !small && this.cfg.mods.has('rockets.drill') ? 3 : 0, manual, trail: 0 });
  }

  private updateRockets(dt: number, damage: number) {
    const survivors: Rocket[] = [];
    for (const rocket of this.rockets) {
      rocket.life -= dt;
      const dx = rocket.tx - rocket.x, dy = rocket.ty - rocket.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const thrust = rocket.small ? 900 : 620;
      rocket.vx += dx / distance * thrust * dt; rocket.vy += dy / distance * thrust * dt;
      const drag = Math.pow(0.12, dt);
      rocket.vx *= drag; rocket.vy *= drag;
      rocket.x += rocket.vx * dt; rocket.y += rocket.vy * dt;
      rocket.trail += dt;
      if (rocket.trail > 0.03 && particleSystem.particles.length < 160) {
        rocket.trail = 0;
        particleSystem.particles.push({ x: rocket.x, y: rocket.y, vx: -rocket.vx * 0.1, vy: -rocket.vy * 0.1, size: rocket.small ? 1.2 : 2,
          color: Math.random() > 0.5 ? '#ffb070' : '#777', glow: '', alpha: 0.8, life: 0, maxLife: 0.35, shape: 'circle' });
      }
      const gx = Math.floor(rocket.x / BLOCK_SIZE), gy = Math.floor(rocket.y / BLOCK_SIZE);
      const inRock = !this.world.isMined(gx, gy);
      const hitRival = this.rival && Math.hypot(this.rival.x - rocket.x, this.rival.y - rocket.y) < 14;
      if (inRock && rocket.drill > 0 && !hitRival) {
        // Drill payload chews through a few blocks before detonating.
        this.hit(gx, gy, 1e9, 'explosion');
        rocket.drill--;
        survivors.push(rocket);
        continue;
      }
      if (inRock || hitRival || rocket.life <= 0 || (distance < 6 && rocket.small)) {
        this.detonate(rocket, damage);
        continue;
      }
      survivors.push(rocket);
    }
    this.rockets = survivors;
  }

  private detonate(rocket: Rocket, damage: number) {
    const radius = (rocket.small ? 0.9 : 1.7) * BLOCK_SIZE;
    this.explode(rocket.x, rocket.y, radius, rocket.small ? damage * 0.45 : damage * (rocket.manual ? 1.3 : 1));
    if (!rocket.small && this.cfg.mods.has('rockets.napalm')) {
      const gx = Math.floor(rocket.x / BLOCK_SIZE), gy = Math.floor(rocket.y / BLOCK_SIZE);
      for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) if (!this.world.isMined(x, y) && this.fires.length < 80) this.fires.push({ gx: x, gy: y, life: 4 });
    }
    if (!rocket.small) {
      const splits = (this.cfg.mods.has('rockets.cluster') ? 6 : 0) + (this.cfg.relic === 'split_rockets' ? 3 : 0) + (this.cfg.legendaryPowers?.has('cluster_sparks') ? 4 : 0);
      for (let i = 0; i < splits; i++) {
        const angle = (i / splits) * Math.PI * 2;
        this.launch(null as unknown as ShipPhysicsState, rocket.x + Math.cos(angle) * 60, rocket.y + Math.sin(angle) * 60, true, false,
          { x: rocket.x - rocket.vx * 0.02, y: rocket.y - rocket.vy * 0.02 });
      }
    }
  }

  private updateFires(dt: number, dps: number) {
    for (const fire of this.fires) {
      fire.life -= dt;
      this.hit(fire.gx, fire.gy, dps * dt, 'explosion', this.cfg.mods.has('rockets.magnet') ? 2 : 1);
      if (this.world.isMined(fire.gx, fire.gy)) fire.life = 0;
    }
    this.fires = this.fires.filter(fire => fire.life > 0);
  }

  // ─── Railgun ───────────────────────────────────────────────────────────────
  private fireRail(ship: ShipPhysicsState, damage: number) {
    let angle = Math.atan2(ship.y - CENTER, ship.x - CENTER);
    const target = this.pickTarget(ship, 6);
    if (target) angle = Math.atan2(target.y - ship.y, target.x - ship.x);
    const pierce = (6 + Math.floor((this.cfg.levels.railgun || 1) / 2)) * (this.cfg.mods.has('railgun.tungsten') ? 2 : 1);
    let pierced = 0, x = ship.x, y = ship.y, lastKey = '';
    const shockwave = this.cfg.mods.has('railgun.shockwave');
    for (let step = 0; step < 400 && pierced < pierce; step++) {
      x += Math.cos(angle) * BLOCK_SIZE / 3; y += Math.sin(angle) * BLOCK_SIZE / 3;
      const gx = Math.floor(x / BLOCK_SIZE), gy = Math.floor(y / BLOCK_SIZE), key = `${gx},${gy}`;
      if (key === lastKey) continue;
      lastKey = key;
      if (this.rival && Math.hypot(this.rival.x - x, this.rival.y - y) < 14) this.damageRival(damage);
      if (this.world.isMined(gx, gy)) continue;
      this.hit(gx, gy, damage, 'rail');
      if (shockwave) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) this.hit(gx + ox, gy + oy, damage * 0.3, 'rail');
      pierced++;
    }
    this.lines.push({ points: [{ x: ship.x, y: ship.y }, { x, y }], life: 0.35, max: 0.35, color: '#b3f0ff', width: 4 });
    this.shake = Math.min(14, this.shake + 4);
  }

  // ─── Chain arc ─────────────────────────────────────────────────────────────
  arc(fromX: number, fromY: number, gx: number, gy: number, damage: number) {
    const start = this.world.getBlock(gx, gy);
    if (!start) return;
    const jumps = 5 + (this.cfg.mods.has('arc.conductor') ? 4 : 0);
    const forked = this.cfg.mods.has('arc.forked');
    const visited = new Set<string>();
    let frontier = [{ gx, gy, x: fromX, y: fromY }];
    for (let jump = 0; jump < jumps && frontier.length; jump++) {
      const next: typeof frontier = [];
      for (const node of frontier) {
        const key = `${node.gx},${node.gy}`;
        if (visited.has(key)) continue;
        visited.add(key);
        const px = (node.gx + 0.5) * BLOCK_SIZE, py = (node.gy + 0.5) * BLOCK_SIZE;
        this.lines.push({ points: jag(node.x, node.y, px, py), life: 0.25, max: 0.25, color: '#d4a8ff', width: 1.6 });
        this.hit(node.gx, node.gy, damage, 'arc');
        const candidates: { gx: number; gy: number }[] = [];
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          if (!dx && !dy) continue;
          const block = this.world.getBlock(node.gx + dx, node.gy + dy);
          if (block && block.type === start.type && !visited.has(`${node.gx + dx},${node.gy + dy}`)) candidates.push({ gx: node.gx + dx, gy: node.gy + dy });
        }
        candidates.sort(() => Math.random() - 0.5);
        for (const candidate of candidates.slice(0, forked ? 2 : 1)) next.push({ ...candidate, x: px, y: py });
        if (!candidates.length && this.cfg.mods.has('arc.overload')) this.explode(px, py, 1.3 * BLOCK_SIZE, damage * 1.5);
      }
      frontier = next.slice(0, 12);
    }
  }

  // ─── Gravity well ──────────────────────────────────────────────────────────
  private updateWells(dt: number, power: number) {
    const mult = this.cfg.mods.has('gravity.compressor') ? 2.5 : 1.5;
    for (const well of this.wells) {
      well.life -= dt;
      const r = Math.ceil(well.r / BLOCK_SIZE);
      const cx = Math.floor(well.x / BLOCK_SIZE), cy = Math.floor(well.y / BLOCK_SIZE);
      const dps = power * (well.small ? 1.2 : 3);
      for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) {
        if (Math.hypot((gx + 0.5) * BLOCK_SIZE - well.x, (gy + 0.5) * BLOCK_SIZE - well.y) <= well.r) this.hit(gx, gy, dps * dt, 'gravity', mult);
      }
      if (particleSystem.particles.length < 150 && Math.random() < 0.6) {
        const angle = Math.random() * Math.PI * 2;
        particleSystem.particles.push({ x: well.x + Math.cos(angle) * well.r, y: well.y + Math.sin(angle) * well.r,
          vx: -Math.cos(angle) * well.r * 2.2, vy: -Math.sin(angle) * well.r * 2.2, size: 1.5, color: '#a78bfa', glow: '', alpha: 1, life: 0, maxLife: 0.4, shape: 'circle' });
      }
      if (well.life <= 0) {
        // Implosion: one big crushing hit.
        for (let gy = cy - r; gy <= cy + r; gy++) for (let gx = cx - r; gx <= cx + r; gx++) {
          if (Math.hypot((gx + 0.5) * BLOCK_SIZE - well.x, (gy + 0.5) * BLOCK_SIZE - well.y) <= well.r) this.hit(gx, gy, power * (well.small ? 3 : 8), 'gravity', mult);
        }
        this.blasts.push({ x: well.x, y: well.y, r: well.r, life: 0.4, max: 0.4, color: '#7c5cff' });
        this.shake = Math.min(14, this.shake + 3);
      }
    }
    this.wells = this.wells.filter(well => well.life > 0);
  }

  // ─── Random events ─────────────────────────────────────────────────────────
  private updateEvents(fleet: ShipPhysicsState[], dt: number, power: number) {
    const ship = fleet[0];
    if (!this.event) {
      if (this.collapse > 0) return;
      this.eventCooldown -= dt * (this.cfg.relic === 'meteor_magnet' ? 3 : 1);
      if (this.eventCooldown <= 0) {
        const roll = Math.random();
        const type = this.cfg.relic === 'meteor_magnet' || roll < 0.45 ? 'meteors' : roll < 0.75 ? 'flare' : 'rival';
        this.event = { type, time: type === 'meteors' ? 12 : type === 'flare' ? 15 : 25 };
        this.eventCooldown = 45 + Math.random() * 45;
        if (type === 'meteors') this.events.push({ type: 'banner', text: 'METEOR SHOWER: free explosions incoming', color: '#ffd27a' });
        if (type === 'flare') this.events.push({ type: 'banner', text: this.cfg.relic === 'cold_fusion' ? 'SOLAR FLARE (Cold Fusion protects you)' : 'SOLAR FLARE: lasers at 30%, other weapons unaffected', color: '#ffb800' });
        if (type === 'rival') {
          const angle = Math.random() * Math.PI * 2;
          const hp = Math.max(400, power * 45);
          this.rival = { x: ship.x + Math.cos(angle) * 90, y: ship.y + Math.sin(angle) * 90, hp, maxHp: hp, life: 25, angle: 0, tx: ship.x, ty: ship.y };
          this.events.push({ type: 'banner', text: 'RIVAL MINER: destroy it within 25s or it steals 10% of your ore', color: '#ff3366' });
        }
      }
      return;
    }
    this.event.time -= dt;
    if (this.event.type === 'meteors' && this.tick('meteor', dt, 0.45)) {
      const target = this.pickTarget(ship, 12);
      if (target) {
        const angle = Math.random() * Math.PI * 2;
        this.meteors.push({ x: target.x + Math.cos(angle) * 500, y: target.y + Math.sin(angle) * 500, tx: target.x, ty: target.y, life: 0.9 });
      }
    }
    if (this.rival) {
      const rival = this.rival;
      rival.life -= dt;
      // The rival hovers near your fleet and lasers your rock.
      if (this.tick('rivalMove', dt, 1.5)) {
        const target = this.pickTarget(ship, 6);
        if (target) { rival.tx = target.x; rival.ty = target.y; }
      }
      rival.x += (rival.tx - rival.x) * Math.min(1, dt * 0.8);
      rival.y += (rival.ty - rival.y) * Math.min(1, dt * 0.8);
      rival.angle = Math.atan2(rival.ty - rival.y, rival.tx - rival.x);
      // Your lasers chip at it when it gets close.
      for (const fleetShip of fleet) if (Math.hypot(fleetShip.x - rival.x, fleetShip.y - rival.y) < 150) this.damageRival(this.cfg.power * 0.6 * dt * this.laserMultiplier());
      if (rival.life <= 0 && this.rival) {
        this.events.push({ type: 'steal' }, { type: 'banner', text: 'The rival escaped with 10% of your ore', color: '#ff3366' });
        this.rival = null; this.event = null;
      }
    }
    if (this.event && this.event.time <= 0) {
      if (this.event.type === 'rival' && this.rival) return;
      this.event = null;
    }
    const remaining: Meteor[] = [];
    for (const meteor of this.meteors) {
      meteor.life -= dt;
      const t = Math.max(0, meteor.life / 0.9);
      const x = meteor.tx + (meteor.x - meteor.tx) * t, y = meteor.ty + (meteor.y - meteor.ty) * t;
      if (particleSystem.particles.length < 160) particleSystem.particles.push({ x, y, vx: 0, vy: 0, size: 3, color: '#ffd27a', glow: '', alpha: 1, life: 0, maxLife: 0.25, shape: 'circle' });
      if (meteor.life <= 0) this.explode(meteor.tx, meteor.ty, 1.8 * BLOCK_SIZE, Math.max(80, power * 5), 'meteor');
      else remaining.push(meteor);
    }
    this.meteors = remaining;
  }

  private damageRival(amount: number) {
    if (!this.rival) return;
    this.rival.hp -= amount;
    if (this.rival.hp <= 0) {
      this.explode(this.rival.x, this.rival.y, 2.5 * BLOCK_SIZE, this.cfg.power * 4);
      this.events.push({ type: 'rivalKilled' }, { type: 'banner', text: 'RIVAL DESTROYED: you salvaged its cargo', color: '#00ff88' });
      this.rival = null;
      if (this.event?.type === 'rival') this.event = null;
    }
  }

  // ─── Collapse ──────────────────────────────────────────────────────────────
  private updateCollapse(fleet: ShipPhysicsState[], dt: number, power: number) {
    if (this.collapse <= 0) return;
    this.collapse = Math.max(0, this.collapse - dt);
    this.shake = Math.max(this.shake, 3 + (1 - this.collapse / 30) * 6);
    if (this.tick('collapse', dt, 0.18)) {
      const ship = fleet[Math.floor(Math.random() * fleet.length)];
      const target = this.pickTarget(ship, 10);
      if (target) this.explode(target.x, target.y, 1.5 * BLOCK_SIZE, power * 4, 'collapse');
    }
  }
}

function jag(x1: number, y1: number, x2: number, y2: number) {
  const points = [{ x: x1, y: y1 }];
  for (let i = 1; i < 4; i++) points.push({ x: x1 + (x2 - x1) * i / 4 + (Math.random() - 0.5) * 10, y: y1 + (y2 - y1) * i / 4 + (Math.random() - 0.5) * 10 });
  points.push({ x: x2, y: y2 });
  return points;
}

export const combat = new CombatSystem();
