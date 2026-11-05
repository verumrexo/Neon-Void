import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  ResourceType,
  RESOURCE_DEFINITIONS,
  UpgradesState,
  CraftingItem,
  QuantumPerk,
  GameStats,
  BlockData,
  FleetShip,
} from '../types/game';
import { AsteroidWorld, BLOCK_SIZE, getRingHardness } from '../engine/world';
import { RingMiningEngine, createShip, ShipPhysicsState } from '../engine/physics';
import { particleSystem } from '../engine/particles';
import { sound } from '../audio/sound';

const SAVE_KEY = 'nvm_save_v1';

export const INITIAL_CRAFTING_ITEMS: CraftingItem[] = [
  {
    id: 'focus_crystal_1',
    name: 'Focusing Crystal Array',
    description: 'Calibrated prismatic lens array focusing the main mining beam.',
    cost: { iron: 120, quartz: 35 },
    crafted: false,
    tier: 1,
    effect: '+40% Laser Damage',
    statBonus: { damageMultiplier: 1.4 },
  },
  {
    id: 'flux_resonator',
    name: 'High-Flux Resonator',
    description: 'Splits primary laser diode into a synchronized dual-beam array.',
    cost: { basalt: 450, iron: 200, quartz: 80, emeraldite: 20 },
    crafted: false,
    tier: 2,
    effect: '+1 Simultaneous Laser Beam',
    statBonus: { extraBeams: 1 },
  },
  {
    id: 'drone_bay_1',
    name: 'Shipyard',
    description: 'Builds another full-size mining ship with the same systems as your first.',
    cost: { iron: 250, quartz: 100, emeraldite: 35 },
    crafted: false,
    tier: 2,
    effect: '+1 Mining Ship',
    statBonus: { extraDrones: 1 },
  },
  {
    id: 'harmonic_resonator',
    name: 'Harmonic Pulse Resonator',
    description: 'Fine-tunes laser pulse resonance to extract higher purity mineral yields.',
    cost: { iron: 300, quartz: 60, voidOre: 10 },
    crafted: false,
    tier: 3,
    effect: '+30% Mineral Extraction Yield',
    statBonus: { refiningBonus: 0.3 },
  },
  {
    id: 'drone_bay_2',
    name: 'Fleet Expansion',
    description: 'Builds an additional mining ship sharing your fleet upgrades.',
    cost: { iron: 500, emeraldite: 80, voidOre: 30 },
    crafted: false,
    tier: 3,
    effect: '+1 Mining Ship',
    statBonus: { extraDrones: 1 },
  },
  {
    id: 'prismatic_converter',
    name: 'Prismatic Core Converter',
    description: 'Taps deep gravitational harmonics to attract exotic high-tier mineral veins.',
    cost: { quartz: 250, emeraldite: 120, voidOre: 45, sunstone: 8 },
    crafted: false,
    tier: 4,
    effect: '+50% Rare Mineral Vein Rarity',
    statBonus: { rareOreBoost: 0.5 },
  },
  {
    id: 'vanguard_hull',
    name: 'Vanguard Tri-Hull Modification',
    description: 'Reconstructs outer chassis with reinforced carbon-lattice geometry.',
    cost: { iron: 800, quartz: 300, emeraldite: 150, voidOre: 60, sunstone: 15 },
    crafted: false,
    tier: 5,
    effect: '+100% All Mining Power & Hull Overhaul',
    statBonus: { damageMultiplier: 2.0 },
  },
];

export const INITIAL_QUANTUM_PERKS: QuantumPerk[] = [
  {
    id: 'stardust_resonance',
    name: 'Stardust Resonance',
    description: '+25% Stardust harvested from all future Quantum Singularities.',
    cost: 1,
    costMultiplier: 2.2,
    level: 0,
    maxLevel: 10,
    iconName: 'Sparkles',
    branch: 'cosmic',
  },
  {
    id: 'laser_overclock',
    name: 'Laser Overclock',
    description: '+50% permanent base mining damage to all ship beams.',
    cost: 2,
    costMultiplier: 1.8,
    level: 0,
    maxLevel: 15,
    iconName: 'Zap',
    branch: 'combat',
  },
  {
    id: 'multi_beam_mastery',
    name: 'Quantum Splitter',
    description: 'Permanently grants +1 additional simultaneous laser beam.',
    cost: 5,
    costMultiplier: 3.5,
    level: 0,
    maxLevel: 3,
    iconName: 'GitFork',
    branch: 'combat',
  },
  {
    id: 'drone_matrix',
    name: 'Permanent Fleet',
    description: 'Start each reset with an additional mining ship.',
    cost: 4,
    costMultiplier: 2.5,
    level: 0,
    maxLevel: 4,
    iconName: 'Cpu',
    branch: 'automation',
  },
  {
    id: 'exotic_vein_finder',
    name: 'Exotic Vein Harmonizer',
    description: '+20% higher chance for Quartz, Emeraldite, Void Ore, and Sunstone veins.',
    cost: 3,
    costMultiplier: 2.0,
    level: 0,
    maxLevel: 10,
    iconName: 'Gem',
    branch: 'cosmic',
  },
  {
    id: 'cosmic_multiplier',
    name: 'Cosmic Abundance',
    description: '+50% bonus resources yielded from every destroyed asteroid block.',
    cost: 8,
    costMultiplier: 2.4,
    level: 0,
    maxLevel: 8,
    iconName: 'Coins',
    branch: 'cosmic',
  },
];

interface GameContextType {
  resources: Record<ResourceType, number>;
  upgrades: UpgradesState;
  craftingItems: CraftingItem[];
  quantumPerks: QuantumPerk[];
  stats: GameStats;
  ship: ShipPhysicsState;
  drones: FleetShip[];
  world: AsteroidWorld;
  currentDps: number;
  availableStardustOnPrestige: number;
  ringProgress: { ring: number; remaining: number; total: number };
  offlineEarnings: { seconds: number; minerals: Partial<Record<ResourceType, number>> } | null;
  clearOfflineNotification: () => void;
  buyUpgrade: (type: keyof UpgradesState) => boolean;
  getUpgradeCost: (type: keyof UpgradesState) => { resource: ResourceType; amount: number };
  craftItem: (itemId: string) => boolean;
  buyQuantumPerk: (perkId: string) => boolean;
  triggerQuantumSingularity: () => void;
  resetAllProgress: () => void;

}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // World instance
  const worldRef = useRef<AsteroidWorld>(new AsteroidWorld());
  const world = worldRef.current;

  // Ship physics state
  const shipRef = useRef<ShipPhysicsState>(createShip());
  const dronesRef = useRef<FleetShip[]>([]);
  const ringEngineRef = useRef(new RingMiningEngine());
  const [ringProgress, setRingProgress] = useState({ ring: 1, remaining: 0, total: 0 });

  // React state for UI rendering
  const [resources, setResources] = useState<Record<ResourceType, number>>({
    basalt: 0,
    iron: 0,
    quartz: 0,
    emeraldite: 0,
    voidOre: 0,
    sunstone: 0,
    stardust: 0,
  });

  const [upgrades, setUpgrades] = useState<UpgradesState>({
    laserDamage: 1,
    fireRate: 1,
    laserRange: 1,
    beamCount: 1,
    flightSpeed: 1,
    droneBay: 0,
  });

  const [craftingItems, setCraftingItems] = useState<CraftingItem[]>(INITIAL_CRAFTING_ITEMS);
  const [quantumPerks, setQuantumPerks] = useState<QuantumPerk[]>(INITIAL_QUANTUM_PERKS);

  const [stats, setStats] = useState<GameStats>({
    totalBlocksDestroyed: 0,
    blocksDestroyedThisRun: 0,
    totalDamageDealt: 0,
    maxDepthReached: 0,
    singularityCount: 0,
    timePlayedSeconds: 0,
    lifetimeResources: {
      basalt: 0,
      iron: 0,
      quartz: 0,
      emeraldite: 0,
      voidOre: 0,
      sunstone: 0,
      stardust: 0,
    },
  });

  const [offlineEarnings, setOfflineEarnings] = useState<{
    seconds: number;
    minerals: Partial<Record<ResourceType, number>>;
  } | null>(null);

  // Load saved state
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw);
        // Migrate removed collection purchases once, keeping their original currencies.
        if (saved.version !== 2) {
          const pickupLevel = saved.upgrades?.collectorMagnet || 1;
          let ironRefund = 0;
          for (let level = 1; level < Math.min(1000, pickupLevel); level++) ironRefund += Math.floor(25 * Math.pow(1.42, level - 1));
          const vacuumLevel = saved.quantumPerks?.find((perk: QuantumPerk) => perk.id === 'singularity_vacuum')?.level || 0;
          if (saved.resources) {
            saved.resources.iron = (saved.resources.iron || 0) + ironRefund;
            saved.resources.stardust = (saved.resources.stardust || 0) + vacuumLevel * 12;
          }
          if (saved.upgrades) delete saved.upgrades.collectorMagnet;
          if (saved.quantumPerks) saved.quantumPerks = saved.quantumPerks.filter((perk: QuantumPerk) => perk.id !== 'singularity_vacuum');
          saved.version = 2;
          localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
        }
        if (saved.resources) setResources(saved.resources);
        if (saved.upgrades) setUpgrades(previous => ({ ...previous, ...saved.upgrades }));
        if (saved.craftingItems) setCraftingItems(INITIAL_CRAFTING_ITEMS.map(item => ({ ...item, crafted: saved.craftingItems.some((old: CraftingItem) => old.id === item.id && old.crafted) })));
        if (saved.quantumPerks) setQuantumPerks(INITIAL_QUANTUM_PERKS.map(perk => ({ ...perk, level: saved.quantumPerks.find((old: QuantumPerk) => old.id === perk.id)?.level || 0 })));
        if (saved.stats) setStats(saved.stats);
        if (saved.world) world.deserialize(saved.world);
        Object.assign(shipRef.current, createShip());

        // Offline progress calculation
        if (saved.lastSaveTime) {
          const elapsedSeconds = Math.min(86400, Math.floor((Date.now() - saved.lastSaveTime) / 1000));
          if (elapsedSeconds > 15) {
            // Calculate base offline mining rate
            const baseDps = calculateDps(saved.upgrades, saved.craftingItems, saved.quantumPerks);
            const blocksDestroyedOffline = Math.floor(elapsedSeconds * 0.45 * (baseDps / 20) / getRingHardness(saved.ring || 1));
            if (blocksDestroyedOffline > 0) {
              const gainedBasalt = Math.floor(blocksDestroyedOffline * 1.5);
              const gainedIron = Math.floor(blocksDestroyedOffline * 0.35);
              const gainedQuartz = Math.floor(blocksDestroyedOffline * 0.1);

              setResources((prev) => ({
                ...prev,
                basalt: prev.basalt + gainedBasalt,
                iron: prev.iron + gainedIron,
                quartz: prev.quartz + gainedQuartz,
              }));

              setOfflineEarnings({
                seconds: elapsedSeconds,
                minerals: { basalt: gainedBasalt, iron: gainedIron, quartz: gainedQuartz },
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Could not load saved game state', e);
    }
  }, []);

  // Save game state periodically
  useEffect(() => {
    const saveTimer = setInterval(() => {
      try {
        const stateToSave = {
          resources,
          upgrades,
          craftingItems,
          quantumPerks,
          stats,
          world: world.serialize(),
          ship: { x: shipRef.current.x, y: shipRef.current.y },
          lastSaveTime: Date.now(),
          version: 2,
          ring: ringEngineRef.current.ring,
        };
        localStorage.setItem(SAVE_KEY, JSON.stringify(stateToSave));
      } catch (e) {
        console.warn('Failed to auto-save game', e);
      }
    }, 4000);

    return () => clearInterval(saveTimer);
  }, [resources, upgrades, craftingItems, quantumPerks, stats]);

  // Sync drones with upgrades & crafted items & quantum perks
  useEffect(() => {
    let targetDroneCount = upgrades.droneBay;
    // Crafted drone bonuses
    craftingItems.forEach((c) => {
      if (c.crafted && c.statBonus.extraDrones) {
        targetDroneCount += c.statBonus.extraDrones;
      }
    });
    // Quantum perk permanent drones
    const dronePerk = quantumPerks.find((p) => p.id === 'drone_matrix');
    if (dronePerk && dronePerk.level > 0) {
      targetDroneCount += dronePerk.level;
    }

    const currentDrones = dronesRef.current;
    if (currentDrones.length < targetDroneCount) {
      for (let i = currentDrones.length; i < targetDroneCount; i++) {
        currentDrones.push({ ...createShip(i + 1), id: `ship-${i + 1}-${Date.now()}` });
      }
    } else if (currentDrones.length > targetDroneCount) {
      dronesRef.current = currentDrones.slice(0, targetDroneCount);
    }
  }, [upgrades.droneBay, craftingItems, quantumPerks]);

  // Compute effective DPS
  const calculateEffectiveDps = useCallback((): number => {
    return calculateDps(upgrades, craftingItems, quantumPerks);
  }, [upgrades, craftingItems, quantumPerks]);

  const currentDps = calculateEffectiveDps();

  // Quantum Singularity available stardust calculation
  // Fixed bug: Only awards stardust earned in THIS run; requires minimum 120 blocks destroyed this run
  const blocksThisRun = stats.blocksDestroyedThisRun || 0;
  const stardustPerk = quantumPerks.find((p) => p.id === 'stardust_resonance');
  const resonanceBonus = 1 + (stardustPerk ? stardustPerk.level * 0.25 : 0);
  const availableStardustOnPrestige = blocksThisRun >= 120
    ? Math.floor(Math.pow(blocksThisRun / 120, 0.72) * resonanceBonus)
    : 0;

  // Rebalanced upgrade cost formulas for rewarding, paced progression
  const getUpgradeCost = (type: keyof UpgradesState): { resource: ResourceType; amount: number } => {
    const lvl = upgrades[type];
    switch (type) {
      case 'laserDamage':
        return { resource: 'basalt', amount: Math.floor(20 * Math.pow(1.40, lvl - 1)) };
      case 'fireRate':
        return { resource: 'iron', amount: Math.floor(26 * Math.pow(1.45, lvl - 1)) };
      case 'laserRange':
        return { resource: 'basalt', amount: Math.floor(35 * Math.pow(1.44, lvl - 1)) };
      case 'beamCount':
        return { resource: 'quartz', amount: Math.floor(40 * Math.pow(2.7, lvl - 1)) };
      case 'flightSpeed':
        return { resource: 'basalt', amount: Math.floor(30 * Math.pow(1.40, lvl - 1)) };
      case 'droneBay':
        return { resource: 'quartz', amount: Math.floor(55 * Math.pow(3.0, lvl)) };
    }
  };

  const buyUpgrade = (type: keyof UpgradesState): boolean => {
    const { resource, amount } = getUpgradeCost(type);
    if (resources[resource] >= amount) {
      setResources((prev) => ({
        ...prev,
        [resource]: prev[resource] - amount,
      }));
      setUpgrades((prev) => ({
        ...prev,
        [type]: prev[type] + 1,
      }));
      sound.playUpgradeSound();
      return true;
    }
    return false;
  };

  const craftItem = (itemId: string): boolean => {
    const item = craftingItems.find((i) => i.id === itemId);
    if (!item || item.crafted) return false;

    // Check costs
    for (const [res, amount] of Object.entries(item.cost)) {
      if ((resources[res as ResourceType] || 0) < (amount || 0)) {
        return false;
      }
    }

    // Deduct resources
    setResources((prev) => {
      const updated = { ...prev };
      for (const [res, amount] of Object.entries(item.cost)) {
        updated[res as ResourceType] -= amount || 0;
      }
      return updated;
    });

    // Mark crafted
    setCraftingItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, crafted: true } : i))
    );

    sound.playUpgradeSound();
    return true;
  };

  const buyQuantumPerk = (perkId: string): boolean => {
    const perk = quantumPerks.find((p) => p.id === perkId);
    if (!perk || perk.level >= perk.maxLevel) return false;

    const currentCost = Math.floor(perk.cost * Math.pow(perk.costMultiplier, perk.level));
    if (resources.stardust >= currentCost) {
      setResources((prev) => ({
        ...prev,
        stardust: prev.stardust - currentCost,
      }));
      setQuantumPerks((prev) =>
        prev.map((p) => (p.id === perkId ? { ...p, level: p.level + 1 } : p))
      );
      sound.playSingularity();
      return true;
    }
    return false;
  };

  const triggerQuantumSingularity = () => {
    if (availableStardustOnPrestige <= 0) return;
    sound.playSingularity();
    const stardustGained = availableStardustOnPrestige;

    // Reset local sector
    world.createSpawnClearing();
    Object.assign(shipRef.current, createShip());
    dronesRef.current.forEach((ship, index) => Object.assign(ship, createShip(index + 1)));
    ringEngineRef.current.reset();
    setRingProgress({ ring: 1, remaining: 0, total: 0 });
    particleSystem.clear();

    // Reset resources and add gained stardust
    setResources((prev) => ({
      basalt: 0,
      iron: 0,
      quartz: 0,
      emeraldite: 0,
      voidOre: 0,
      sunstone: 0,
      stardust: prev.stardust + stardustGained,
    }));

    // Reset standard upgrades
    setUpgrades({
      laserDamage: 1,
      fireRate: 1,
      laserRange: 1,
      beamCount: 1,
      flightSpeed: 1,
      droneBay: 0,
    });

    // Reset uncrafted gear
    setCraftingItems(INITIAL_CRAFTING_ITEMS);

    setStats((prev) => ({
      ...prev,
      blocksDestroyedThisRun: 0,
      singularityCount: prev.singularityCount + 1,
      lifetimeResources: {
        ...prev.lifetimeResources,
        stardust: prev.lifetimeResources.stardust + stardustGained,
      },
    }));
  };

  const resetAllProgress = () => {
    localStorage.removeItem(SAVE_KEY);
    world.createSpawnClearing();
    Object.assign(shipRef.current, createShip());
    dronesRef.current.forEach((ship, index) => Object.assign(ship, createShip(index + 1)));
    ringEngineRef.current.reset();
    setRingProgress({ ring: 1, remaining: 0, total: 0 });
    particleSystem.clear();
    setResources({
      basalt: 0,
      iron: 0,
      quartz: 0,
      emeraldite: 0,
      voidOre: 0,
      sunstone: 0,
      stardust: 0,
    });
    setUpgrades({
      laserDamage: 1,
      fireRate: 1,
      laserRange: 1,
      beamCount: 1,
      flightSpeed: 1,
      droneBay: 0,
    });
    setCraftingItems(INITIAL_CRAFTING_ITEMS);
    setQuantumPerks(INITIAL_QUANTUM_PERKS);
    setStats({
      totalBlocksDestroyed: 0,
      blocksDestroyedThisRun: 0,
      totalDamageDealt: 0,
      maxDepthReached: 0,
      singularityCount: 0,
      timePlayedSeconds: 0,
      lifetimeResources: {
        basalt: 0,
        iron: 0,
        quartz: 0,
        emeraldite: 0,
        voidOre: 0,
        sunstone: 0,
        stardust: 0,
      },
    });
  };

  // One controller owns fleet assignments and ring completion. UI updates are batched.
  useEffect(() => {
    let lastTime = performance.now();
    let frame = 0;
    let pending = 0;
    let uiTimer = 0;
    let sectorEpoch = world.terrainEpoch;
    const gains = {} as Partial<Record<ResourceType, number>>;
    let destroyedCount = 0;
    let deepest = 0;
    let damage = 0;
    const flush = () => {
      if (sectorEpoch !== world.terrainEpoch) return;
      if (destroyedCount || damage) {
        const credited = { ...gains };
        const count = destroyedCount, depth = deepest, dealt = damage;
        setResources(previous => {
          const result = { ...previous };
          for (const [type, amount] of Object.entries(credited)) result[type as ResourceType] += amount!;
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
        destroyedCount = damage = deepest = 0;
      }
      const engine = ringEngineRef.current;
      setRingProgress(previous => previous.ring === engine.ring && previous.remaining === engine.remaining && previous.total === engine.total
        ? previous : { ring: engine.ring, remaining: engine.remaining, total: engine.total });
    };
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;
      pending += dt; uiTimer += dt;
      // Fixed 30 Hz mining simulation; the canvas continues rendering at display refresh rate.
      if (pending >= 1 / 30) {
        const step = pending; pending = 0;
        const rareBoost = getRareBoost(craftingItems, quantumPerks);
        if (world.rareBoost !== rareBoost) { world.rareBoost = rareBoost; world.terrainEpoch++; }
        sectorEpoch = world.terrainEpoch;
        let speed = 1 + (upgrades.flightSpeed - 1) * 0.12;
        let beams = upgrades.beamCount + (quantumPerks.find(perk => perk.id === 'multi_beam_mastery')?.level || 0);
        let range = 100 + (upgrades.laserRange - 1) * 20;
        for (const item of craftingItems) if (item.crafted) {
          speed *= item.statBonus.speedBoost || 1;
          beams += item.statBonus.extraBeams || 0;
          range += item.statBonus.rangeBoost || 0;
        }
        const fleet = [shipRef.current, ...dronesRef.current];
        const destroyed = ringEngineRef.current.update(fleet, world, step,
          calculateDps(upgrades, craftingItems, quantumPerks), range, beams, speed);
        if (fleet.some(ship => ship.miningTargets.length)) sound.playLaserHit();
        for (const block of destroyed) {
          const amount = handleBlockDestroyed(block, craftingItems, quantumPerks);
          gains[block.type] = (gains[block.type] || 0) + amount;
          destroyedCount++;
          deepest = Math.max(deepest, Math.round(Math.hypot(block.x, block.y)));
        }
        damage += fleet.reduce((sum, ship) => sum + (ship.miningTargets.length ? calculateDps(upgrades, craftingItems, quantumPerks) * step : 0), 0);
        particleSystem.update(step);
      }
      if (uiTimer >= 0.15) { flush(); uiTimer = 0; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); flush(); };
  }, [upgrades, craftingItems, quantumPerks]);

  const handleBlockDestroyed = (block: BlockData, crafting: CraftingItem[], perks: QuantumPerk[]) => {
    const definition = RESOURCE_DEFINITIONS[block.type];
    const x = (block.x + 0.5) * BLOCK_SIZE, y = (block.y + 0.5) * BLOCK_SIZE;
    const cosmic = perks.find(perk => perk.id === 'cosmic_multiplier')?.level || 0;
    const refining = crafting.reduce((sum, item) => sum + (item.crafted ? item.statBonus.refiningBonus || 0 : 0), 0);
    const amount = Math.max(1, Math.round((block.type === 'basalt' ? 2 : 1) * (1 + cosmic * 0.5 + refining)));
    // Fragments are visual only. Resources enter cargo without proximity checks.
    sound.playBlockShatter(definition.tier);
    particleSystem.spawnBlockShatter(x, y, block.color, block.glow, definition.tier);
    particleSystem.spawnFloatingText(x, y, `+${amount} ${definition.name}`, block.color);
    return amount;
  };

  const clearOfflineNotification = () => setOfflineEarnings(null);

  return (
    <GameContext.Provider
      value={{
        resources,
        upgrades,
        craftingItems,
        quantumPerks,
        stats,
        ship: shipRef.current,
        drones: dronesRef.current,
        world,
        currentDps,
        availableStardustOnPrestige,
        ringProgress,
        offlineEarnings,
        clearOfflineNotification,
        buyUpgrade,
        getUpgradeCost,
        craftItem,
        buyQuantumPerk,
        triggerQuantumSingularity,
        resetAllProgress,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = () => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within a GameProvider');
  return ctx;
};

// Helper: Calculate DPS
function calculateDps(
  upgrades: UpgradesState,
  crafting: CraftingItem[],
  quantumPerks: QuantumPerk[]
): number {
  let damage = 8 * Math.pow(1.32, upgrades.laserDamage - 1);
  const fireRateMultiplier = 1 + (upgrades.fireRate - 1) * 0.2;

  // Crafting multipliers
  crafting.forEach((c) => {
    if (c.crafted && c.statBonus.damageMultiplier) {
      damage *= c.statBonus.damageMultiplier;
    }
  });

  // Quantum perks overclock
  const overclock = quantumPerks.find((p) => p.id === 'laser_overclock');
  if (overclock && overclock.level > 0) {
    damage *= 1 + overclock.level * 0.5;
  }

  return Math.round(damage * fireRateMultiplier * 10) / 10;
}

// Helper: Rare ore find bonus
function getRareBoost(crafting: CraftingItem[], quantumPerks: QuantumPerk[]): number {
  let boost = 0;
  crafting.forEach((c) => {
    if (c.crafted && c.statBonus.rareOreBoost) boost += c.statBonus.rareOreBoost;
  });
  const perk = quantumPerks.find((p) => p.id === 'exotic_vein_finder');
  if (perk) boost += perk.level * 0.2;
  return boost;
}
