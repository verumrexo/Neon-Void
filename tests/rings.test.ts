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

for (const size of [1, 2, 4]) test(`${size} ships clear rings without skipping rock or duplicating assignments`, () => {
  const world = new AsteroidWorld();
  const engine = new RingMiningEngine();
  const fleet = Array.from({ length: size }, (_, index) => createShip(index));
  let destroyedCount = 0;
  let idle = 0;
  let longestIdle = 0;
  let previousRing = 1;
  for (let frame = 0; frame < 60_000 && engine.ring < 12; frame++) {
    const destroyed = engine.update(fleet, world, 1 / 30, 80, 100, 2, 2);
    for (const block of destroyed) assert.equal(getRingNumber(block.x, block.y), engine.ring);
    destroyedCount += destroyed.length;
    idle = destroyed.length ? 0 : idle + 1;
    longestIdle = Math.max(longestIdle, idle);
    if (engine.ring !== previousRing) {
      for (let y = -20; y <= 20; y++) for (let x = -20; x <= 20; x++) {
        if (getRingNumber(x, y) < engine.ring) assert(world.isMined(x, y));
      }
      previousRing = engine.ring;
    }
    const assignments = fleet.flatMap(ship => ship.ringTarget ? [`${ship.ringTarget.gx},${ship.ringTarget.gy}`] : []);
    assert.equal(new Set(assignments).size, assignments.length);
    for (const ship of fleet) {
      assert(Number.isFinite(ship.x) && Number.isFinite(ship.y));
      assert(world.isMined(Math.floor(ship.x / 26), Math.floor(ship.y / 26)));
      const gx = Math.floor(ship.x / 26), gy = Math.floor(ship.y / 26);
      for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) {
        if (world.isMined(x, y)) continue;
        const nearestX = Math.max(x * 26, Math.min(ship.x, (x + 1) * 26));
        const nearestY = Math.max(y * 26, Math.min(ship.y, (y + 1) * 26));
        assert(Math.hypot(ship.x - nearestX, ship.y - nearestY) >= 10, 'hull overlaps rock');
      }
    }
  }
  assert(engine.ring >= 12);
  assert(destroyedCount > 500);
  assert(longestIdle < 900);
  world.createSpawnClearing();
  engine.update(fleet, world, 1 / 30, 8, 100, 1, 1);
  assert.equal(engine.ring, 1);
});
