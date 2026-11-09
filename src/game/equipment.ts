import type {
  GearSlot,
  GearRarity,
  GearStatKey,
  LegendaryPowerKey,
  GearItem,
  GearAffix,
  EquippedGear,
  GearBonusTotal,
} from '../types/equipment';
import type { ResourceType } from '../types/game';
import type { Cost } from './content';

export const GEAR_SLOTS: Record<
  GearSlot,
  { name: string; icon: string; description: string; primaryStat: GearStatKey }
> = {
  lens: {
    name: 'Beam Lens',
    icon: 'Zap',
    description: 'Focuses laser diode convergence and amplified photon emission.',
    primaryStat: 'laserDamagePercent',
  },
  ordnance: {
    name: 'Ordnance Pod',
    icon: 'Rocket',
    description: 'Increases missile blast payload yield and salvo lethality.',
    primaryStat: 'rocketDamagePercent',
  },
  chassis: {
    name: 'Reinforced Chassis',
    icon: 'Shield',
    description: 'Structural micro-lattices enhancing overall ship power and durability.',
    primaryStat: 'damagePercent',
  },
  thruster: {
    name: 'Vector Thruster',
    icon: 'Wind',
    description: 'Sub-light ion propulsion nozzle tuning maneuverability and flight speed.',
    primaryStat: 'flightSpeedPercent',
  },
  sensor: {
    name: 'Deep Scanner',
    icon: 'Radio',
    description: 'Multi-spectral resonance array detecting rare veins and extending mining range.',
    primaryStat: 'miningReach',
  },
  core: {
    name: 'Flux Dynamo',
    icon: 'Cpu',
    description: 'High-frequency capacitor enabling devastating critical strikes.',
    primaryStat: 'critChance',
  },
};

export const GEAR_SLOT_KEYS: GearSlot[] = ['lens', 'ordnance', 'chassis', 'thruster', 'sensor', 'core'];

export const RARITY_CONFIG: Record<
  GearRarity,
  { name: string; color: string; glow: string; affixes: number; baseMult: number }
> = {
  common: { name: 'Standard', color: '#94a3b8', glow: 'rgba(148, 163, 184, 0.4)', affixes: 0, baseMult: 1.0 },
  refined: { name: 'Refined', color: '#00f0ff', glow: 'rgba(0, 240, 255, 0.6)', affixes: 1, baseMult: 1.4 },
  exotic: { name: 'Exotic', color: '#00ff88', glow: 'rgba(0, 255, 136, 0.7)', affixes: 2, baseMult: 2.0 },
  void: { name: 'Void-Forged', color: '#ff007f', glow: 'rgba(255, 0, 127, 0.8)', affixes: 3, baseMult: 2.8 },
  cosmic: { name: 'Cosmic', color: '#ffb800', glow: 'rgba(255, 184, 0, 0.9)', affixes: 3, baseMult: 3.8 },
};

export const RARITY_ORDER: GearRarity[] = ['common', 'refined', 'exotic', 'void', 'cosmic'];

export const LEGENDARY_POWERS: Record<LegendaryPowerKey, { name: string; description: string; icon: string }> = {
  chain_crits: {
    name: 'Arc Resonance',
    description: 'Critical strikes discharge chain lightning into 2 adjacent blocks.',
    icon: 'GitFork',
  },
  cluster_sparks: {
    name: 'Spark Scatter',
    description: 'Rocket detonations release 4 high-energy homing photon sparks.',
    icon: 'Sparkles',
  },
  sunstone_infusion: {
    name: 'Solar Plasma',
    description: 'Critical strikes ignite targets with intense solar flame.',
    icon: 'Flame',
  },
  quantum_magnet: {
    name: 'Graviton Siphon',
    description: 'Critical strikes yield triple resource extraction.',
    icon: 'Magnet',
  },
  deep_resonator: {
    name: 'Strata Cleaver',
    description: '+60% total damage against hard strata (ring 6 and beyond).',
    icon: 'Crosshair',
  },
};

const STAT_CONFIGS: Record<
  GearStatKey,
  { label: string; format: (val: number) => string; baseMin: number; baseMax: number }
> = {
  damagePercent: {
    label: 'All Damage',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.10,
    baseMax: 0.22,
  },
  laserDamagePercent: {
    label: 'Laser Damage',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.15,
    baseMax: 0.35,
  },
  rocketDamagePercent: {
    label: 'Rocket Damage & Blast',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.18,
    baseMax: 0.40,
  },
  critChance: {
    label: 'Critical Strike Chance',
    format: (v) => `+${(v * 100).toFixed(1)}%`,
    baseMin: 0.05,
    baseMax: 0.12,
  },
  critDamageMultiplier: {
    label: 'Critical Strike Damage',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.25,
    baseMax: 0.60,
  },
  flightSpeedPercent: {
    label: 'Flight Speed',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.12,
    baseMax: 0.25,
  },
  miningReach: {
    label: 'Mining Reach',
    format: (v) => `+${Math.round(v)} px`,
    baseMin: 20,
    baseMax: 45,
  },
  rareOreChance: {
    label: 'Rare Mineral Veins',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.15,
    baseMax: 0.35,
  },
  salvoChargeSpeed: {
    label: 'Salvo Charge Speed',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.20,
    baseMax: 0.50,
  },
  yieldBonus: {
    label: 'Extraction Yield',
    format: (v) => `+${Math.round(v * 100)}%`,
    baseMin: 0.10,
    baseMax: 0.25,
  },
  overheatBuffer: {
    label: 'Overheat Tolerance',
    format: (v) => `+${v.toFixed(1)}s`,
    baseMin: 1.0,
    baseMax: 2.5,
  },
};

export function formatStatValue(stat: GearStatKey, value: number): string {
  const conf = STAT_CONFIGS[stat];
  return conf ? `${conf.format(value)} ${conf.label}` : `+${value} ${stat}`;
}

const NAME_PREFIXES: Record<GearRarity, string[]> = {
  common: ['Standard', 'Field-Grade', 'Scrap', 'Surveyor', 'Recycled'],
  refined: ['Calibrated', 'Precision', 'High-Flux', 'Pulse', 'Reinforced'],
  exotic: ['Supercharged', 'Hyper-Field', 'Emerald', 'Vanguard', 'Overclocked'],
  void: ['Void-Infused', 'Singularity', 'Dark-Matter', 'Abyssal', 'Phantom'],
  cosmic: ['Starlight', 'Nova', 'Celestial', 'Supercluster', 'Apex'],
};

const SLOT_NAMES: Record<GearSlot, string[]> = {
  lens: ['Focus Diode', 'Refractor Lens', 'Prism Collimator', 'Photon Emitter'],
  ordnance: ['Warhead Rack', 'Munitions Pod', 'Missile Array', 'Silo Adapter'],
  chassis: ['Carbon Hull Plating', 'Ablative Matrix', 'Vanguard Ribbing', 'Exo-Frame'],
  thruster: ['Ion Vector Nozzle', 'Sub-Light Burner', 'Afterburner Manifold', 'Drift Injector'],
  sensor: ['Tachyon Radar', 'Gravimetric Dish', 'Spectral Array', 'Deep-Vein Probe'],
  core: ['Flux Capacitor', 'Singularity Battery', 'Harmonic Reactor', 'Plasma Dynamo'],
};

export function generateGear(options: {
  slot?: GearSlot;
  minRarity?: GearRarity;
  ringLevel?: number;
}): GearItem {
  const slot = options.slot || GEAR_SLOT_KEYS[Math.floor(Math.random() * GEAR_SLOT_KEYS.length)];
  const ring = Math.max(1, options.ringLevel || 1);

  // Determine rarity
  const minIdx = options.minRarity ? RARITY_ORDER.indexOf(options.minRarity) : 0;
  const roll = Math.random();
  let rarityIdx = minIdx;
  if (roll < 0.05) rarityIdx = Math.max(minIdx, 4); // Cosmic
  else if (roll < 0.18) rarityIdx = Math.max(minIdx, 3); // Void
  else if (roll < 0.45) rarityIdx = Math.max(minIdx, 2); // Exotic
  else if (roll < 0.75) rarityIdx = Math.max(minIdx, 1); // Refined
  const rarity = RARITY_ORDER[rarityIdx];
  const rConf = RARITY_CONFIG[rarity];

  const level = Math.min(20, Math.max(1, Math.floor(1 + ring / 2 + Math.random() * 2)));
  const levelMult = 1 + (level - 1) * 0.12;
  const totalMult = rConf.baseMult * levelMult;

  // Primary Stat
  const pStatKey = GEAR_SLOTS[slot].primaryStat;
  const pStatConf = STAT_CONFIGS[pStatKey];
  const pBaseVal = pStatConf.baseMin + Math.random() * (pStatConf.baseMax - pStatConf.baseMin);
  const primaryVal = pBaseVal * totalMult;

  // Affixes
  const allStatKeys = Object.keys(STAT_CONFIGS) as GearStatKey[];
  const availableAffixes = allStatKeys.filter((s) => s !== pStatKey);
  const affixes: GearAffix[] = [];
  const chosenStats = new Set<GearStatKey>();

  for (let i = 0; i < rConf.affixes; i++) {
    const remaining = availableAffixes.filter((s) => !chosenStats.has(s));
    if (!remaining.length) break;
    const statKey = remaining[Math.floor(Math.random() * remaining.length)];
    chosenStats.add(statKey);
    const sConf = STAT_CONFIGS[statKey];
    const val = (sConf.baseMin + Math.random() * (sConf.baseMax - sConf.baseMin)) * totalMult * 0.65;
    affixes.push({ stat: statKey, value: val });
  }

  // Legendary Power for Cosmic items
  let legendaryPower: LegendaryPowerKey | undefined;
  if (rarity === 'cosmic') {
    const powers = Object.keys(LEGENDARY_POWERS) as LegendaryPowerKey[];
    legendaryPower = powers[Math.floor(Math.random() * powers.length)];
  }

  // Name
  const prefixList = NAME_PREFIXES[rarity];
  const nameList = SLOT_NAMES[slot];
  const prefix = prefixList[Math.floor(Math.random() * prefixList.length)];
  const baseName = nameList[Math.floor(Math.random() * nameList.length)];
  const name = `${prefix} ${baseName} MK-${level}`;

  // Scrap Value
  const scrapValue: Partial<Record<ResourceType, number>> = {
    basalt: 50 * level,
    iron: 20 * level * (rarityIdx + 1),
  };
  if (rarityIdx >= 1) scrapValue.quartz = 10 * level * rarityIdx;
  if (rarityIdx >= 2) scrapValue.emeraldite = 4 * level * (rarityIdx - 1);
  if (rarityIdx >= 3) scrapValue.voidOre = 2 * level * (rarityIdx - 2);
  if (rarityIdx >= 4) scrapValue.sunstone = 1 * level;

  return {
    id: `gear-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    name,
    slot,
    rarity,
    level,
    primaryStat: { stat: pStatKey, value: primaryVal },
    affixes,
    legendaryPower,
    scrapValue,
  };
}

export function getGearUpgradeCost(item: GearItem): Cost {
  const nextLvl = item.level + 1;
  const rarityIdx = RARITY_ORDER.indexOf(item.rarity);
  const cost: Cost = {
    iron: Math.floor(40 * Math.pow(1.35, nextLvl - 1)),
  };
  if (rarityIdx >= 1) cost.quartz = Math.floor(15 * Math.pow(1.32, nextLvl - 1));
  if (rarityIdx >= 2) cost.emeraldite = Math.floor(6 * Math.pow(1.3, nextLvl - 1));
  if (rarityIdx >= 3) cost.voidOre = Math.floor(3 * Math.pow(1.28, nextLvl - 1));
  if (rarityIdx >= 4) cost.sunstone = Math.max(1, Math.floor(nextLvl / 4));
  return cost;
}

export function upgradeGearItem(item: GearItem): GearItem {
  const nextLevel = item.level + 1;
  const scale = (nextLevel + 5) / (item.level + 5);

  const updatedPrimary: GearAffix = {
    stat: item.primaryStat.stat,
    value: item.primaryStat.value * scale,
  };

  const updatedAffixes = item.affixes.map((affix) => ({
    stat: affix.stat,
    value: affix.value * scale,
  }));

  const updatedName = item.name.replace(/MK-\d+$/, `MK-${nextLevel}`);

  return {
    ...item,
    level: nextLevel,
    name: updatedName,
    primaryStat: updatedPrimary,
    affixes: updatedAffixes,
  };
}

export function aggregateGearStats(equipped: EquippedGear): GearBonusTotal {
  const total: GearBonusTotal = {
    damageMult: 1,
    laserDamageMult: 1,
    rocketDamageMult: 1,
    critChance: 0.05, // 5% baseline
    critDamageMult: 1.5, // 150% baseline
    flightSpeedMult: 1,
    extraReach: 0,
    rareOreBoost: 0,
    salvoChargeMult: 1,
    yieldBonus: 0,
    overheatBuffer: 0,
    powers: new Set<LegendaryPowerKey>(),
  };

  const applyAffix = (stat: GearStatKey, value: number) => {
    switch (stat) {
      case 'damagePercent':
        total.damageMult += value;
        break;
      case 'laserDamagePercent':
        total.laserDamageMult += value;
        break;
      case 'rocketDamagePercent':
        total.rocketDamageMult += value;
        break;
      case 'critChance':
        total.critChance = Math.min(0.85, total.critChance + value);
        break;
      case 'critDamageMultiplier':
        total.critDamageMult += value;
        break;
      case 'flightSpeedPercent':
        total.flightSpeedMult += value;
        break;
      case 'miningReach':
        total.extraReach += value;
        break;
      case 'rareOreChance':
        total.rareOreBoost += value;
        break;
      case 'salvoChargeSpeed':
        total.salvoChargeMult += value;
        break;
      case 'yieldBonus':
        total.yieldBonus += value;
        break;
      case 'overheatBuffer':
        total.overheatBuffer += value;
        break;
    }
  };

  for (const item of Object.values(equipped)) {
    if (!item) continue;
    applyAffix(item.primaryStat.stat, item.primaryStat.value);
    for (const affix of item.affixes) {
      applyAffix(affix.stat, affix.value);
    }
    if (item.legendaryPower) {
      total.powers.add(item.legendaryPower);
    }
  }

  return total;
}
