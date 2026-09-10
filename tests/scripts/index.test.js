import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadMain() {
  vi.resetModules();
  const module = await import('../../scripts/index.js');
  return module.default;
}

async function initializeMain(Main) {
  const addEventListener = vi.spyOn(document, 'addEventListener');
  new Main();
  const initializers = addEventListener.mock.calls
    .map(([, listener]) => listener)
    .filter(listener => typeof listener === 'function');
  initializers.at(-1)();
  await Promise.resolve();
  addEventListener.mockRestore();
}

describe('Main entry point', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <ul id="TableOfContents" class="hidden"></ul>
      <input id="ThemeToggle" type="checkbox">
      <button id="ShareButton" class="hidden">Share</button>
    `;
    localStorage.clear();
  });

  it('constructs the main enhancement entry point', async () => {
    const Main = await loadMain();

    expect(() => new Main()).not.toThrow();
  });

  it('initializes the enhancement entry point after DOMContentLoaded', async () => {
    const Main = await loadMain();
    await initializeMain(Main);

    expect(document.body.classList.contains('js')).toBe(true);
  });
});