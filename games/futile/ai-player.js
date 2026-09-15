// @ts-check

/**
 * Heuristic AI player for Futile.
 * It calls the same public game actions as the human interface.
 * @module futile/ai-player
 */
// It names the tiles it wants and calls the same
// public API the human UI uses (createMeld / addToMeld / endTurn). It never
// touches selection state.
import { isSet, isRun } from './shared.js';

/**
 * Tile type shared by the Futile modules.
 * @typedef {import('./shared.js').Tile} Tile
 */

/**
 * @typedef {import('./futile.js').Futile} Futile
 */

/**
 * Result of searching a hand for its strongest meld.
 * @typedef {object} MeldPlan
 * @property {Tile[]|null} set Largest available set.
 * @property {Tile[]|null} run Largest available run.
 * @property {'set'|'run'|null} type Preferred meld type.
 * @property {Tile[]|null} tiles Tiles in the preferred meld.
 * @property {number} length Length of the preferred meld.
 */

/**
 * Delay range in milliseconds for each difficulty.
 * @type {Record<'easy'|'medium'|'hard', [number, number]>}
 */
const DELAY_RANGES = {
  easy: [3000, 5000],
  medium: [2000, 4000],
  hard: [1500, 2500],
};

/**
 * Chooses and executes legal moves for one bot player.
 */
export class AIPlayer {
  /**
   * Zero-based player index controlled by this AI.
   * @type {number}
   */
  idx;
  /**
   * Delay used between AI actions.
   * @type {number}
   */
  #shortDelay = 200;

  /**
   * Creates an AI player for the supplied zero-based player index.
    * @param {number} idx Zero-based player index.
   */
  constructor(idx) {
    this.idx = idx;
  }

  /**
   * Waits for a short period between AI actions.
   * @param {number} ms Delay in milliseconds.
   * @returns {Promise<void>} Resolves after the delay.
   */
  async #pause(ms) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Finds the largest set and largest run available in a hand.
   * @param {Tile[]} hand Tiles available to the AI.
   * @returns {MeldPlan} Strongest set, run, and preferred meld.
   */
  #findBestMeld(hand) {
    /** @type {Map<number, Tile[]>} */
    const byNum = new Map();
    /** @type {Map<string, Tile[]>} */
    const byColour = new Map();
    /**
     * Groups a tile by a numeric or colour key.
     * @template {string|number} K
     * @param {Map<K, Tile[]>} map Tile groups to update.
     * @param {K} key Group key.
     * @param {Tile} tile Tile to append to the group.
     * @returns {void}
     */
    const push = (map, key, tile) => {
      const arr = map.get(key) ?? [];
      arr.push(tile);
      map.set(key, arr);
    };
    for (const tile of hand) {
      push(byNum, tile.number, tile);
      push(byColour, tile.colour, tile);
    }

    const bestSet =
      [...byNum.values()].filter((g) => g.length >= 3).sort((a, b) => b.length - a.length)[0] ||
      null;

    let bestRun = null;
    for (const group of byColour.values()) {
      if (group.length < 3) continue;
      const byNumber = new Map(group.map((t) => [t.number, t]));
      const numbers = [...byNumber.keys()].sort((a, b) => a - b);
      for (const start of numbers) {
        const run = [];
        let cur = start;
        while (byNumber.has(cur)) {
          const tile = byNumber.get(cur);
          if (!tile) break;
          run.push(tile);
          cur++;
        }
        if (run.length >= 3 && (!bestRun || run.length > bestRun.length)) bestRun = run;
      }
    }

    const setLen = bestSet?.length || 0;
    const runLen = bestRun?.length || 0;
    const type = runLen > setLen ? 'run' : bestSet ? 'set' : null;
    const tiles = type === 'run' ? bestRun : type === 'set' ? bestSet : null;
    return { set: bestSet, run: bestRun, type, tiles, length: Math.max(setLen, runLen) };
  }

  /**
   * Plays the bot's turn according to the game's difficulty.
    * @param {Futile} game Active Futile game instance.
    * @returns {Promise<void>} Resolves when the turn is complete.
   */
  async takeTurn(game) {
    const difficulty = game.difficulty || 'medium';
    const [minMs, maxMs] = DELAY_RANGES[difficulty] ?? DELAY_RANGES.medium;
    const moveDelay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    this.#shortDelay = Math.max(150, Math.round(moveDelay * 0.25));
    await this.#pause(Math.max(300, Math.round(moveDelay * 0.5)));

    if (await this.#tryDirectMeld(game)) return;
    if (difficulty === 'hard' && (await this.#trySteal(game))) return;
    if (difficulty !== 'easy') await this.#tryExtendMelds(game);
    await this.#passTurn(game);
  }

  /**
   * Plays the largest set or run available directly in the hand.
   * @param {Futile} game Active Futile game instance.
   * @returns {Promise<boolean>} Whether a direct meld was played.
   */
  async #tryDirectMeld(game) {
    const hand = game.players[this.idx].hand.slice();
    const best = this.#findBestMeld(hand);
    if (!best.tiles || best.tiles.length < 3) return false;

    const result = await game.createMeld({ handTileIds: best.tiles.map((t) => t.id) });
    if (!result.ok) return false;
    game.checkForWin();
    await this.#pause(this.#shortDelay);
    await this.#passTurn(game);
    return true;
  }

  /**
   * Steals one tile when it enables a larger meld than a direct play.
   * @param {Futile} game Active Futile game instance.
   * @returns {Promise<boolean>} Whether a stolen tile was used.
   */
  async #trySteal(game) {
    const me = game.players[this.idx];
    if (me.hand.length === 0) return false;
    const hand = me.hand.slice();
    const direct = this.#findBestMeld(hand);

    for (let owner = 0; owner < game.players.length; owner++) {
      if (owner === this.idx) continue;
      const melds = game.players[owner].playedMelds;
      for (let mi = 0; mi < melds.length; mi++) {
        const source = melds[mi];
        for (const stolen of source) {
          const remaining = source.filter((t) => t.id !== stolen.id);
          if (remaining.length > 0 && !(isSet(remaining) || isRun(remaining))) continue;

          const best = this.#findBestMeld([...hand, stolen]);
          if (!best.tiles || best.tiles.length < 3) continue;
          if (best.length <= direct.length) continue; // not an improvement
          if (!best.tiles.some((t) => t.id === stolen.id)) continue; // must use the stolen tile

          const handTileIds = best.tiles.filter((t) => t.id !== stolen.id).map((t) => t.id);
          const result = await game.createMeld({ handTileIds, meldTileIds: [stolen.id] });
          if (result.ok) {
            game.checkForWin();
            await this.#pause(this.#shortDelay);
            await this.#passTurn(game);
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Extends any existing meld that can legally accept hand tiles.
   * @param {Futile} game Active Futile game instance.
   * @returns {Promise<boolean>} Whether at least one meld was extended.
   */
  async #tryExtendMelds(game) {
    const me = game.players[this.idx];
    if (!me.hasPlayedMeld) return false;
    let acted = false;

    for (let owner = 0; owner < game.players.length; owner++) {
      const melds = game.players[owner].playedMelds;
      for (let mi = 0; mi < melds.length; mi++) {
        const dest = melds[mi];
        if (!dest || dest.length === 0) continue;

        let handTileIds = null;
        if (isSet(dest)) {
          const num = dest[0].number;
          const cands = me.hand.filter((t) => t.number === num);
          if (cands.length) handTileIds = cands.map((t) => t.id);
        } else if (isRun(dest)) {
          handTileIds = this.#planRunExtension(dest, me.hand);
        }
        if (!handTileIds || handTileIds.length === 0) continue;

        const result = await game.addToMeld({ targetOwner: owner, targetMeldIdx: mi, handTileIds });
        await this.#pause(this.#shortDelay);
        if (result.ok) {
          game.checkForWin();
          acted = true;
        }
      }
    }
    return acted;
  }

  /**
   * Chooses tiles that fill a run's gaps, or extend either end of the run.
   * @param {Tile[]} dest Existing destination run.
   * @param {Tile[]} hand Tiles available to the AI.
   * @returns {string[]|null} Selected hand tile ids, or `null` when no extension exists.
   */
  #planRunExtension(dest, hand) {
    const colour = dest[0].colour;
    const sameColour = hand.filter((t) => t.colour === colour);
    if (!sameColour.length) return null;

    const existing = [...new Set(dest.map((t) => t.number))].sort((a, b) => a - b);
    const min = existing[0];
    const max = existing[existing.length - 1];

    const available = new Map();
    for (const t of sameColour) {
      const arr = available.get(t.number) ?? [];
      arr.push(t);
      available.set(t.number, arr);
    }

    const wanted = [];
    const gaps = [];
    for (let n = min; n <= max; n++) if (!existing.includes(n)) gaps.push(n);
    if (gaps.length && gaps.every((n) => available.has(n))) {
      wanted.push(...gaps);
    } else {
      let cur = max + 1;
      while (available.has(cur)) wanted.push(cur++);
      cur = min - 1;
      while (available.has(cur)) wanted.push(cur--);
    }
    if (wanted.length === 0) return null;

    const union = [...new Set([...existing, ...wanted])].sort((a, b) => a - b);
    if (union[union.length - 1] - union[0] + 1 !== union.length) return null;

    const ids = [];
    for (const n of wanted) {
      const arr = available.get(n);
      if (!arr || !arr.length) return null;
      ids.push(arr.shift().id);
    }
    return ids;
  }

  /**
   * Passes the lowest tile and ends the turn.
   * @param {Futile} game Active Futile game instance.
   * @returns {Promise<void>} Resolves when the turn has ended.
   */
  async #passTurn(game) {
    const hand = game.players[this.idx].hand;
    const passId = hand.length ? hand[0].id : null;
    await game.endTurn(passId);
  }
}
