import { beforeEach, describe, expect, it, vi } from 'vitest';

const defaultSettings = {
  theme: 'system',
  wordley_settings: 'wordley_settings',
  wordley_stats: 'wordley_stats'
};

async function loadSettingsService() {
  vi.resetModules();
  const module = await import('../../scripts/settings.js');
  return module.default;
}

function dispatchDomContentLoaded() {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

describe('settings service', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exposes the documented defaults before the DOM is ready', async () => {
    const settings = await loadSettingsService();

    expect(settings.theme).toBe(defaultSettings.theme);
    expect(settings.wordley_settings).toBe(defaultSettings.wordley_settings);
    expect(settings.wordley_stats).toBe(defaultSettings.wordley_stats);
  });

  it('loads stored values after DOMContentLoaded', async () => {
    localStorage.setItem('theme', JSON.stringify('dark'));
    localStorage.setItem('wordley_settings', JSON.stringify({ wordLength: 6, timer: true }));
    localStorage.setItem('wordley_stats', JSON.stringify({ played: 12, wins: 9 }));

    const settings = await loadSettingsService();
    dispatchDomContentLoaded();

    expect(settings.theme).toBe('dark');
    expect(settings.wordley_settings).toEqual({ wordLength: 6, timer: true });
    expect(settings.wordley_stats).toEqual({ played: 12, wins: 9 });
  });

  it('keeps defaults for keys that are absent from localStorage', async () => {
    localStorage.setItem('theme', JSON.stringify('light'));

    const settings = await loadSettingsService();
    dispatchDomContentLoaded();

    expect(settings.theme).toBe('light');
    expect(settings.wordley_settings).toBe(defaultSettings.wordley_settings);
    expect(settings.wordley_stats).toBe(defaultSettings.wordley_stats);
  });

  it('does not load unrelated localStorage keys', async () => {
    localStorage.setItem('unrelated', JSON.stringify('value'));

    const settings = await loadSettingsService();
    dispatchDomContentLoaded();

    expect(settings.theme).toBe(defaultSettings.theme);
    expect(settings.wordley_settings).toBe(defaultSettings.wordley_settings);
    expect(settings.wordley_stats).toBe(defaultSettings.wordley_stats);
  });

  it.each([
    ['theme', 'light'],
    ['theme', null],
    ['wordley_settings', { wordLength: 5, timer: false }],
    ['wordley_settings', ['classic', 'hard']],
    ['wordley_stats', { played: 3, wins: 2, currentStreak: 1 }],
    ['wordley_stats', 0]
  ])('persists %s values as JSON and returns the assigned value', async (key, value) => {
    const settings = await loadSettingsService();

    settings[key] = value;

    expect(settings[key]).toEqual(value);
    expect(localStorage.getItem(key)).toBe(JSON.stringify(value));
  });

  it('round-trips values written by setters through a later load', async () => {
    const settings = await loadSettingsService();
    const wordleySettings = { wordLength: 4, playerCount: 2 };
    const wordleyStats = { played: 7, wins: 4, guessDistribution: { 3: 2, 4: 2 } };

    settings.theme = 'other';
    settings.wordley_settings = wordleySettings;
    settings.wordley_stats = wordleyStats;

    const reloadedSettings = await loadSettingsService();
    dispatchDomContentLoaded();

    expect(reloadedSettings.theme).toBe('other');
    expect(reloadedSettings.wordley_settings).toEqual(wordleySettings);
    expect(reloadedSettings.wordley_stats).toEqual(wordleyStats);
  });
});