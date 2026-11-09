import type { ResourceType } from '../types/game';

export type Cost = Partial<Record<ResourceType, number>>;

// ─── Weapons ────────────────────────────────────────────────────────────────
export type WeaponId = 'laser' | 'rockets' | 'railgun' | 'arc' | 'gravity';

export interface WeaponMod { id: string; name: string; description: string; cost: Cost }
export interface WeaponDef {
  id: WeaponId; name: string; color: string; description: string;
  unlockCost: Cost; levelCost: (level: number) => Cost; mods: WeaponMod[];
}

const scale = (base: Cost, level: number, growth: number): Cost =>
  Object.fromEntries(Object.entries(base).map(([key, value]) => [key, Math.floor(value! * Math.pow(growth, level - 1))]));

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  laser: {
    id: 'laser', name: 'Mining Laser', color: '#00f0ff',
    description: 'Steady beams that chew through the rock face. Quartz makes them stronger.',
    unlockCost: {}, levelCost: level => scale({ basalt: 20, quartz: level > 3 ? 6 : 0 }, level, 1.38),
    mods: [
      { id: 'splitter', name: 'Beam Splitter', description: '+1 beam per ship.', cost: { quartz: 40, iron: 60 } },
      { id: 'prism', name: 'Prism Focus', description: 'Beams deal +60% damage to ore veins (anything except basalt).', cost: { quartz: 120 } },
      { id: 'longfocus', name: 'Long Focus', description: '+60% beam reach.', cost: { iron: 160, quartz: 60 } },
      { id: 'overdrive', name: 'Overdrive', description: 'Every 8s the lasers overload for 2s at 3x power.', cost: { quartz: 260, emeraldite: 30 } },
    ],
  },
  rockets: {
    id: 'rockets', name: 'Rocket Pods', color: '#ff6a2a',
    description: 'Homing rockets that explode in an area. Click or tap the asteroid to fire a salvo yourself; hold to load more rockets.',
    unlockCost: { iron: 120, basalt: 200 }, levelCost: level => scale({ iron: 50, voidOre: level > 4 ? 3 : 0 }, level, 1.42),
    mods: [
      { id: 'cluster', name: 'Cluster Payload', description: 'Each rocket splits into 6 small rockets on impact.', cost: { iron: 220, quartz: 50 } },
      { id: 'drill', name: 'Drill Payload', description: 'Rockets burrow 3 blocks deep before detonating.', cost: { iron: 300, emeraldite: 25 } },
      { id: 'napalm', name: 'Napalm Payload', description: 'Leaves burning tiles that keep damaging rock for 4s.', cost: { quartz: 150, voidOre: 10 } },
      { id: 'magnet', name: 'Magnet Payload', description: 'Blocks destroyed by explosions yield +100% ore.', cost: { emeraldite: 60, voidOre: 20 } },
    ],
  },
  railgun: {
    id: 'railgun', name: 'Railgun', color: '#b3f0ff',
    description: 'Charges for a few seconds, then fires a slug that goes straight through the rings.',
    unlockCost: { iron: 400, quartz: 120 }, levelCost: level => scale({ iron: 90, quartz: 20 }, level, 1.45),
    mods: [
      { id: 'capacitor', name: 'Capacitor Bank', description: 'Charges 40% faster.', cost: { iron: 500, quartz: 100 } },
      { id: 'tungsten', name: 'Tungsten Slug', description: 'Pierces twice as many blocks.', cost: { iron: 800 } },
      { id: 'shockwave', name: 'Shockwave', description: 'The slug path cracks neighbouring blocks.', cost: { quartz: 200, emeraldite: 40 } },
    ],
  },
  arc: {
    id: 'arc', name: 'Chain Arc', color: '#d4a8ff',
    description: 'Lightning that jumps between blocks of the same ore. Strongest inside rich veins.',
    unlockCost: { quartz: 180, emeraldite: 20 }, levelCost: level => scale({ quartz: 40, emeraldite: 4 }, level, 1.45),
    mods: [
      { id: 'forked', name: 'Forked Arc', description: 'Arcs split in two at every jump.', cost: { quartz: 300, emeraldite: 50 } },
      { id: 'conductor', name: 'Conductor', description: '+4 jumps per arc.', cost: { emeraldite: 80 } },
      { id: 'overload', name: 'Overload', description: 'The final block an arc hits explodes.', cost: { emeraldite: 100, voidOre: 15 } },
    ],
  },
  gravity: {
    id: 'gravity', name: 'Gravity Well', color: '#7c5cff',
    description: 'Drops a small singularity that crushes everything in a radius, then implodes.',
    unlockCost: { emeraldite: 60, voidOre: 10 }, levelCost: level => scale({ emeraldite: 15, voidOre: 3 }, level, 1.5),
    mods: [
      { id: 'horizon', name: 'Event Horizon', description: '+50% well radius.', cost: { emeraldite: 150, voidOre: 30 } },
      { id: 'compressor', name: 'Compressor', description: 'Blocks crushed by a well yield +150% ore.', cost: { voidOre: 50 } },
      { id: 'twin', name: 'Twin Wells', description: 'Spawns two wells at once.', cost: { voidOre: 70, sunstone: 5 } },
    ],
  },
};
export const WEAPON_ORDER: WeaponId[] = ['laser', 'rockets', 'railgun', 'arc', 'gravity'];

// ─── Hull modules ───────────────────────────────────────────────────────────
export type ModuleTag = 'power' | 'cooling' | 'weapon' | 'hangar' | 'utility';
export interface ModuleDef {
  id: string; name: string; w: number; h: number; color: string; tag: ModuleTag;
  description: string; drawback?: string; adjacency?: string; cost: Cost;
}

export const MODULES: ModuleDef[] = [
  { id: 'reactor', name: 'Reactor', w: 1, h: 1, color: '#ffb800', tag: 'power', cost: { iron: 80, quartz: 20 },
    description: '+25% damage for all weapons.', adjacency: 'Next to a laser emitter: lasers do +50% damage.' },
  { id: 'coolant', name: 'Coolant Loop', w: 1, h: 2, color: '#38bdf8', tag: 'cooling', cost: { iron: 120 },
    description: 'Removes heat from the Overcharged Core.', adjacency: 'Next to a rocket rack: rockets fire 40% faster.' },
  { id: 'emitter', name: 'Laser Emitter', w: 2, h: 1, color: '#00f0ff', tag: 'weapon', cost: { quartz: 60, iron: 60 },
    description: '+1 laser beam.' },
  { id: 'rack', name: 'Rocket Rack', w: 1, h: 2, color: '#ff6a2a', tag: 'weapon', cost: { iron: 200, basalt: 200 },
    description: '+2 rockets per salvo.', adjacency: 'Next to a reactor: +30% explosion radius.' },
  { id: 'core', name: 'Overcharged Core', w: 2, h: 2, color: '#ff3366', tag: 'power', cost: { quartz: 200, emeraldite: 40 },
    description: '+80% damage for all weapons.', drawback: 'After 5s of firing the ship overheats and every weapon stops for 3s. A coolant loop next to it prevents this.' },
  { id: 'hangar', name: 'Hangar', w: 2, h: 1, color: '#a3e635', tag: 'hangar', cost: { iron: 250, quartz: 100, emeraldite: 20 },
    description: 'Launches a wingman ship. Pick its role in the Wingmen section.' },
  { id: 'scanner', name: 'Deep Scanner', w: 1, h: 1, color: '#00ff88', tag: 'utility', cost: { quartz: 90, emeraldite: 15 },
    description: '+40% rare ore veins.', adjacency: 'Next to a hangar: Scout wingmen double their bonus.' },
  { id: 'refinery', name: 'Refinery', w: 2, h: 1, color: '#e2e8f0', tag: 'utility', cost: { iron: 300, emeraldite: 40 },
    description: '+30% ore from every block.', drawback: 'Heavy: ships fly 15% slower.' },
  { id: 'thrusters', name: 'Afterburners', w: 1, h: 1, color: '#f472b6', tag: 'utility', cost: { basalt: 300, iron: 60 },
    description: 'Ships fly 30% faster.' },
  { id: 'vault', name: 'Volatile Vault', w: 1, h: 1, color: '#ff8800', tag: 'utility', cost: { voidOre: 25, quartz: 100 },
    description: 'Volatile blocks explode twice as wide and drop 3x ore.' },
];
export const moduleDef = (id: string) => MODULES.find(module => module.id === id)!;

export interface PlacedModule { uid: string; id: string; x: number; y: number }

export type WingRole = 'frigate' | 'tug' | 'scout';
export const WING_ROLES: Record<WingRole, { name: string; color: string; description: string }> = {
  frigate: { name: 'Rocket Frigate', color: '#ff6a2a', description: 'Has no laser, but fires rockets at double rate (rockets work even before you unlock them).' },
  tug: { name: 'Tug', color: '#7c5cff', description: 'Drops small gravity wells along the rock face.' },
  scout: { name: 'Scout', color: '#00ff88', description: 'Mines with its laser and gives +20% rare veins and +10% ore for the whole fleet.' },
};

// ─── Asteroid types / relics / singularity unlocks ──────────────────────────
export type AsteroidType = 'standard' | 'ice' | 'volatile' | 'metallic' | 'hollow';
export const ASTEROIDS: Record<AsteroidType, { name: string; color: string; description: string }> = {
  standard: { name: 'Standard Rock', color: '#94a3b8', description: 'No special rules.' },
  ice: { name: 'Ice Comet', color: '#7dd3fc', description: 'Rock is 40% softer and ships fly faster, but ore yield is 20% lower.' },
  volatile: { name: 'Volatile Rock', color: '#ff6a2a', description: 'Full of explosive crystals. Chain reactions are common.' },
  metallic: { name: 'Metallic Rock', color: '#cbd5e1', description: 'Iron everywhere. Lasers do +60% damage, explosions do 50% less.' },
  hollow: { name: 'Hollow Rock', color: '#a78bfa', description: 'Hidden caverns and lots of armored jackpot cores.' },
};

export interface RelicDef { id: string; name: string; description: string }
export const RELICS: RelicDef[] = [
  { id: 'split_rockets', name: 'Fractal Warheads', description: 'Every rocket splits into small rockets on impact (stacks with Cluster).' },
  { id: 'jackpot', name: 'Lucky Strike', description: 'Every 100th block is a jackpot worth 25x ore.' },
  { id: 'chain_master', name: 'Chain Master', description: 'Every explosion triggers another explosion 40% of the time.' },
  { id: 'glass_cannon', name: 'Glass Cannon', description: 'All damage x2, but you get 30% less ore.' },
  { id: 'meteor_magnet', name: 'Meteor Magnet', description: 'Meteor showers happen 3x as often.' },
  { id: 'boss_hunter', name: 'Boss Hunter', description: 'Armored cores take 3x damage and drop double loot.' },
  { id: 'arc_storm', name: 'Arc Storm', description: 'Every block destroyed has a 10% chance to release a free chain arc.' },
  { id: 'cold_fusion', name: 'Cold Fusion', description: 'Ships never overheat, and solar flares do nothing.' },
];

export interface UnlockDef { id: string; name: string; description: string; cost: number; maxLevel: number; requires?: string }
export const UNLOCKS: UnlockDef[] = [
  { id: 'slot', name: 'Weapon Slot', description: '+1 weapon slot (you start with 2).', cost: 3, maxLevel: 2 },
  { id: 'hull', name: 'Hull Expansion', description: '+1 hull row (the hull starts at 4x3).', cost: 4, maxLevel: 3 },
  { id: 'start_rockets', name: 'Rocket Pods Blueprint', description: 'Every run starts with Rocket Pods unlocked.', cost: 2, maxLevel: 1 },
  { id: 'start_railgun', name: 'Railgun Blueprint', description: 'Every run starts with the Railgun unlocked.', cost: 5, maxLevel: 1, requires: 'start_rockets' },
  { id: 'start_arc', name: 'Chain Arc Blueprint', description: 'Every run starts with the Chain Arc unlocked.', cost: 6, maxLevel: 1, requires: 'start_rockets' },
  { id: 'start_gravity', name: 'Gravity Well Blueprint', description: 'Every run starts with the Gravity Well unlocked.', cost: 9, maxLevel: 1, requires: 'start_arc' },
  { id: 'ast_ice', name: 'Chart: Ice Comets', description: 'Ice comets can appear as your next asteroid.', cost: 2, maxLevel: 1 },
  { id: 'ast_volatile', name: 'Chart: Volatile Rocks', description: 'Volatile rocks can appear as your next asteroid.', cost: 3, maxLevel: 1 },
  { id: 'ast_metallic', name: 'Chart: Metallic Rocks', description: 'Metallic rocks can appear as your next asteroid.', cost: 3, maxLevel: 1 },
  { id: 'ast_hollow', name: 'Chart: Hollow Rocks', description: 'Hollow rocks can appear as your next asteroid.', cost: 5, maxLevel: 1 },
  { id: 'relic_choice', name: 'Relic Insight', description: '+1 relic to choose from after each collapse.', cost: 6, maxLevel: 2 },
  { id: 'keep_modules', name: 'Salvage Crew', description: 'Keep your built hull modules after a collapse.', cost: 10, maxLevel: 1 },
  { id: 'overclock', name: 'Laser Overclock', description: '+50% damage for all weapons, permanently.', cost: 2, maxLevel: 10 },
  { id: 'resonance', name: 'Stardust Resonance', description: '+25% stardust from each collapse.', cost: 2, maxLevel: 10 },
  { id: 'fleet', name: 'Permanent Wingman', description: 'Start every run with a Scout wingman.', cost: 5, maxLevel: 3 },
];
export const unlockCost = (unlock: UnlockDef, level: number) => Math.floor(unlock.cost * Math.pow(2, level));

export const COLLAPSE_MIN_RING = 6;
export const COLLAPSE_DURATION = 30;
/** Bombs get pricier with every collapse and move to deeper ore. Sunstone fuels the late ones. */
export function bombCost(collapses: number): Cost {
  if (collapses === 0) return { quartz: 60, iron: 150 };
  if (collapses < 3) return { quartz: 120 * collapses, emeraldite: 20 * collapses };
  if (collapses < 6) return { emeraldite: 60 * collapses, voidOre: 6 * collapses };
  return { voidOre: 12 * collapses, sunstone: 2 * collapses };
}

export function canAfford(resources: Record<string, number>, cost: Cost) {
  return Object.entries(cost).every(([key, value]) => (resources[key] || 0) >= (value || 0));
}
