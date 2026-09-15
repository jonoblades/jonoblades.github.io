// @ts-check

/**
 * Draw pile for the Futile tile game.
 * Tile ids are globally unique so selections can safely identify tiles.
 * @module futile/deck
 */
import { COLOURS, NUMBERS, COPIES_PER_TILE, shuffle } from './shared.js';

/**
 * Tile type shared by the Futile modules.
 * @typedef {import('./shared.js').Tile} Tile
 */

/**
 * A shuffled collection of all tiles available in a game.
 */
export class Deck {
  /**
   * Tiles remaining in the draw pile.
  * @type {Tile[]}
   */
  #tiles;

  /**
   * Creates and shuffles a complete deck.
   */
  constructor() {
    this.#tiles = this.#createDeck();
  }

  #createDeck() {
    const deck = [];
    for (const colour of COLOURS) {
      for (const number of NUMBERS) {
        for (let k = 0; k < COPIES_PER_TILE; k++) {
          deck.push({
            // Prefix aids debugging; UUID guarantees global uniqueness.
            id: `${colour}-${number}-${k}-${crypto.randomUUID()}`,
            colour,
            number,
          });
        }
      }
    }
    return shuffle(deck);
  }

  /**
   * Removes and returns the next tile, or `undefined` when empty.
    * @returns {Tile|undefined} The drawn tile.
   */
  draw() {
    return this.#tiles.pop();
  }

  /**
   * Returns the number of tiles remaining in the pile.
    * @returns {number} The number of remaining tiles.
   */
  get size() {
    return this.#tiles.length;
  }
}
