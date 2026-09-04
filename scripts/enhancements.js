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
    if (navigation && navigation.share) {
      const shareButton = document.getElementById('ShareButton');
      if (shareButton) {
        shareButton.style.display = 'block';
        shareButton.addEventListener('click', async () => {
          try {
            await navigation.share({
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