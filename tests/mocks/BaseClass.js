// Test-double for the app's BaseClass (real one lives at /scripts/BaseClass.js).
// Mirrors the real shape: settingsService, eventListeners tracking, tearDown.
// The one deliberate difference: init() STORES the callback instead of waiting
// for DOMContentLoaded, so a constructed Futile stays un-started and tests can
// configure players/hands directly (call _ready() if you ever want to run it).
const defaults = {
  theme: 'system',
  futile_settings: 'futile_settings',
  wordley_settings: 'wordley_settings',
  wordley_stats: 'wordley_stats',
};

const settingsService = Object.defineProperties(
  {},
  Object.fromEntries(
    Object.entries(defaults).map(([key, fallback]) => [
      key,
      {
        get() {
          const value = localStorage.getItem(key);
          return value === null ? fallback : JSON.parse(value);
        },
        set(value) {
          localStorage.setItem(key, JSON.stringify(value));
        },
      },
    ]),
  ),
);

export default class BaseClass {
  settingsService = settingsService;
  eventListeners = [];

  init(initCallback) {
    this._readyCallback = initCallback;
  }

  _ready() {
    if (this._readyCallback) return this._readyCallback();
    return undefined;
  }

  addListener(element, event, handler) {
    if (element && typeof element.addEventListener === 'function') {
      element.addEventListener(event, handler);
      this.eventListeners.push({ element, event, handler });
    }
  }

  tearDown() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}