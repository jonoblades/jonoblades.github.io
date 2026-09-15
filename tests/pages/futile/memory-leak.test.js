// Regression test for the memory leak: BaseClass.addListener records every
// listener in `eventListeners`. With per-tile listeners this grew on every
// render. With delegation it must stay constant.
import { beforeEach, describe, expect, it } from 'vitest';
import { Futile } from '../../../games/futile/futile.js';

describe('event delegation (no listener growth)', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="tileRack"></div>
      <div class="player-area"><div class="player-score"></div></div>
      <div class="player-area"><div class="player-score"></div></div>
      <span id="message"></span>
    `;
  });

  it('keeps eventListeners flat across many renders', async () => {
    const g = new Futile(2, 0);
    await g._ready(); // runs #init -> wires delegated listeners once

    const T = (c, n, id) => ({ id, colour: c, number: n });
    ['a', 'b', 'c', 'd', 'e'].forEach((id, i) => g.players[0].receiveTile(T('blue', i, id)));

    const before = g.eventListeners.length;
    for (let i = 0; i < 100; i++) g.renderAllHands();
    expect(g.eventListeners.length).toBe(before);
  });
});