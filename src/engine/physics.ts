import { AsteroidWorld, BLOCK_SIZE, SPAWN_CLEARING_RADIUS, getDepthBand, getRingNumber } from './world';
import type { BlockData } from '../types/game';

export interface MiningTarget { gx: number; gy: number; color: string; glow: string }
export interface ShipPhysicsState {
  x: number; y: number; vx: number; vy: number; angle: number;
  hoverAngle: number;
  miningTarget: MiningTarget | null;
  miningTargets: MiningTarget[];
  ringTarget: { gx: number; gy: number; angle: number } | null;
  sweepAngle: number;
  sweepDirection: 1 | -1;
}
export const SHIP_RADIUS = 10;
const TAU = Math.PI * 2;
const positiveAngle = (angle: number) => (angle % TAU + TAU) % TAU;

export function createShip(index = 0): ShipPhysicsState {
  return { x: 0, y: 0, vx: 0, vy: 0, angle: 0, hoverAngle: index,
    miningTarget: null, miningTargets: [], ringTarget: null,
    sweepAngle: positiveAngle(index * 2.39996), sweepDirection: index % 2 === 0 ? 1 : -1 };
}

/** A shared ring is completely excavated before any ship starts the next one. */
export class RingMiningEngine {
  public ring = 1;
  public remaining = 0;
  public total = 0;
  private epoch = -1;
  private revision = -1;
  private ringBlocks: { gx: number; gy: number; angle: number }[] = [];
  private remainingBlocks: { gx: number; gy: number; angle: number }[] = [];

  public reset() {
    this.ring = 1; this.remaining = this.total = 0;
    this.epoch = -1; this.revision = -1;
    this.ringBlocks = []; this.remainingBlocks = [];
  }

  private refresh(world: AsteroidWorld, ships: ShipPhysicsState[]) {
    if (this.epoch !== world.terrainEpoch) {
      this.reset(); this.epoch = world.terrainEpoch;
      ships.forEach((ship, index) => Object.assign(ship, createShip(index)));
    }
    if (this.revision === world.minedBlocks.size && this.ringBlocks.length) return;
    let advanced = false;
    while (true) {
      if (!this.ringBlocks.length) this.ringBlocks = this.buildRing(this.ring);
      this.remainingBlocks = this.ringBlocks.filter(block => !world.isMined(block.gx, block.gy));
      if (this.remainingBlocks.length) break;
      this.ring++; this.ringBlocks = []; advanced = true;
    }
    if (advanced) ships.forEach((ship, index) => {
      ship.ringTarget = null;
      ship.sweepAngle = TAU * index / ships.length;
    });
    this.remaining = this.remainingBlocks.length;
    this.total = this.ringBlocks.length;
    this.revision = world.minedBlocks.size;
  }

  private buildRing(ring: number) {
    const radius = Math.ceil(SPAWN_CLEARING_RADIUS + ring);
    const result: { gx: number; gy: number; angle: number }[] = [];
    for (let gy = -radius; gy <= radius; gy++) for (let gx = -radius; gx <= radius; gx++) {
      if (Math.hypot(gx, gy) <= SPAWN_CLEARING_RADIUS || getRingNumber(gx, gy) !== ring) continue;
      result.push({ gx, gy, angle: positiveAngle(Math.atan2(gy, gx)) });
    }
    return result.sort((a, b) => a.angle - b.angle);
  }

  public update(ships: ShipPhysicsState[], world: AsteroidWorld, dt: number,
    dps: number, range: number, beams: number, speedMultiplier: number): BlockData[] {
    this.refresh(world, ships);
    const destroyed: BlockData[] = [];
    const claimed = new Set<string>();
    const key = (target: { gx: number; gy: number }) => `${target.gx},${target.gy}`;
    for (const ship of ships) {
      if (ship.ringTarget && (world.isMined(ship.ringTarget.gx, ship.ringTarget.gy) ||
          getRingNumber(ship.ringTarget.gx, ship.ringTarget.gy) !== this.ring)) {
        ship.sweepAngle = positiveAngle(ship.ringTarget.angle + ship.sweepDirection * 0.001);
        ship.ringTarget = null;
      }
      if (ship.ringTarget && claimed.has(key(ship.ringTarget))) ship.ringTarget = null;
      if (!ship.ringTarget) {
        let best = Infinity;
        for (const target of this.remainingBlocks) {
          if (claimed.has(key(target)) || world.isMined(target.gx, target.gy)) continue;
          const score = positiveAngle((target.angle - ship.sweepAngle) * ship.sweepDirection);
          if (score < best) { best = score; ship.ringTarget = target; }
        }
      }
      if (ship.ringTarget) claimed.add(key(ship.ringTarget));
      ship.miningTargets = [];
      ship.miningTarget = null;
    }
    // All primary assignments are reserved before assigning secondary beams.
    for (const ship of ships) {
      const target = ship.ringTarget;
      if (!target) { ship.vx = ship.vy = 0; continue; }
      this.moveShip(ship, target, dt, speedMultiplier);
      const inRange = (block: { gx: number; gy: number }) =>
        Math.hypot((block.gx + 0.5) * BLOCK_SIZE - ship.x, (block.gy + 0.5) * BLOCK_SIZE - ship.y) <= range;
      const targets = inRange(target) ? [target] : [];
      if (targets.length) {
        const extras = this.remainingBlocks.filter(block => !claimed.has(key(block)) &&
          !world.isMined(block.gx, block.gy) && inRange(block))
          .sort((a, b) => positiveAngle((a.angle - target.angle) * ship.sweepDirection) -
            positiveAngle((b.angle - target.angle) * ship.sweepDirection));
        for (const extra of extras.slice(0, Math.max(0, beams - 1))) {
          targets.push(extra); claimed.add(key(extra));
        }
      }
      const beamDps = dps / Math.max(1, targets.length * 0.75);
      for (const block of targets) {
        if (world.isMined(block.gx, block.gy)) continue;
        const metadata = world.getBlock(block.gx, block.gy)!;
        ship.miningTargets.push({ gx: block.gx, gy: block.gy, color: metadata.color, glow: metadata.glow });
        const result = world.damageBlock(block.gx, block.gy, beamDps * dt);
        if (result.destroyed) destroyed.push(result.block);
      }
      ship.miningTarget = ship.miningTargets[0] || null;
    }
    return destroyed;
  }

  private moveShip(ship: ShipPhysicsState, target: { gx: number; gy: number; angle: number }, dt: number, speed: number) {
    const center = BLOCK_SIZE / 2;
    // Fly in the already-cleared interior, never on a track through solid rock.
    const orbitRadius = Math.max(20, (SPAWN_CLEARING_RADIUS + this.ring - 1) * BLOCK_SIZE - SHIP_RADIUS - 20);
    const shipRadius = Math.hypot(ship.x - center, ship.y - center);
    const currentAngle = Math.atan2(ship.y - center, ship.x - center);
    const angleLeft = positiveAngle((target.angle - currentAngle) * ship.sweepDirection);
    // A local arc waypoint preserves clockwise/counterclockwise travel across the seam.
    const waypointAngle = currentAngle + ship.sweepDirection * Math.min(angleLeft, 0.18);
    ship.hoverAngle += dt * 1.2;
    const radius = orbitRadius - 3 + Math.sin(ship.hoverAngle) * 2;
    const x = center + Math.cos(waypointAngle) * radius;
    const y = center + Math.sin(waypointAngle) * radius;
    const dx = x - ship.x, dy = y - ship.y;
    const distance = Math.hypot(dx, dy);
    const velocity = Math.min(58 * speed, distance * 4);
    ship.vx = distance > 0.1 ? dx / distance * velocity : 0;
    ship.vy = distance > 0.1 ? dy / distance * velocity : 0;
    ship.x += ship.vx * dt; ship.y += ship.vy * dt;
    // New ships travel outward from spawn through cleared rings.
    if (shipRadius > orbitRadius + 10) {
      ship.x = center + Math.cos(currentAngle) * orbitRadius;
      ship.y = center + Math.sin(currentAngle) * orbitRadius;
    }
    const face = Math.atan2((target.gy + 0.5) * BLOCK_SIZE - ship.y, (target.gx + 0.5) * BLOCK_SIZE - ship.x);
    const delta = Math.atan2(Math.sin(face - ship.angle), Math.cos(face - ship.angle));
    ship.angle += delta * Math.min(1, dt * 5.5);
  }

  public get band() { return getDepthBand(this.ring); }
}
