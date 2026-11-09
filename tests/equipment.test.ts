import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  generateGear,
  aggregateGearStats,
  upgradeGearItem,
  getGearUpgradeCost,
  GEAR_SLOT_KEYS,
  RARITY_ORDER,
} from '../src/game/equipment';
import type { EquippedGear } from '../src/types/equipment';

test('generateGear creates valid gear with appropriate slot and rarity', () => {
  for (const slot of GEAR_SLOT_KEYS) {
    const item = generateGear({ slot, minRarity: 'refined', ringLevel: 4 });
    assert.equal(item.slot, slot);
    assert(RARITY_ORDER.indexOf(item.rarity) >= 1);
    assert(item.level >= 1);
    assert(item.primaryStat.value > 0);
    assert(item.affixes.length >= 1);
    assert(item.scrapValue.iron! > 0);
  }
});

test('cosmic gear rolls a legendary power', () => {
  let foundCosmic = false;
  for (let i = 0; i < 100; i++) {
    const item = generateGear({ minRarity: 'cosmic', ringLevel: 10 });
    assert.equal(item.rarity, 'cosmic');
    assert(item.legendaryPower !== undefined);
    assert.equal(item.affixes.length, 3);
    foundCosmic = true;
    break;
  }
  assert.equal(foundCosmic, true);
});

test('upgradeGearItem scales level, primary stat, and affixes', () => {
  const item = generateGear({ slot: 'lens', minRarity: 'refined', ringLevel: 1 });
  const startLevel = item.level;
  const startVal = item.primaryStat.value;

  const cost = getGearUpgradeCost(item);
  assert(cost.iron! > 0);

  const upgraded = upgradeGearItem(item);
  assert.equal(upgraded.level, startLevel + 1);
  assert(upgraded.primaryStat.value > startVal);
  if (item.affixes.length > 0) {
    assert(upgraded.affixes[0].value > item.affixes[0].value);
  }
});

test('aggregateGearStats computes cumulative bonuses and registers legendary powers', () => {
  const lens = generateGear({ slot: 'lens', minRarity: 'void', ringLevel: 5 });
  const core = generateGear({ slot: 'core', minRarity: 'cosmic', ringLevel: 8 });

  const equipped: EquippedGear = {
    lens,
    ordnance: null,
    chassis: null,
    thruster: null,
    sensor: null,
    core,
  };

  const bonuses = aggregateGearStats(equipped);
  assert(bonuses.laserDamageMult > 1, 'Lens should boost laser damage');
  assert(bonuses.critChance > 0.05, 'Core should boost crit chance above 5% baseline');
  assert(core.legendaryPower && bonuses.powers.has(core.legendaryPower), 'Cosmic legendary power should be registered in bonuses');
});
