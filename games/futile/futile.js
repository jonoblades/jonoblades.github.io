// @ts-check

/**
 * Futile game orchestrator and controller.
 * @module futile/game
 */
//
// Model/view decoupled: pure actions (createMeld/addToMeld) mutate the model and
// return { ok, reason }; thin controllers read the Selection and map reasons to
// user messages; the view stamps data-* and the game handles clicks via a small
// number of DELEGATED listeners wired once (not per tile, per render).
import { COLOUR_TO_STATUS, createTileElement, isSet, isRun, validateTarget } from './shared.js';
import { Deck } from './deck.js';
import { Player } from './player.js';
import { AIPlayer } from './ai-player.js';
import { Selection } from './selection.js';
import BaseClass from '/scripts/BaseClass.js';

/**
 * Tile type shared by the Futile modules.
 * @typedef {import('./shared.js').Tile} Tile
 */

/**
 * Tile IDs selected from the player's hand or existing melds.
 * @typedef {object} MeldTileSelection
 * @property {string[]} [handTileIds=[]] Selected tiles from the current hand.
 * @property {string[]} [meldTileIds=[]] Selected tiles from existing melds.
 */

/**
 * Request used to create a new meld.
 * @typedef {MeldTileSelection} CreateMeldSelection
 */

/**
 * Request used to extend an existing meld.
 * @typedef {object} AddMeldSelection
 * @property {number} targetOwner Destination player index.
 * @property {number} targetMeldIdx Destination meld index.
 * @property {string[]} [handTileIds=[]] Selected tiles from the current hand.
 * @property {string[]} [meldTileIds=[]] Selected tiles from existing melds.
 */

/**
 * Result returned by a pure meld action.
 * @typedef {{ ok: true }|{ ok: false, reason: keyof typeof MELD_ERRORS }} MeldResult
 */

/**
 * Planned removal from an existing meld.
 * @typedef {object} MeldRemoval
 * @property {number} owner Player index owning the source meld.
 * @property {number} meldIdx Source meld index.
 * @property {string[]} ids Tile ids to remove.
 * @property {Tile[]} tiles Tiles to remove.
 */

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const STARTING_HAND = 10;
const AI_SCHEDULE_MS = 180;
const WATCHDOG_MS = 5000;

/**
 * Clamps a requested player count to the supported range.
 * @param {number} n Requested player count.
 * @returns {number} Clamped player count.
 */
const clampPlayers = (n) => Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, n));

// Machine reason -> human message. Keeping this here (a view concern) means the
// pure actions never need to know about the UI.
const MELD_ERRORS = {
  'game-over': 'The game is over.',
  'source-invalid': 'Cannot remove those tiles — a source meld would become invalid.',
  empty: 'Select tiles from your hand or a meld first.',
  'need-hand-tile': 'You must include at least one tile from your hand.',
  'invalid-meld': 'Selected tiles do not form a valid set or run.',
  'add-failed': 'Failed to create the meld.',
  'not-played': 'You must play a meld before adding to existing melds.',
  'no-dest': 'That destination meld no longer exists.',
  'dest-number': 'Tiles must match the number of the destination set.',
  'dest-colour': 'Tiles must match the colour of the destination run.',
  'dest-duplicate': 'Cannot add duplicate numbers into a run.',
  'dest-gap': 'Added tiles must keep the run consecutive.',
  'dest-invalid': 'Destination meld is neither a valid set nor run.',
};

/**
 * Coordinates the Futile model, view, turn flow, and AI players.
 */
export class Futile extends BaseClass {
  /**
   * Number of players in the current game.
   * @type {number}
   */
  #playerCount = 2;
  /**
   * Current draw pile.
   * @type {Deck|undefined}
   */
  #deck;
  /**
   * Number of turns completed in the current passing round.
   * @type {number}
   */
  #turnsThisRound = 0;
  /**
   * Tiles waiting to be passed at the end of the round.
   * @type {({ tileId: string, from: number }|null)[]}
   */
  #pendingPasses = [];
  /**
   * Whether the game has ended.
   * @type {boolean}
   */
  #gameOver = false;
  /**
   * Whether an asynchronous turn action is in progress.
   * @type {boolean}
   */
  #turnBusy = false;
  /**
   * Timer used to recover from a stuck turn.
   * @type {number|null}
   */
  #watchdogTimer = null;
  /**
   * AI players keyed by their player index.
   * @type {Map<number, AIPlayer>}
   */
  #bots = new Map();
  /**
   * Tiles and destination currently selected by the human player.
   * @type {Selection}
   */
  #selection = new Selection();

  // DOM refs
  /**
   * Live status message element.
   * @type {HTMLElement|null}
   */
  #messageEl = null;
  /**
   * Player area elements in board order.
   * @type {HTMLElement[]}
   */
  #playerAreas = [];
  /**
   * Tile rack element for the current player.
   * @type {HTMLElement|null}
   */
  #tileRack = null;
  /**
   * Button that opens the help dialog.
   * @type {HTMLElement|null}
   */
  #helpButton = null;
  /**
   * Help dialog element.
   * @type {HTMLDialogElement|null}
   */
  #helpDialog = null;
  /**
   * Button that closes the help dialog.
   * @type {HTMLElement|null}
   */
  #closeHelpBtn = null;
  /**
   * Settings dialog element.
   * @type {HTMLDialogElement|null}
   */
  #settingsDialog = null;
  /**
   * Button that opens the settings dialog.
   * @type {HTMLElement|null}
   */
  #settingsBtn = null;
  /**
   * Button that closes the settings dialog.
   * @type {HTMLElement|null}
   */
  #closeSettingsBtn = null;

  /**
   * Players participating in the current game.
   * @type {Player[]}
   */
  players = [];
  /**
   * Index of the player whose turn it is.
   * @type {number}
   */
  currentPlayer = 0;
  /**
   * Index of the human player.
   * @type {number}
   */
  humanPlayer = 0;
  /**
   * Difficulty used by AI players.
   * @type {'easy'|'medium'|'hard'}
   */
  difficulty = 'medium';

  /**
   * Creates a game with two to four players and one human player.
    * @param {number} [playerCount=2] Number of players.
    * @param {number} [humanPlayer=0] Zero-based human player index.
   */
  constructor(playerCount = 2, humanPlayer = 0) {
    super();
    this.#playerCount = clampPlayers(playerCount);
    this.humanPlayer = Math.max(0, Math.min(this.#playerCount - 1, humanPlayer));
    for (let i = 0; i < this.#playerCount; i++) this.players.push(new Player(i));
    this.init(async () => await this.#init());
  }

  // --- lifecycle / wiring ---------------------------------------------------

  /**
   * Loads the page state, wires controls, and starts a new game.
   * @returns {Promise<void>} Resolves after initialization completes.
   */
  async #init() {
    this.#messageEl = document.getElementById('message');
    this.#playerAreas = Array.from(document.querySelectorAll('.player-area'));
    this.#tileRack = document.getElementById('tileRack');
    this.#helpButton = document.getElementById('helpBtn');
    this.#helpDialog = /** @type {HTMLDialogElement|null} */ (
      document.querySelector('dialog#helpDialog')
    );
    this.#closeHelpBtn = document.getElementById('closeHelp');
    this.#settingsBtn = document.getElementById('SettingsButton');
    this.#settingsDialog = /** @type {HTMLDialogElement|null} */ (
      document.querySelector('dialog#settingsDialog')
    );
    this.#closeSettingsBtn = document.getElementById('closeSettings');
    if (this.#messageEl) {
      this.#messageEl.setAttribute('role', 'status');
      this.#messageEl.setAttribute('aria-live', 'polite');
    }
    this.#loadSettings();
    await this.#initUI();
    this.#wireControls();
    this.#wireBoardEvents();
    this.#wireHelp();
    this.#wireSettings();
    await this.#startNewGame();
  }

  /**
   * Wires delegated listeners to stable board containers.
   * @returns {void}
   */
  #wireBoardEvents() {
    if (this.#tileRack) {
      this.addListener(this.#tileRack, 'click', (ev) => this.#onRackClick(ev));
    }
    for (const area of this.#playerAreas) {
      this.addListener(area, 'click', (ev) => this.#onAreaClick(ev));
    }
  }

  /**
   * Handles a click on the current player's hand rack.
   * @param {Event} ev Board click event.
   * @returns {void}
   */
  #onRackClick(ev) {
    if (this.#gameOver || this.currentPlayer !== this.humanPlayer) return;
    const target = validateTarget(ev.target, Element);
    if (!target) return;
    const tile = validateTarget(target?.closest('game-tile[data-id]'), HTMLElement);
    if (!tile) return;
    this.#handleHandTileClick(this.currentPlayer, tile.dataset.id || '');
  }

  /**
   * Handles tile and meld-add clicks in player areas.
   * @param {Event} ev Board click event.
   * @returns {void}
   */
  #onAreaClick(ev) {
    if (this.#gameOver || this.currentPlayer !== this.humanPlayer) return;
    const target = validateTarget(ev.target, Element);
    if (!target) return;
    const addBtn = validateTarget(target?.closest('[data-add-meld]'), HTMLElement);
    if (addBtn) {
      this.#commitAddToMeld(Number(addBtn.dataset.owner), Number(addBtn.dataset.meldIdx));
      return;
    }
    const tile = validateTarget(target?.closest('game-tile[data-id]'), HTMLElement);
    if (!tile || tile.dataset.owner === undefined) return;
    const owner = Number(tile.dataset.owner);
    const meldIdx = Number(tile.dataset.meldIdx);
    if (Number.isNaN(owner) || Number.isNaN(meldIdx)) return;
    this.#handleMeldTileClick(owner, meldIdx, tile.dataset.id || '');
  }

  /**
   * Wires the help dialog controls.
   * @returns {void}
   */
  #wireHelp() {
    if (this.#helpButton && this.#helpDialog) {
      this.addListener(this.#helpButton, 'click', () => this.#openHelp());
    }
    if (this.#closeHelpBtn && this.#helpDialog) {
      this.addListener(this.#closeHelpBtn, 'click', () => this.#helpDialog?.close());
    }
    if (this.#helpDialog) {
      this.addListener(this.#helpDialog, 'click', (ev) => {
        if (ev.target === this.#helpDialog) this.#helpDialog?.close();
      });
    }
  }

  /**
   * Opens the help dialog when it is available.
   * @returns {void}
   */
  #openHelp() {
    if (!this.#helpDialog) return;
    this.#helpDialog.showModal();
  }

  /**
   * Wires the settings dialog controls.
   * @returns {void}
   */
  #wireSettings() {
    if (this.#settingsBtn && this.#settingsDialog) {
      this.#settingsBtn.classList.remove('hidden');
      this.addListener(this.#settingsBtn, 'click', () => this.#openSettings());
    }
    if (this.#closeSettingsBtn && this.#settingsDialog) {
      this.addListener(this.#closeSettingsBtn, 'click', () => this.#closeSettings());
    }
    if (this.#settingsDialog) {
      this.addListener(this.#settingsDialog, 'click', (ev) => {
        if (ev.target === this.#settingsDialog) this.#closeSettings();
      });
    }
  }

  /**
   * Opens the settings dialog and reflects current settings in its controls.
   * @returns {void}
   */
  #openSettings() {
    if (!this.#settingsDialog) return;
    const pcInput = validateTarget(this.#settingsDialog.querySelector(
      `input[name="playerCount"][value="${this.#playerCount}"]`
    ), HTMLInputElement);
    if (pcInput) pcInput.checked = true;
    const diffInput = validateTarget(this.#settingsDialog.querySelector(
      `input[name="difficulty"][value="${this.difficulty}"]`
    ), HTMLInputElement);
    if (diffInput) diffInput.checked = true;
    this.#settingsDialog.showModal();
  }

  /**
   * Reads settings controls, closes the dialog, and persists the changes.
   * @returns {void}
   */
  #closeSettings() {
    if (!this.#settingsDialog) return;
    const diffSel = validateTarget(this.#settingsDialog.querySelector('input[name="difficulty"]:checked'), HTMLInputElement);
    if (diffSel &&
      (diffSel.value === 'easy' || diffSel.value === 'medium' || diffSel.value === 'hard')
    ) { this.difficulty = diffSel.value };
    this.#settingsDialog.close();
    this.saveSettings();
  }

  /**
   * Persists the current player count and difficulty.
    * @returns {void}
   */
  saveSettings() {
    try {
      this.settingsService.futile_settings = {
        playerCount: this.#playerCount,
        difficulty: this.difficulty,
      };
    } catch {
      // ignore storage errors
    }
  }

  /**
   * Loads persisted player count and difficulty settings.
   * @returns {void}
   */
  #loadSettings() {
    try {
      const settings = this.settingsService.futile_settings || {
        playerCount: 2,
        difficulty: 'medium',
      };
      if (typeof settings.playerCount === 'number') {
        this.#playerCount = clampPlayers(settings.playerCount);
      }
      if (['easy', 'medium', 'hard'].includes(settings.difficulty)) {
        this.difficulty = settings.difficulty;
      }
      const pcInput = validateTarget(document.querySelector(
        `input[name="playerCount"][value="${this.#playerCount}"]`
      ), HTMLInputElement);
      if (pcInput) pcInput.checked = true;
      const diffInput = validateTarget(document.querySelector(
        `input[name="difficulty"][value="${this.difficulty}"]`
      ), HTMLInputElement);
      if (diffInput) diffInput.checked = true;
    } catch {
      // ignore parse errors
    }
  }

  /**
   * Wires the player-count controls used to restart a game.
   * @returns {Promise<void>} Resolves after the controls are initialized.
   */
  async #initUI() {
    const radios = document.querySelectorAll('input[name="playerCount"]');
    radios.forEach((r) => {
      const radioElement = validateTarget(r, HTMLInputElement);
      radioElement && this.addListener(radioElement, 'change', async () => {
        const val = parseInt(radioElement.value, 10);
        if (Number.isNaN(val)) return;
        this.#playerCount = clampPlayers(val);
        for (let i = 0; i < this.#playerAreas.length; i++) {
          this.#playerAreas[i].style.display = i < this.#playerCount ? '' : 'none';
        }
        await this.#startNewGame(); // owns player construction
        this.saveSettings();
      });
    });
  }

  /**
   * Wires the create-meld and end-turn buttons.
   * @returns {void}
   */
  #wireControls() {
    const createBtn = document.querySelector('#meldButton');
    createBtn && this.addListener(createBtn, 'click', () => this.#commitCreateMeld());
    const endBtn = document.querySelector('#passButton');
    endBtn && this.addListener(endBtn, 'click', () => this.endTurn());
  }

  // --- watchdog (guards against a stuck #turnBusy) --------------------------

  /**
   * Starts a watchdog that clears a stale turn-busy flag.
   * @param {number} [timeout=WATCHDOG_MS] Watchdog duration in milliseconds.
   * @returns {void}
   */
  #startWatchdog(timeout = WATCHDOG_MS) {
    this.#clearWatchdog();
    this.#watchdogTimer = window.setTimeout(() => {
      if (this.#turnBusy) {
        console.warn('watchdog cleared stale turnBusy flag');
        this.#turnBusy = false;
      }
      this.#clearWatchdog();
    }, timeout);
  }

  /**
   * Cancels the active turn watchdog.
   * @returns {void}
   */
  #clearWatchdog() {
    if (this.#watchdogTimer != null) {
      clearTimeout(this.#watchdogTimer);
      this.#watchdogTimer = null;
    }
  }

  // --- messaging ------------------------------------------------------------

  /**
   * Writes a message to the live status region.
   * @param {string} text Message to display.
   * @returns {void}
   */
  #setMessage(text) {
    if (this.#messageEl) this.#messageEl.textContent = text;
  }

  // Non-blocking for everyone: routes to the aria-live region instead of alert().
  /**
   * Displays a user-facing message and logs messages suppressed for AI turns.
   * @param {string} text Message to display.
   * @returns {void}
   */
  #notify(text) {
    if (this.currentPlayer !== this.humanPlayer) {
      console.warn('AI suppressed message:', text);
    }
    this.#setMessage(text);
  }

  /**
   * Clears the current hand and meld tile selection.
   * @returns {void}
   */
  #clearSelections() {
    this.#selection.clear();
  }

  // --- PURE ACTIONS (model only, no UI, no selection reads) -----------------

  /**
   * Create a new meld for the current player.
    * @param {CreateMeldSelection} selection Tiles to use for the new meld.
    * @returns {Promise<MeldResult>} Action result.
   */
  async createMeld(selection) {
    if (this.#gameOver) return { ok: false, reason: 'game-over' };
    const { handTileIds = [], meldTileIds = [] } = selection;

    const handTiles = this.#tilesFromHand(handTileIds);
    const removals = this.#planMeldRemovals(meldTileIds);
    if (removals === null) return { ok: false, reason: 'source-invalid' };

    const stolenTiles = removals.flatMap((r) => r.tiles);
    const combined = [...stolenTiles, ...handTiles];

    if (combined.length === 0) return { ok: false, reason: 'empty' };
    if (stolenTiles.length > 0 && handTiles.length === 0) {
      return { ok: false, reason: 'need-hand-tile' };
    }
    if (!(isSet(combined) || isRun(combined))) {
      return { ok: false, reason: 'invalid-meld' };
    }

    for (const r of removals) {
      await this.players[r.owner].removeTilesFromMeld(r.meldIdx, r.ids);
    }
    for (const t of handTiles) this.players[this.currentPlayer].removeTileById(t.id);
    this.#compactMelds();

    const added = await this.players[this.currentPlayer].addMeld(combined);
    return added ? { ok: true } : { ok: false, reason: 'add-failed' };
  }

  /**
   * Add tiles (from hand and/or other melds) to an existing meld.
    * @param {AddMeldSelection} selection Destination and tiles to add.
    * @returns {Promise<MeldResult>} Action result.
   */
  async addToMeld(selection) {
    const { targetOwner, targetMeldIdx, handTileIds = [], meldTileIds = [] } = selection;
    if (this.#gameOver) return { ok: false, reason: 'game-over' };
    if (!this.players[this.currentPlayer].hasPlayedMeld) {
      return { ok: false, reason: 'not-played' };
    }

    const handTiles = this.#tilesFromHand(handTileIds);
    const removals = this.#planMeldRemovals(meldTileIds);
    if (removals === null) return { ok: false, reason: 'source-invalid' };

    const stolenTiles = removals.flatMap((r) => r.tiles);
    const combined = [...stolenTiles, ...handTiles];
    if (combined.length === 0) return { ok: false, reason: 'empty' };
    if (stolenTiles.length > 0 && handTiles.length === 0) {
      return { ok: false, reason: 'need-hand-tile' };
    }

    const dest = this.players[targetOwner]?.playedMelds[targetMeldIdx];
    if (!dest) return { ok: false, reason: 'no-dest' };

    const reason = this.#validateAddToDest(dest, combined);
    if (reason) return { ok: false, reason };

    for (const r of removals) {
      await this.players[r.owner].removeTilesFromMeld(r.meldIdx, r.ids);
    }
    for (const t of handTiles) this.players[this.currentPlayer].removeTileById(t.id);

    const destIdx = this.players[targetOwner].playedMelds.indexOf(dest);
    this.#compactMelds();
    if (destIdx === -1) return { ok: false, reason: 'no-dest' }; // dest itself got emptied
    const ok = await this.players[targetOwner].updateMeld(
      this.players[targetOwner].playedMelds.indexOf(dest),
      combined,
    );
    return ok ? { ok: true } : { ok: false, reason: 'add-failed' };
  }

  // --- action helpers -------------------------------------------------------

  /**
   * Resolves tile ids against the current player's hand.
   * @param {string[]} ids Tile ids to resolve.
   * @returns {Tile[]} Matching tiles in hand.
   */
  #tilesFromHand(ids) {
    const hand = this.players[this.currentPlayer].hand;
    return ids.map((id) => hand.find((t) => t.id === id))
      .filter(t => t !== undefined);
  }

  /**
   * Groups requested meld tiles by source and validates each remaining meld.
   * @param {string[]} meldTileIds Tile ids to remove from existing melds.
   * @returns {MeldRemoval[]|null} Planned removals, or `null` when invalid.
   */
  #planMeldRemovals(meldTileIds) {
    if (meldTileIds.length === 0) return [];
    const idSet = new Set(meldTileIds);
    const byMeld = new Map();

    for (let owner = 0; owner < this.players.length; owner++) {
      const melds = this.players[owner].playedMelds;
      for (let meldIdx = 0; meldIdx < melds.length; meldIdx++) {
        const taken = melds[meldIdx].filter((t) => idSet.has(t.id));
        if (taken.length === 0) continue;

        const remaining = melds[meldIdx].filter((t) => !idSet.has(t.id));
        if (remaining.length > 0 && !(isSet(remaining) || isRun(remaining))) {
          return null;
        }
        byMeld.set(`${owner}|${meldIdx}`, {
          owner,
          meldIdx,
          ids: taken.map((t) => t.id),
          tiles: taken,
        });
      }
    }
    return [...byMeld.values()];
  }

  /**
   * Validates tiles against a destination set or run.
   * @param {Tile[]} dest Existing destination meld.
   * @param {Tile[]} combined Tiles proposed for the destination.
    * @returns {keyof typeof MELD_ERRORS|null} Machine-readable failure reason, or `null` when valid.
   */
  #validateAddToDest(dest, combined) {
    if (isSet(dest)) {
      const num = dest[0].number;
      return combined.every((t) => t.number === num) ? null : 'dest-number';
    }
    if (isRun(dest)) {
      const colour = dest[0].colour;
      if (!combined.every((t) => t.colour === colour)) return 'dest-colour';
      const existing = dest.map((t) => t.number);
      const incoming = combined.map((t) => t.number);
      const incomingSet = new Set(incoming);
      if (incomingSet.size !== incoming.length || incoming.some((n) => existing.includes(n))) {
        return 'dest-duplicate';
      }
      const union = [...new Set([...existing, ...incoming])].sort((a, b) => a - b);
      if (union[union.length - 1] - union[0] + 1 !== union.length) return 'dest-gap';
      return null;
    }
    return 'dest-invalid';
  }

  // --- CONTROLLERS (read selection, guard, map reasons, render) -------------

  /**
   * Commits the current selection as a new meld.
   * @returns {Promise<void>} Resolves after the action and rendering complete.
   */
  async #commitCreateMeld() {
    if (this.#turnBusy) return;
    this.#turnBusy = true;
    this.#startWatchdog();
    try {
      const result = await this.createMeld({
        handTileIds: this.#selection.handIds,
        meldTileIds: this.#selection.meldTileIds,
      });
      if (!result.ok) {
        this.#notify(MELD_ERRORS[result.reason] ?? 'That move is not allowed.');
        return;
      }
      this.#clearSelections();
      if (this.checkForWin()) return;
      this.renderAllHands();
    } finally {
      this.#turnBusy = false;
      this.#clearWatchdog();
    }
  }

  /**
   * Commits the current selection to a destination meld.
   * @param {number} targetOwner Destination player index.
   * @param {number} targetMeldIdx Destination meld index.
   * @returns {Promise<void>} Resolves after the action and rendering complete.
   */
  async #commitAddToMeld(targetOwner, targetMeldIdx) {
    if (this.#turnBusy) return;
    this.#turnBusy = true;
    this.#startWatchdog();
    try {
      const result = await this.addToMeld({
        targetOwner,
        targetMeldIdx,
        handTileIds: this.#selection.handIds,
        meldTileIds: this.#selection.meldTileIds,
      });
      if (!result.ok) {
        this.#notify(MELD_ERRORS[result.reason] ?? 'That move is not allowed.');
        return;
      }
      this.#clearSelections();
      if (this.checkForWin()) return;
      this.renderAllHands();
    } finally {
      this.#turnBusy = false;
      this.#clearWatchdog();
    }
  }

  // --- VIEW EVENT REACTIONS -------------------------------------------------

  /**
   * Toggles a hand tile selected by the human player.
   * @param {number} playerIdx Player index associated with the tile.
   * @param {string} tileId Tile id to toggle.
   * @returns {void}
   */
  #handleHandTileClick(playerIdx, tileId) {
    if (this.#gameOver || playerIdx !== this.currentPlayer) return;
    this.#selection.toggleHand(tileId);
    this.renderAllHands();
  }

  /**
   * Toggles a played-meld tile selected by the human player.
   * @param {number} owner Player index owning the meld.
   * @param {number} meldIdx Meld index containing the tile.
   * @param {string} tileId Tile id to toggle.
   * @returns {void}
   */
  #handleMeldTileClick(owner, meldIdx, tileId) {
    if (this.#gameOver || this.currentPlayer !== this.humanPlayer) return;
    this.#selection.toggleMeldTile(tileId, owner, meldIdx);
    this.renderAllHands();
  }

  // --- rendering ------------------------------------------------------------

  /**
   * Renders every player area and the current player's tile rack.
    * @returns {void}
   */
  renderAllHands() {
    for (let i = 0; i < this.#playerAreas.length; i++) {
      const area = this.#playerAreas[i];
      if (!area) continue;
      area.classList.toggle('show', i < this.#playerCount);
      if (i < this.#playerCount) {
        this.players[i].render(area, i, {
          selection: this.#selection,
          isCurrent: i === this.currentPlayer,
        });
      } else {
        const played = area.querySelector('.played-tiles');
        if (played) played.innerHTML = '';
        const scoreEl = area.querySelector('.player-score');
        if (scoreEl) scoreEl.textContent = '';
        area.classList.remove('active');
      }
    }

    const rack = this.#tileRack;
    if (rack) {
      rack.innerHTML = '';
      const current = this.players[this.currentPlayer];
      if (this.currentPlayer === this.humanPlayer) {
        current.hand.forEach((tile) => {
          const tileEl = createTileElement(
            String(tile.number),
            tile.id,
            COLOUR_TO_STATUS[tile.colour],
          );
          const selected = this.#selection.hasHand(tile.id);
          if (selected) tileEl.setAttribute('selected', '');
          tileEl.setAttribute('aria-pressed', selected ? 'true' : 'false');
          const pending = this.#pendingPasses.find(
            (p) => p && p.tileId === tile.id && p.from === this.currentPlayer,
          );
          if (pending) tileEl.setAttribute('pending-pass', '');
          rack.appendChild(tileEl); // no per-tile listener — see #wireBoardEvents
        });
      } else {
        // Bot's turn — render hidden placeholders so the human can't read the hand.
        current.hand.forEach(() => {
          const tileEl = createTileElement('');
          tileEl.setAttribute('aria-hidden', 'true');
          rack.appendChild(tileEl);
        });
      }
    }

    this.#renderDraw();
    this.#updateScores();
  }

  /**
   * Updates the draw-pile and current-turn message.
   * @returns {void}
   */
  #renderDraw() {
    this.#setMessage(`Draw pile: ${this.#deck?.size} — Player ${this.currentPlayer + 1}'s turn`);
  }

  /**
   * Recalculates and renders every player's score.
   * @returns {void}
   */
  #updateScores() {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      p.score = p.computeScore();
      const area = this.#playerAreas[i];
      if (!area) continue;
      const scoreEl = area.querySelector('.player-score');
      if (scoreEl) scoreEl.textContent = String(p.score);
    }
  }

  // --- win detection --------------------------------------------------------

  /**
   * Counts a player's hand while accounting for pending outgoing passes.
   * @param {number} playerIdx Player index to inspect.
   * @returns {number} Effective hand count.
   */
  #effectiveHandCount(playerIdx) {
    // Outgoing pending passes still belong to the player until applied, so they
    // prevent a premature win.
    let count = this.players[playerIdx].hand.length;
    for (const p of this.#pendingPasses) {
      if (p && p.from === playerIdx) count++;
    }
    return count;
  }

  /**
   * Updates scores and returns whether the game has ended.
    * @returns {boolean} Whether the game has ended.
   */
  checkForWin() {
    if (this.#gameOver) return false;
    const gameEnded =
      this.#deck?.size === 0 ||
      this.players.some((_, i) => this.#effectiveHandCount(i) === 0);
    this.#updateScores();
    this.renderAllHands();

    if (gameEnded) {
      this.#gameOver = true;
      const winner = [...this.players].sort((a, b) => b.score - a.score)[0];
      this.#setMessage(`Player ${winner.id + 1} wins with a score of ${winner.score}!`);
    }
    return gameEnded;
  }

  // --- turn flow ------------------------------------------------------------

  /**
   * Draws a tile, renders the turn, and schedules an AI turn when needed.
   * @returns {Promise<void>} Resolves after the turn has been scheduled.
   */
  async #startTurn() {
    if (this.#gameOver) return;
    const tile = this.#deck?.draw();
    if (tile) this.players[this.currentPlayer].receiveTile(tile);
    this.#clearSelections();
    this.#turnsThisRound++;
    this.renderAllHands();

    if (this.currentPlayer === this.humanPlayer) return;

    let bot = this.#bots.get(this.currentPlayer);
    if (!bot) {
      bot = new AIPlayer(this.currentPlayer);
      this.#bots.set(this.currentPlayer, bot);
    }
    if (this.#turnBusy) {
      console.warn('startTurn clearing stale turnBusy flag before scheduling AI');
      this.#turnBusy = false;
      this.#clearWatchdog();
    }
    setTimeout(() => {
      bot.takeTurn(this).catch((err) => {
        console.error('AI error:', err);
        void this.endTurn();
      });
    }, AI_SCHEDULE_MS);
  }

  /**
   * End the current turn, passing one tile to the next player.
   * @param {string|null} explicitPassId  Used by the AI; humans pass their selected tile.
    * @returns {Promise<void>} Resolves after the next turn starts.
   */
  async endTurn(explicitPassId = null) {
    if (this.#gameOver || this.#turnBusy) return;

    let passId = explicitPassId;
    if (this.currentPlayer === this.humanPlayer) {
      const sel = this.#selection.handIds;
      if (sel.length !== 1) {
        this.#notify('Select exactly one tile from your hand to pass before ending your turn.');
        return;
      }
      passId = sel[0];
    } else if (passId == null) {
      const hand = this.players[this.currentPlayer].hand;
      passId = hand.length ? hand[0].id : null;
    }

    if (passId) {
      const receiver = (this.currentPlayer + 1) % this.#playerCount;
      this.#pendingPasses[receiver] = { tileId: passId, from: this.currentPlayer };
    }

    this.#clearSelections();
    this.currentPlayer = (this.currentPlayer + 1) % this.#playerCount;
    this.renderAllHands();

    if (this.#turnsThisRound >= this.#playerCount) {
      this.#applyPendingPasses();
      this.#turnsThisRound = 0;
    }

    if (this.#turnBusy) {
      console.warn('endTurn clearing stale turnBusy flag');
      this.#turnBusy = false;
    }
    await this.#startTurn();
  }

  /**
   * Applies queued passes and moves tiles to their receivers.
   * @returns {void}
   */
  #applyPendingPasses() {
    for (let i = 0; i < this.#playerCount; i++) {
      const pending = this.#pendingPasses[i];
      if (!pending) continue;
      const tile = this.players[pending.from].removeTileById(pending.tileId);
      if (tile) this.players[i].receiveTile(tile);
      this.#pendingPasses[i] = null;
    }
    this.renderAllHands();
  }

  /**
   * Resets model state, deals starting hands, and starts the first turn.
   * @returns {Promise<void>} Resolves after the new game starts.
   */
  async #startNewGame() {
    this.#deck = new Deck();
    this.currentPlayer = 0;
    this.#turnsThisRound = 0;
    this.#gameOver = false;
    this.#pendingPasses = new Array(this.#playerCount).fill(null);
    this.#clearSelections();

    this.players = [];
    for (let i = 0; i < this.#playerCount; i++) this.players.push(new Player(i));

    this.#bots.clear();
    for (let i = 0; i < this.#playerCount; i++) {
      if (i !== this.humanPlayer) this.#bots.set(i, new AIPlayer(i));
    }

    for (let k = 0; k < STARTING_HAND; k++) {
      for (let p = 0; p < this.#playerCount; p++) {
        const tile = this.#deck.draw();
        if (!tile) break;
        this.players[p].receiveTile(tile);
      }
    }

    this.renderAllHands();
    await this.#startTurn();
  }

  /**
   * Removes empty melds after tiles have been transferred.
   * @returns {void}
   */
  // Remove any melds that were fully emptied by steals/removals.
  // Iterate BACKWARDS so splicing never shifts an index we haven't visited yet.
  #compactMelds() {
    for (const player of this.players) {
      const melds = player.playedMelds;
      for (let i = melds.length - 1; i >= 0; i--) {
        if (melds[i].length === 0) melds.splice(i, 1);
      }
    }
  }
}
