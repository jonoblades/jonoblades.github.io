import BaseClass from "./BaseClass.js";

export default class Enhancements extends BaseClass {
  constructor() {
    super();
    this.init(async () => {
      await this.#init();
    });
  }

  async #init() {
    document.body.classList.add('js');
    this.#initTableOfContents();
    this.#addShareButton();
    this.#addThemeToggleListener();
  }

  #initTableOfContents() {
    const toc = document.getElementById('TableOfContents');
    if (toc) {
      const titles = document.querySelectorAll('h2, h3');
      if (titles.length > 3) {
        titles.forEach(title => {
          if (!title.id) {
            const usedIds = new Set();
            title.id = this.#createHeadingId(
              title.textContent,
              usedIds
            );
            title.textContent.toLowerCase().replace(/\s+/g, '-');
          }
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.textContent = title.textContent;
          link.href = `#${title.id}`;
          this.addListener(link, 'click', () => {
            const tocDetails = toc.closest('details');
            if (tocDetails) {
              tocDetails.open = false;
            }
          });
          li.appendChild(link);
          if (title.tagName === 'H3') {
            li.classList.add('sub-item');
          }
          toc.appendChild(li);
        });
        toc.classList.remove('hidden');
      }
    }
  }

  #createHeadingId(text, usedIds) {
    const baseId = text
      .trim()
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'section';

    let id = baseId;
    let suffix = 2;

    while (usedIds.has(id) || document.getElementById(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }

    usedIds.add(id);
    return id;
  }

  #addThemeToggleListener() {
    const themeToggleCheckbox = document.getElementById('ThemeToggle');
    this.addListener(themeToggleCheckbox, 'change', (ev) => {
      this.settingsService.theme = ev.currentTarget.checked ? 'other' : 'system';
    });
    themeToggleCheckbox.checked = this.settingsService.theme === 'other';
  }

  #addShareButton() {
    if (navigator && navigator.share) {
      const shareButton = document.getElementById('ShareButton');
      if (shareButton) {
        shareButton.classList.remove('hidden');
        this.addListener(shareButton, 'click', async () => {
          try {
            await navigator.share({
              title: document.title,
              text: document
                .querySelector('meta[name="description"]')?.content ?? 'Check out this page:',
              url: window.location.href,
            });
          } catch (err) {
            console.error('Error sharing:', err);
          }
        });
      }
    }
  }
}