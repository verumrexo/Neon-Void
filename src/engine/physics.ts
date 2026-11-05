import { AsteroidWorld, BLOCK_SIZE } from './world';
import { FleetShip } from '../types/game';

export interface ShipPhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetX: number | null;
  targetY: number | null;
  guidedAngle: number | null;
  navigationMode?: 'destination' | 'heading';
  parked?: boolean;
  isManualGuided: boolean;
  wanderAngle: number;
  wanderTimer: number;
  hoverAngle: number;
  miningTarget: { gx: number; gy: number; color: string; glow: string } | null;
  miningTargets: { gx: number; gy: number; color: string; glow: string }[];
}

export const SHIP_RADIUS = 10; // Physical collision radius in pixels

export class PhysicsEngine {
  /**
   * Updates ship physics with constant directional navigation and serene bumblebee roaming.
   * Strict collision physics: the ship cannot go over blocks.
   * When navigating, hitting a block immediately stops manual flight and starts bee roaming.
   */
  public updateShip(
    ship: ShipPhysicsState,
    world: AsteroidWorld,
    dt: number,
    miningTarget: { gx: number; gy: number } | null = null,
    speedMultiplier: number = 1,
    fleetCenter?: { x: number; y: number }
  ) {
    const cruiseSpeed = 58 * speedMultiplier;
    const guidedSpeed = 82 * speedMultiplier;
    const turnSpeed = 5.5; // Fluid, responsive turning

    const now = Date.now();

    if (ship.isManualGuided && ship.guidedAngle !== null) {
      let speed = guidedSpeed;
      if (ship.navigationMode !== 'heading' && ship.targetX !== null && ship.targetY !== null) {
        const dx = ship.targetX - ship.x;
        const dy = ship.targetY - ship.y;
        const distance = Math.hypot(dx, dy);
        ship.guidedAngle = Math.atan2(dy, dx);
        speed = Math.min(guidedSpeed, distance * 4);
        if (distance < 2) {
          ship.x = ship.targetX;
          ship.y = ship.targetY;
          ship.vx = ship.vy = 0;
          ship.isManualGuided = false;
          ship.guidedAngle = null;
          ship.targetX = ship.targetY = null;
          ship.parked = false;
          return;
        }
      }
      ship.angle = this.lerpAngle(ship.angle, ship.guidedAngle, turnSpeed * dt);
      ship.vx = Math.cos(ship.guidedAngle) * speed;
      ship.vy = Math.sin(ship.guidedAngle) * speed;
    } else if (ship.parked) {
      ship.vx = ship.vy = 0;
    } else if (fleetCenter && Math.hypot(ship.x - fleetCenter.x, ship.y - fleetCenter.y) > 85) {
      // Regroup before pursuing a distant mining orbit. Collision remains authoritative.
      const dx = fleetCenter.x - ship.x;
      const dy = fleetCenter.y - ship.y;
      const distance = Math.hypot(dx, dy);
      const heading = Math.atan2(dy, dx);
      ship.angle = this.lerpAngle(ship.angle, heading, turnSpeed * dt);
      ship.vx = dx / distance * cruiseSpeed;
      ship.vy = dy / distance * cruiseSpeed;
      ship.wanderAngle = heading;
    } else if (miningTarget) {
      // 2. AUTONOMOUS BUMBLEBEE HOVERING & ORBITING NEAR MINED ROCK
      // Roams around gracefully in the open cave near the block
      const targetWorldX = miningTarget.gx * BLOCK_SIZE + BLOCK_SIZE / 2;
      const targetWorldY = miningTarget.gy * BLOCK_SIZE + BLOCK_SIZE / 2;
      const dx = targetWorldX - ship.x;
      const dy = targetWorldY - ship.y;

      const idealDist = 52;
      ship.hoverAngle += dt * 0.8;

      const angleFromRock = Math.atan2(ship.y - targetWorldY, ship.x - targetWorldX);
      const standAngle = angleFromRock + Math.sin(ship.hoverAngle) * 0.65;
      let targetStandX = targetWorldX + Math.cos(standAngle) * idealDist;
      let targetStandY = targetWorldY + Math.sin(standAngle) * idealDist;

      const standGx = Math.floor(targetStandX / BLOCK_SIZE);
      const standGy = Math.floor(targetStandY / BLOCK_SIZE);

      // If standoff orbital point touches solid rock, stay on the open air side
      if (!world.isMined(standGx, standGy)) {
        targetStandX = targetWorldX + Math.cos(angleFromRock) * idealDist;
        targetStandY = targetWorldY + Math.sin(angleFromRock) * idealDist;
      }

      // Add gentle organic bumblebee bobbing
      targetStandX += Math.sin(now * 0.003) * 6;
      targetStandY += Math.cos(now * 0.0036) * 6;

      const steerX = targetStandX - ship.x;
      const steerY = targetStandY - ship.y;
      const steerDist = Math.hypot(steerX, steerY);

      // Orient ship towards the rock being mined
      const faceAngle = Math.atan2(dy, dx);
      ship.angle = this.lerpAngle(ship.angle, faceAngle, turnSpeed * dt);

      const hoverSpeed = Math.min(cruiseSpeed * 0.85, Math.max(20, steerDist * 1.6));
      const targetVx = (steerDist > 1 ? (steerX / steerDist) : 0) * hoverSpeed;
      const targetVy = (steerDist > 1 ? (steerY / steerDist) : 0) * hoverSpeed;

      ship.vx += (targetVx - ship.vx) * 4.5 * dt;
      ship.vy += (targetVy - ship.vy) * 4.5 * dt;
    } else {
      // 3. OPEN CAVERN BUMBLEBEE ROAMING
      ship.wanderTimer -= dt;
      if (ship.wanderTimer <= 0) {
        ship.wanderTimer = 1.6 + Math.random() * 1.5;
        ship.wanderAngle += (Math.random() - 0.5) * 1.3;
      }

      // Look ahead to smoothly curve away from walls before collision
      const lookDist = 26;
      const checkX = ship.x + Math.cos(ship.wanderAngle) * lookDist;
      const checkY = ship.y + Math.sin(ship.wanderAngle) * lookDist;
      const checkGx = Math.floor(checkX / BLOCK_SIZE);
      const checkGy = Math.floor(checkY / BLOCK_SIZE);

      if (!world.isMined(checkGx, checkGy)) {
        ship.wanderAngle += Math.PI * 0.55;
      }

      const organicSway = Math.sin(now * 0.0028) * 0.22;
      const targetHeading = ship.wanderAngle + organicSway;
      ship.angle = this.lerpAngle(ship.angle, targetHeading, turnSpeed * dt);

      const targetVx = Math.cos(ship.angle) * cruiseSpeed;
      const targetVy = Math.sin(ship.angle) * cruiseSpeed;
      ship.vx += (targetVx - ship.vx) * 3.5 * dt;
      ship.vy += (targetVy - ship.vy) * 3.5 * dt;
    }

    // Move ship
    ship.x += ship.vx * dt;
    ship.y += ship.vy * dt;

    // 4. RIGID BLOCK COLLISION RESOLUTION (The ship CANNOT go over blocks)
    // If navigating and it hits a block, it stops there and starts roaming like a bee again.
    const shipGx = Math.floor(ship.x / BLOCK_SIZE);
    const shipGy = Math.floor(ship.y / BLOCK_SIZE);

    let collidedWithBlock = false;
    let collisionNormalX = 0;
    let collisionNormalY = 0;

    // Check 5x5 neighborhood around the ship
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const gx = shipGx + dx;
        const gy = shipGy + dy;

        // Only test unmined solid blocks
        if (world.isMined(gx, gy)) continue;

        const bx0 = gx * BLOCK_SIZE;
        const bx1 = bx0 + BLOCK_SIZE;
        const by0 = gy * BLOCK_SIZE;
        const by1 = by0 + BLOCK_SIZE;

        // Find closest point on solid block AABB to ship center
        const cx = Math.max(bx0, Math.min(ship.x, bx1));
        const cy = Math.max(by0, Math.min(ship.y, by1));

        const diffX = ship.x - cx;
        const diffY = ship.y - cy;
        const distSq = diffX * diffX + diffY * diffY;

        if (distSq < SHIP_RADIUS * SHIP_RADIUS) {
          collidedWithBlock = true;
          const dist = Math.sqrt(distSq);

          let nx = 0;
          let ny = 0;
          if (dist > 0.0001) {
            nx = diffX / dist;
            ny = diffY / dist;
          } else {
            // Ship center is inside the block: push outward from block center
            const blockCenterX = bx0 + BLOCK_SIZE / 2;
            const blockCenterY = by0 + BLOCK_SIZE / 2;
            const outAngle = Math.atan2(ship.y - blockCenterY, ship.x - blockCenterX);
            nx = Math.cos(outAngle);
            ny = Math.sin(outAngle);
          }

          collisionNormalX += nx;
          collisionNormalY += ny;

          // Push ship completely out of the solid block
          const penetration = SHIP_RADIUS - dist;
          ship.x += nx * penetration;
          ship.y += ny * penetration;

          // Cancel any velocity heading into the block surface
          const velNorm = ship.vx * nx + ship.vy * ny;
          if (velNorm < 0) {
            ship.vx -= velNorm * nx;
            ship.vy -= velNorm * ny;
          }
        }
      }
    }

    if (collidedWithBlock && ship.isManualGuided) {
      ship.isManualGuided = false;
      ship.targetX = ship.targetY = ship.guidedAngle = null;
      ship.vx = ship.vy = 0;
      ship.parked = false;
    }
    if (collidedWithBlock && !ship.isManualGuided) {
      ship.wanderAngle = Math.atan2(collisionNormalY, collisionNormalX);
    }
  }

  public updateFleet(
    ships: FleetShip[], world: AsteroidWorld, dt: number,
    rareBoost: number, dps: number, range: number, beamCount: number,
    speedMultiplier: number, excludedTargets: Set<string>, fleetCenter?: { x: number; y: number }
  ): { destroyedBlocks: { gx: number; gy: number; block: import('../types/game').BlockData }[] } {
    const destroyedBlocks: { gx: number; gy: number; block: import('../types/game').BlockData }[] = [];
    const claimed = new Set(excludedTargets);
    for (const ship of ships) {
      const targets = world.findMultipleMiningTargets(ship.x, ship.y, range, beamCount, claimed,
        ship.isManualGuided && ship.targetX !== null && ship.targetY !== null
          ? { x: ship.targetX, y: ship.targetY } : null, rareBoost);
      ship.miningTargets = targets.map(t => ({ gx: t.gx, gy: t.gy, color: t.block.color, glow: t.block.glow }));
      ship.miningTarget = ship.miningTargets[0] || null;
      this.updateShip(ship, world, dt, ship.miningTarget, speedMultiplier, fleetCenter);
      for (const target of targets) {
        claimed.add(`${target.gx},${target.gy}`);
        const result = world.damageBlock(target.gx, target.gy, dps / Math.max(1, targets.length * 0.75) * dt, rareBoost);
        if (result.destroyed) destroyedBlocks.push({ gx: target.gx, gy: target.gy, block: result.block });
      }
    }
    return { destroyedBlocks };
  }

  /**
   * Helper to smoothly interpolate angles avoiding 360 wrap glitch.
   */
  private lerpAngle(from: number, to: number, t: number): number {
    const diff = (to - from + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    return from + diff * Math.min(1, Math.max(0, t));
  }
}

export const physics = new PhysicsEngine();
