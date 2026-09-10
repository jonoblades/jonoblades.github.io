import BaseClass from "../scripts/BaseClass.js";

class Resume extends BaseClass {
  constructor() {
    super();
    this.init(async () => {
      await this.#init();
    });
  }
  
  async #init() {
    this.#viewCvMode();
  }

  #viewCvMode() {
    const isResume = window.location.pathname === '/resume/';
    const queryParams = new URLSearchParams(window.location.search);
    const showCvMode = isResume && queryParams.get('cv') === 'true';
    const stylesheetId = 'CvStylesheet';

    if (showCvMode) {
      this.#addCvLink(false);
      if (!document.getElementById(stylesheetId)) {
        const stylesheet = document.createElement('link');
        stylesheet.id = stylesheetId;
        stylesheet.rel = 'stylesheet';
        stylesheet.href = './cv.css';
        document.head.appendChild(stylesheet);
      }
    } else if (isResume) {
      this.#addCvLink(true);
      document.getElementById(stylesheetId)?.remove();
    } else {
      document.getElementById(stylesheetId)?.remove();
    }
  }

  #addCvLink(isCvLink) {
    const viewCvLink = document.createElement('a');
    viewCvLink.classList.add('no-print');
    viewCvLink.textContent = `View ${isCvLink ? '2-page CV' : 'full résumé'}`;
    viewCvLink.href = `${window.location.pathname}${isCvLink ? '?cv=true' : ''}`;
    const header = document.querySelector('header');
    const spacer = header?.querySelector('.spacer');
    header?.insertBefore(viewCvLink, spacer);
  }
}

new Resume();