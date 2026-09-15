// @ts-check

/**
 * Player model containing a hand, played melds, and score.
 * @module futile/player
 */
//
// The view (render) is now a PURE renderer: it stamps data-* attributes and
// registers NO event listeners. The game attaches a single delegated listener
// per board region (see Futile.#wireBoardEvents), which avoids the unbounded
// growth of BaseClass.eventListeners that per-tile listeners caused.
import BaseClass from '../../scripts/BaseClass.js';
import GameTile from '../../scripts/components/game-tile.js';
import { COLOUR_TO_STATUS, compareTiles, isValidMeld, createTileElement, validateTarget } from './shared.js';

/**
 * Tile type shared by the Futile modules.
 * @typedef {import('./shared.js').Tile} Tile
 * 
 * @typedef {import('./selection.js').Selection} Selection
 */

/**
 * Owns the state and rendering for one Futile player.
 */
export class Player extends BaseClass {
  /**
   * Zero-based player id.
   * @type {number}
   */
  id;
  /**
   * Tiles held by the player.
  * @type {Tile[]}
   */
  #hand = [];
  /**
   * Melds currently played by the player.
  * @type {Tile[][]}
   */
  #playedMelds = [];
  /**
   * Whether the player has successfully played a meld.
   * @type {boolean}
   */
  #hasPlayedMeld = false;
  /**
   * Current score calculated from melds and hand.
   * @type {number}
   */
  #score = 0;

  /**
   * Creates a player with the supplied zero-based id.
    * @param {number} id Zero-based player id.
   */
  constructor(id) {
    super();
    this.id = id;
  }

  get hand() {
    return this.#hand;
  }
  get playedMelds() {
    return this.#playedMelds;
  }
  get hasPlayedMeld() {
    return this.#hasPlayedMeld;
  }
  get score() {
    return this.#score;
  }
  set score(val) {
    this.#score = val;
  }

  /**
   * Adds a tile to the hand and preserves tile ordering.
    * @param {Tile} tile Tile to add.
   */
  receiveTile(tile) {
    this.#hand.push(tile);
    this.#hand.sort(compareTiles);
  }

  /**
   * Removes and returns a hand tile by id.
    * @param {string} id Tile id to remove.
    * @returns {Tile|null} Removed tile, or `null` when absent.
   */
  removeTileById(id) {
    const idx = this.#hand.findIndex((t) => t.id === id);
    if (idx === -1) return null;
    return this.#hand.splice(idx, 1)[0];
  }

  /**
   * Adds a valid meld to the table.
    * @param {Tile[]} tiles Tiles to add as a meld.
    * @returns {Promise<boolean>} Whether the meld was added.
   */
  async addMeld(tiles) {
    if (!Array.isArray(tiles) || tiles.length === 0) return false;
    const copy = tiles.slice().sort(compareTiles);
    if (!isValidMeld(copy)) return false;
    this.#playedMelds.push(copy);
    this.#hasPlayedMeld = true;
    return true;
  }

  /**
   * Extends an existing meld when the combined tiles remain valid.
    * @param {number} meldIdx Index of the meld to extend.
    * @param {Tile[]} tiles Tiles to add.
    * @returns {Promise<boolean>} Whether the meld was updated.
   */
  async updateMeld(meldIdx, tiles) {
    if (meldIdx < 0 || meldIdx >= this.#playedMelds.length) return false;
    if (!Array.isArray(tiles) || tiles.length === 0) return false;
    const existing = this.#playedMelds[meldIdx] ?? [];
    const combined = existing.concat(tiles).sort(compareTiles); // consistent ordering
    if (!isValidMeld(combined)) return false;
    this.#playedMelds[meldIdx] = combined;
    this.#hasPlayedMeld = true;
    return true;
  }

  /**
   * Removes tiles while ensuring the source meld remains valid.
    * @param {number} meldIdx Index of the source meld.
    * @param {string[]} tileIds Tile ids to remove.
    * @returns {Promise<boolean>} Whether the tiles were removed.
   */
  async removeTilesFromMeld(meldIdx, tileIds) {
    if (meldIdx < 0 || meldIdx >= this.#playedMelds.length) return false;
    const meld = this.#playedMelds[meldIdx];
    const remaining = meld.filter((t) => !tileIds.includes(t.id));
    if (remaining.length > 0) {
      remaining.sort(compareTiles);
      if (!isValidMeld(remaining)) return false;
    }
    this.#playedMelds[meldIdx] = remaining;
    return true;
  }

  /**
   * Calculates meld points minus the value of tiles still in hand.
    * @returns {number} The player's current score.
   */
  computeScore() {
    const meldSum = this.#playedMelds.flat().reduce((s, t) => s + t.number, 0);
    const handSum = this.#hand.reduce((s, t) => s + t.number, 0);
    return meldSum - handSum;
  }

  /**
   * Render this player's area. Registers no listeners — clicks are handled by
   * the game's delegated board listeners via the stamped data-* attributes.
   * @param {Element} area
   * @param {number} playerIdx
   * @param {{ selection: Selection, isCurrent: boolean }} ctx
  * @returns {void}
   */
  render(area, playerIdx, ctx) {
    if (!area) return;
    const { selection, isCurrent } = ctx;

    // Hand size indicator (backs, not faces).
    const handEl = validateTarget(area.querySelector('.player-hand game-tile'), GameTile);
    if (handEl) handEl.value = `x${this.#hand.length}`;

    // Played melds container.
    let playedEl = area.querySelector('.played-tiles');
    if (!playedEl) {
      playedEl = document.createElement('div');
      playedEl.className = 'played-tiles';
      area.appendChild(playedEl);
    }
    playedEl.innerHTML = '';

    for (let m = 0; m < this.#playedMelds.length; m++) {
      const tiles = this.#playedMelds[m];
      const meldEl = document.createElement('div');
      meldEl.className = 'meld';

      tiles.forEach((t) => {
        const el = createTileElement(String(t.number), t.id, COLOUR_TO_STATUS[t.colour]);
        // Location stamped so the delegated handler knows which meld this is.
        el.dataset.owner = String(playerIdx);
        el.dataset.meldIdx = String(m);
        const selected = selection.hasMeldTile(t.id);
        if (selected) el.setAttribute('selected', '');
        el.setAttribute('aria-pressed', selected ? 'true' : 'false');
        meldEl.appendChild(el);
      });

      const addBtn = document.createElement('button');
      addBtn.className = 'meld-add';
      addBtn.title = 'Add selected tiles to this meld';
      addBtn.dataset.addMeld = '';
      addBtn.dataset.owner = String(playerIdx);
      addBtn.dataset.meldIdx = String(m);
      const plus = document.createElement('game-tile');
      plus.setAttribute('value', '+');
      addBtn.appendChild(plus);
      meldEl.appendChild(addBtn);

      playedEl.appendChild(meldEl);
    }

    area.classList.toggle('active', Boolean(isCurrent));
    const scoreEl = area.querySelector('.player-score');
    if (scoreEl) scoreEl.textContent = String(this.#score);
  }
}
