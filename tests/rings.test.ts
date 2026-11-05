import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AsteroidWorld, getRingHardness, getRingNumber, getDepthColor } from '../src/engine/world';
import { RingMiningEngine, createShip } from '../src/engine/physics';

test('ship directions alternate and rock hardness compounds every five rings', () => {
  assert.deepEqual([0, 1, 2, 3].map(index => createShip(index).sweepDirection), [1, -1, 1, -1]);
  assert.equal(getRingHardness(1), 1);
  assert.equal(getRingHardness(5), 1);
  assert.equal(getRingHardness(6), 1.2);
  assert.equal(getRingHardness(11), 1.44);
  assert.notEqual(getDepthColor(5), getDepthColor(6));
  const world = new AsteroidWorld();
  const base = { basalt: 8, iron: 14, quartz: 25, emeraldite: 45, voidOre: 95, sunstone: 220, stardust: 0 };
  for (const depth of [4, 8, 14, 28, 100]) {
    const block = world.getBlock(depth, 0)!;
    assert.equal(block.maxHp, Math.ceil(base[block.type] * getRingHardness(getRingNumber(depth, 0))));
  }
});

for (const size of [1, 2, 4]) test(`${size} ships circle continuously while mining without jumping or crossing solid rock`, () => {
  const world = new AsteroidWorld();
  const engine = new RingMiningEngine();
  const fleet = Array.from({ length: size }, (_, index) => createShip(index));
  let destroyedCount = 0, moving = 0;
  for (let frame = 0; frame < 12_000; frame++) {
    const before = fleet.map(ship => ({ x: ship.x, y: ship.y }));
    const destroyed = engine.update(fleet, world, 1 / 60, 80, 100, 2, 2);
    destroyedCount += destroyed.length;
    for (const [index, ship] of fleet.entries()) {
      const distance = Math.hypot(ship.x - before[index].x, ship.y - before[index].y);
      assert(distance <= 116 / 60 + 1e-8, 'ship jumped or teleported');
      if (distance > 0.005) moving++;
      assert(Number.isFinite(ship.x) && Number.isFinite(ship.y));
      const gx = Math.floor(ship.x / 26), gy = Math.floor(ship.y / 26);
      for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) {
        if (world.isMined(x, y)) continue;
        const nearestX = Math.max(x * 26, Math.min(ship.x, (x + 1) * 26));
        const nearestY = Math.max(y * 26, Math.min(ship.y, (y + 1) * 26));
        assert(Math.hypot(ship.x - nearestX, ship.y - nearestY) >= 10, 'hull overlaps rock');
      }
    }
  }
  assert(destroyedCount > 50, `mining stalled: ${destroyedCount}`);
  assert(moving > 12_000 * size * 0.8, 'ships stopped to wait for targets');
  assert(engine.ring > 2);
});

test('bees keep flying while unbreakable ore remains in range', () => {
  const world = new AsteroidWorld();
  const engine = new RingMiningEngine();
  const ship = createShip();
  let moving = 0, mining = 0;
  for (let frame = 0; frame < 2400; frame++) {
    const x = ship.x, y = ship.y;
    engine.update([ship], world, 1 / 60, 0, 100, 1, 1);
    if (Math.hypot(ship.x - x, ship.y - y) > 0.005) moving++;
    if (ship.miningTargets.length) mining++;
  }
  assert(moving > 2200, `moving frames: ${moving}`);
  assert(mining > 2200);
  assert.equal(world.minedBlocks.size, 21);
});

test('multiple beams can work across exposed neighboring depth rings', () => {
  const world = new AsteroidWorld();
  const engine = new RingMiningEngine();
  const ship = createShip();
  let overlapping = false;
  for (let frame = 0; frame < 3600; frame++) {
    engine.update([ship], world, 1 / 60, 80, 150, 3, 1);
    const depths = new Set(ship.miningTargets.map(target => getRingNumber(target.gx, target.gy)));
    if (depths.size > 1) overlapping = true;
  }
  assert(overlapping, 'beams were unnecessarily restricted to one ring');
});

test('mining stays within the moving angular sector and advances outward without resetting its angle', () => {
  const world = new AsteroidWorld();
  const engine = new RingMiningEngine();
  const ship = createShip();
  let expanded = false;
  for (let frame = 0; frame < 18000; frame++) {
    const oldRadius = ship.orbitRadius, oldAngle = ship.workAngle;
    engine.update([ship], world, 1 / 60, 100, 150, 2, 2);
    assert(ship.workAngle >= oldAngle);
    assert(ship.workAngle - oldAngle < 0.1);
    if (ship.orbitRadius > oldRadius) {
      assert.equal(ship.orbitRadius - oldRadius, 26);
      expanded = true;
    }
    for (const target of ship.miningTargets) {
      const angle = Math.atan2(target.gy, target.gx);
      const offset = Math.atan2(Math.sin(angle - ship.workAngle), Math.cos(angle - ship.workAngle));
      assert(Math.abs(offset) <= 0.85 + 1e-8);
    }
  }
  assert(expanded, 'work zone never finished a lap');
});
