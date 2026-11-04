import { BlockData, ResourceType, RESOURCE_DEFINITIONS } from '../types/game';

export const BLOCK_SIZE = 26; // pixels per grid block
export const SPAWN_CLEARING_RADIUS = 2.8; // initial hollow clearing in blocks (~73px radius)

// Fast deterministic pseudo-random hash for procedural grid generation
function hash2D(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

export class AsteroidWorld {
  // Set of mined block keys: "x,y"
  public minedBlocks: Set<string> = new Set();
  // Map of blocks that have taken damage but not yet broken: "x,y" -> currentHp
  public damagedBlocks: Map<string, number> = new Map();

  constructor() {
    this.createSpawnClearing();
  }

  /**
   * Initializes the starting cavern so the ship has room to fly and immediate rocks to mine.
   */
  public createSpawnClearing() {
    this.minedBlocks.clear();
    this.damagedBlocks.clear();

    const r = Math.ceil(SPAWN_CLEARING_RADIUS);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= SPAWN_CLEARING_RADIUS * SPAWN_CLEARING_RADIUS) {
          this.minedBlocks.add(`${dx},${dy}`);
        }
      }
    }
    // Guarantee origin is always clear
    this.minedBlocks.add('0,0');
  }

  public serialize(): { mined: string[]; damaged: [string, number][] } {
    return {
      mined: Array.from(this.minedBlocks),
      damaged: Array.from(this.damagedBlocks.entries()),
    };
  }

  public deserialize(data: { mined?: string[]; damaged?: [string, number][] }) {
    if (data.mined && Array.isArray(data.mined) && data.mined.length > 0) {
      this.minedBlocks = new Set(data.mined);
      // Guarantee spawn clearing is open
      this.minedBlocks.add('0,0');
      this.minedBlocks.add('1,0');
      this.minedBlocks.add('-1,0');
      this.minedBlocks.add('0,1');
      this.minedBlocks.add('0,-1');
    } else {
      this.createSpawnClearing();
    }
    if (data.damaged && Array.isArray(data.damaged)) {
      this.damagedBlocks = new Map(data.damaged);
    }
  }

  /**
   * Checks if a grid block has been mined (is empty void).
   */
  public isMined(gx: number, gy: number): boolean {
    return this.minedBlocks.has(`${gx},${gy}`);
  }

  /**
   * Checks if an unmined block is an exposed "surface" block,
   * meaning at least one adjacent cardinal neighbor is already empty space.
   */
  public isSurfaceBlock(gx: number, gy: number): boolean {
    if (this.isMined(gx, gy)) return false;
    return (
      this.isMined(gx + 1, gy) ||
      this.isMined(gx - 1, gy) ||
      this.isMined(gx, gy + 1) ||
      this.isMined(gx, gy - 1)
    );
  }

  /**
   * Generates procedural block metadata for any coordinate on the infinite grid.
   */
  public getBlock(gx: number, gy: number, rareBoost: number = 0): BlockData | null {
    if (this.isMined(gx, gy)) return null;

    const key = `${gx},${gy}`;
    const dist = Math.sqrt(gx * gx + gy * gy);
    const noise = hash2D(gx, gy);
    const clusterNoise = hash2D(Math.floor(gx / 3), Math.floor(gy / 3));

    let type: ResourceType = 'basalt';
    let baseHp = 10;

    // Rich, colorful mineral progression with veins right from the start
    const bonus = rareBoost * 0.08;
    const clusterRoll = (noise + clusterNoise) * 0.5;

    if (dist > 100 && clusterRoll > 0.88 - bonus) {
      type = 'sunstone';
      baseHp = 220 + Math.floor(dist * 1.2);
    } else if ((dist > 40 && clusterRoll > 0.78 - bonus) || clusterRoll > 0.94 - bonus) {
      // Early rare void ore sprinkles!
      type = 'voidOre';
      baseHp = 95 + Math.floor(dist * 0.8);
    } else if (clusterRoll > 0.68 - bonus) {
      // Plentiful glowing emeraldite
      type = 'emeraldite';
      baseHp = 45 + Math.floor(dist * 0.5);
    } else if (clusterRoll > 0.44 - bonus) {
      // Abundant glowing cyan quartz
      type = 'quartz';
      baseHp = 25 + Math.floor(dist * 0.35);
    } else if (clusterRoll > 0.22) {
      type = 'iron';
      baseHp = 14 + Math.floor(dist * 0.2);
    } else {
      type = 'basalt';
      baseHp = 8 + Math.floor(dist * 0.1);
    }

    const def = RESOURCE_DEFINITIONS[type];
    const currentHp = this.damagedBlocks.has(key) ? this.damagedBlocks.get(key)! : baseHp;

    return {
      x: gx,
      y: gy,
      type,
      hp: currentHp,
      maxHp: baseHp,
      color: def.color,
      glow: def.glow,
    };
  }

  /**
   * Applies mining damage to a block.
   * Returns true if the block was completely destroyed.
   */
  public damageBlock(gx: number, gy: number, damage: number, rareBoost: number = 0): { destroyed: boolean; block: BlockData } {
    const key = `${gx},${gy}`;
    const block = this.getBlock(gx, gy, rareBoost)!;
    const newHp = Math.max(0, block.hp - damage);

    if (newHp <= 0) {
      this.minedBlocks.add(key);
      this.damagedBlocks.delete(key);
      block.hp = 0;
      return { destroyed: true, block };
    } else {
      this.damagedBlocks.set(key, newHp);
      block.hp = newHp;
      return { destroyed: false, block };
    }
  }

  /**
   * Finds the best surface block for the bumblebee ship to mine.
   * Prioritizes exposed surface blocks within range to avoid unwanted blind burrowing.
   */
  public findBestMiningTarget(
    worldX: number,
    worldY: number,
    rangePx: number,
    preferredDir?: { x: number; y: number } | null,
    allowInterior: boolean = false
  ): { gx: number; gy: number; distPx: number; block: BlockData } | null {
    const shipGx = Math.floor(worldX / BLOCK_SIZE);
    const shipGy = Math.floor(worldY / BLOCK_SIZE);
    const gridRange = Math.ceil(rangePx / BLOCK_SIZE) + 1;

    let bestTarget: { gx: number; gy: number; distPx: number; block: BlockData } | null = null;
    let bestScore = Infinity;

    for (let gy = shipGy - gridRange; gy <= shipGy + gridRange; gy++) {
      for (let gx = shipGx - gridRange; gx <= shipGx + gridRange; gx++) {
        if (this.isMined(gx, gy)) continue;

        // By default, only mine surface blocks unless manual guidance specifically requested interior
        if (!allowInterior && !this.isSurfaceBlock(gx, gy)) {
          continue;
        }

        const blockCenterWorldX = gx * BLOCK_SIZE + BLOCK_SIZE / 2;
        const blockCenterWorldY = gy * BLOCK_SIZE + BLOCK_SIZE / 2;
        const dx = blockCenterWorldX - worldX;
        const dy = blockCenterWorldY - worldY;
        const distPx = Math.sqrt(dx * dx + dy * dy);

        if (distPx > rangePx) continue;

        // Calculate score: lower is better
        let score = distPx;

        // If the player pointed in a direction, prioritize blocks in that direction
        if (preferredDir) {
          const dirX = preferredDir.x - worldX;
          const dirY = preferredDir.y - worldY;
          const dirLen = Math.sqrt(dirX * dirX + dirY * dirY);
          if (dirLen > 0) {
            const dot = (dx * dirX + dy * dirY) / (distPx * dirLen);
            // Angle alignment bonus
            score -= dot * 40;
          }
        }

        // Slight bonus to finish off already-damaged blocks
        if (this.damagedBlocks.has(`${gx},${gy}`)) {
          score -= 30;
        }

        if (score < bestScore) {
          bestScore = score;
          const block = this.getBlock(gx, gy);
          if (block) {
            bestTarget = { gx, gy, distPx, block };
          }
        }
      }
    }

    return bestTarget;
  }

  /**
   * Finds up to `count` distinct surface blocks within range for multi-beam array.
   */
  public findMultipleMiningTargets(
    worldX: number,
    worldY: number,
    rangePx: number,
    count: number,
    excludeKeys: Set<string> = new Set(),
    preferredDir?: { x: number; y: number } | null,
    rareBoost: number = 0
  ): { gx: number; gy: number; distPx: number; block: BlockData }[] {
    const shipGx = Math.floor(worldX / BLOCK_SIZE);
    const shipGy = Math.floor(worldY / BLOCK_SIZE);
    const gridRange = Math.ceil(rangePx / BLOCK_SIZE) + 1;

    const candidates: { gx: number; gy: number; distPx: number; score: number; block: BlockData }[] = [];

    for (let gy = shipGy - gridRange; gy <= shipGy + gridRange; gy++) {
      for (let gx = shipGx - gridRange; gx <= shipGx + gridRange; gx++) {
        const key = `${gx},${gy}`;
        if (this.isMined(gx, gy) || excludeKeys.has(key)) continue;

        if (!this.isSurfaceBlock(gx, gy)) continue;

        const blockCenterWorldX = gx * BLOCK_SIZE + BLOCK_SIZE / 2;
        const blockCenterWorldY = gy * BLOCK_SIZE + BLOCK_SIZE / 2;
        const dx = blockCenterWorldX - worldX;
        const dy = blockCenterWorldY - worldY;
        const distPx = Math.hypot(dx, dy);

        if (distPx > rangePx) continue;

        let score = distPx;
        if (preferredDir) {
          const dirX = preferredDir.x - worldX;
          const dirY = preferredDir.y - worldY;
          const dirLen = Math.hypot(dirX, dirY);
          if (dirLen > 0) {
            const dot = (dx * dirX + dy * dirY) / (distPx * dirLen);
            score -= dot * 40;
          }
        }

        if (this.damagedBlocks.has(key)) {
          score -= 30;
        }

        const block = this.getBlock(gx, gy, rareBoost);
        if (block) {
          candidates.push({ gx, gy, distPx, score, block });
        }
      }
    }

    candidates.sort((a, b) => a.score - b.score);
    return candidates.slice(0, count).map((c) => ({
      gx: c.gx,
      gy: c.gy,
      distPx: c.distPx,
      block: c.block,
    }));
  }
}
