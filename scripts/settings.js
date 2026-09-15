/**
 * Persistent settings service backed by localStorage.
 * @module settings
 */

/**
 * Theme preference type.
 * @typedef {'system' | 'other'} Theme
 */

/**
 * Futile game settings.
 * @typedef {object} FutileSettings
 * @property {number} playerCount Number of players.
 * @property {'easy' | 'medium' | 'hard'} difficulty Game difficulty.
 */

/**
 * Wordley game settings.
 * @typedef {object} WordleySettings
 * @property {number} wordLength Length of the Wordley word.
 * @property {number} playerCount Number of players.
 * @property {number} timerDuration Duration of the game timer in seconds.
 */

/**
 * Guess result totals for one Wordley word length in single-player mode.
 * @typedef {{
 *   1?: number;
 *   2?: number;
 *   3?: number;
 *   4?: number;
 *   5?: number;
 *   6?: number;
 *   failed: number;
 * }} WordleySinglePlayerStats
 */

/**
 * Win and loss totals for one Wordley player and word length.
 * @typedef {object} WordleyPlayerStats
 * @property {number} wins Games won.
 * @property {number} losses Games lost.
 */

/**
 * Persisted Wordley statistics grouped by mode and word length.
 * @typedef {object} WordleyStats
 * @property {{ [wordLength: number]: WordleySinglePlayerStats }} singlePlayer Single-player guess totals.
 * @property {{
 *   player1: { [wordLength: number]: WordleyPlayerStats };
 *   player2: { [wordLength: number]: WordleyPlayerStats };
 *   draws: { [wordLength: number]: number };
 * }} twoPlayer Two-player win, loss, and draw totals.
 */

/**
 * Values managed by the settings service.
 * @typedef {object} SettingsStore
 * @property {Theme} theme Theme preference.
 * @property {FutileSettings} futile_settings Futile game settings or its legacy default key.
 * @property {WordleySettings} wordley_settings Wordley game settings or its legacy default key.
 * @property {WordleyStats} wordley_stats Wordley game statistics or its legacy default key.
 */

/**
 * Provides JSON-backed settings and statistics for the site.
 */
class SettingsService {
  /**
   * In-memory settings values loaded from localStorage.
   * @type {SettingsStore}
   */
  #settings = {
    theme: 'system',
    futile_settings: {
      playerCount: 1,
      difficulty: 'easy'
    },
    wordley_settings: {
      wordLength: 5,
      playerCount: 1,
      timerDuration: 60
    },
    wordley_stats: {
      singlePlayer: {},
      twoPlayer: {
        player1: {},
        player2: {},
        draws: {}
      }
    }
  }

  /**
   * Creates the service and registers its DOM-ready load callback.
   */
  constructor() {
    document.addEventListener('DOMContentLoaded', () => {
      this.#loadSettings();
    });
  }
  
  /**
   * Loads known settings from localStorage into the in-memory store.
   * @returns {void}
   */
  #loadSettings() {
    /** @type {(keyof SettingsStore)[]} */
    const keys = /** @type {(keyof SettingsStore)[]} */ (Object.keys(this.#settings));
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        this.#settings[key] = JSON.parse(value);
      }
    });
  }

  /**
   * Stores one value in memory and serializes it to localStorage.
   * @param {keyof SettingsStore} key Setting key to persist.
   * @param {any} value Value to serialize.
   * @returns {void}
   */
  #saveSetting(key, value) {
    this.#settings[key] = value;
    localStorage.setItem(key, JSON.stringify(value));
  }

  /**
   * Returns the persisted theme preference.
   * @returns {Theme} Current theme value.
   */
  get theme() {
    return this.#settings.theme;
  }

  /**
   * Persists a theme preference.
   * @param {Theme} value Theme value to store.
   * @returns {void}
   */
  set theme(value) {
    this.#saveSetting('theme', value);
  }

  /**
   * Returns persisted Futile game settings.
   * @returns {FutileSettings} Current Futile settings.
   */
  get futile_settings() {
    return this.#settings.futile_settings;
  }

  /**
   * Persists Futile game settings.
   * @param {FutileSettings} value Settings value to store.
   * @returns {void}
   */
  set futile_settings(value) {
    this.#saveSetting('futile_settings', value);
  }

  /**
   * Returns persisted Wordley game settings.
   * @returns {WordleySettings} Current Wordley settings.
   */
  get wordley_settings() {
    return this.#settings.wordley_settings;
  }

  /**
   * Persists Wordley game settings.
   * @param {WordleySettings} value Settings value to store.
   * @returns {void}
   */
  set wordley_settings(value) {
    this.#saveSetting('wordley_settings', value);
  }

  /**
   * Returns persisted Wordley statistics.
   * @returns {WordleyStats} Current Wordley statistics.
   */
  get wordley_stats() {
    return this.#settings.wordley_stats;
  }

  /**
   * Persists Wordley statistics.
   * @param {WordleyStats} value Statistics value to store.
   * @returns {void}
   */
  set wordley_stats(value) {
    this.#saveSetting('wordley_stats', value);
  }
}

const settingsService = new SettingsService();
export default settingsService;