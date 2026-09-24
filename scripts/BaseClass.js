/**
 * Shared lifecycle, settings, and event-listener management for page classes.
 * @module BaseClass
 */
import settingsService from './Settings.js';

/**
 * Shape of a tracked DOM event listener.
 * @typedef {object} ListenerRecord
 * @property {EventTarget} element Element that owns the listener.
 * @property {string} event Event name.
 * @property {EventListener} handler Listener callback.
 */

/** Base class for browser page and game controllers. */
class BaseClass {
  /**
   * Shared settings service used by the controller.
   * @type {typeof settingsService}
   */
  settingsService;
  /**
   * Event listeners registered through {@link addListener}.
   * @type {ListenerRecord[]}
   */
  eventListeners = [];

  /** Initializes the controller with the shared settings service. */
  constructor() {
    this.settingsService = settingsService;   
  }

  /**
   * Runs an initializer after the DOM has finished loading.
   * @param {(() => void|Promise<void>)|undefined} [initCallback] Initialization callback.
   * @returns {void}
   */
  init(initCallback) {
    document.addEventListener('DOMContentLoaded', () => {
      if (initCallback) initCallback();
    });
  }

  /**
   * Registers and tracks an event listener for later cleanup.
   * @param {EventTarget} element Event target that receives the listener.
   * @param {string} event Event name to listen for.
   * @param {EventListener} handler Callback invoked when the event occurs.
   * @returns {void}
   */
  addListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  /**
   * Removes every listener registered through {@link addListener}.
   * @returns {void}
   */
  tearDown() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}

export default BaseClass;