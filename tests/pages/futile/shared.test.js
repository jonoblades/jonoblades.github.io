import { describe, it, expect } from 'vitest';
import { isSet, isRun, isValidMeld, compareTiles } from '../../../games/futile/shared.js';

const tile = (colour, number, id = `${colour}-${number}-${Math.random()}`) => ({ id, colour, number });

describe('isSet', () => {
  it('accepts 3+ tiles of the same number', () => {
    expect(isSet([tile('blue', 5), tile('red', 5), tile('green', 5)])).toBe(true);
  });
  it('rejects fewer than 3 tiles', () => {
    expect(isSet([tile('blue', 5), tile('red', 5)])).toBe(false);
  });
  it('rejects mixed numbers', () => {
    expect(isSet([tile('blue', 5), tile('red', 6), tile('green', 5)])).toBe(false);
  });
});

describe('isRun', () => {
  it('accepts consecutive same-colour tiles', () => {
    expect(isRun([tile('blue', 3), tile('blue', 4), tile('blue', 5)])).toBe(true);
  });
  it('accepts an out-of-order but consecutive run', () => {
    expect(isRun([tile('blue', 5), tile('blue', 3), tile('blue', 4)])).toBe(true);
  });
  it('rejects mixed colours', () => {
    expect(isRun([tile('blue', 3), tile('red', 4), tile('blue', 5)])).toBe(false);
  });
  it('rejects a gap', () => {
    expect(isRun([tile('blue', 3), tile('blue', 5), tile('blue', 6)])).toBe(false);
  });
  it('rejects duplicate numbers', () => {
    expect(isRun([tile('blue', 3), tile('blue', 3), tile('blue', 4)])).toBe(false);
  });
});

describe('isValidMeld', () => {
  it('is true for a set or a run', () => {
    expect(isValidMeld([tile('blue', 2), tile('red', 2), tile('amber', 2)])).toBe(true);
    expect(isValidMeld([tile('green', 7), tile('green', 8), tile('green', 9)])).toBe(true);
  });
});

describe('compareTiles', () => {
  it('orders by number, then colour, then id', () => {
    const a = tile('red', 2, 'a');
    const b = tile('blue', 2, 'b');
    const c = tile('blue', 3, 'c');
    const sorted = [c, a, b].sort(compareTiles);
    expect(sorted.map((t) => t.id)).toEqual(['b', 'a', 'c']);
  });
});
