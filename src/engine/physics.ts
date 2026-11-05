import { AsteroidWorld, BLOCK_SIZE, getRingNumber } from './world';
import type { BlockData } from '../types/game';

export interface MiningTarget { gx: number; gy: number; color: string; glow: string }
export interface ShipPhysicsState {
  x: number; y: number; vx: number; vy: number; angle: number;
  previousX: number; previousY: number; previousAngle: number;
  hoverAngle: number;
  orbitRadius: number;
  sensorTimer: number;
  miningTarget: MiningTarget | null;
  miningTargets: MiningTarget[];
  sweepDirection: 1 | -1;
}
export const SHIP_RADIUS = 10;
const TAU = Math.PI * 2;
const CENTER = BLOCK_SIZE / 2;

export function createShip(index = 0): ShipPhysicsState {
  return { x: 0, y: 0, vx: 0, vy: 0, angle: 0,
    previousX: 0, previousY: 0, previousAngle: 0,
    hoverAngle: index * 2.39996, orbitRadius: 38, sensorTimer: 0,
    miningTarget: null, miningTargets: [], sweepDirection: index % 2 === 0 ? 1 : -1 };
}

/** Continuous circular foraging. Depth is descriptive, never a completion gate. */
export class RingMiningEngine {
  public ring = 1;
  private sector = -1;

  public reset() { this.ring = 1; this.sector = -1; }

  public update(ships: ShipPhysicsState[], world: AsteroidWorld, dt: number,
    dps: number, range: number, beams: number, speedMultiplier: number): BlockData[] {
    if (this.sector !== world.sectorEpoch) {
      // Only a reset/load changes the sector. Mining and recoloring never reset flight.
      this.sector = world.sectorEpoch;
      for (const ship of ships) { ship.miningTargets.length = 0; ship.sensorTimer = 0; }
    }
    const destroyed: BlockData[] = [];
    const claimed = new Set<string>();
    for (const ship of ships) {
      ship.previousX = ship.x; ship.previousY = ship.y; ship.previousAngle = ship.angle;
      this.moveShip(ship, world, dt, speedMultiplier);
      ship.sensorTimer -= dt;
      const retained = ship.miningTargets.filter(target => !world.isMined(target.gx, target.gy) &&
        this.inRange(ship, target.gx, target.gy, range) && this.visible(ship, target.gx, target.gy, world));
      if (ship.sensorTimer <= 0 || retained.length < ship.miningTargets.length) {
        ship.miningTargets = this.findTargets(ship, world, range, beams, claimed, retained);
        ship.sensorTimer = 0.12;
      } else ship.miningTargets = retained.slice(0, beams);
      for (const target of ship.miningTargets) claimed.add(`${target.gx},${target.gy}`);
      const beamDps = dps / Math.max(1, ship.miningTargets.length * 0.75);
      for (const target of ship.miningTargets) {
        if (world.isMined(target.gx, target.gy)) continue;
        const result = world.damageBlock(target.gx, target.gy, beamDps * dt);
        if (result.destroyed) destroyed.push(result.block);
      }
      ship.miningTarget = ship.miningTargets[0] || null;
    }
    this.ring = Math.max(1, ...ships.map(ship => getRingNumber(
      (Math.hypot(ship.x - CENTER, ship.y - CENTER) + 30) / BLOCK_SIZE, 0)));
    return destroyed;
  }

  private inRange(ship: ShipPhysicsState, gx: number, gy: number, range: number) {
    const dx = (gx + 0.5) * BLOCK_SIZE - ship.x, dy = (gy + 0.5) * BLOCK_SIZE - ship.y;
    return dx * dx + dy * dy <= range * range;
  }

  private visible(ship: ShipPhysicsState, gx: number, gy: number, world: AsteroidWorld) {
    const dx = (gx + 0.5) * BLOCK_SIZE - ship.x, dy = (gy + 0.5) * BLOCK_SIZE - ship.y;
    const steps = Math.ceil(Math.hypot(dx, dy) / (BLOCK_SIZE / 3));
    for (let index = 1; index < steps; index++) {
      const x = Math.floor((ship.x + dx * index / steps) / BLOCK_SIZE);
      const y = Math.floor((ship.y + dy * index / steps) / BLOCK_SIZE);
      if ((x !== gx || y !== gy) && !world.isMined(x, y)) return false;
    }
    return true;
  }

  private findTargets(ship: ShipPhysicsState, world: AsteroidWorld, range: number, count: number,
    claimed: Set<string>, retained: MiningTarget[]): MiningTarget[] {
    const gx = Math.floor(ship.x / BLOCK_SIZE), gy = Math.floor(ship.y / BLOCK_SIZE);
    const scan = Math.ceil(range / BLOCK_SIZE);
    const heading = Math.atan2(ship.y - CENTER, ship.x - CENTER) + ship.sweepDirection * Math.PI / 2;
    const forwardX = Math.cos(heading), forwardY = Math.sin(heading);
    const old = new Set(retained.map(target => `${target.gx},${target.gy}`));
    const candidates: { gx: number; gy: number; score: number }[] = [];
    for (let y = gy - scan; y <= gy + scan; y++) for (let x = gx - scan; x <= gx + scan; x++) {
      if (!world.isSurfaceBlock(x, y) || !this.inRange(ship, x, y, range)) continue;
      const dx = (x + 0.5) * BLOCK_SIZE - ship.x, dy = (y + 0.5) * BLOCK_SIZE - ship.y;
      const distance = Math.hypot(dx, dy);
      const key = `${x},${y}`;
      // Favor the wall ahead, preserve useful work, and spread beams across reachable ore.
      const score = distance - (dx * forwardX + dy * forwardY) / Math.max(1, distance) * 35 -
        (old.has(key) ? 22 : 0) + (claimed.has(key) ? 100 : 0);
      candidates.push({ gx: x, gy: y, score });
    }
    candidates.sort((a, b) => a.score - b.score);
    const targets: MiningTarget[] = [];
    for (const candidate of candidates) {
      if (!this.visible(ship, candidate.gx, candidate.gy, world)) continue;
      const block = world.getBlock(candidate.gx, candidate.gy);
      if (!block) continue;
      targets.push({ gx: candidate.gx, gy: candidate.gy, color: block.color, glow: block.glow });
      if (targets.length >= count) break;
    }
    return targets;
  }

  private canOccupy(world: AsteroidWorld, x: number, y: number): boolean {
    const gx = Math.floor(x / BLOCK_SIZE), gy = Math.floor(y / BLOCK_SIZE);
    for (let by = gy - 1; by <= gy + 1; by++) for (let bx = gx - 1; bx <= gx + 1; bx++) {
      if (world.isMined(bx, by)) continue;
      const nearestX = Math.max(bx * BLOCK_SIZE, Math.min(x, (bx + 1) * BLOCK_SIZE));
      const nearestY = Math.max(by * BLOCK_SIZE, Math.min(y, (by + 1) * BLOCK_SIZE));
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 < SHIP_RADIUS ** 2) return false;
    }
    return true;
  }

  private moveShip(ship: ShipPhysicsState, world: AsteroidWorld, dt: number, speed: number) {
    const oldAngle = Math.atan2(ship.y - CENTER, ship.x - CENTER);
    const oldRadius = Math.hypot(ship.x - CENTER, ship.y - CENTER);
    ship.hoverAngle += dt * 1.1;
    // The next waypoint is always just ahead of the ship, never a fixed ring start.
    const lead = 0.24 + Math.sin(ship.hoverAngle * 0.73) * 0.055;
    const nextAngle = oldAngle + ship.sweepDirection * lead;
    if (!ship.miningTargets.length) ship.orbitRadius += dt * 10 * speed;
    ship.orbitRadius = Math.max(32, Math.min(ship.orbitRadius, oldRadius + 24));
    const radius = ship.orbitRadius + Math.sin(ship.hoverAngle) * 5 + Math.sin(ship.hoverAngle * 1.71) * 2;
    const dx = CENTER + Math.cos(nextAngle) * radius - ship.x;
    const dy = CENTER + Math.sin(nextAngle) * radius - ship.y;
    const distance = Math.hypot(dx, dy);
    const velocity = Math.min(58 * speed * (0.9 + 0.1 * Math.sin(ship.hoverAngle * 0.47)), distance * 5);
    const vx = distance > 0.01 ? dx / distance * velocity : 0;
    const vy = distance > 0.01 ? dy / distance * velocity : 0;
    const oldX = ship.x, oldY = ship.y;
    const substeps = Math.max(1, Math.ceil(velocity * dt / (SHIP_RADIUS * 0.6)));
    for (let step = 0; step < substeps; step++) {
      const x = ship.x + vx * dt / substeps;
      if (this.canOccupy(world, x, ship.y)) ship.x = x;
      const y = ship.y + vy * dt / substeps;
      if (this.canOccupy(world, ship.x, y)) ship.y = y;
    }
    const moved = Math.hypot(ship.x - oldX, ship.y - oldY);
    if (moved < velocity * dt * 0.1) {
      // A jagged corner must not pin a bee to one block: dip inward and keep circling.
      ship.orbitRadius = Math.max(32, oldRadius - 8);
      const remaining = Math.max(0, velocity * dt - moved);
      const escapeX = (-Math.cos(oldAngle) * 0.8 - Math.sin(oldAngle) * ship.sweepDirection * 0.6) * remaining;
      const escapeY = (-Math.sin(oldAngle) * 0.8 + Math.cos(oldAngle) * ship.sweepDirection * 0.6) * remaining;
      if (this.canOccupy(world, ship.x + escapeX, ship.y)) ship.x += escapeX;
      if (this.canOccupy(world, ship.x, ship.y + escapeY)) ship.y += escapeY;
    }
    ship.vx = (ship.x - oldX) / dt; ship.vy = (ship.y - oldY) / dt;
    const angle = Math.atan2(ship.y - CENTER, ship.x - CENTER);
    const traveled = Math.atan2(Math.sin(angle - oldAngle), Math.cos(angle - oldAngle)) * ship.sweepDirection;
    // Spiral outward with actual circular travel, without waiting for all rocks to clear.
    if (traveled > 0) ship.orbitRadius += traveled * BLOCK_SIZE / TAU;
    const face = Math.hypot(ship.vx, ship.vy) > 1 ? Math.atan2(ship.vy, ship.vx) : ship.angle;
    ship.angle += Math.atan2(Math.sin(face - ship.angle), Math.cos(face - ship.angle)) * Math.min(1, dt * 5.5);
  }
}
