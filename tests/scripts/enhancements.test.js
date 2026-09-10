import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadEnhancements() {
  vi.resetModules();
  const module = await import('../../scripts/enhancements.js');
  return module.default;
}

function dispatchDomContentLoaded() {
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

async function initializeEnhancements(Enhancements) {
  const addEventListener = vi.spyOn(document, 'addEventListener');
  new Enhancements();
  const initializer = addEventListener.mock.calls.at(-1)[1];
  initializer();
  await Promise.resolve();
  addEventListener.mockRestore();
}

describe('Enhancements', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = `
      <details open>
        <summary>Table of Contents</summary>
        <ul id="TableOfContents" class="hidden"></ul>
      </details>
      <input id="ThemeToggle" type="checkbox">
      <button id="ShareButton" class="hidden">Share</button>
    `;
    document.title = 'Test page';
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('marks the document as JavaScript-enabled when initialized', async () => {
    const Enhancements = await loadEnhancements();

    await initializeEnhancements(Enhancements);

    expect(document.body.classList.contains('js')).toBe(true);
  });

  it('builds a visible table of contents for more than three headings', async () => {
    document.querySelector('#TableOfContents').parentElement.insertAdjacentHTML(
      'afterend',
      '<h2>Getting Started</h2><h3>First Steps</h3><h2>Getting Started</h2><h2 id="custom">Already Named</h2>'
    );
    const Enhancements = await loadEnhancements();

    await initializeEnhancements(Enhancements);

    const links = [...document.querySelectorAll('#TableOfContents a')];
    expect(document.querySelector('#TableOfContents').classList.contains('hidden')).toBe(false);
    expect(links.map(link => [link.textContent, link.getAttribute('href')])).toEqual([
      ['Getting Started', '#getting-started'],
      ['First Steps', '#first-steps'],
      ['Getting Started', '#getting-started-2'],
      ['Already Named', '#custom']
    ]);
    expect(links[1].parentElement.classList.contains('sub-item')).toBe(true);
  });

  it('creates normalized heading ids and closes the TOC details when a link is clicked', async () => {
    document.querySelector('#TableOfContents').parentElement.insertAdjacentHTML(
      'afterend',
      '<h2>  Café: A   New   Start! </h2><h2>--- </h2><h2>Third</h2><h2>Fourth</h2>'
    );
    const Enhancements = await loadEnhancements();

    await initializeEnhancements(Enhancements);

    const headings = [...document.querySelectorAll('h2')];
    expect(headings.map(heading => heading.id)).toEqual([
      'cafe-a-new-start',
      'section',
      'third',
      'fourth'
    ]);

    const details = document.querySelector('details');
    expect(details.open).toBe(true);
    document.querySelector('#TableOfContents a').click();
    expect(details.open).toBe(false);
  });

  it('initializes the theme checkbox from settings and persists changes', async () => {
    localStorage.setItem('theme', JSON.stringify('other'));
    const Enhancements = await loadEnhancements();

    const settings = (await import('../../scripts/settings.js')).default;
    settings.theme = 'other';
    await initializeEnhancements(Enhancements);

    const checkbox = document.querySelector('#ThemeToggle');
    expect(checkbox.checked).toBe(true);

    checkbox.checked = false;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem('theme'))).toBe('system');

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(JSON.parse(localStorage.getItem('theme'))).toBe('other');
  });

  it('reveals the share button and shares the page metadata', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    document.head.innerHTML = '<meta name="description" content="A test description">';
    document.title = 'Test page';
    window.history.replaceState({}, '', '/test-page');
    const Enhancements = await loadEnhancements();

    await initializeEnhancements(Enhancements);
    document.querySelector('#ShareButton').click();
    await vi.waitFor(() => expect(share).toHaveBeenCalled());

    expect(document.querySelector('#ShareButton').classList.contains('hidden')).toBe(false);
    expect(share).toHaveBeenCalledWith({
      title: 'Test page',
      text: 'A test description',
      url: window.location.href
    });
  });

  it('uses the fallback share text when the description meta tag is absent', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const Enhancements = await loadEnhancements();

    await initializeEnhancements(Enhancements);
    document.querySelector('#ShareButton').click();
    await vi.waitFor(() => expect(share).toHaveBeenCalled());

    expect(share.mock.calls[0][0].text).toBe('Check out this page:');
  });

  it('logs sharing failures without throwing', async () => {
    const error = new Error('share unavailable');
    const share = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(navigator, 'share', { configurable: true, value: share });
    const Enhancements = await loadEnhancements();

    await initializeEnhancements(Enhancements);
    document.querySelector('#ShareButton').click();
    await vi.waitFor(() => expect(consoleError).toHaveBeenCalledWith('Error sharing:', error));
  });
});