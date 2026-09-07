export default class Enhancements {
  constructor() {
    document.addEventListener('DOMContentLoaded', () => {
      this.#init();
      this.#addShareButton();
    });
  }

  #init() {
    document.body.classList.add('js');
    this.#initTableOfContents();
    this.#viewCvMode();
  }

  #viewCvMode() {
    const pageName = window.location.pathname.split('/').pop();
    const isResume = pageName === 'resume.html';
    const queryParams = new URLSearchParams(window.location.search);
    const showCvMode = isResume && queryParams.get('cv') === 'true';
    const stylesheetId = 'CvStylesheet';

    if (showCvMode) {
      this.#addCvLink(false);
      if (!document.getElementById(stylesheetId)) {
        const stylesheet = document.createElement('link');
        stylesheet.id = stylesheetId;
        stylesheet.rel = 'stylesheet';
        stylesheet.href = './styles/cv.css';
        document.head.appendChild(stylesheet);
      }
    } else if (isResume) {
      this.#addCvLink(true);
      document.getElementById(stylesheetId)?.remove();
    } else {
      document.getElementById(stylesheetId)?.remove();
    }
  }

  #initTableOfContents() {
    const toc = document.getElementById('TableOfContents');
    if (toc) {
      const titles = document.querySelectorAll('h2, h3');
      if (titles.length > 0) {
        titles.forEach(title => {
          if (!title.id) {
            title.id = title.textContent.toLowerCase().replace(/\s+/g, '-');
          }
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.textContent = title.textContent;
          link.href = `#${title.id}`;
          link.addEventListener('click', () => {
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
      }
    }
  }

  #addShareButton() {
    if (navigator && navigator.share) {
      const shareButton = document.getElementById('ShareButton');
      if (shareButton) {
        shareButton.style.display = 'block';
        shareButton.addEventListener('click', async () => {
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

  #addCvLink(isCvLink) {
    const viewCvLink = document.createElement('a');
    viewCvLink.classList.add('no-print');
    viewCvLink.textContent = `View as ${isCvLink ? '2-page CV' : 'résumé'}`;
    viewCvLink.href = `${window.location.pathname}${isCvLink ? '?cv=true' : ''}`;
    const header = document.querySelector('header');
    const spacer = header?.querySelector('.spacer');
    header?.insertBefore(viewCvLink, spacer);
  }
}