import type { ShipPhysicsState } from '../engine/physics';
export type ResourceType = 
  | 'basalt' 
  | 'iron' 
  | 'quartz' 
  | 'emeraldite' 
  | 'voidOre' 
  | 'sunstone' 
  | 'stardust';

export interface ResourceInfo {
  id: ResourceType;
  name: string;
  color: string;
  glow: string;
  symbol: string;
  tier: number;
}

export const RESOURCE_DEFINITIONS: Record<ResourceType, ResourceInfo> = {
  basalt: {
    id: 'basalt',
    name: 'Basalt',
    color: '#94a3b8',
    glow: 'rgba(148, 163, 184, 0.4)',
    symbol: '◈',
    tier: 1,
  },
  iron: {
    id: 'iron',
    name: 'Iron',
    color: '#e2e8f0',
    glow: 'rgba(226, 232, 240, 0.6)',
    symbol: '⬡',
    tier: 1,
  },
  quartz: {
    id: 'quartz',
    name: 'Cyan Quartz',
    color: '#00f0ff',
    glow: 'rgba(0, 240, 255, 0.8)',
    symbol: '◇',
    tier: 2,
  },
  emeraldite: {
    id: 'emeraldite',
    name: 'Emeraldite',
    color: '#00ff88',
    glow: 'rgba(0, 255, 136, 0.8)',
    symbol: '⬢',
    tier: 3,
  },
  voidOre: {
    id: 'voidOre',
    name: 'Void Ore',
    color: '#ff007f',
    glow: 'rgba(255, 0, 127, 0.85)',
    symbol: '✦',
    tier: 4,
  },
  sunstone: {
    id: 'sunstone',
    name: 'Sunstone',
    color: '#ffb800',
    glow: 'rgba(255, 184, 0, 0.9)',
    symbol: '★',
    tier: 5,
  },
  stardust: {
    id: 'stardust',
    name: 'Stardust',
    color: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.95)',
    symbol: '❖',
    tier: 6,
  },
};

export interface BlockData {
  x: number; // grid x
  y: number; // grid y
  type: ResourceType;
  hp: number;
  maxHp: number;
  color: string;
  glow: string;
  mined?: boolean;
}

export interface DroppedMineral {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: ResourceType;
  amount: number;
  color: string;
  glow: string;
  symbol: string;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
}

export interface FleetShip extends ShipPhysicsState {
  id: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  glow: string;
  alpha: number;
  life: number;
  maxLife: number;
  shape: 'circle' | 'square' | 'shard';
}

export interface FloatingText {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
  alpha: number;
  life: number;
  maxLife: number;
}

export interface UpgradesState {
  laserDamage: number;
  fireRate: number;
  laserRange: number;
  beamCount: number;
  collectorMagnet: number;
  flightSpeed: number;
  droneBay: number;
}

export interface CraftingItem {
  id: string;
  name: string;
  description: string;
  cost: Partial<Record<ResourceType, number>>;
  crafted: boolean;
  tier: number;
  effect: string;
  statBonus: Partial<{
    damageMultiplier: number;
    rangeBoost: number;
    extraBeams: number;
    extraDrones: number;
    rareOreBoost: number;
    speedBoost: number;
    refiningBonus: number;
  }>;
}

export interface QuantumPerk {
  id: string;
  name: string;
  description: string;
  cost: number; // Stardust
  costMultiplier: number;
  level: number;
  maxLevel: number;
  iconName: string;
  reqPerkId?: string;
  branch: 'combat' | 'automation' | 'cosmic';
}

export interface GameStats {
  totalBlocksDestroyed: number;
  blocksDestroyedThisRun: number;
  totalDamageDealt: number;
  maxDepthReached: number;
  singularityCount: number;
  timePlayedSeconds: number;
  lifetimeResources: Record<ResourceType, number>;
}
