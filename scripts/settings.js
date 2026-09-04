class SettingsService {
  #settings = {
    theme: 'system'
  }

  constructor() {
    document.addEventListener('DOMContentLoaded', () => {
      this.#loadSettings();
      this.#addThemeToggleListener();
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

  #addThemeToggleListener() {
    const themeToggleCheckbox = document.getElementById('ThemeToggle').control;
    themeToggleCheckbox.addEventListener('change', (ev) => {
      this.theme = ev.currentTarget.checked ? 'other' : 'system';
    });
    themeToggleCheckbox.checked = this.theme === 'other';
  }

  get theme() {
    return this.#settings.theme;
  }

  set theme(value) {
    this.#saveSetting('theme', value);
  }
}

const settingsService = new SettingsService();
export default settingsService;