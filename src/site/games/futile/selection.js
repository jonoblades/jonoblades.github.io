// @ts-check

/**
 * Selection state staged for the next Futile game action.
 * @module futile/selection
 */
// Single source of truth for what is currently "staged" for the next action.
//
// Because every tile id is globally unique (see deck.js), a selected meld
// tile's location (owner + meldIdx) can be stored *alongside* its id. That
// removes the need for the old trio of overlapping sets
// (#selectedMeldTileIds, selectedMeldInstanceKeys, selectedMeldSource*) plus
// the syncSelectedMeldIdsFromInstances() reconciliation routine.

/**
 * Tracks selected hand tiles, meld tiles, and an optional destination meld.
 */
export class Selection {
  /**
   * Ids of selected tiles in the current player's hand.
   * @type {Set<string>}
   */
  #handIds = new Set(); // tileId
  /**
   * Selected meld tile ids mapped to their source locations.
   * @type {Map<string, { owner: number, meldIdx: number }>}
   */
  #meldTiles = new Map(); // tileId -> { owner, meldIdx }
  /**
   * Optional destination meld for an add operation.
   * @type {{ owner: number, meldIdx: number }|null}
   */
  #dest = null; // { owner, meldIdx } | null

  // --- hand tiles ---
  /**
   * Toggles a hand tile in the current selection.
   * @param {string} tileId
  * @returns {void}
   */
  toggleHand(tileId) {
    if (this.#handIds.has(tileId)) this.#handIds.delete(tileId);
    else this.#handIds.add(tileId);
  }
  /**
   * Returns whether a hand tile is selected.
   * @param {string} tileId
  * @returns {boolean} Whether the tile is selected.
   */
  hasHand(tileId) {
    return this.#handIds.has(tileId);
  }
  /**
   * Returns selected hand tile ids.
  * @returns {string[]} Selected hand tile ids.
   */
  get handIds() {
    return [...this.#handIds];
  }
  /**
   * Returns the number of selected hand tiles.
  * @returns {number} Number of selected hand tiles.
   */
  get handCount() {
    return this.#handIds.size;
  }

  // --- meld tiles (id carries its own location) ---
  /**
   * Toggles a meld tile and records its source location.
  * @param {string} tileId Tile id to toggle.
  * @param {number} owner Index of the tile's owning player.
  * @param {number} meldIdx Index of the source meld.
  * @returns {void}
   */
  toggleMeldTile(tileId, owner, meldIdx) {
    if (this.#meldTiles.has(tileId)) this.#meldTiles.delete(tileId);
    else this.#meldTiles.set(tileId, { owner, meldIdx });
  }
  /**
   * Returns whether a meld tile is selected.
   * @param {string} tileId
  * @returns {boolean} Whether the tile is selected.
   */
  hasMeldTile(tileId) {
    return this.#meldTiles.has(tileId);
  }
  /**
   * O(1) lookup of where a selected meld tile lives — replaces the source anchors.
  * @param {string} tileId Tile id to locate.
  * @returns {{ owner: number, meldIdx: number }|null} Tile location, or `null` when absent.
   */
  locate(tileId) {
    return this.#meldTiles.get(tileId) ?? null;
  }
  /**
   * Returns selected meld tile ids.
  * @returns {string[]} Selected meld tile ids.
   */
  get meldTileIds() {
    return [...this.#meldTiles.keys()];
  }
  /**
   * Returns the number of selected meld tiles.
  * @returns {number} Number of selected meld tiles.
   */
  get meldTileCount() {
    return this.#meldTiles.size;
  }

  // --- destination meld (optional; the +button carries an explicit target) ---
  /**
   * Sets the destination meld for an add operation.
  * @param {number} owner Index of the destination meld's owner.
  * @param {number} meldIdx Index of the destination meld.
  * @returns {void}
   */
  setDest(owner, meldIdx) {
    this.#dest = { owner, meldIdx };
  }
  /**
   * Returns the selected destination meld, if any.
  * @returns {{ owner: number, meldIdx: number }|null} Selected destination, or `null`.
   */
  get dest() {
    return this.#dest;
  }

  /**
   * Clears all selected tiles and the destination.
  * @returns {void}
   */
  clear() {
    this.#handIds.clear();
    this.#meldTiles.clear();
    this.#dest = null;
  }
  /**
   * Returns whether no tiles are selected.
  * @returns {boolean} Whether the selection is empty.
   */
  isEmpty() {
    return this.#handIds.size === 0 && this.#meldTiles.size === 0;
  }
}
