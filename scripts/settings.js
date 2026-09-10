class SettingsService {
  #settings = {
    theme: 'system',
    wordley_settings: 'wordley_settings',
    wordley_stats: 'wordley_stats'
  }

  constructor() {
    document.addEventListener('DOMContentLoaded', () => {
      this.#loadSettings();
    });
  }
  
  #loadSettings() {
    const keys = Object.keys(this.#settings);
    keys.forEach(key => {
      const value = localStorage.getItem(key);
      if (value !== null) {
        this.#settings[key] = JSON.parse(value);
      }
    });
  }

  #saveSetting(key, value) {
    this.#settings[key] = value;
    localStorage.setItem(key, JSON.stringify(value));
  }

  get theme() {
    return this.#settings.theme;
  }

  set theme(value) {
    this.#saveSetting('theme', value);
  }

  get wordley_settings() {
    return this.#settings.wordley_settings;
  }

  set wordley_settings(value) {
    this.#saveSetting('wordley_settings', value);
  }

  get wordley_stats() {
    return this.#settings.wordley_stats;
  }

  set wordley_stats(value) {
    this.#saveSetting('wordley_stats', value);
  }
}

const settingsService = new SettingsService();
export default settingsService;