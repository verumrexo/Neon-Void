import { BlockData, ResourceType, RESOURCE_DEFINITIONS } from '../types/game';

export const CHUNK_SIZE = 16;
export const BLOCK_SIZE = 26; // pixels per grid block
export const SPAWN_CLEARING_RADIUS = 2.8; // initial hollow clearing in blocks (~73px radius)

export function getRingNumber(gx: number, gy: number): number {
  return Math.max(1, Math.floor(Math.hypot(gx, gy) - SPAWN_CLEARING_RADIUS) + 1);
}
export function getDepthBand(ring: number): number { return Math.floor((ring - 1) / 5); }
export function getRingHardness(ring: number): number { return Math.pow(1.2, getDepthBand(ring)); }
export const DEPTH_COLORS = ['#475569', '#476b68', '#526185', '#756087', '#8a6653', '#8a5361'];
export function getDepthColor(ring: number): string { return DEPTH_COLORS[getDepthBand(ring) % DEPTH_COLORS.length]; }

// Fast deterministic pseudo-random hash for procedural grid generation
function hash2D(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export class AsteroidWorld {
  // Set of mined block keys: "x,y"
  public minedBlocks: Set<string> = new Set();
  // Map of blocks that have taken damage but not yet broken: "x,y" -> currentHp
  public damagedBlocks: Map<string, number> = new Map();

  public terrainEpoch = 0;
  public sectorEpoch = 0;
  public rareBoost = 0;
  private chunkVersions = new Map<number, Map<string, number>>();

  public getChunkVersion(cx: number, cy: number, detail = 1): number {
    let versions = this.chunkVersions.get(detail);
    if (!versions) { versions = new Map(); this.chunkVersions.set(detail, versions); }
    return versions.get(`${cx},${cy}`) || 0;
  }

  private invalidateTerrain(gx: number, gy: number) {
    // Track only detail levels the renderer has used; hits do not invalidate terrain.
    for (const [detail, versions] of this.chunkVersions) {
      const size = CHUNK_SIZE * detail;
      const touched = new Set<string>();
      for (const [x, y] of [[gx, gy], [gx-1, gy], [gx+1, gy], [gx, gy-1], [gx, gy+1]]) {
        touched.add(`${Math.floor(x / size)},${Math.floor(y / size)}`);
      }
      for (const key of touched) versions.set(key, (versions.get(key) || 0) + 1);
    }
  }

  constructor() {
    this.createSpawnClearing();
  }

  /**
   * Initializes the starting cavern so the ship has room to fly and immediate rocks to mine.
   */
  public createSpawnClearing() {
    this.sectorEpoch++;
    this.terrainEpoch++;
    this.chunkVersions.clear();
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
    this.sectorEpoch++;
    this.terrainEpoch++;
    this.chunkVersions.clear();
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
  public getBlock(gx: number, gy: number, rareBoost: number = this.rareBoost): BlockData | null {
    if (this.isMined(gx, gy)) return null;

    const key = `${gx},${gy}`;
    const dist = Math.sqrt(gx * gx + gy * gy);
    const noise = hash2D(gx, gy);
    const clusterNoise = hash2D(Math.floor(gx / 3), Math.floor(gy / 3));

    let type: ResourceType = 'basalt';
    let baseHp = 10;

    // Rare ores unlock in distance bands measured in grid blocks from spawn.
    const bonus = Math.min(0.08, Math.max(0, rareBoost) * 0.04);
    const clusterRoll = noise * 0.8 + clusterNoise * 0.2;
    // Keep common-rock composition independent of the rare-vein roll.
    const commonRoll = hash2D(gx + 92821, gy - 68917);
    const quartzThreshold = dist < 15 ? 0.95 : 0.90;

    if (dist >= 180 && clusterRoll > 0.94 - bonus) {
      type = 'sunstone';
      baseHp = 220;
    } else if (dist >= 100 && clusterRoll > 0.88 - bonus) {
      // Void ore only appears beyond the deep-core boundary.
      type = 'voidOre';
      baseHp = 95;
    } else if (dist >= 45 && clusterRoll > 0.76 - bonus) {
      // Emeraldite marks the first rare mineral zone.
      type = 'emeraldite';
      baseHp = 45;
    } else if (commonRoll > quartzThreshold) {
      // Small quartz deposits near spawn, more frequent farther out.
      type = 'quartz';
      baseHp = 25;
    } else if (commonRoll > 0.70) {
      type = 'iron';
      baseHp = 14;
    } else {
      type = 'basalt';
      baseHp = 8;
    }

    const ring = getRingNumber(gx, gy);
    baseHp = Math.ceil(baseHp * getRingHardness(ring));
    const def = RESOURCE_DEFINITIONS[type];
    const currentHp = Math.min(baseHp, this.damagedBlocks.get(key) ?? baseHp);

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
  public damageBlock(gx: number, gy: number, damage: number, rareBoost: number = this.rareBoost): { destroyed: boolean; block: BlockData } {
    const key = `${gx},${gy}`;
    const block = this.getBlock(gx, gy, rareBoost)!;
    const newHp = Math.max(0, block.hp - damage);

    if (newHp <= 0) {
      this.minedBlocks.add(key);
      this.invalidateTerrain(gx, gy);
      this.damagedBlocks.delete(key);
      block.hp = 0;
      return { destroyed: true, block };
    } else {
      this.damagedBlocks.set(key, newHp);
      block.hp = newHp;
      return { destroyed: false, block };
    }
  }

}
