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

function setServiceWorker(serviceWorker) {
  Object.defineProperty(navigator, 'serviceWorker', {
    configurable: true,
    value: serviceWorker
  });
}

describe('Main entry point', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <ul id="TableOfContents" class="hidden"></ul>
      <input id="ThemeToggle" type="checkbox">
      <button id="ShareButton" class="hidden">Share</button>
    `;
    localStorage.clear();
    delete navigator.serviceWorker;
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

  it('does not register a service worker when unsupported', async () => {
    const addEventListener = vi.spyOn(window, 'addEventListener')
      .mockImplementation(() => {});

    await loadMain();

    expect(addEventListener).not.toHaveBeenCalledWith(
      'load',
      expect.any(Function)
    );
    addEventListener.mockRestore();
  });

  it('registers and updates the service worker after the page loads', async () => {
    const update = vi.fn().mockResolvedValue();
    const register = vi.fn().mockResolvedValue({
      scope: 'https://example.test/',
      update
    });
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const addEventListener = vi.spyOn(window, 'addEventListener')
      .mockImplementation(() => {});
    setServiceWorker({ register });

    await loadMain();
    const loadListener = addEventListener.mock.calls
      .find(([event]) => event === 'load')[1];
    await loadListener();

    expect(register).toHaveBeenCalledWith('/service-worker.js', {
      updateViaCache: 'none'
    });
    expect(info).toHaveBeenCalledWith(
      'Service worker registered:',
      'https://example.test/'
    );
    addEventListener.mockRestore();
    info.mockRestore();
  });

  it('logs a service worker registration or update failure', async () => {
    const error = new Error('Update failed');
    const register = vi.fn().mockResolvedValue({
      scope: 'https://example.test/',
      update: vi.fn().mockRejectedValue(error)
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const addEventListener = vi.spyOn(window, 'addEventListener')
      .mockImplementation(() => {});
    setServiceWorker({ register });

    await loadMain();
    const loadListener = addEventListener.mock.calls
      .find(([event]) => event === 'load')[1];
    await loadListener();

    expect(consoleError).toHaveBeenCalledWith(
      'Service worker registration failed:',
      error
    );
    addEventListener.mockRestore();
    consoleError.mockRestore();
  });
});