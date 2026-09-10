import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadResume() {
  vi.resetModules();
  await import('../../../resume/resume.js');
}

function initializePage(path) {
  window.history.replaceState({}, '', path);
  document.dispatchEvent(new Event('DOMContentLoaded'));
}

describe('resume page', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.body.innerHTML = '<header><div class="spacer"></div></header>';
  });

  it('adds a link to the full resume in normal resume mode', async () => {
    await loadResume();
    initializePage('/resume/');

    const link = document.querySelector('header a.no-print');
    expect(link?.textContent).toBe('View 2-page CV');
    expect(link?.getAttribute('href')).toBe('/resume/?cv=true');
    expect(document.getElementById('CvStylesheet')).toBeNull();
  });

  it('switches to the CV stylesheet and adds a full resume link in CV mode', async () => {
    await loadResume();
    initializePage('/resume/?cv=true');

    const link = document.querySelector('header a.no-print');
    const stylesheet = document.getElementById('CvStylesheet');
    expect(link?.textContent).toBe('View full résumé');
    expect(link?.getAttribute('href')).toBe('/resume/');
    expect(stylesheet).toMatchObject({ rel: 'stylesheet', href: 'http://localhost:3000/resume/cv.css' });
  });

  it('inserts the mode link before the header spacer', async () => {
    await loadResume();
    initializePage('/resume/');

    const header = document.querySelector('header');
    expect(header?.firstElementChild?.textContent).toBe('View 2-page CV');
    expect(header?.lastElementChild?.className).toBe('spacer');
  });

  it('removes an existing CV stylesheet outside CV mode', async () => {
    document.head.innerHTML = '<link id="CvStylesheet" rel="stylesheet" href="./cv.css">';
    await loadResume();
    initializePage('/writing/');

    expect(document.getElementById('CvStylesheet')).toBeNull();
  });
});