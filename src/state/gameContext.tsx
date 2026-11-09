import React, { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react';
import {
  ResourceType,
  RESOURCE_DEFINITIONS,
  GameStats,
  BlockData,
  FleetShip,
} from '../types/game';
import { AsteroidWorld, BLOCK_SIZE, getRingHardness } from '../engine/world';
import { RingMiningEngine, createShip, ShipPhysicsState } from '../engine/physics';
import { gameFrames } from '../engine/frameClock';
import { particleSystem } from '../engine/particles';
import { combat, CombatConfig, DestroyedHit } from '../engine/weapons';
import {
  WeaponId, WEAPONS, WEAPON_ORDER, MODULES, moduleDef, PlacedModule, WingRole, AsteroidType, ASTEROIDS,
  RELICS, UNLOCKS, unlockCost, COLLAPSE_MIN_RING, COLLAPSE_DURATION, bombCost, canAfford, Cost,
} from '../game/content';
import type { GearSlot, GearItem, EquippedGear, GearBonusTotal } from '../types/equipment';
import {
  aggregateGearStats,
  generateGear,
  upgradeGearItem,
  getGearUpgradeCost,
  RARITY_CONFIG,
} from '../game/equipment';

const SAVE_KEY = 'nvm_save_v1';
const SAVE_VERSION = 3;

const EMPTY_RESOURCES: Record<ResourceType, number> = { basalt: 0, iron: 0, quartz: 0, emeraldite: 0, voidOre: 0, sunstone: 0, stardust: 0 };
const EMPTY_STATS: GameStats = {
  totalBlocksDestroyed: 0, blocksDestroyedThisRun: 0, totalDamageDealt: 0, maxDepthReached: 0,
  singularityCount: 0, timePlayedSeconds: 0, lifetimeResources: { ...EMPTY_RESOURCES },
};

export interface ArsenalState {
  unlocked: WeaponId[];
  levels: Record<WeaponId, number>;
  mods: string[];
  equipped: WeaponId[];
}
export interface HullState { built: { uid: string; id: string }[]; placed: PlacedModule[] }
export interface CollapseChoice { stardust: number; asteroids: AsteroidType[]; relics: string[] }

const freshArsenal = (unlocks: Record<string, number>): ArsenalState => {
  const unlocked: WeaponId[] = ['laser'];
  if (unlocks.start_rockets) unlocked.push('rockets');
  if (unlocks.start_railgun) unlocked.push('railgun');
  if (unlocks.start_arc) unlocked.push('arc');
  if (unlocks.start_gravity) unlocked.push('gravity');
  return {
    unlocked,
    levels: { laser: 1, rockets: 1, railgun: 1, arc: 1, gravity: 1 },
    mods: [],
    equipped: unlocked.slice(0, 2 + (unlocks.slot || 0)),
  };
};
const freshHull = (): HullState => ({ built: [], placed: [] });

export interface Loadout {
  slots: number;
  hullCols: number;
  hullRows: number;
  laserDps: number;
  power: number;
  beams: number;
  range: number;
  speed: number;
  rareBoost: number;
  yieldBonus: number;
  wingmen: number;
  config: CombatConfig;
  prism: number;
  synergies: string[];
}

/** Turns arsenal + hull layout + unlocks + relic into concrete combat numbers. */
export function computeLoadout(arsenal: ArsenalState, hull: HullState, unlocks: Record<string, number>,
  relic: string | null, asteroid: AsteroidType, roles: WingRole[], gearBonus?: GearBonusTotal): Loadout {
  const slots = 2 + (unlocks.slot || 0);
  const hullCols = 4, hullRows = 3 + (unlocks.hull || 0);
  const placed = hull.placed.map(module => ({ ...module, def: moduleDef(module.id) }));
  const touching = (a: typeof placed[0], b: typeof placed[0]) => {
    if (a === b) return false;
    const overlapX = a.x < b.x + b.def.w && b.x < a.x + a.def.w;
    const overlapY = a.y < b.y + b.def.h && b.y < a.y + a.def.h;
    const edgeX = a.x + a.def.w === b.x || b.x + b.def.w === a.x;
    const edgeY = a.y + a.def.h === b.y || b.y + b.def.h === a.y;
    return (edgeX && overlapY) || (edgeY && overlapX);
  };
  const near = (module: typeof placed[0], id: string) => placed.some(other => other.id === id && touching(module, other));

  let damageMult = 1 + (unlocks.overclock || 0) * 0.5;
  let laserMult = 1, rocketRate = 1, radiusMult = 1, salvo = 0, extraBeams = 0, wingmen = unlocks.fleet || 0;
  let rareBoost = 0, yieldBonus = 0, speed = 1, overheats = false, vault = false, scoutDouble = false;
  const synergies: string[] = [];
  for (const module of placed) {
    switch (module.id) {
      case 'reactor':
        damageMult += 0.25;
        if (near(module, 'emitter')) { laserMult += 0.5; synergies.push('Reactor + Laser Emitter: +50% laser damage'); }
        if (near(module, 'rack')) { radiusMult += 0.3; synergies.push('Reactor + Rocket Rack: +30% explosion radius'); }
        break;
      case 'coolant':
        if (near(module, 'rack')) { rocketRate *= 1.4; synergies.push('Coolant + Rocket Rack: rockets fire 40% faster'); }
        break;
      case 'emitter': extraBeams++; break;
      case 'rack': salvo += 2; break;
      case 'core':
        damageMult += 0.8;
        if (near(module, 'coolant')) synergies.push('Coolant + Overcharged Core: no overheating');
        else overheats = true;
        break;
      case 'hangar': wingmen++; break;
      case 'scanner':
        rareBoost += 0.4;
        if (near(module, 'hangar')) { scoutDouble = true; synergies.push('Scanner + Hangar: Scout bonuses doubled'); }
        break;
      case 'refinery': yieldBonus += 0.3; speed *= 0.85; break;
      case 'thrusters': speed *= 1.3; break;
      case 'vault': vault = true; break;
    }
  }
  const fleetRoles = Array.from({ length: wingmen }, (_, index) => roles[index] || (index < (unlocks.fleet || 0) ? 'scout' : 'frigate'));
  for (const role of fleetRoles) if (role === 'scout') { rareBoost += scoutDouble ? 0.4 : 0.2; yieldBonus += scoutDouble ? 0.2 : 0.1; }
  if (relic === 'glass_cannon') damageMult *= 2;
  if (asteroid === 'metallic') laserMult *= 1.6;
  if (asteroid === 'ice') speed *= 1.25;

  if (gearBonus) {
    damageMult *= gearBonus.damageMult;
    laserMult *= gearBonus.laserDamageMult;
    rocketRate *= gearBonus.rocketDamageMult;
    rareBoost += gearBonus.rareOreBoost;
    yieldBonus += gearBonus.yieldBonus;
    speed *= gearBonus.flightSpeedMult;
  }

  const mods = new Set(arsenal.mods);
  const equipped = new Set(arsenal.equipped.filter(id => arsenal.unlocked.includes(id)).slice(0, slots));
  const power = 8 * damageMult;
  const laserLevel = arsenal.levels.laser || 1;
  const laserDps = equipped.has('laser') ? Math.round(8 * Math.pow(1.32, laserLevel - 1) * damageMult * laserMult * 10) / 10 : 0;
  return {
    slots, hullCols, hullRows, laserDps, power, speed, rareBoost, yieldBonus, wingmen, synergies,
    beams: 1 + (mods.has('laser.splitter') ? 1 : 0) + extraBeams,
    range: 100 * (mods.has('laser.longfocus') ? 1.6 : 1) + (gearBonus?.extraReach || 0),
    prism: mods.has('laser.prism') ? 1.6 : 1,
    config: {
      power, equipped, levels: arsenal.levels, mods, damageMult: 1, salvo, rocketRate, radiusMult,
      relic, roles: fleetRoles, overheats, vault, asteroid,
      critChance: gearBonus?.critChance ?? 0.05,
      critDamageMult: gearBonus?.critDamageMult ?? 1.5,
      salvoChargeMult: gearBonus?.salvoChargeMult ?? 1,
      overheatBuffer: gearBonus?.overheatBuffer ?? 0,
      legendaryPowers: gearBonus?.powers,
    },
  };
}

interface Banner { id: number; text: string; color: string }

interface GameContextType {
  resources: Record<ResourceType, number>;
  stats: GameStats;
  ship: ShipPhysicsState;
  drones: FleetShip[];
  world: AsteroidWorld;
  currentDps: number;
  availableStardustOnPrestige: number;
  ringProgress: { ring: number };
  offlineEarnings: { seconds: number; minerals: Partial<Record<ResourceType, number>> } | null;
  clearOfflineNotification: () => void;

  arsenal: ArsenalState;
  hull: HullState;
  unlocks: Record<string, number>;
  wingRoles: WingRole[];
  asteroid: AsteroidType;
  relic: string | null;
  loadout: Loadout;
  collapseActive: boolean;
  collapseChoice: CollapseChoice | null;
  banners: Banner[];

  equippedGear: EquippedGear;
  inventoryGear: GearItem[];
  gearBonus: GearBonusTotal;
  equipGear: (item: GearItem) => void;
  unequipGear: (slot: GearSlot) => void;
  scrapGear: (item: GearItem) => void;
  scrapAllCommon: () => void;
  upgradeGear: (item: GearItem) => boolean;

  unlockWeapon: (id: WeaponId) => boolean;
  levelWeapon: (id: WeaponId) => boolean;
  buyMod: (weapon: WeaponId, mod: string) => boolean;
  toggleEquip: (id: WeaponId) => void;
  buildModule: (id: string) => boolean;
  placeModule: (uid: string, x: number, y: number) => boolean;
  unplaceModule: (uid: string) => void;
  setWingRole: (index: number, role: WingRole) => void;
  buyUnlock: (id: string) => boolean;
  armCollapse: () => boolean;
  confirmCollapse: (asteroid: AsteroidType, relic: string) => void;
  resetAllProgress: () => void;
  pay: (cost: Cost) => boolean;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [world] = useState(() => { const created = new AsteroidWorld(); created.features = true; return created; });

  const shipRef = useRef<ShipPhysicsState>(createShip());
  const dronesRef = useRef<FleetShip[]>([]);
  const ringEngineRef = useRef(new RingMiningEngine());
  const [ringProgress, setRingProgress] = useState({ ring: 1 });

  const [resources, setResources] = useState<Record<ResourceType, number>>({ ...EMPTY_RESOURCES });
  const [stats, setStats] = useState<GameStats>(EMPTY_STATS);
  const [unlocks, setUnlocks] = useState<Record<string, number>>({});
  const [arsenal, setArsenal] = useState<ArsenalState>(() => freshArsenal({}));
  const [hull, setHull] = useState<HullState>(freshHull);
  const [wingRoles, setWingRoles] = useState<WingRole[]>([]);
  const [asteroid, setAsteroid] = useState<AsteroidType>('standard');
  const [relic, setRelic] = useState<string | null>(null);
  const [collapseActive, setCollapseActive] = useState(false);
  const [collapseChoice, setCollapseChoice] = useState<CollapseChoice | null>(null);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [offlineEarnings, setOfflineEarnings] = useState<{ seconds: number; minerals: Partial<Record<ResourceType, number>> } | null>(null);

  const [equippedGear, setEquippedGear] = useState<EquippedGear>(() => ({
    lens: generateGear({ slot: 'lens', minRarity: 'refined', ringLevel: 1 }),
    ordnance: null,
    chassis: null,
    thruster: null,
    sensor: null,
    core: null,
  }));
  const [inventoryGear, setInventoryGear] = useState<GearItem[]>([]);

  const gearBonus = useMemo(() => aggregateGearStats(equippedGear), [equippedGear]);

  const loadout = useMemo(() => computeLoadout(arsenal, hull, unlocks, relic, asteroid, wingRoles, gearBonus),
    [arsenal, hull, unlocks, relic, asteroid, wingRoles, gearBonus]);

  const pushBanner = (text: string, color: string) => {
    const id = Date.now() + Math.random();
    setBanners(previous => [...previous.slice(-2), { id, text, color }]);
    window.setTimeout(() => setBanners(previous => previous.filter(banner => banner.id !== id)), 3800);
  };

  const equipGear = (item: GearItem) => {
    setEquippedGear(previous => {
      const current = previous[item.slot];
      setInventoryGear(inv => {
        const filtered = inv.filter(g => g.id !== item.id);
        return current ? [current, ...filtered] : filtered;
      });
      return { ...previous, [item.slot]: item };
    });
    pushBanner(`Equipped ${item.name}`, RARITY_CONFIG[item.rarity].color);
  };

  const unequipGear = (slot: GearSlot) => {
    setEquippedGear(previous => {
      const current = previous[slot];
      if (!current) return previous;
      setInventoryGear(inv => [current, ...inv]);
      return { ...previous, [slot]: null };
    });
  };

  const scrapGear = (item: GearItem) => {
    setResources(previous => {
      const next = { ...previous };
      for (const [res, amt] of Object.entries(item.scrapValue)) {
        next[res as ResourceType] = (next[res as ResourceType] || 0) + (amt || 0);
      }
      return next;
    });
    setInventoryGear(inv => inv.filter(g => g.id !== item.id));
    setEquippedGear(previous => {
      if (previous[item.slot]?.id === item.id) return { ...previous, [item.slot]: null };
      return previous;
    });
    pushBanner(`Scrapped ${item.name}`, '#94a3b8');
  };

  const scrapAllCommon = () => {
    let scrappedCount = 0;
    const scrapTotals: Partial<Record<ResourceType, number>> = {};
    setInventoryGear(inv => {
      const remaining: GearItem[] = [];
      for (const item of inv) {
        if (item.rarity === 'common') {
          scrappedCount++;
          for (const [res, amt] of Object.entries(item.scrapValue)) {
            scrapTotals[res as ResourceType] = (scrapTotals[res as ResourceType] || 0) + (amt || 0);
          }
        } else {
          remaining.push(item);
        }
      }
      return remaining;
    });
    if (scrappedCount > 0) {
      setResources(previous => {
        const next = { ...previous };
        for (const [res, amt] of Object.entries(scrapTotals)) {
          next[res as ResourceType] = (next[res as ResourceType] || 0) + (amt || 0);
        }
        return next;
      });
      pushBanner(`Scrapped ${scrappedCount} common items for parts`, '#94a3b8');
    }
  };

  const upgradeGear = (item: GearItem): boolean => {
    const cost = getGearUpgradeCost(item);
    if (!pay(cost)) return false;
    const upgraded = upgradeGearItem(item);
    setInventoryGear(inv => inv.map(g => g.id === item.id ? upgraded : g));
    setEquippedGear(previous => previous[item.slot]?.id === item.id ? { ...previous, [item.slot]: upgraded } : previous);
    pushBanner(`Upgraded ${upgraded.name}`, RARITY_CONFIG[upgraded.rarity].color);
    return true;
  };

  const addDropGear = (gear: GearItem) => {
    setInventoryGear(previous => {
      if (previous.length >= 36) return previous;
      return [gear, ...previous];
    });
    pushBanner(`SALVAGE: ${gear.name}`, RARITY_CONFIG[gear.rarity].color);
  };
  const addDropRef = useRef(addDropGear);
  addDropRef.current = addDropGear;

  // ─── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if ((saved.version || 0) < SAVE_VERSION) {
        // Old saves: keep ore and stats, refund stardust spent on the removed perk tree, keep laser level.
        let refund = 0;
        for (const perk of saved.quantumPerks || []) {
          const base = { stardust_resonance: [1, 2.2], laser_overclock: [2, 1.8], multi_beam_mastery: [5, 3.5], drone_matrix: [4, 2.5], exotic_vein_finder: [3, 2], cosmic_multiplier: [8, 2.4] }[perk.id as string];
          if (base) for (let level = 0; level < (perk.level || 0); level++) refund += Math.floor(base[0] * Math.pow(base[1], level));
        }
        saved.resources = { ...EMPTY_RESOURCES, ...(saved.resources || {}) };
        saved.resources.stardust += refund;
        saved.arsenal = { ...freshArsenal({}), levels: { ...freshArsenal({}).levels, laser: saved.upgrades?.laserDamage || 1 } };
        if (refund > 0 || saved.upgrades) window.setTimeout(() => pushBanner(`Game systems rebuilt${refund ? `: ${refund} stardust refunded` : ''}`, '#c084fc'), 800);
      }
      if (saved.resources) setResources({ ...EMPTY_RESOURCES, ...saved.resources });
      if (saved.stats) setStats({ ...EMPTY_STATS, ...saved.stats });
      const savedUnlocks = saved.unlocks || {};
      setUnlocks(savedUnlocks);
      if (saved.arsenal) {
        const fresh = freshArsenal(savedUnlocks);
        setArsenal({ ...fresh, ...saved.arsenal, levels: { ...fresh.levels, ...saved.arsenal.levels } });
      }
      if (saved.hull) setHull({ built: saved.hull.built || [], placed: (saved.hull.placed || []).filter((module: PlacedModule) => MODULES.some(def => def.id === module.id)) });
      if (saved.wingRoles) setWingRoles(saved.wingRoles);
      if (saved.asteroid && saved.asteroid in ASTEROIDS) { setAsteroid(saved.asteroid); world.asteroidType = saved.asteroid; }
      if (saved.relic !== undefined) setRelic(saved.relic);
      if (saved.collapseChoice) setCollapseChoice(saved.collapseChoice);
      if (saved.equippedGear) setEquippedGear(saved.equippedGear);
      if (saved.inventoryGear) setInventoryGear(saved.inventoryGear);
      if (saved.world) world.deserialize(saved.world);
      Object.assign(shipRef.current, createShip());
      if (saved.ship && Number.isFinite(saved.ship.x) && Number.isFinite(saved.ship.y) &&
          world.isMined(Math.floor(saved.ship.x / BLOCK_SIZE), Math.floor(saved.ship.y / BLOCK_SIZE))) {
        Object.assign(shipRef.current, { x: saved.ship.x, previousX: saved.ship.x, y: saved.ship.y, previousY: saved.ship.y,
          orbitRadius: Number.isFinite(saved.ship.orbitRadius) ? saved.ship.orbitRadius : Math.hypot(saved.ship.x - 13, saved.ship.y - 13),
          workAngle: Number.isFinite(saved.ship.workAngle) ? saved.ship.workAngle : Math.atan2(saved.ship.y - 13, saved.ship.x - 13),
          lapProgress: Number.isFinite(saved.ship.lapProgress) ? saved.ship.lapProgress : 0,
          hoverAngle: Number.isFinite(saved.ship.hoverAngle) ? saved.ship.hoverAngle : 0 });
      }
      if (saved.lastSaveTime) {
        const elapsedSeconds = Math.min(86400, Math.floor((Date.now() - saved.lastSaveTime) / 1000));
        const dps = Number.isFinite(saved.offlineDps) ? saved.offlineDps : 8;
        if (elapsedSeconds > 15) {
          const blocks = Math.floor(elapsedSeconds * 0.45 * (dps / 20) / getRingHardness(saved.ring || 1));
          if (blocks > 0) {
            const minerals = { basalt: Math.floor(blocks * 1.5), iron: Math.floor(blocks * 0.35), quartz: Math.floor(blocks * 0.1) };
            setResources(previous => ({ ...previous, basalt: previous.basalt + minerals.basalt, iron: previous.iron + minerals.iron, quartz: previous.quartz + minerals.quartz }));
            setOfflineEarnings({ seconds: elapsedSeconds, minerals });
          }
        }
      }
    } catch (error) {
      console.warn('Could not load saved game state', error);
    }
  }, []);

  // ─── Save ─────────────────────────────────────────────────────────────────
  const saveStateRef = useRef({});
  saveStateRef.current = {
    resources, stats, unlocks, arsenal, hull, wingRoles, asteroid, relic, collapseChoice,
    equippedGear, inventoryGear,
    offlineDps: loadout.laserDps + loadout.power * (loadout.config.equipped.size - 1)
  };
  useEffect(() => {
    let idle: number | null = null;
    const save = () => {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify({
          ...saveStateRef.current,
          world: world.serialize(),
          ship: { x: shipRef.current.x, y: shipRef.current.y, orbitRadius: shipRef.current.orbitRadius, hoverAngle: shipRef.current.hoverAngle, workAngle: shipRef.current.workAngle, lapProgress: shipRef.current.lapProgress },
          lastSaveTime: Date.now(), version: SAVE_VERSION, ring: ringEngineRef.current.ring,
        }));
      } catch (error) { console.warn('Failed to auto-save game', error); }
    };
    const scheduleSave = () => {
      if (idle !== null) return;
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(() => { idle = null; save(); }, { timeout: 2000 });
      else save();
    };
    const saveOnHide = () => { if (document.hidden) save(); };
    const timer = window.setInterval(scheduleSave, 4000);
    document.addEventListener('visibilitychange', saveOnHide);
    window.addEventListener('pagehide', save);
    return () => {
      window.clearInterval(timer);
      if (idle !== null) window.cancelIdleCallback(idle);
      document.removeEventListener('visibilitychange', saveOnHide);
      window.removeEventListener('pagehide', save);
    };
  }, [world]);

  // ─── Fleet sync ───────────────────────────────────────────────────────────
  useEffect(() => {
    const target = loadout.wingmen;
    const current = dronesRef.current;
    if (current.length < target) {
      for (let i = current.length; i < target; i++) {
        current.push({ ...createShip(i + 1), x: shipRef.current.x, previousX: shipRef.current.x, y: shipRef.current.y, previousY: shipRef.current.y,
          orbitRadius: shipRef.current.orbitRadius, workAngle: shipRef.current.workAngle, id: `ship-${i + 1}-${Date.now()}` });
      }
    } else if (current.length > target) dronesRef.current.splice(target);
    dronesRef.current.forEach((ship, index) => { ship.laserScale = loadout.config.roles[index] === 'frigate' ? 0 : 1; });
  }, [loadout]);

  useEffect(() => { if (world.asteroidType !== asteroid) { world.asteroidType = asteroid; world.terrainEpoch++; } }, [asteroid, world]);

  // ─── Purchases ────────────────────────────────────────────────────────────
  const pay = (cost: Cost): boolean => {
    if (!canAfford(resources, cost)) return false;
    setResources(previous => {
      const next = { ...previous };
      for (const [key, value] of Object.entries(cost)) next[key as ResourceType] -= value || 0;
      return next;
    });
    return true;
  };

  const unlockWeapon = (id: WeaponId) => {
    if (arsenal.unlocked.includes(id) || !pay(WEAPONS[id].unlockCost)) return false;
    setArsenal(previous => ({ ...previous, unlocked: [...previous.unlocked, id],
      equipped: previous.equipped.length < loadout.slots ? [...previous.equipped, id] : previous.equipped }));
    return true;
  };
  const levelWeapon = (id: WeaponId) => {
    if (!arsenal.unlocked.includes(id) || !pay(WEAPONS[id].levelCost(arsenal.levels[id]))) return false;
    setArsenal(previous => ({ ...previous, levels: { ...previous.levels, [id]: previous.levels[id] + 1 } }));
    return true;
  };
  const buyMod = (weapon: WeaponId, mod: string) => {
    const key = `${weapon}.${mod}`;
    const def = WEAPONS[weapon].mods.find(entry => entry.id === mod);
    if (!def || arsenal.mods.includes(key) || !arsenal.unlocked.includes(weapon) || !pay(def.cost)) return false;
    setArsenal(previous => ({ ...previous, mods: [...previous.mods, key] }));
    return true;
  };
  const toggleEquip = (id: WeaponId) => {
    setArsenal(previous => {
      if (previous.equipped.includes(id)) return { ...previous, equipped: previous.equipped.filter(entry => entry !== id) };
      if (!previous.unlocked.includes(id)) return previous;
      const equipped = [...previous.equipped, id];
      // Equipping into a full loadout swaps out the oldest weapon.
      while (equipped.length > loadout.slots) equipped.shift();
      return { ...previous, equipped };
    });
  };

  const buildModule = (id: string) => {
    const def = MODULES.find(module => module.id === id);
    if (!def || !pay(def.cost)) return false;
    setHull(previous => ({ ...previous, built: [...previous.built, { uid: `${id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, id }] }));
    return true;
  };
  const placeModule = (uid: string, x: number, y: number) => {
    const item = hull.built.find(entry => entry.uid === uid);
    if (!item) return false;
    const def = moduleDef(item.id);
    if (x < 0 || y < 0 || x + def.w > loadout.hullCols || y + def.h > loadout.hullRows) return false;
    const others = hull.placed.filter(module => module.uid !== uid);
    const collides = others.some(module => {
      const other = moduleDef(module.id);
      return x < module.x + other.w && module.x < x + def.w && y < module.y + other.h && module.y < y + def.h;
    });
    if (collides) return false;
    setHull(previous => ({ ...previous, placed: [...previous.placed.filter(module => module.uid !== uid), { uid, id: item.id, x, y }] }));
    return true;
  };
  const unplaceModule = (uid: string) => setHull(previous => ({ ...previous, placed: previous.placed.filter(module => module.uid !== uid) }));
  const setWingRole = (index: number, role: WingRole) => setWingRoles(previous => {
    const next = [...previous];
    for (let i = 0; i <= index; i++) next[i] = next[i] || loadout.config.roles[i] || 'frigate';
    next[index] = role;
    return next;
  });

  const buyUnlock = (id: string) => {
    const def = UNLOCKS.find(unlock => unlock.id === id);
    if (!def) return false;
    const level = unlocks[id] || 0;
    if (level >= def.maxLevel || (def.requires && !unlocks[def.requires])) return false;
    const cost = unlockCost(def, level);
    if (resources.stardust < cost) return false;
    setResources(previous => ({ ...previous, stardust: previous.stardust - cost }));
    setUnlocks(previous => ({ ...previous, [id]: level + 1 }));
    // Blueprints apply immediately to the current run too.
    const weapon = ({ start_rockets: 'rockets', start_railgun: 'railgun', start_arc: 'arc', start_gravity: 'gravity' } as Record<string, WeaponId>)[id];
    if (weapon) setArsenal(previous => previous.unlocked.includes(weapon) ? previous : { ...previous, unlocked: [...previous.unlocked, weapon] });
    return true;
  };

  // ─── Collapse ─────────────────────────────────────────────────────────────
  const resonance = 1 + (unlocks.resonance || 0) * 0.25;
  const blocksThisRun = stats.blocksDestroyedThisRun || 0;
  const availableStardustOnPrestige = Math.max(1, Math.floor(Math.pow(blocksThisRun / 120, 0.72) * resonance));
  const stardustRef = useRef(availableStardustOnPrestige);
  stardustRef.current = availableStardustOnPrestige;

  const armCollapse = () => {
    if (collapseActive || collapseChoice || ringProgress.ring < COLLAPSE_MIN_RING) return false;
    if (!pay(bombCost(stats.singularityCount))) return false;
    combat.collapse = COLLAPSE_DURATION;
    combat.event = null; combat.rival = null;
    setCollapseActive(true);
    pushBanner('SINGULARITY BOMB ARMED: ore x5, damage x3 for 30 seconds', '#c084fc');
    return true;
  };

  const finishCollapse = () => {
    setCollapseActive(false);
    const charted = (Object.keys(ASTEROIDS) as AsteroidType[]).filter(type => type !== 'standard' && unlocks[`ast_${type}`]);
    const basePool: AsteroidType[] = ['standard', ...charted];
    const pool: AsteroidType[] = basePool.filter((type): type is AsteroidType => type !== world.asteroidType || charted.length < 2);
    const asteroids = shuffle(pool).slice(0, 3);
    const relics = shuffle(RELICS.map(entry => entry.id)).slice(0, 3 + (unlocks.relic_choice || 0));
    const cosmicCache = generateGear({ minRarity: 'cosmic', ringLevel: 10 });
    addDropRef.current(cosmicCache);
    setCollapseChoice({ stardust: stardustRef.current, asteroids, relics });
  };
  const finishRef = useRef(finishCollapse);
  finishRef.current = finishCollapse;

  const resetRun = (keepModules: boolean) => {
    world.createSpawnClearing();
    Object.assign(shipRef.current, createShip());
    dronesRef.current.forEach((ship, index) => Object.assign(ship, createShip(index + 1)));
    ringEngineRef.current.reset();
    combat.reset();
    setRingProgress({ ring: 1 });
    particleSystem.clear();
    if (!keepModules) setHull(freshHull());
  };

  const confirmCollapse = (nextAsteroid: AsteroidType, nextRelic: string) => {
    if (!collapseChoice) return;
    const gained = collapseChoice.stardust;
    world.asteroidType = nextAsteroid;
    setAsteroid(nextAsteroid);
    setRelic(nextRelic);
    resetRun(!!unlocks.keep_modules);
    setResources({ ...EMPTY_RESOURCES, stardust: resources.stardust + gained });
    setArsenal(freshArsenal(unlocks));
    setStats(previous => ({ ...previous, blocksDestroyedThisRun: 0, singularityCount: previous.singularityCount + 1,
      lifetimeResources: { ...previous.lifetimeResources, stardust: previous.lifetimeResources.stardust + gained } }));
    setCollapseChoice(null);
    pushBanner(`Now mining: ${ASTEROIDS[nextAsteroid].name} · Relic: ${RELICS.find(entry => entry.id === nextRelic)?.name}`, ASTEROIDS[nextAsteroid].color);
  };

  const resetAllProgress = () => {
    localStorage.removeItem(SAVE_KEY);
    world.asteroidType = 'standard';
    resetRun(false);
    setResources({ ...EMPTY_RESOURCES });
    setStats({ ...EMPTY_STATS, lifetimeResources: { ...EMPTY_RESOURCES } });
    setUnlocks({});
    setArsenal(freshArsenal({}));
    setWingRoles([]);
    setAsteroid('standard');
    setRelic(null);
    setCollapseActive(false);
    setCollapseChoice(null);
    setEquippedGear({
      lens: generateGear({ slot: 'lens', minRarity: 'refined', ringLevel: 1 }),
      ordnance: null,
      chassis: null,
      thruster: null,
      sensor: null,
      core: null,
    });
    setInventoryGear([]);
  };

  // ─── Simulation loop ──────────────────────────────────────────────────────
  useEffect(() => {
    let uiTimer = 0, damageTimer = 0;
    world.rareBoost = loadout.rareBoost;
    world.terrainEpoch++;
    const fleet = [shipRef.current, ...dronesRef.current];
    let sectorEpoch = world.terrainEpoch;
    const gains = {} as Partial<Record<ResourceType, number>>;
    let destroyedCount = 0, deepest = 0, damage = 0, jackpotCounter = 0;
    let steal = false, loot = false;
    const yieldBase = 1 + loadout.yieldBonus;
    const flush = (force = false) => {
      if (sectorEpoch !== world.terrainEpoch) return;
      if (destroyedCount || steal || loot || (damage && (force || damageTimer >= 1))) {
        const credited = { ...gains };
        const count = destroyedCount, depth = deepest, dealt = damage;
        const doSteal = steal, doLoot = loot;
        const ring = ringEngineRef.current.ring;
        setResources(previous => {
          const result = { ...previous };
          for (const [type, amount] of Object.entries(credited)) result[type as ResourceType] += amount!;
          if (doSteal) for (const type of ['basalt', 'iron', 'quartz', 'emeraldite', 'voidOre', 'sunstone'] as ResourceType[]) result[type] = Math.floor(result[type] * 0.9);
          if (doLoot) { result.iron += 40 * ring; result.quartz += 12 * ring; if (ring > 15) result.emeraldite += 3 * ring; }
          return result;
        });
        setStats(previous => {
          const lifetimeResources = { ...previous.lifetimeResources };
          for (const [type, amount] of Object.entries(credited)) lifetimeResources[type as ResourceType] += amount!;
          return { ...previous, lifetimeResources,
            totalBlocksDestroyed: previous.totalBlocksDestroyed + count,
            blocksDestroyedThisRun: previous.blocksDestroyedThisRun + count,
            totalDamageDealt: previous.totalDamageDealt + dealt,
            maxDepthReached: Math.max(previous.maxDepthReached, depth) };
        });
        for (const key of Object.keys(gains)) delete gains[key as ResourceType];
        destroyedCount = damage = deepest = damageTimer = 0;
        steal = loot = false;
      }
      const engine = ringEngineRef.current;
      setRingProgress(previous => previous.ring === engine.ring ? previous : { ring: engine.ring });
    };

    const credit = (hit: DestroyedHit) => {
      const { block } = hit;
      let amount = (block.type === 'basalt' ? 2 : 1) * yieldBase * hit.mult;
      if (block.volatile) amount *= loadout.config.vault ? 3 : 1.5;
      if (block.armored) {
        amount *= relic === 'boss_hunter' ? 30 : 15;
        const ring = ringEngineRef.current.ring;
        const gear = generateGear({ minRarity: 'exotic', ringLevel: ring });
        addDropRef.current(gear);
      } else if (Math.random() < 0.003 * (1 + loadout.rareBoost)) {
        const ring = ringEngineRef.current.ring;
        const gear = generateGear({ ringLevel: ring });
        addDropRef.current(gear);
      }
      if (combat.collapse > 0) amount *= 5;
      if (asteroid === 'ice') amount *= 0.8;
      if (relic === 'glass_cannon') amount *= 0.7;
      let jackpot = false;
      if (relic === 'jackpot' && ++jackpotCounter % 100 === 0) { amount *= 25; jackpot = true; }
      const rounded = Math.max(1, Math.round(amount));
      gains[block.type] = (gains[block.type] || 0) + rounded;
      destroyedCount++;
      deepest = Math.max(deepest, Math.round(Math.hypot(block.x, block.y)));
      const definition = RESOURCE_DEFINITIONS[block.type];
      const x = (block.x + 0.5) * BLOCK_SIZE, y = (block.y + 0.5) * BLOCK_SIZE;
      particleSystem.spawnBlockShatter(x, y, block.color, block.glow, definition.tier);
      if (hit.source === 'laser' || block.armored || jackpot || rounded >= 5 || Math.random() < 0.25) {
        particleSystem.spawnFloatingText(x, y, `${jackpot ? 'JACKPOT ' : ''}+${rounded} ${definition.name}`, jackpot ? '#ffb800' : block.color);
      }
      if (relic === 'arc_storm' && Math.random() < 0.1) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!world.isMined(block.x + dx, block.y + dy)) {
          combat.arc(x, y, block.x + dx, block.y + dy, loadout.power * 2); break;
        }
      }
    };

    const unsubscribe = gameFrames.subscribeUpdate(step => {
      uiTimer += step; damageTimer += step;
      if (world.rareBoost !== loadout.rareBoost) { world.rareBoost = loadout.rareBoost; world.terrainEpoch++; }
      sectorEpoch = world.terrainEpoch;
      const laserDps = loadout.laserDps * combat.laserMultiplier();
      const laserHits = ringEngineRef.current.update(fleet, world, step, laserDps, loadout.range, loadout.beams, loadout.speed, loadout.prism);
      for (const block of laserHits) { combat.notifyDestroyed(block); credit({ block, source: 'laser', mult: 1 }); }
      const wasCollapsing = combat.collapse > 0;
      for (const hit of combat.update(fleet, world, step, loadout.config)) credit(hit);
      if (wasCollapsing && combat.collapse <= 0) finishRef.current();
      while (combat.events.length) {
        const event = combat.events.shift()!;
        if (event.type === 'banner') pushBanner(event.text, event.color);
        else if (event.type === 'steal') steal = true;
        else if (event.type === 'rivalKilled') {
          loot = true;
          const ring = ringEngineRef.current.ring;
          const gear = generateGear({ minRarity: 'void', ringLevel: ring });
          addDropRef.current(gear);
        }
      }
      damage += fleet.reduce((sum, ship) => sum + (ship.miningTargets.length ? laserDps * (ship.laserScale ?? 1) * step : 0), 0);
      particleSystem.update(step);
      if (uiTimer >= 0.15) { flush(); uiTimer -= 0.15; }
    });
    return () => { unsubscribe(); flush(true); };
  }, [loadout, relic, asteroid]);

  return (
    <GameContext.Provider value={{
      resources, stats, ship: shipRef.current, drones: dronesRef.current, world,
      currentDps: loadout.laserDps, availableStardustOnPrestige, ringProgress, offlineEarnings,
      clearOfflineNotification: () => setOfflineEarnings(null),
      arsenal, hull, unlocks, wingRoles, asteroid, relic, loadout, collapseActive, collapseChoice, banners,
      equippedGear, inventoryGear, gearBonus,
      equipGear, unequipGear, scrapGear, scrapAllCommon, upgradeGear,
      unlockWeapon, levelWeapon, buyMod, toggleEquip, buildModule, placeModule, unplaceModule, setWingRole,
      buyUnlock, armCollapse, confirmCollapse, resetAllProgress, pay,
    }}>
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
};

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy;
}

export { WEAPON_ORDER, COLLAPSE_MIN_RING, bombCost };
export type { BlockData };
