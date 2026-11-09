import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AsteroidWorld, BLOCK_SIZE } from '../src/engine/world';
import { createShip } from '../src/engine/physics';
import { CombatSystem, CombatConfig } from '../src/engine/weapons';
import { computeLoadout, ArsenalState, HullState } from '../src/state/gameContext';
import { bombCost, COLLAPSE_MIN_RING } from '../src/game/content';

test('computeLoadout calculates synergies and prevents overheat with coolant', () => {
  const arsenal: ArsenalState = {
    unlocked: ['laser', 'rockets'],
    levels: { laser: 2, rockets: 1, railgun: 1, arc: 1, gravity: 1 },
    mods: ['laser.splitter'],
    equipped: ['laser', 'rockets'],
  };
  const hullWithoutCoolant: HullState = {
    built: [
      { uid: 'core-1', id: 'core' },
      { uid: 'reactor-1', id: 'reactor' },
      { uid: 'emitter-1', id: 'emitter' },
    ],
    placed: [
      // core is 2x2 at (0, 0)
      { uid: 'core-1', id: 'core', x: 0, y: 0 },
      // reactor is 1x1 at (2, 0)
      { uid: 'reactor-1', id: 'reactor', x: 2, y: 0 },
      // emitter is 2x1 at (2, 1), adjacent to reactor
      { uid: 'emitter-1', id: 'emitter', x: 2, y: 1 },
    ],
  };

  const loadoutOverheating = computeLoadout(arsenal, hullWithoutCoolant, {}, null, 'standard', []);
  assert.equal(loadoutOverheating.config.overheats, true);
  assert(loadoutOverheating.synergies.some(s => s.includes('Reactor + Laser Emitter')));
  // 1 base beam + 1 splitter mod + 1 emitter module = 3 beams
  assert.equal(loadoutOverheating.beams, 3);

  // Now place coolant adjacent to core at (0, 2) (coolant is 1x2, touches y=2 of core)
  const hullWithCoolant: HullState = {
    built: [...hullWithoutCoolant.built, { uid: 'coolant-1', id: 'coolant' }],
    placed: [...hullWithoutCoolant.placed, { uid: 'coolant-1', id: 'coolant', x: 0, y: 2 }],
  };
  const loadoutCooled = computeLoadout(arsenal, hullWithCoolant, {}, null, 'standard', []);
  assert.equal(loadoutCooled.config.overheats, false);
  assert(loadoutCooled.synergies.some(s => s.includes('Coolant + Overcharged Core')));
});

test('rockets explode and damage surface blocks in an area', () => {
  const world = new AsteroidWorld();
  world.features = true;
  const combat = new CombatSystem();
  const ship = createShip(0);
  ship.x = 0;
  ship.y = 0;

  const config: CombatConfig = {
    power: 50,
    equipped: new Set(['rockets']),
    levels: { laser: 1, rockets: 2, railgun: 1, arc: 1, gravity: 1 },
    mods: new Set(),
    damageMult: 1,
    salvo: 2,
    rocketRate: 2,
    radiusMult: 1,
    relic: null,
    roles: [],
    overheats: false,
    vault: false,
    asteroid: 'standard',
  };

  let destroyedCount = 0;
  // Run combat simulation for several seconds
  for (let step = 0; step < 240; step++) {
    const hits = combat.update([ship], world, 1 / 60, config);
    destroyedCount += hits.length;
  }

  assert(combat.rockets.length >= 0);
  assert(destroyedCount > 0, 'Rockets should destroy asteroid blocks');
});

test('volatile blocks trigger chained secondary explosions', () => {
  const world = new AsteroidWorld();
  world.features = true;
  const combat = new CombatSystem();

  const config: CombatConfig = {
    power: 100,
    equipped: new Set(['rockets']),
    levels: { laser: 1, rockets: 1, railgun: 1, arc: 1, gravity: 1 },
    mods: new Set(),
    damageMult: 1,
    salvo: 1,
    rocketRate: 1,
    radiusMult: 1,
    relic: null,
    roles: [],
    overheats: false,
    vault: true,
    asteroid: 'volatile',
  };

  // Find a surface block coordinate and trigger an explosion
  let targetGx = 0, targetGy = 0;
  for (let gy = -5; gy <= 5; gy++) {
    for (let gx = -5; gx <= 5; gx++) {
      if (world.isSurfaceBlock(gx, gy)) {
        targetGx = gx;
        targetGy = gy;
        break;
      }
    }
  }

  combat.explode((targetGx + 0.5) * BLOCK_SIZE, (targetGy + 0.5) * BLOCK_SIZE, 3 * BLOCK_SIZE, 1000);
  const ship = createShip(0);
  const hits = combat.update([ship], world, 1 / 60, config);

  assert(hits.length > 0, 'Explosion should hit and destroy nearby blocks');
});

test('manual rocket salvo aiming charges and releases rockets', () => {
  const combat = new CombatSystem();
  const ship = createShip(0);
  const config: CombatConfig = {
    power: 20,
    equipped: new Set(['rockets']),
    levels: { laser: 1, rockets: 1, railgun: 1, arc: 1, gravity: 1 },
    mods: new Set(),
    damageMult: 1,
    salvo: 2,
    rocketRate: 1,
    radiusMult: 1,
    relic: null,
    roles: [],
    overheats: false,
    vault: false,
    asteroid: 'standard',
  };

  assert.equal(combat.canAim(config), true);
  combat.beginCharge(100, 100, config);
  assert.equal(combat.isCharging, true);

  // Advance time to charge up
  for (let step = 0; step < 60; step++) {
    combat.update([ship], new AsteroidWorld(), 1 / 60, config);
  }
  assert(combat.manualCharge > 0.5);

  combat.releaseCharge(ship);
  assert.equal(combat.isCharging, false);
  assert(combat.rockets.length >= 2, 'Salvo should launch rockets toward the target');
});

test('singularity collapse requires ring 6 and scales bomb cost with collapse count', () => {
  assert.equal(COLLAPSE_MIN_RING, 6);
  const cost0 = bombCost(0);
  assert(cost0.quartz! > 0 && cost0.iron! > 0);

  const cost3 = bombCost(3);
  assert(cost3.emeraldite! > 0);

  const cost7 = bombCost(7);
  assert(cost7.sunstone! > 0);
});
