import { AsteroidWorld, BLOCK_SIZE } from './world';
import { Drone } from '../types/game';

export interface ShipPhysicsState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  targetX: number | null;
  targetY: number | null;
  guidedAngle: number | null;
  isManualGuided: boolean;
  wanderAngle: number;
  wanderTimer: number;
  hoverAngle: number;
  miningTarget: { gx: number; gy: number; color: string; glow: string } | null;
  miningTargets: { gx: number; gy: number; color: string; glow: string }[];
}

export const SHIP_RADIUS = 10; // Physical collision radius in pixels
export const DRONE_RADIUS = 7; // Drone physical collision radius in pixels

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
    speedMultiplier: number = 1
  ) {
    const cruiseSpeed = 58 * speedMultiplier;
    const guidedSpeed = 82 * speedMultiplier;
    const turnSpeed = 5.5; // Fluid, responsive turning

    const now = Date.now();

    // 1. CONSTANT DIRECTIONAL NAVIGATION
    // The player presses once, and the ship constantly flies in that chosen direction!
    if (ship.isManualGuided && ship.guidedAngle !== null) {
      // Rotate ship to face the navigation direction
      ship.angle = this.lerpAngle(ship.angle, ship.guidedAngle, turnSpeed * dt);

      // Constant forward propulsion in the chosen direction
      const targetVx = Math.cos(ship.angle) * guidedSpeed;
      const targetVy = Math.sin(ship.angle) * guidedSpeed;

      ship.vx += (targetVx - ship.vx) * 8.0 * dt;
      ship.vy += (targetVy - ship.vy) * 8.0 * dt;
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

    // If the ship was navigating and hit a block:
    // "if it hits a block, it stops there and starts roaming around like a bee again."
    if (collidedWithBlock && ship.isManualGuided) {
      ship.isManualGuided = false;
      ship.guidedAngle = null;
      ship.targetX = null;
      ship.targetY = null;

      // Start roaming like a bee pointing away from the block into the open cave
      const normLen = Math.hypot(collisionNormalX, collisionNormalY);
      if (normLen > 0.001) {
        ship.wanderAngle = Math.atan2(collisionNormalY, collisionNormalX) + (Math.random() - 0.5) * 0.5;
      } else {
        ship.wanderAngle += Math.PI * 0.7;
      }
      ship.wanderTimer = 2.0;
    }
  }

  /**
   * Updates autonomous companion ships (drones) with a mind of their own.
   * Drones roam like mini-bees in the cavern, lock onto their own individual blocks,
   * deal real damage, finish mining until destroyed, and obey strict rigid block collision.
   */
  public updateDrones(
    drones: Drone[],
    ship: ShipPhysicsState,
    world: AsteroidWorld,
    dt: number,
    rareBoost: number = 0,
    droneDps: number = 10,
    excludedTargets: Set<string> = new Set()
  ): { destroyedBlocks: { gx: number; gy: number; block: any }[] } {
    const destroyedBlocks: { gx: number; gy: number; block: any }[] = [];
    const cruiseSpeed = 48; // Agile mini-ship flight speed
    const turnSpeed = 5.0;
    const now = Date.now();

    // Track targets claimed by drones this frame to avoid duplicate locking
    const droneClaimedTargets = new Set<string>();

    drones.forEach((drone, index) => {
      // Initialize wander properties if missing
      if (typeof drone.wanderAngle !== 'number') drone.wanderAngle = (index * 1.5) % (Math.PI * 2);
      if (typeof drone.wanderTimer !== 'number') drone.wanderTimer = 1.0 + Math.random() * 2.0;
      if (typeof drone.hoverAngle !== 'number') drone.hoverAngle = Math.random() * Math.PI * 2;

      // 1. VERIFY EXISTING TARGET LOCK
      let activeTarget: { gx: number; gy: number } | null = null;
      if (drone.targetBlock) {
        const { x: tgx, y: tgy } = drone.targetBlock;
        if (world.isMined(tgx, tgy)) {
          drone.targetBlock = null;
        } else {
          const bx = tgx * BLOCK_SIZE + BLOCK_SIZE / 2;
          const by = tgy * BLOCK_SIZE + BLOCK_SIZE / 2;
          const dist = Math.hypot(bx - drone.x, by - drone.y);
          // Keep lock if within 130px sensor range
          if (dist <= 130) {
            activeTarget = { gx: tgx, gy: tgy };
            droneClaimedTargets.add(`${tgx},${tgy}`);
          } else {
            drone.targetBlock = null;
          }
        }
      }

      // 2. ACQUIRE NEW TARGET IF UNLOCKED
      if (!activeTarget) {
        const combinedExcluded = new Set([...excludedTargets, ...droneClaimedTargets]);
        const found = world.findMultipleMiningTargets(
          drone.x,
          drone.y,
          95,
          1,
          combinedExcluded,
          null,
          rareBoost
        );
        if (found.length > 0) {
          activeTarget = { gx: found[0].gx, gy: found[0].gy };
          drone.targetBlock = { x: found[0].gx, y: found[0].gy };
          droneClaimedTargets.add(`${found[0].gx},${found[0].gy}`);
        }
      }

      // 3. AUTONOMOUS FLIGHT / BEE ROAMING
      if (activeTarget) {
        // Drone hovers and orbits near its targeted block
        drone.beamActive = true;
        const targetWorldX = activeTarget.gx * BLOCK_SIZE + BLOCK_SIZE / 2;
        const targetWorldY = activeTarget.gy * BLOCK_SIZE + BLOCK_SIZE / 2;
        const dx = targetWorldX - drone.x;
        const dy = targetWorldY - drone.y;

        const idealDist = 42;
        drone.hoverAngle += dt * 1.1;

        const angleFromRock = Math.atan2(drone.y - targetWorldY, drone.x - targetWorldX);
        const standAngle = angleFromRock + Math.sin(drone.hoverAngle) * 0.7;
        let standX = targetWorldX + Math.cos(standAngle) * idealDist;
        let standY = targetWorldY + Math.sin(standAngle) * idealDist;

        // Add subtle organic bobbing
        standX += Math.sin(now * 0.0035 + index) * 5;
        standY += Math.cos(now * 0.004 + index) * 5;

        const steerX = standX - drone.x;
        const steerY = standY - drone.y;
        const steerDist = Math.hypot(steerX, steerY);

        // Turn drone to face the block being mined
        const faceAngle = Math.atan2(dy, dx);
        drone.angle = this.lerpAngle(drone.angle, faceAngle, turnSpeed * dt);

        const hoverSpeed = Math.min(cruiseSpeed, Math.max(16, steerDist * 1.8));
        const targetVx = (steerDist > 1 ? steerX / steerDist : 0) * hoverSpeed;
        const targetVy = (steerDist > 1 ? steerY / steerDist : 0) * hoverSpeed;

        drone.vx += (targetVx - drone.vx) * 4.5 * dt;
        drone.vy += (targetVy - drone.vy) * 4.5 * dt;

        // Apply drone mining damage
        const damageThisFrame = droneDps * dt;
        const res = world.damageBlock(activeTarget.gx, activeTarget.gy, damageThisFrame, rareBoost);
        if (res.destroyed) {
          destroyedBlocks.push({ gx: activeTarget.gx, gy: activeTarget.gy, block: res.block });
          drone.targetBlock = null;
          drone.beamActive = false;
        }
      } else {
        // Drone has no target: roams open caverns like a bee
        drone.beamActive = false;
        drone.wanderTimer -= dt;
        if (drone.wanderTimer <= 0) {
          drone.wanderTimer = 1.4 + Math.random() * 1.6;
          drone.wanderAngle += (Math.random() - 0.5) * 1.5;
        }

        // Keep companion drone within ~220px of mother ship so they stay in exploratory orbit
        const distFromShip = Math.hypot(drone.x - ship.x, drone.y - ship.y);
        if (distFromShip > 200) {
          const angleToShip = Math.atan2(ship.y - drone.y, ship.x - drone.x);
          drone.wanderAngle = this.lerpAngle(drone.wanderAngle, angleToShip, 0.4);
        }

        // Avoid solid walls ahead
        const lookDist = 20;
        const checkX = drone.x + Math.cos(drone.wanderAngle) * lookDist;
        const checkY = drone.y + Math.sin(drone.wanderAngle) * lookDist;
        const checkGx = Math.floor(checkX / BLOCK_SIZE);
        const checkGy = Math.floor(checkY / BLOCK_SIZE);
        if (!world.isMined(checkGx, checkGy)) {
          drone.wanderAngle += Math.PI * 0.6;
        }

        drone.angle = this.lerpAngle(drone.angle, drone.wanderAngle, turnSpeed * dt);
        const targetVx = Math.cos(drone.angle) * cruiseSpeed;
        const targetVy = Math.sin(drone.angle) * cruiseSpeed;

        drone.vx += (targetVx - drone.vx) * 3.5 * dt;
        drone.vy += (targetVy - drone.vy) * 3.5 * dt;
      }

      // Move drone
      drone.x += drone.vx * dt;
      drone.y += drone.vy * dt;

      // 4. RIGID BLOCK COLLISION RESOLUTION (Drones CANNOT go through blocks)
      const dGx = Math.floor(drone.x / BLOCK_SIZE);
      const dGy = Math.floor(drone.y / BLOCK_SIZE);

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const gx = dGx + dx;
          const gy = dGy + dy;

          if (world.isMined(gx, gy)) continue;

          const bx0 = gx * BLOCK_SIZE;
          const bx1 = bx0 + BLOCK_SIZE;
          const by0 = gy * BLOCK_SIZE;
          const by1 = by0 + BLOCK_SIZE;

          const cx = Math.max(bx0, Math.min(drone.x, bx1));
          const cy = Math.max(by0, Math.min(drone.y, by1));

          const diffX = drone.x - cx;
          const diffY = drone.y - cy;
          const distSq = diffX * diffX + diffY * diffY;

          if (distSq < DRONE_RADIUS * DRONE_RADIUS) {
            const dist = Math.sqrt(distSq);
            let nx = 0;
            let ny = 0;
            if (dist > 0.0001) {
              nx = diffX / dist;
              ny = diffY / dist;
            } else {
              const blockCenterX = bx0 + BLOCK_SIZE / 2;
              const blockCenterY = by0 + BLOCK_SIZE / 2;
              const outAngle = Math.atan2(drone.y - blockCenterY, drone.x - blockCenterX);
              nx = Math.cos(outAngle);
              ny = Math.sin(outAngle);
            }

            const penetration = DRONE_RADIUS - dist;
            drone.x += nx * penetration;
            drone.y += ny * penetration;

            const velNorm = drone.vx * nx + drone.vy * ny;
            if (velNorm < 0) {
              drone.vx -= velNorm * nx;
              drone.vy -= velNorm * ny;
            }
          }
        }
      }
    });

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
