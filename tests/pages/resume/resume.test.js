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
    document.body.innerHTML = '<main id="main-content"><div class="t-o-c"></div></main>';
  });

  it('adds a link to the full resume in normal resume mode', async () => {
    await loadResume();
    initializePage('/resume/');

    const link = document.querySelector('#main-content a.no-print');
    expect(link?.textContent).toBe('View 2-page, printable CV');
    expect(link?.getAttribute('href')).toBe('/resume/?cv=true');
    expect(document.getElementById('CvStylesheet')).toBeNull();
  });

  it('switches to the CV stylesheet and adds a full resume link in CV mode', async () => {
    await loadResume();
    initializePage('/resume/?cv=true');

    const link = document.querySelector('#main-content a.no-print');
    const stylesheet = document.getElementById('CvStylesheet');
    expect(link?.textContent).toBe('View full résumé');
    expect(link?.getAttribute('href')).toBe('/resume/');
    expect(stylesheet).toMatchObject({ rel: 'stylesheet', href: 'http://localhost:3000/resume/cv.css' });
  });

  it('inserts the mode controls before the table of contents', async () => {
    await loadResume();
    initializePage('/resume/');

    const main = document.querySelector('#main-content');
    expect(main?.firstElementChild?.className).toBe('button-container');
    expect(main?.firstElementChild?.textContent).toBe('View 2-page, printable CV');
    expect(main?.lastElementChild?.className).toBe('t-o-c');
  });

  it('removes an existing CV stylesheet outside CV mode', async () => {
    document.head.innerHTML = '<link id="CvStylesheet" rel="stylesheet" href="./cv.css">';
    await loadResume();
    initializePage('/writing/');

    expect(document.getElementById('CvStylesheet')).toBeNull();
  });
});