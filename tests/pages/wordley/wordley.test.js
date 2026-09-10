import { beforeEach, describe, expect, it, vi } from 'vitest';

const definitionsService = vi.hoisted(() => ({
  getWords: vi.fn(),
  validateWord: vi.fn(),
  fetchDefinition: vi.fn(),
}));

vi.mock('/scripts/DefinitionsService.js', () => ({
  default: definitionsService,
}));

function pageMarkup() {
  return `
    <dialog id="settingsDialog"></dialog>
    <button id="closeSettings" type="button"></button>
    <select id="lengthSelect"><option value="5">5</option><option value="6">6</option></select>
    <select id="timerSelect"><option value="0">None</option><option value="15">15</option></select>
    <input type="radio" name="playerCount" value="1" checked>
    <input type="radio" name="playerCount" value="2">
    <button id="SettingsButton" class="hidden" type="button"></button>
    <section id="board"><div id="turnIndicator"></div></section>
    <form id="guessForm">
      ${[0, 1, 2, 3, 4, 5].map(index => `<input class="guess-letter" index="${index}">`).join('')}
      <button type="submit" id="submitGuess"></button>
    </form>
    <button id="resetGame" type="button"></button>
    <nav id="alphaLeft"></nav><nav id="alphaRight"></nav>
    <div id="message"></div><span id="lengthValue"></span>
    <template id="RowTemplate"><div class="row"><div class="tiles">${[0, 1, 2, 3, 4, 5].map(index => `<game-tile class="letter${index + 1}" index="${index}"></game-tile>`).join('')}</div></div></template>
  `;
}

async function loadWordley() {
  vi.resetModules();
  const addEventListener = vi.spyOn(document, 'addEventListener');
  const module = await import('../../../games/wordley/wordley.js');
  const listeners = addEventListener.mock.calls.map(([, listener]) => listener);
  const initialize = listeners.at(-1);
  const loadSettings = listeners.at(-2);
  addEventListener.mockRestore();
  return { initialize, loadSettings, Wordley: module.Wordley };
}

async function initializePage({ initialize, loadSettings }) {
  loadSettings?.();
  await initialize();
  await vi.waitFor(() => expect(document.querySelectorAll('#board .row').length).toBeGreaterThan(0));
}

async function enterGuess(word) {
  [...document.querySelectorAll('.guess-letter')].forEach((input, index) => {
    input.value = word[index] || '';
  });
  document.getElementById('guessForm').dispatchEvent(
    new Event('submit', { bubbles: true, cancelable: true }),
  );
  await Promise.resolve();
  await Promise.resolve();
}

describe('Wordley page', () => {
  beforeEach(() => {
    document.body.innerHTML = pageMarkup();
    localStorage.clear();
    definitionsService.getWords.mockImplementation(async (length) => (
      length === 6 ? new Set(['planet']) : new Set(['cigar', 'arise', 'crane'])
    ));
    definitionsService.validateWord.mockImplementation(async (word) => (
      ['cigar', 'arise', 'crane', 'planet'].includes(word)
    ));
    definitionsService.fetchDefinition.mockResolvedValue(null);
    vi.spyOn(Math, 'random').mockReturnValue(0);
  });

  it('builds the board, alphabet, and initial game state', async () => {
    const initialize = await loadWordley();
    await initializePage(initialize);

    expect(document.querySelectorAll('#board .row')).toHaveLength(6);
    expect(document.querySelectorAll('.alpha-tile')).toHaveLength(26);
    expect(document.getElementById('message').textContent).toBe('6 guesses remaining');
    expect(document.getElementById('lengthValue').textContent).toBe('5');
    expect(document.activeElement).toBe(document.getElementById('guessForm').querySelector('.guess-letter'));
  });

  it('rejects incomplete and disallowed guesses with useful messages', async () => {
    const initialize = await loadWordley();
    await initializePage(initialize);
    const inputs = [...document.querySelectorAll('.guess-letter')];
    inputs[0].value = 'c';
    document.getElementById('guessForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById('message').textContent).toBe('Enter a 5-letter word.');

    inputs.forEach((input) => { input.value = 'x'; });
    document.getElementById('guessForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    expect(document.getElementById('message').textContent).toBe('Word not in list.');
  });

  it('scores a winning guess and disables the game', async () => {
    const initialize = await loadWordley();
    await initializePage(initialize);
    const inputs = [...document.querySelectorAll('.guess-letter')];
    ['c', 'i', 'g', 'a', 'r'].forEach((value, index) => { inputs[index].value = value; });

    document.getElementById('guessForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(document.getElementById('message').textContent).toContain('You win!'));

    expect(document.getElementById('submitGuess').disabled).toBe(true);
  });

  it('persists length and timer settings from the settings controls', async () => {
    const initialize = await loadWordley();
    await initializePage(initialize);

    const lengthSelect = document.getElementById('lengthSelect');
    lengthSelect.value = '6';
    definitionsService.getWords.mockResolvedValue(new Set(['planet']));
    lengthSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById('lengthValue').textContent).toBe('6'));

    const timerSelect = document.getElementById('timerSelect');
    timerSelect.value = '15';
    timerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    timerSelect.value = '0';
    timerSelect.dispatchEvent(new Event('change', { bubbles: true }));

    expect(JSON.parse(localStorage.getItem('wordley_settings'))).toMatchObject({
      wordLength: 6,
      timerDuration: 0,
      playerCount: 1
    });

    lengthSelect.value = '0';
    lengthSelect.dispatchEvent(new Event('change', { bubbles: true }));
    await vi.waitFor(() => expect(document.getElementById('lengthValue').textContent).toBe('5'));
  });

  it('restores saved word length, timer, and player settings', async () => {
    localStorage.setItem('wordley_settings', JSON.stringify({
      wordLength: 6,
      timerDuration: 15,
      playerCount: 2
    }));
    definitionsService.getWords.mockResolvedValue(new Set(['planet']));

    const initialize = await loadWordley();
    await initializePage(initialize);

    expect(document.getElementById('lengthSelect').value).toBe('6');
    expect(document.getElementById('timerSelect').value).toBe('15');
    expect(document.querySelector('input[value="2"]').checked).toBe(true);
    expect(document.querySelectorAll('#board .row')).toHaveLength(10);
    expect(document.getElementById('turnIndicator').textContent).toBe("Player 1's turn");
  });

  it('leaves timer controls unchanged when no timer setting was saved', async () => {
    localStorage.setItem('wordley_settings', JSON.stringify({ wordLength: 5 }));
    const initialize = await loadWordley();
    await initializePage(initialize);

    expect(document.getElementById('timerSelect').value).toBe('0');
  });

  it('scores correct, present, and absent letters and advances a two-player turn', async () => {
    localStorage.setItem('wordley_settings', JSON.stringify({ playerCount: 2 }));
    const initialize = await loadWordley();
    await initializePage(initialize);

    await enterGuess('crane');
    const tiles = [...document.querySelectorAll('.row[data-row="0"] .tiles game-tile')];

    expect(tiles.slice(0, 5).map(tile => tile.status)).toEqual([
      'correct', 'present', 'present', 'absent', 'absent'
    ]);
    expect(document.querySelector('.row[data-row="0"]').classList.contains('player-1')).toBe(true);
    expect(document.getElementById('turnIndicator').textContent).toBe("Player 2's turn");
    expect(document.getElementById('turnIndicator').classList.contains('player-2')).toBe(true);
    await enterGuess('crane');
    expect(document.getElementById('turnIndicator').textContent).toBe("Player 1's turn");
  });

  it('shows the singular remaining-guess message after five valid guesses', async () => {
    const initialize = await loadWordley();
    await initializePage(initialize);

    for (let guess = 0; guess < 5; guess++) {
      await enterGuess('crane');
    }

    expect(document.getElementById('message').textContent).toBe('1 guess remaining');
  });

  it('handles a Player 2 win after the turn changes', async () => {
    localStorage.setItem('wordley_settings', JSON.stringify({ playerCount: 2 }));
    const initialize = await loadWordley();
    await initializePage(initialize);

    await enterGuess('crane');
    await enterGuess('cigar');

    await vi.waitFor(() => expect(document.getElementById('message').textContent).toContain('You win!'));
    expect(document.getElementById('turnIndicator').textContent).toBe('Player 2 wins!');
    expect(document.getElementById('turnIndicator').classList.contains('player-2')).toBe(true);
  });

  it('does not downgrade an existing alphabet status for repeated letters', async () => {
    definitionsService.getWords.mockResolvedValue(new Set(['cigar', 'xxxxx']));
    definitionsService.validateWord.mockResolvedValue(true);
    const initialize = await loadWordley();
    await initializePage(initialize);

    await enterGuess('xxxxx');
    const xTile = [...document.querySelectorAll('.alpha-tile')].find(tile => tile.dataset.letter === 'X');
    expect(xTile.status).toBe('absent');
    expect(xTile.getAttribute('aria-label')).toBe('X, not in word');
  });

  it('renders a fetched word definition on the completed guess row', async () => {
    definitionsService.fetchDefinition.mockResolvedValue([
      { partOfSpeech: 'noun', definition: 'to move swiftly' }
    ]);
    const initialize = await loadWordley();
    await initializePage(initialize);

    await enterGuess('crane');
    const row = document.querySelector('.row[data-row="0"]');
    await vi.waitFor(() => expect(row.dataset.tooltip).toBe('noun: to move swiftly'));

    expect(row.hidden).toBe(false);
    expect(row.getAttribute('aria-label')).toBe('Definition of crane');
    expect(row.getAttribute('aria-describedby')).toMatch(/^tooltip-0-/);
  });

  it('maps unknown Datamuse parts of speech and ignores empty definitions', async () => {
    definitionsService.fetchDefinition.mockResolvedValue([
      { partOfSpeech: 'xyz', definition: 'move quickly' }
    ]);
    const initialize = await loadWordley();
    await initializePage(initialize);

    await enterGuess('crane');
    const row = document.querySelector('.row[data-row="0"]');
    await vi.waitFor(() => expect(row.dataset.tooltip).toBe('xyz: move quickly'));
    expect(row.getAttribute('aria-label')).toBe('Definition of crane');
  });

  it('ignores dictionary responses without definitions', async () => {
    definitionsService.fetchDefinition.mockResolvedValue(null);
    const initialize = await loadWordley();
    await initializePage(initialize);

    await enterGuess('crane');
    await vi.waitFor(() => expect(document.querySelector('.row[data-row="0"]').dataset.tooltip).toBeUndefined());
  });

  it('handles empty definitions and exposes stats for both game modes', async () => {
    definitionsService.fetchDefinition.mockResolvedValue(null);
    const loaded = await loadWordley();
    await initializePage(loaded);

    await enterGuess('crane');
    await vi.waitFor(() => expect(document.querySelector('.row[data-row="0"]').dataset.tooltip).toBeUndefined());

    const settings = (await import('../../../scripts/settings.js')).default;
    settings.wordley_stats = null;
    const game = new loaded.Wordley();
    expect(game.getStats('singlePlayer')).toHaveProperty('4');
    expect(game.getStats('singlePlayer', 4)).toMatchObject({ 1: 0, failed: 0 });
    expect(game.getStats('singlePlayer', 99)).toMatchObject({ 1: 0, failed: 0 });
    expect(game.getStats('twoPlayer')).toHaveProperty('player1');
    expect(game.getStats('twoPlayer', 4)).toMatchObject({
      player1: { wins: 0, losses: 0 },
      player2: { wins: 0, losses: 0 },
      draws: 0
    });
    expect(game.getStats('twoPlayer', 99)).toMatchObject({
      player1: { wins: 0, losses: 0 },
      player2: { wins: 0, losses: 0 },
      draws: 0
    });
    expect(game.getStats('other')).toBeDefined();
  });

  it('updates timer progress and ends a timed-out game', async () => {
    let timerCallback;
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback) => {
      timerCallback = callback;
      return 1;
    });
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    localStorage.setItem('wordley_settings', JSON.stringify({ timerDuration: 1, playerCount: 2 }));
    const initialize = await loadWordley();
    await initializePage(initialize);

    await enterGuess('crane');
    const timerSelect = document.getElementById('timerSelect');
    timerSelect.value = '15';
    timerSelect.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('.guess-letter').dispatchEvent(new CustomEvent('tile-input', {
      bubbles: true,
      detail: { value: 'c', index: 0 }
    }));
    expect(timerCallback).toBeTypeOf('function');
    for (let tick = 0; tick < 15; tick++) {
      timerCallback();
    }

    expect(document.getElementById('message').textContent).toBe('6 guesses remaining');
    expect([...document.querySelectorAll('.row[data-row="1"] game-tile')]
      .slice(0, 5)
      .every(tile => tile.status === 'absent')).toBe(true);
    expect(document.querySelector('.row[data-row="1"]').classList.contains('player-2')).toBe(true);
    expect(document.getElementById('turnIndicator').textContent).toBe("Player 1's turn");
  });

  it('starts a first-row timer and switches to Player 2 on expiry', async () => {
    let timerCallback;
    vi.spyOn(globalThis, 'setInterval').mockImplementation((callback) => {
      timerCallback = callback;
      return 1;
    });
    vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => {});
    localStorage.setItem('wordley_settings', JSON.stringify({ timerDuration: 1, playerCount: 2 }));
    const initialize = await loadWordley();
    await initializePage(initialize);

    document.querySelector('.guess-letter').dispatchEvent(new CustomEvent('tile-input', {
      bubbles: true,
      detail: { value: 'c', index: 0 }
    }));
    expect(timerCallback).toBeTypeOf('function');
    timerCallback();

    expect(document.getElementById('turnIndicator').textContent).toBe("Player 2's turn");
  });

  it('supports reset, settings dialog controls, and keyboard letter navigation', async () => {
    const initialize = await loadWordley();
    await initializePage(initialize);
    const settingsDialog = document.getElementById('settingsDialog');
    settingsDialog.showModal = vi.fn();
    settingsDialog.close = vi.fn();

    document.getElementById('SettingsButton').click();
    expect(settingsDialog.showModal).toHaveBeenCalledOnce();
    document.getElementById('closeSettings').click();
    expect(settingsDialog.close).toHaveBeenCalledOnce();

    const firstInput = document.querySelector('.guess-letter');
    const secondInput = document.querySelectorAll('.guess-letter')[1];
    const originalEvent = { preventDefault: vi.fn() };
    secondInput.dispatchEvent(new CustomEvent('tile-keydown', {
      bubbles: true,
      detail: { key: 'ArrowLeft', index: 1, originalEvent }
    }));
    expect(document.activeElement).toBe(firstInput);
    expect(originalEvent.preventDefault).toHaveBeenCalledOnce();

    secondInput.value = '';
    secondInput.dispatchEvent(new CustomEvent('tile-keydown', {
      bubbles: true,
      detail: { key: 'Backspace', index: 1, originalEvent }
    }));
    expect(originalEvent.preventDefault).toHaveBeenCalledTimes(2);

    secondInput.dispatchEvent(new CustomEvent('tile-keydown', {
      bubbles: true,
      detail: { key: 'ArrowRight', index: 0, originalEvent }
    }));
    expect(document.activeElement).toBe(secondInput);

    document.getElementById('resetGame').click();
    await vi.waitFor(() => expect(document.getElementById('message').textContent).toBe('6 guesses remaining'));
  });

  it('initializes with optional controls absent', async () => {
    document.getElementById('lengthSelect').remove();
    document.getElementById('resetGame').remove();
    document.getElementById('SettingsButton').remove();
    document.getElementById('closeSettings').remove();
    document.getElementById('settingsDialog').remove();
    document.getElementById('timerSelect').remove();
    document.getElementById('turnIndicator').remove();

    const loaded = await loadWordley();
    await initializePage(loaded);

    expect(document.querySelectorAll('#board .row')).toHaveLength(6);
    expect(document.getElementById('message').textContent).toBe('6 guesses remaining');
  });

  it('uses explicitly supplied controls when constructing a game', async () => {
    const loaded = await loadWordley();
    const button = document.getElementById('submitGuess');
    const form = document.getElementById('guessForm');
    const addEventListener = vi.spyOn(document, 'addEventListener');
    const game = new loaded.Wordley({ button, form });
    const initialize = addEventListener.mock.calls.at(-1)[1];
    addEventListener.mockRestore();

    await initialize();
    expect(game).toBeDefined();
  });

  it('records a failed game after exhausting all valid guesses', async () => {
    const initialize = await loadWordley();
    await initializePage(initialize);

    for (let guess = 0; guess < 6; guess++) {
      await enterGuess('crane');
    }

    await vi.waitFor(() => expect(document.getElementById('message').textContent).toContain('Out of guesses!'));
    expect(document.getElementById('submitGuess').disabled).toBe(true);
  });

});