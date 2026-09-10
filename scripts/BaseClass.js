import settingsService from './settings.js';

class BaseClass {
  settingsService;
  eventListeners = [];

  constructor() {
    this.settingsService = settingsService;   
  }

  init(initCallback) {
    document.addEventListener('DOMContentLoaded', () => {
      if (initCallback) initCallback();
    });
  }

  addListener(element, event, handler) {
    element.addEventListener(event, handler);
    this.eventListeners.push({ element, event, handler });
  }

  tearDown() {
    this.eventListeners.forEach(({ element, event, handler }) => {
      element.removeEventListener(event, handler);
    });
    this.eventListeners = [];
  }
}

export default BaseClass;