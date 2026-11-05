import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AsteroidWorld } from '../src/engine/world';
import { ParticleSystem } from '../src/engine/particles';

test('terrain hits do not rebuild textures; mining invalidates adjacent chunks at every active detail level', () => {
  const world = new AsteroidWorld();
  for (const detail of [1, 2, 4]) {
    assert.equal(world.getChunkVersion(-1, 0, detail), 0);
    assert.equal(world.getChunkVersion(0, 0, detail), 0);
    assert.equal(world.getChunkVersion(10, 10, detail), 0);
  }
  world.damageBlock(-1, 5, 0.1);
  assert.equal(world.getChunkVersion(-1, 0), 0);
  world.damageBlock(-1, 5, 1e6);
  for (const detail of [1, 2, 4]) {
    assert(world.getChunkVersion(-1, 0, detail) > 0);
    assert(world.getChunkVersion(0, 0, detail) > 0);
    assert.equal(world.getChunkVersion(10, 10, detail), 0);
  }
  const epoch = world.terrainEpoch;
  world.createSpawnClearing();
  assert(world.terrainEpoch > epoch);
  assert.equal(world.getChunkVersion(-1, 0, 4), 0);
});

test('rapid mining cannot create unbounded visual effects', () => {
  const particles = new ParticleSystem();
  for (let index = 0; index < 1000; index++) {
    particles.spawnBlockShatter(0, 0, '#fff', '#fff', 5);
    particles.spawnThrusterMote(0, 0, 0);
    particles.spawnFloatingText(0, 0, '+1 ore', '#fff');
  }
  assert(particles.particles.length <= 180);
  assert(particles.floatingTexts.length <= 24);
  particles.update(1);
  assert.equal(particles.particles.length, 0);
  assert.equal(particles.floatingTexts.length, 0);
});
