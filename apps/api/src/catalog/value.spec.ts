import assert from 'node:assert/strict';
import { test } from 'node:test';
import { computeValue } from './value';

test('cheaper and better beats a model; unranked models are not judged', () => {
  const r = computeValue([
    { id: 'a', price: 0.05, elo: 1100 },
    { id: 'b', price: 0.1, elo: 1050 }, // dearer and worse than a
    { id: 'c', price: 0.2, elo: 1200 }, // dearer but better: stays on the line
    { id: 'd', price: 0.01, elo: null },
  ]);
  assert.deepEqual(r.get('a'), { bestValue: true, beatenBy: null });
  assert.deepEqual(r.get('b'), { bestValue: false, beatenBy: 'a' });
  assert.deepEqual(r.get('c'), { bestValue: true, beatenBy: null });
  assert.deepEqual(r.get('d'), { bestValue: null, beatenBy: null });
});

test('same price and same score do not beat each other', () => {
  const r = computeValue([
    { id: 'a', price: 0.05, elo: 1100 },
    { id: 'b', price: 0.05, elo: 1100 },
  ]);
  assert.equal(r.get('a')!.bestValue, true);
  assert.equal(r.get('b')!.bestValue, true);
});

test('equal price but higher score beats; beatenBy is the highest scorer', () => {
  const r = computeValue([
    { id: 'low', price: 0.08, elo: 949 },
    { id: 'mid', price: 0.07, elo: 1000 },
    { id: 'top', price: 0.08, elo: 1134 },
  ]);
  assert.deepEqual(r.get('low'), { bestValue: false, beatenBy: 'top' });
});
