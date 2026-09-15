// @ts-check

/**
 * Pure helpers and constants shared by the Futile game modules.
 * @module futile/shared
 */

/**
 * Tile shape used by the Futile game model.
 * @typedef {object} Tile
 * @property {string} id Globally unique tile id.
 * @property {keyof typeof COLOUR_TO_STATUS} colour Tile colour.
 * @property {number} number Tile number.
 */

/**
 * Available tile colours.
 * @type {('blue' | 'red' | 'amber' | 'green')[]}
 */
export const COLOURS = ['blue', 'red', 'amber', 'green'];
export const COPIES_PER_TILE = 2;
export const NUMBERS = Array.from({ length: 10 }, (_, i) => i);

export const COLOUR_TO_STATUS = {
  blue: 'blue',
  red: 'red',
  amber: 'yellow',
  green: 'green',
};

/**
 * Randomizes an array in place using the Fisher-Yates shuffle.
 * @template T
 * @param {T[]} arr Array to shuffle.
 * @returns {T[]} The same array instance, shuffled.
 */
export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Orders tiles by number, then colour, then id.
 * @param {{ number: number, colour: string, id: string }} a First tile to compare.
 * @param {{ number: number, colour: string, id: string }} b Second tile to compare.
 * @returns {number} Sort comparator result.
 */
export function compareTiles(a, b) {
  if (a.number !== b.number) return a.number - b.number;
  if (a.colour !== b.colour) return a.colour.localeCompare(b.colour);
  return a.id.localeCompare(b.id);
}

/**
 * Checks whether tiles form a set: three or more tiles sharing the same number.
 * @param {{ number: number }[]} tiles Tiles to validate.
 * @returns {boolean} True when the tiles form a set.
 */
export function isSet(tiles) {
  if (tiles.length < 3) return false;
  const num = tiles[0].number;
  return tiles.every((t) => t.number === num);
}

/**
 * Checks whether tiles form a run: three or more same-colour tiles with consecutive numbers.
 * @param {{ colour: string, number: number }[]} tiles Tiles to validate.
 * @returns {boolean} True when the tiles form a run.
 */
export function isRun(tiles) {
  if (tiles.length < 3) return false;
  const colour = tiles[0].colour;
  if (!tiles.every((t) => t.colour === colour)) return false;
  const nums = tiles.map((t) => t.number).sort((a, b) => a - b);
  for (let i = 1; i < nums.length; i++) {
    if (nums[i] !== nums[i - 1] + 1) return false;
  }
  return true;
}

/**
 * Checks whether tiles form any valid meld.
 * @param {{ colour: string, number: number }[]} tiles Tiles to validate.
 * @returns {boolean} True when the tiles form a valid set or run.
 */
export function isValidMeld(tiles) {
  return isSet(tiles) || isRun(tiles);
}

/**
 * Creates a readonly game-tile element for a Futile tile.
 * @param {string} value Displayed tile value.
 * @param {string} [id] Optional tile id to store in the dataset.
 * @param {string} [status] Optional visual status attribute.
 * @returns {HTMLElement} Configured game-tile element.
 */
export function createTileElement(value, id, status) {
  const tileEl = document.createElement('game-tile');
  tileEl.setAttribute('value', value || '');
  tileEl.setAttribute('type', 'number');
  if (id) tileEl.dataset.id = id;
  if (status) tileEl.setAttribute('status', status);
  tileEl.setAttribute('readonly', '');
  return tileEl;
}

/**
 * Validates a target against a constructor and returns the constructor's instance type.
 * @template T
 * @param {*} target Value to validate.
 * @param {new (...args: any[]) => T} [type] Constructor function to validate against.
 * @returns {T|false} The target as an instance of the generic type, or `false` if invalid.
 */
export function validateTarget(target, type) {
  const validator = type || /** @type {new (...args: any[]) => T} */ (Element);
  if (!(target instanceof validator)) return false;
  return target;
}

export const DIFFICULTIES = [
  'easy',
  'medium',
  'hard'
];