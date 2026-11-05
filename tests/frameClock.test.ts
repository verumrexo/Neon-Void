import assert from 'node:assert/strict';
import { test } from 'node:test';
import { FixedStepClock, SIMULATION_STEP } from '../src/engine/frameClock';

for (const hz of [30, 60, 90, 120, 144]) test(`simulation preserves elapsed time on a ${hz} Hz display`, () => {
  const clock = new FixedStepClock();
  let steps = 0;
  let simulated = 0;
  clock.advance(0, () => {});
  for (let frame = 1; frame <= hz * 10; frame++) {
    const sample = clock.advance(frame * 1000 / hz, dt => { steps++; simulated += dt; });
    assert(sample.alpha >= 0 && sample.alpha <= 1);
  }
  assert.equal(steps, 600);
  assert(Math.abs(simulated - 10) < 1e-8);
});

test('interpolated movement advances on every 120 Hz display frame', () => {
  const clock = new FixedStepClock();
  let previous = 0, current = 0, rendered = -1, changes = 0;
  clock.advance(0, () => {});
  for (let frame = 1; frame <= 240; frame++) {
    const { alpha } = clock.advance(frame * 1000 / 120, dt => { previous = current; current += 60 * dt; });
    const next = previous + (current - previous) * alpha;
    if (next > rendered + 1e-8) changes++;
    rendered = next;
  }
  assert(changes >= 239);
});

test('stalls have bounded catch-up and visibility resets discard background time', () => {
  const clock = new FixedStepClock();
  let steps = 0;
  clock.advance(0, () => {});
  clock.advance(60_000, () => { steps++; });
  assert.equal(steps, 6);
  clock.reset();
  clock.advance(120_000, () => { steps++; });
  assert.equal(steps, 6);
  clock.advance(120_000 + SIMULATION_STEP * 1000, () => { steps++; });
  assert.equal(steps, 7);
});
