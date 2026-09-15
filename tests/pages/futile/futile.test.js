import { afterEach, describe, it, expect, vi } from 'vitest';
import { Futile } from '../../../games/futile/futile.js';
import { AIPlayer } from '../../../games/futile/ai-player.js';
import { Deck } from '../../../games/futile/deck.js';
import { Player } from '../../../games/futile/player.js';

// Plain tile objects with deterministic ids.
const T = (colour, number, id) => ({ id, colour, number });

// The BaseClass test-double (test/mocks/BaseClass.js, aliased in vitest.config.js)
// does NOT auto-run the ready callback, so a constructed Futile stays un-started
// and we can configure players/hands directly.

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
  document.body.innerHTML = '';
});

function futileMarkup(playerCount = 4) {
  return `
    <div id="tileRack"></div>
    <button id="meldButton" type="button"></button>
    <button id="passButton" type="button"></button>
    <button id="helpBtn" type="button"></button>
    <dialog id="helpDialog"><button id="closeHelp" type="button"></button></dialog>
    <button id="SettingsButton" class="hidden" type="button"></button>
    <dialog id="settingsDialog">
      ${[2, 3, 4].map((count) => `<input type="radio" name="playerCount" value="${count}">`).join('')}
      ${['easy', 'medium', 'hard'].map((level) => `<input type="radio" name="difficulty" value="${level}">`).join('')}
      <button id="closeSettings" type="button"></button>
    </dialog>
    <span id="message"></span>
    ${Array.from({ length: playerCount }, () => `
      <section class="player-area">
        <div class="player-hand"><game-tile></game-tile></div>
        <span class="player-score"></span>
      </section>
    `).join('')}
  `;
}

describe('Deck', () => {
  it('creates a full unique draw pile and exhausts cleanly', () => {
    const deck = new Deck();
    const drawn = [];

    while (deck.size > 0) drawn.push(deck.draw());

    expect(drawn).toHaveLength(80);
    expect(new Set(drawn.map((tile) => tile.id)).size).toBe(80);
    expect(deck.size).toBe(0);
    expect(deck.draw()).toBeUndefined();
  });
});

describe('Player', () => {
  it('sorts, removes, validates melds, updates score, and renders played melds', async () => {
    const player = new Player(2);
    player.receiveTile(T('red', 3, 'r3'));
    player.receiveTile(T('blue', 1, 'b1'));
    player.receiveTile(T('green', 2, 'g2'));

    expect(player.hand.map((tile) => tile.id)).toEqual(['b1', 'g2', 'r3']);
    expect(player.removeTileById('missing')).toBeNull();
    expect(player.removeTileById('g2')).toMatchObject({ id: 'g2' });
    expect(await player.addMeld([])).toBe(false);
    expect(await player.addMeld([T('blue', 1, 'm1'), T('red', 2, 'm2')])).toBe(false);
    expect(await player.addMeld([T('blue', 4, 'm1'), T('red', 4, 'm2'), T('green', 4, 'm3')])).toBe(true);
    expect(await player.updateMeld(-1, [T('amber', 4, 'bad')])).toBe(false);
    expect(await player.updateMeld(0, [])).toBe(false);
    expect(await player.updateMeld(0, [T('amber', 4, 'm4')])).toBe(true);
    expect(await player.removeTilesFromMeld(99, ['m1'])).toBe(false);
    expect(await player.removeTilesFromMeld(0, ['m4'])).toBe(true);
    expect(player.computeScore()).toBe(8);

    const area = document.createElement('section');
    area.innerHTML = '<div class="player-hand"><game-tile></game-tile></div><span class="player-score"></span>';
    player.score = 10;
    player.render(area, 2, {
      isCurrent: true,
      selection: { hasMeldTile: (id) => id === 'm1' },
    });

    expect(area.classList.contains('active')).toBe(true);
    expect(area.querySelector('.player-hand game-tile').value).toBe('x2');
    expect(area.querySelector('.player-score').textContent).toBe('10');
    expect(area.querySelectorAll('.meld game-tile[data-owner="2"][data-meld-idx="0"]')).toHaveLength(3);
    expect(area.querySelector('game-tile[data-id="m1"]').getAttribute('aria-pressed')).toBe('true');
    expect(area.querySelector('.meld-add').dataset.owner).toBe('2');

    expect(() => player.render(null, 2, { selection: { hasMeldTile: () => false }, isCurrent: false })).not.toThrow();
  });
});

describe('Futile UI wiring', () => {
  it('loads settings, wires dialogs, validates passing, delegates rack clicks, and tears down listeners', async () => {
    vi.useFakeTimers();
    localStorage.setItem('futile_settings', JSON.stringify({ playerCount: 4, difficulty: 'hard' }));
    document.body.innerHTML = futileMarkup();
    document.getElementById('helpDialog').showModal = vi.fn();
    document.getElementById('helpDialog').close = vi.fn();
    document.getElementById('settingsDialog').showModal = vi.fn();
    document.getElementById('settingsDialog').close = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const g = new Futile(9, 0);
    await g._ready();

    expect(g.humanPlayer).toBe(0);
    expect(g.difficulty).toBe('hard');
    expect(document.querySelector('input[name="playerCount"][value="4"]').checked).toBe(true);
    expect(document.querySelector('input[name="difficulty"][value="hard"]').checked).toBe(true);
    expect(document.getElementById('message').getAttribute('role')).toBe('status');
    expect(document.querySelectorAll('.player-area.show')).toHaveLength(4);
    expect(document.getElementById('SettingsButton').classList.contains('hidden')).toBe(false);

    document.getElementById('helpBtn').click();
    expect(document.getElementById('helpDialog').showModal).toHaveBeenCalledOnce();
    document.getElementById('closeHelp').click();
    document.getElementById('helpDialog').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.getElementById('helpDialog').close).toHaveBeenCalledTimes(2);

    document.getElementById('SettingsButton').click();
    expect(document.getElementById('settingsDialog').showModal).toHaveBeenCalledOnce();
    document.querySelector('input[name="difficulty"][value="easy"]').checked = true;
    document.getElementById('closeSettings').click();
    expect(g.difficulty).toBe('easy');
    expect(JSON.parse(localStorage.getItem('futile_settings'))).toMatchObject({ playerCount: 4, difficulty: 'easy' });

    document.getElementById('passButton').click();
    expect(document.getElementById('message').textContent).toContain('Select exactly one tile');

    const firstRackTile = document.querySelector('#tileRack game-tile[data-id]');
    firstRackTile.click();
    expect(firstRackTile.hasAttribute('selected')).toBe(false);
    expect(document.querySelector('#tileRack game-tile[selected]')).toBeTruthy();
    document.getElementById('passButton').click();
    expect(g.currentPlayer).toBe(1);
    expect(document.querySelector('#tileRack game-tile[aria-hidden="true"]')).toBeTruthy();

    g.saveSettings();
    g.tearDown();
    const listenerCount = g.eventListeners.length;
    document.getElementById('passButton').click();
    expect(g.eventListeners).toHaveLength(listenerCount);
    expect(warn).not.toHaveBeenCalledWith(expect.stringContaining('AI suppressed message:'), expect.anything());
  });

  it('changes player count from settings controls and hides inactive player areas', async () => {
    vi.useFakeTimers();
    document.body.innerHTML = futileMarkup();
    const g = new Futile(2, 0);
    await g._ready();

    const threePlayers = document.querySelector('input[name="playerCount"][value="3"]');
    threePlayers.checked = true;
    threePlayers.dispatchEvent(new Event('change', { bubbles: true }));

    expect(g.players).toHaveLength(3);
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem('futile_settings'))).toMatchObject({ playerCount: 3 }));
    expect([...document.querySelectorAll('.player-area')].map((area) => area.style.display))
      .toEqual(['', '', '', 'none']);
  });
});

describe('createMeld', () => {
  it('plays a valid set from the hand', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 0;
    const p = g.players[0];
    ['a', 'b', 'c'].forEach((id, i) => p.receiveTile(T(['blue', 'red', 'green'][i], 5, id)));
    const res = await g.createMeld({ handTileIds: ['a', 'b', 'c'] });
    expect(res).toEqual({ ok: true });
    expect(p.playedMelds).toHaveLength(1);
    expect(p.hand).toHaveLength(0);
    expect(p.hasPlayedMeld).toBe(true);
  });

  it('rejects an invalid combination with a reason', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 0;
    const p = g.players[0];
    p.receiveTile(T('blue', 1, 'a'));
    p.receiveTile(T('red', 2, 'b'));
    const res = await g.createMeld({ handTileIds: ['a', 'b'] });
    expect(res).toEqual({ ok: false, reason: 'invalid-meld' });
    expect(p.playedMelds).toHaveLength(0);
  });
});

describe('stealing (unified createMeld path)', () => {
  it('steals a tile and rebuilds both melds', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 1;
    const victim = g.players[0];
    await victim.addMeld([
      T('blue', 4, 'x1'),
      T('blue', 5, 'x2'),
      T('blue', 6, 'x3'),
      T('blue', 7, 'x4'),
    ]);
    const thief = g.players[1];
    thief.receiveTile(T('blue', 1, 'h1'));
    thief.receiveTile(T('blue', 2, 'h2'));
    thief.receiveTile(T('blue', 3, 'h3'));

    const res = await g.createMeld({ handTileIds: ['h1', 'h2', 'h3'], meldTileIds: ['x1'] });
    expect(res.ok).toBe(true);
    expect(victim.playedMelds[0].map((t) => t.number)).toEqual([5, 6, 7]);
    expect(thief.playedMelds[0].map((t) => t.number)).toEqual([1, 2, 3, 4]);
  });

  it('refuses a steal that would break the source meld', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 1;
    const victim = g.players[0];
    await victim.addMeld([T('blue', 4, 'x1'), T('blue', 5, 'x2'), T('blue', 6, 'x3')]);
    const thief = g.players[1];
    thief.receiveTile(T('red', 4, 'h1'));
    thief.receiveTile(T('green', 4, 'h2'));
    const res = await g.createMeld({ handTileIds: ['h1', 'h2'], meldTileIds: ['x2'] });
    expect(res).toEqual({ ok: false, reason: 'source-invalid' });
    expect(victim.playedMelds[0]).toHaveLength(3);
  });

  it('requires at least one hand tile when stealing', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 1;
    const victim = g.players[0];
    await victim.addMeld([T('blue', 4, 'x1'), T('blue', 5, 'x2'), T('blue', 6, 'x3')]);
    const res = await g.createMeld({ handTileIds: [], meldTileIds: ['x1', 'x2', 'x3'] });
    expect(res).toEqual({ ok: false, reason: 'need-hand-tile' });
  });
});

describe('addToMeld', () => {
  it('extends a run', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 0;
    const p = g.players[0];
    await p.addMeld([T('green', 3, 'm1'), T('green', 4, 'm2'), T('green', 5, 'm3')]);
    p.receiveTile(T('green', 6, 'h1'));
    const res = await g.addToMeld({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h1'] });
    expect(res.ok).toBe(true);
    expect(p.playedMelds[0].map((t) => t.number)).toEqual([3, 4, 5, 6]);
  });

  it('rejects adding before the player has played a meld', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 1;
    const victim = g.players[0];
    await victim.addMeld([T('red', 1, 'm1'), T('red', 2, 'm2'), T('red', 3, 'm3')]);
    g.players[1].receiveTile(T('red', 4, 'h1'));
    const res = await g.addToMeld({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h1'] });
    expect(res).toEqual({ ok: false, reason: 'not-played' });
  });

  it('returns specific reasons for invalid add destinations', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 0;
    const p = g.players[0];
    await p.addMeld([T('red', 3, 'r1'), T('red', 4, 'r2'), T('red', 5, 'r3')]);

    expect(await g.addToMeld({ targetOwner: 9, targetMeldIdx: 0, handTileIds: [] }))
      .toEqual({ ok: false, reason: 'empty' });

    p.receiveTile(T('blue', 9, 'h1'));
    expect(await g.addToMeld({ targetOwner: 9, targetMeldIdx: 0, handTileIds: ['h1'] }))
      .toEqual({ ok: false, reason: 'no-dest' });

    expect(await g.addToMeld({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h1'] }))
      .toEqual({ ok: false, reason: 'dest-colour' });

    p.receiveTile(T('red', 4, 'h2'));
    expect(await g.addToMeld({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h2'] }))
      .toEqual({ ok: false, reason: 'dest-duplicate' });

    p.receiveTile(T('red', 8, 'h3'));
    expect(await g.addToMeld({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h3'] }))
      .toEqual({ ok: false, reason: 'dest-gap' });
  });

  it('rejects number mismatches when adding to a set', async () => {
    const g = new Futile(2, 0);
    g.currentPlayer = 0;
    const p = g.players[0];
    await p.addMeld([T('blue', 7, 'm1'), T('red', 7, 'm2'), T('green', 7, 'm3')]);
    p.receiveTile(T('amber', 8, 'h1'));

    expect(await g.addToMeld({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h1'] }))
      .toEqual({ ok: false, reason: 'dest-number' });
  });
});

describe('checkForWin', () => {
  it('is false while every player holds tiles', () => {
    const g = new Futile(2, 0);
    g.players[0].receiveTile(T('blue', 1, 'a'));
    g.players[1].receiveTile(T('red', 2, 'b'));
    expect(g.checkForWin()).toBe(false);
  });

  it('is true once a hand is empty', () => {
    const g = new Futile(2, 0);
    g.players[1].receiveTile(T('red', 2, 'b')); // player 0 stays empty
    expect(g.checkForWin()).toBe(true);
  });
});

describe('AIPlayer drives the public API', () => {
  it('plays a direct meld and passes the turn', async () => {
    const g = new Futile(2, 0);
    g.difficulty = 'hard';
    g.currentPlayer = 1;
    const ai = g.players[1];
    ['a', 'b', 'c'].forEach((id, i) => ai.receiveTile(T(['blue', 'red', 'green'][i], 7, id)));
    ai.receiveTile(T('blue', 0, 'spare')); // avoid an instant win
    g.players[0].receiveTile(T('blue', 1, 'z'));

    await new AIPlayer(1).takeTurn(g);

    expect(ai.playedMelds[0].map((t) => t.number)).toEqual([7, 7, 7]);
    expect(g.currentPlayer).toBe(0);
  });

  it('passes the lowest tile when it cannot play a meld', async () => {
    vi.useFakeTimers();
    const game = {
      difficulty: 'easy',
      players: [new Player(0), new Player(1)],
      endTurn: vi.fn(),
    };
    game.players[1].receiveTile(T('red', 3, 'r3'));
    game.players[1].receiveTile(T('blue', 1, 'b1'));

    const turn = new AIPlayer(1).takeTurn(game);
    await vi.runAllTimersAsync();
    await turn;

    expect(game.endTurn).toHaveBeenCalledWith('b1');
  });

  it('extends existing melds before passing on medium difficulty', async () => {
    vi.useFakeTimers();
    const game = {
      difficulty: 'medium',
      players: [new Player(0), new Player(1)],
      addToMeld: vi.fn().mockResolvedValue({ ok: true }),
      checkForWin: vi.fn(),
      endTurn: vi.fn(),
    };
    await game.players[0].addMeld([T('green', 3, 'm1'), T('green', 4, 'm2'), T('green', 5, 'm3')]);
    await game.players[1].addMeld([T('red', 1, 'own1'), T('red', 2, 'own2'), T('red', 3, 'own3')]);
    game.players[1].receiveTile(T('green', 6, 'h1'));

    const turn = new AIPlayer(1).takeTurn(game);
    await vi.runAllTimersAsync();
    await turn;

    expect(game.addToMeld).toHaveBeenCalledWith({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h1'] });
    expect(game.checkForWin).toHaveBeenCalled();
    expect(game.endTurn).toHaveBeenCalledWith('h1');
  });

  it('skips unavailable extensions and can pass with no tile', async () => {
    vi.useFakeTimers();
    const game = {
      difficulty: 'medium',
      players: [new Player(0), new Player(1)],
      addToMeld: vi.fn().mockResolvedValue({ ok: false }),
      checkForWin: vi.fn(),
      endTurn: vi.fn(),
    };
    await game.players[0].addMeld([T('blue', 5, 's1'), T('red', 5, 's2'), T('green', 5, 's3')]);
    await game.players[0].addMeld([T('amber', 1, 'r1'), T('amber', 2, 'r2'), T('amber', 3, 'r3')]);
    await game.players[1].addMeld([T('red', 1, 'own1'), T('red', 2, 'own2'), T('red', 3, 'own3')]);

    const turn = new AIPlayer(1).takeTurn(game);
    await vi.runAllTimersAsync();
    await turn;

    expect(game.addToMeld).not.toHaveBeenCalled();
    expect(game.checkForWin).not.toHaveBeenCalled();
    expect(game.endTurn).toHaveBeenCalledWith(null);
  });

  it('continues after a failed extension attempt', async () => {
    vi.useFakeTimers();
    const game = {
      difficulty: 'medium',
      players: [new Player(0), new Player(1)],
      addToMeld: vi.fn().mockResolvedValue({ ok: false }),
      checkForWin: vi.fn(),
      endTurn: vi.fn(),
    };
    await game.players[0].addMeld([T('green', 3, 'm1'), T('green', 4, 'm2'), T('green', 5, 'm3')]);
    await game.players[1].addMeld([T('red', 1, 'own1'), T('red', 2, 'own2'), T('red', 3, 'own3')]);
    game.players[1].receiveTile(T('green', 6, 'h1'));

    const turn = new AIPlayer(1).takeTurn(game);
    await vi.runAllTimersAsync();
    await turn;

    expect(game.addToMeld).toHaveBeenCalledWith({ targetOwner: 0, targetMeldIdx: 0, handTileIds: ['h1'] });
    expect(game.checkForWin).not.toHaveBeenCalled();
    expect(game.endTurn).toHaveBeenCalledWith('h1');
  });

  it('steals a tile on hard difficulty when it improves the best meld', async () => {
    vi.useFakeTimers();
    const game = {
      difficulty: 'hard',
      players: [new Player(0), new Player(1)],
      createMeld: vi.fn().mockResolvedValue({ ok: true }),
      checkForWin: vi.fn(),
      endTurn: vi.fn(),
    };
    await game.players[0].addMeld([
      T('blue', 3, 'x1'),
      T('blue', 4, 'x2'),
      T('blue', 5, 'x3'),
      T('blue', 6, 'x4'),
    ]);
    game.players[1].receiveTile(T('blue', 1, 'h1'));
    game.players[1].receiveTile(T('blue', 2, 'h2'));
    game.players[1].receiveTile(T('red', 9, 'h3'));

    const turn = new AIPlayer(1).takeTurn(game);
    await vi.runAllTimersAsync();
    await turn;

    expect(game.createMeld).toHaveBeenCalledWith({ handTileIds: ['h1', 'h2'], meldTileIds: ['x1'] });
    expect(game.checkForWin).toHaveBeenCalled();
    expect(game.endTurn).toHaveBeenCalledWith('h1');
  });
});
