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
    const buttonContainer = document.createElement('div');
    buttonContainer.classList.add('button-container');
    const main = document.getElementById('main-content');
    const tableOfContents = main?.querySelector('.t-o-c');
    main?.insertBefore(buttonContainer, tableOfContents);

    if (showCvMode) {
      this.#addCvLink(buttonContainer, false);
      this.#addPrintButton(buttonContainer);
      if (!document.getElementById(stylesheetId)) {
        const stylesheet = document.createElement('link');
        stylesheet.id = stylesheetId;
        stylesheet.rel = 'stylesheet';
        stylesheet.href = './cv.css';
        document.head.appendChild(stylesheet);
      }
    } else if (isResume) {
      this.#addCvLink(buttonContainer, true);
      document.getElementById(stylesheetId)?.remove();
    } else {
      document.getElementById(stylesheetId)?.remove();
    }
  }

  #addCvLink(container, isCvLink) {
    const viewCvLink = document.createElement('a');
    viewCvLink.classList.add('btn');
    viewCvLink.classList.add('no-print');
    viewCvLink.textContent = `View ${isCvLink ? '2-page, printable CV' : 'full résumé'}`;
    viewCvLink.href = `${window.location.pathname}${isCvLink ? '?cv=true' : ''}`;
    container.appendChild(viewCvLink);
  }

  #addPrintButton(container) {
    const printButton = document.createElement('button');
    printButton.classList.add('btn');
    printButton.classList.add('no-print');
    printButton.textContent = 'Print';
    printButton.addEventListener('click', () => {
      window.print();
    });
    container?.appendChild(printButton);
  }
}

new Resume();