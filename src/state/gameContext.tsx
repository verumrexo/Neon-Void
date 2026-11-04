import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  ResourceType,
  RESOURCE_DEFINITIONS,
  UpgradesState,
  CraftingItem,
  QuantumPerk,
  GameStats,
  BlockData,
  Drone,
  DroppedMineral,
} from '../types/game';
import { AsteroidWorld, BLOCK_SIZE } from '../engine/world';
import { physics, ShipPhysicsState } from '../engine/physics';
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
    name: 'Autonomous Drone Bay',
    description: 'Fabricates a micro-triangle drone that orbits and mines automatically.',
    cost: { iron: 250, quartz: 100, emeraldite: 35 },
    crafted: false,
    tier: 2,
    effect: '+1 Mining Drone',
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
    name: 'Heavy Drone Wing',
    description: 'Deploys an additional autonomous mining drone equipped with pulsed laser.',
    cost: { iron: 500, emeraldite: 80, voidOre: 30 },
    crafted: false,
    tier: 3,
    effect: '+1 Mining Drone',
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
    name: 'Permanent Drone Matrix',
    description: 'Awaken with an autonomous mining drone immediately upon every reset.',
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
    id: 'singularity_vacuum',
    name: 'Singularity Vacuum',
    description: 'Mined minerals are instantly drawn from across the entire sector.',
    cost: 12,
    costMultiplier: 1.0,
    level: 0,
    maxLevel: 1,
    iconName: 'Radio',
    branch: 'automation',
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
  drones: Drone[];
  droppedMinerals: DroppedMineral[];
  world: AsteroidWorld;
  currentDps: number;
  availableStardustOnPrestige: number;
  hasManualTarget: boolean;
  offlineEarnings: { seconds: number; minerals: Partial<Record<ResourceType, number>> } | null;
  clearOfflineNotification: () => void;
  buyUpgrade: (type: keyof UpgradesState) => boolean;
  getUpgradeCost: (type: keyof UpgradesState) => { resource: ResourceType; amount: number };
  craftItem: (itemId: string) => boolean;
  buyQuantumPerk: (perkId: string) => boolean;
  triggerQuantumSingularity: () => void;
  resetAllProgress: () => void;
  setManualTarget: (worldX: number, worldY: number) => void;
  clearManualTarget: () => void;
}

const GameContext = createContext<GameContextType | null>(null);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // World instance
  const worldRef = useRef<AsteroidWorld>(new AsteroidWorld());
  const world = worldRef.current;

  // Ship physics state
  const shipRef = useRef<ShipPhysicsState>({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    targetX: null,
    targetY: null,
    guidedAngle: null,
    isManualGuided: false,
    wanderAngle: 0,
    wanderTimer: 0,
    hoverAngle: 0,
    miningTarget: null,
    miningTargets: [],
  });

  const dronesRef = useRef<Drone[]>([]);
  const droppedMineralsRef = useRef<DroppedMineral[]>([]);
  const lockedTargetsRef = useRef<{ gx: number; gy: number }[]>([]);
  const [hasManualTarget, setHasManualTarget] = useState<boolean>(false);

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
    collectorMagnet: 1,
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
        if (saved.resources) setResources(saved.resources);
        if (saved.upgrades) setUpgrades(saved.upgrades);
        if (saved.craftingItems) setCraftingItems(saved.craftingItems);
        if (saved.quantumPerks) setQuantumPerks(saved.quantumPerks);
        if (saved.stats) setStats(saved.stats);
        if (saved.world) world.deserialize(saved.world);
        if (
          saved.ship &&
          typeof saved.ship.x === 'number' &&
          typeof saved.ship.y === 'number' &&
          isFinite(saved.ship.x) &&
          isFinite(saved.ship.y)
        ) {
          if (Math.hypot(saved.ship.x, saved.ship.y) > 2500) {
            shipRef.current.x = 0;
            shipRef.current.y = 0;
          } else {
            shipRef.current.x = saved.ship.x;
            shipRef.current.y = saved.ship.y;
          }
        } else {
          shipRef.current.x = 0;
          shipRef.current.y = 0;
        }
        shipRef.current.vx = 0;
        shipRef.current.vy = 0;

        // Offline progress calculation
        if (saved.lastSaveTime) {
          const elapsedSeconds = Math.min(86400, Math.floor((Date.now() - saved.lastSaveTime) / 1000));
          if (elapsedSeconds > 15) {
            // Calculate base offline mining rate
            const baseDps = calculateDps(saved.upgrades, saved.craftingItems, saved.quantumPerks);
            const blocksDestroyedOffline = Math.floor(elapsedSeconds * 0.45 * (baseDps / 20));
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
        currentDrones.push({
          id: `drone-${i}-${Date.now()}`,
          x: shipRef.current.x + (Math.random() - 0.5) * 40,
          y: shipRef.current.y + (Math.random() - 0.5) * 40,
          vx: 0,
          vy: 0,
          angle: (i * 1.5) % (Math.PI * 2),
          targetBlock: null,
          beamActive: false,
          color: '#00f0ff',
          wanderAngle: (i * 1.5) % (Math.PI * 2),
          wanderTimer: 1.0 + Math.random(),
          hoverAngle: Math.random() * Math.PI * 2,
        });
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
      case 'collectorMagnet':
        return { resource: 'iron', amount: Math.floor(25 * Math.pow(1.42, lvl - 1)) };
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

    // Preserve permanent drones from perk
    const permanentDrones = quantumPerks.find((p) => p.id === 'drone_matrix')?.level || 0;

    // Reset local sector
    world.createSpawnClearing();
    shipRef.current.x = 0;
    shipRef.current.y = 0;
    shipRef.current.vx = 0;
    shipRef.current.vy = 0;
    shipRef.current.targetX = null;
    shipRef.current.targetY = null;
    shipRef.current.guidedAngle = null;
    shipRef.current.isManualGuided = false;
    shipRef.current.miningTarget = null;
    shipRef.current.miningTargets = [];
    lockedTargetsRef.current = [];
    droppedMineralsRef.current = [];
    setHasManualTarget(false);

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
      collectorMagnet: 1,
      flightSpeed: 1,
      droneBay: permanentDrones,
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
    shipRef.current.x = 0;
    shipRef.current.y = 0;
    shipRef.current.miningTarget = null;
    shipRef.current.miningTargets = [];
    lockedTargetsRef.current = [];
    droppedMineralsRef.current = [];
    setHasManualTarget(false);
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
      collectorMagnet: 1,
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

  const setManualTarget = (worldX: number, worldY: number) => {
    const ship = shipRef.current;
    const dx = worldX - ship.x;
    const dy = worldY - ship.y;
    ship.guidedAngle = Math.atan2(dy, dx);
    ship.targetX = worldX;
    ship.targetY = worldY;
    ship.isManualGuided = true;
    setHasManualTarget(true);
  };

  const clearManualTarget = () => {
    shipRef.current.targetX = null;
    shipRef.current.targetY = null;
    shipRef.current.guidedAngle = null;
    shipRef.current.isManualGuided = false;
    setHasManualTarget(false);
  };

  // Main high-rate game simulation loop
  useEffect(() => {
    let lastTime = performance.now();
    let animationFrameId: number;

    const gameLoop = (now: number) => {
      const dt = Math.min(0.1, (now - lastTime) / 1000);
      lastTime = now;

      const ship = shipRef.current;
      const rareBoost = getRareBoost(craftingItems, quantumPerks);

      // Check if ship reached manual destination and cleared it
      if (!ship.isManualGuided && hasManualTarget) {
        setHasManualTarget(false);
      }

      // 1. Calculate calm speed multiplier
      let speedMult = 1 + (upgrades.flightSpeed - 1) * 0.12;
      craftingItems.forEach((c) => {
        if (c.crafted && c.statBonus.speedBoost) speedMult *= c.statBonus.speedBoost;
      });

      // 2. Beam parameters
      let maxBeams = upgrades.beamCount;
      craftingItems.forEach((c) => {
        if (c.crafted && c.statBonus.extraBeams) maxBeams += c.statBonus.extraBeams;
      });
      const multiPerk = quantumPerks.find((p) => p.id === 'multi_beam_mastery');
      if (multiPerk) maxBeams += multiPerk.level;

      const rangePx = 100 + (upgrades.laserRange - 1) * 20;
      const baseDps = calculateDps(upgrades, craftingItems, quantumPerks);

      // 1. MULTI-TARGET BEAM SPLITTER LOCKING
      // Filters destroyed or out-of-range targets, then fills remaining beam slots with new distinct targets
      const currentLocked = lockedTargetsRef.current.filter((t) => {
        if (world.isMined(t.gx, t.gy)) return false;
        const bx = t.gx * BLOCK_SIZE + BLOCK_SIZE / 2;
        const by = t.gy * BLOCK_SIZE + BLOCK_SIZE / 2;
        return Math.hypot(bx - ship.x, by - ship.y) <= rangePx + 40;
      });

      const neededTargets = maxBeams - currentLocked.length;
      if (neededTargets > 0) {
        const excludeKeys = new Set(currentLocked.map((t) => `${t.gx},${t.gy}`));
        const preferredDir =
          ship.isManualGuided && ship.guidedAngle !== null
            ? { x: ship.x + Math.cos(ship.guidedAngle) * 100, y: ship.y + Math.sin(ship.guidedAngle) * 100 }
            : null;

        const newFound = world.findMultipleMiningTargets(
          ship.x,
          ship.y,
          rangePx,
          neededTargets,
          excludeKeys,
          preferredDir,
          rareBoost
        );

        newFound.forEach((f) => currentLocked.push({ gx: f.gx, gy: f.gy }));
      }
      lockedTargetsRef.current = currentLocked;

      // Build active mining targets array
      const activeTargets: { gx: number; gy: number; color: string; glow: string; block: BlockData }[] = [];
      currentLocked.forEach((t) => {
        const block = world.getBlock(t.gx, t.gy, rareBoost);
        if (block) {
          activeTargets.push({
            gx: t.gx,
            gy: t.gy,
            color: block.color,
            glow: block.glow,
            block,
          });
        }
      });

      // Sync ship mining targets
      ship.miningTargets = activeTargets.map((t) => ({
        gx: t.gx,
        gy: t.gy,
        color: t.color,
        glow: t.glow,
      }));
      ship.miningTarget = ship.miningTargets[0] || null;

      // Update ship physics with calm bumblebee flight near primary target
      const primaryTarget = activeTargets[0] || null;
      physics.updateShip(
        ship,
        world,
        dt,
        primaryTarget ? { gx: primaryTarget.gx, gy: primaryTarget.gy } : null,
        speedMult
      );

      // 2. FIRE MINING LASERS AT ALL ACTIVE TARGETS SIMULTANEOUSLY
      if (activeTargets.length > 0) {
        sound.playLaserHit();
        // Distribute damage across split beams while scaling nicely with extra beams
        const beamDps = baseDps / Math.max(1, activeTargets.length * 0.75);

        activeTargets.forEach((target) => {
          const blockWorldX = target.gx * BLOCK_SIZE + BLOCK_SIZE / 2;
          const blockWorldY = target.gy * BLOCK_SIZE + BLOCK_SIZE / 2;

          // Spark emission at block impact site
          particleSystem.spawnLaserHitSparks(blockWorldX, blockWorldY, target.color, target.glow, 1);

          // Apply beam damage
          const res = world.damageBlock(target.gx, target.gy, beamDps * dt, rareBoost);
          if (res.destroyed) {
            // Remove destroyed target from locked list
            lockedTargetsRef.current = lockedTargetsRef.current.filter(
              (lt) => !(lt.gx === target.gx && lt.gy === target.gy)
            );
            handleBlockDestroyed(res.block, blockWorldX, blockWorldY, quantumPerks);
          }
        });
      }

      // 3. UPDATE AUTONOMOUS COMPANION DRONES (MINI-SHIPS)
      const droneDps = baseDps * 0.45;
      const shipLockedKeys = new Set(lockedTargetsRef.current.map((t) => `${t.gx},${t.gy}`));
      const droneUpdate = physics.updateDrones(
        dronesRef.current,
        ship,
        world,
        dt,
        rareBoost,
        droneDps,
        shipLockedKeys
      );
      droneUpdate.destroyedBlocks.forEach((d) => {
        const bx = d.gx * BLOCK_SIZE + BLOCK_SIZE / 2;
        const by = d.gy * BLOCK_SIZE + BLOCK_SIZE / 2;
        handleBlockDestroyed(d.block, bx, by, quantumPerks);
      });

      // 4. UPDATE PHYSICAL DROPPED MINERALS & MAGNET ATTRACTION
      let magnetRadius = 45 + (upgrades.collectorMagnet - 1) * 35;
      const vacuumPerk = quantumPerks.find((p) => p.id === 'singularity_vacuum');
      const vacuumActive = Boolean(vacuumPerk && vacuumPerk.level > 0);
      if (vacuumActive) {
        magnetRadius = 1800; // Screen-wide gravitational vacuum
      }

      const activeMinerals = droppedMineralsRef.current;
      for (let i = activeMinerals.length - 1; i >= 0; i--) {
        const m = activeMinerals[i];
        m.life += dt;
        m.rotation += m.rotationSpeed * dt;

        // Friction
        m.vx *= 0.93;
        m.vy *= 0.93;

        // Gravitational magnet attraction towards ship
        const dx = ship.x - m.x;
        const dy = ship.y - m.y;
        const distToShip = Math.hypot(dx, dy);

        if (distToShip < magnetRadius && distToShip > 1) {
          const pull = (vacuumActive ? 850 : 380) * (1 - distToShip / magnetRadius);
          m.vx += (dx / distToShip) * pull * dt;
          m.vy += (dy / distToShip) * pull * dt;
        }

        // Companion drones also help vacuum up minerals
        dronesRef.current.forEach((drone) => {
          const ddx = drone.x - m.x;
          const ddy = drone.y - m.y;
          const ddist = Math.hypot(ddx, ddy);
          if (ddist < 75 && ddist > 1) {
            const dpull = 320 * (1 - ddist / 75);
            m.vx += (ddx / ddist) * dpull * dt;
            m.vy += (ddy / ddist) * dpull * dt;
          }
        });

        m.x += m.vx * dt;
        m.y += m.vy * dt;

        // Pickup collision detection
        let collected = false;
        if (distToShip < 16) {
          collected = true;
        } else {
          for (const drone of dronesRef.current) {
            if (Math.hypot(drone.x - m.x, drone.y - m.y) < 14) {
              collected = true;
              break;
            }
          }
        }

        if (collected) {
          // Play crystal pickup chime
          const tier = RESOURCE_DEFINITIONS[m.type].tier;
          sound.playCollectMineral(tier);
          particleSystem.spawnFloatingText(
            m.x,
            m.y,
            `+${m.amount} ${RESOURCE_DEFINITIONS[m.type].name}`,
            m.color
          );

          setResources((prev) => ({
            ...prev,
            [m.type]: (prev[m.type] || 0) + m.amount,
          }));

          setStats((prev) => ({
            ...prev,
            lifetimeResources: {
              ...prev.lifetimeResources,
              [m.type]: (prev.lifetimeResources[m.type] || 0) + m.amount,
            },
          }));

          activeMinerals.splice(i, 1);
        }
      }

      // 5. Update debris particles
      particleSystem.update(dt, ship.x, ship.y, magnetRadius);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [upgrades, craftingItems, quantumPerks]);

  const handleBlockDestroyed = (
    block: BlockData,
    bx: number,
    by: number,
    perks: QuantumPerk[]
  ) => {
    sound.playBlockShatter(RESOURCE_DEFINITIONS[block.type].tier);
    particleSystem.spawnBlockShatter(bx, by, block.color, block.glow, RESOURCE_DEFINITIONS[block.type].tier);

    // Multiplier calculation
    const cosmicPerk = perks.find((p) => p.id === 'cosmic_multiplier');
    const yieldMultiplier = 1 + (cosmicPerk ? cosmicPerk.level * 0.5 : 0);

    const baseAmount = block.type === 'basalt' ? 2 : 1;
    const finalAmount = Math.max(1, Math.round(baseAmount * yieldMultiplier));

    // Spawn physical floating mineral gems for player/drone collection
    const mineralCount = block.type === 'basalt' ? 2 : 1;
    const amountPerChunk = Math.max(1, Math.round(finalAmount / mineralCount));

    for (let i = 0; i < mineralCount; i++) {
      const angle = (i / mineralCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
      const speed = 25 + Math.random() * 45;
      droppedMineralsRef.current.push({
        id: `min-${Date.now()}-${Math.random()}`,
        x: bx + (Math.random() - 0.5) * 6,
        y: by + (Math.random() - 0.5) * 6,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        type: block.type,
        amount: amountPerChunk,
        color: block.color,
        glow: block.glow,
        symbol: RESOURCE_DEFINITIONS[block.type].symbol,
        life: 0,
        maxLife: 60,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 3,
      });
    }

    // Increment run stats and lifetime stats
    setStats((prev) => {
      const depth = Math.round(Math.sqrt((bx / BLOCK_SIZE) ** 2 + (by / BLOCK_SIZE) ** 2));
      return {
        ...prev,
        totalBlocksDestroyed: prev.totalBlocksDestroyed + 1,
        blocksDestroyedThisRun: (prev.blocksDestroyedThisRun || 0) + 1,
        maxDepthReached: Math.max(prev.maxDepthReached, depth),
      };
    });
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
        droppedMinerals: droppedMineralsRef.current,
        world,
        currentDps,
        availableStardustOnPrestige,
        hasManualTarget,
        offlineEarnings,
        clearOfflineNotification,
        buyUpgrade,
        getUpgradeCost,
        craftItem,
        buyQuantumPerk,
        triggerQuantumSingularity,
        resetAllProgress,
        setManualTarget,
        clearManualTarget,
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
