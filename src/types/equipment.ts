import type { ResourceType } from './game';

export type GearSlot = 'lens' | 'ordnance' | 'chassis' | 'thruster' | 'sensor' | 'core';

export type GearRarity = 'common' | 'refined' | 'exotic' | 'void' | 'cosmic';

export type GearStatKey =
  | 'damagePercent'
  | 'laserDamagePercent'
  | 'rocketDamagePercent'
  | 'critChance'
  | 'critDamageMultiplier'
  | 'flightSpeedPercent'
  | 'miningReach'
  | 'rareOreChance'
  | 'salvoChargeSpeed'
  | 'yieldBonus'
  | 'overheatBuffer';

export type LegendaryPowerKey =
  | 'chain_crits'
  | 'cluster_sparks'
  | 'sunstone_infusion'
  | 'quantum_magnet'
  | 'deep_resonator';

export interface GearAffix {
  stat: GearStatKey;
  value: number;
}

export interface GearItem {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: GearRarity;
  level: number;
  primaryStat: GearAffix;
  affixes: GearAffix[];
  legendaryPower?: LegendaryPowerKey;
  scrapValue: Partial<Record<ResourceType, number>>;
}

export type EquippedGear = Partial<Record<GearSlot, GearItem | null>>;

export interface GearBonusTotal {
  damageMult: number;
  laserDamageMult: number;
  rocketDamageMult: number;
  critChance: number;
  critDamageMult: number;
  flightSpeedMult: number;
  extraReach: number;
  rareOreBoost: number;
  salvoChargeMult: number;
  yieldBonus: number;
  overheatBuffer: number;
  powers: Set<LegendaryPowerKey>;
}
