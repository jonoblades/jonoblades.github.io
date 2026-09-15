import { describe, it, expect, beforeEach } from 'vitest';
import { Selection } from '../../../games/futile/selection.js';

describe('Selection', () => {
  let sel;
  beforeEach(() => {
    sel = new Selection();
  });

  it('toggles hand tiles on and off', () => {
    sel.toggleHand('t1');
    expect(sel.hasHand('t1')).toBe(true);
    expect(sel.handCount).toBe(1);
    sel.toggleHand('t1');
    expect(sel.hasHand('t1')).toBe(false);
    expect(sel.handCount).toBe(0);
  });

  it('stores a meld tile with its location', () => {
    sel.toggleMeldTile('t2', 3, 1);
    expect(sel.hasMeldTile('t2')).toBe(true);
    expect(sel.locate('t2')).toEqual({ owner: 3, meldIdx: 1 });
    expect(sel.meldTileIds).toEqual(['t2']);
  });

  it('removes a meld tile when it is selected again', () => {
    sel.toggleMeldTile('t2', 3, 1);
    sel.toggleMeldTile('t2', 3, 1);

    expect(sel.hasMeldTile('t2')).toBe(false);
    expect(sel.meldTileCount).toBe(0);
  });

  it('returns null when locating an unselected tile', () => {
    expect(sel.locate('nope')).toBeNull();
  });

  it('tracks a destination meld', () => {
    sel.setDest(2, 4);
    expect(sel.dest).toEqual({ owner: 2, meldIdx: 4 });
  });

  it('clear() resets everything', () => {
    sel.toggleHand('t1');
    sel.toggleMeldTile('t2', 0, 0);
    sel.setDest(1, 1);
    sel.clear();
    expect(sel.isEmpty()).toBe(true);
    expect(sel.dest).toBeNull();
  });
});
