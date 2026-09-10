class DefinitionsService {
  DATAMUSE_POS = Object.freeze({
    n: 'noun',
    v: 'verb',
    adj: 'adjective',
    adv: 'adverb',
    u: 'unknown',
  });

  #words = {
    '4letter': null,
    '5letter': null,
    '6letter': null
  };

  async getWords(wordLength = 5) {
    if (!wordLength) throw new Error('Word length is required');
    if (wordLength < 4) throw new Error('Word length must be at least 4');
    if (wordLength > 6) throw new Error('Word length must be at most 6');
    if (!this.#words[`${wordLength}letter`] || this.#words[`${wordLength}letter`].size === 0) {
      await this.#loadWords(wordLength);
    }
    return this.#words[`${wordLength}letter`];
  }

  async #loadWords(length = 5) {
    if (length < 4) throw new Error('Word length must be at least 4');
    if (length > 6) throw new Error('Word length must be at most 6');
    const response = await fetch(`../data/words-${length}-letter.json`);
    if (!response.ok) throw new Error(`Unable to load words-${length}-letter.json`);
    const words = await response.json();
    this.#words[`${length}letter`] = new Set(words);
    return words;
  }

  async #fetchDefinitionFromDictionaryApi(word) {
    const response = await fetch(
      `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`,
      {
        headers: {
          Accept: 'application/json',
        },
      },
    );

    if (!response || !response.ok) return null;

    const data = await response.json();
    const meanings = data?.[0]?.meanings;
    if (!meanings || meanings.length === 0) return null;

    const results = [];
    for (const meaning of meanings) {
      const partOfSpeech = meaning.partOfSpeech;
      const definition = meaning.definitions?.[0]?.definition;
      if (partOfSpeech && definition) {
        results.push({ partOfSpeech, definition });
      }
    }
    return results.length > 0 ? results : null;
  }

  async #fetchDefinitionFromDatamuse(word) {
    const response = await fetch(
      `https://api.datamuse.com/words?sp=${encodeURIComponent(word)}&md=d&max=1`,
    );

    if (!response || !response.ok) return null;

    const data = await response.json();
    const defs = data?.[0]?.defs;
    if (!defs || defs.length === 0) return null;

    const results = [];
    for (const entry of defs) {
      const [abbr, ...rest] = entry.split('\t');
      const definition = rest.join('\t').trim();
      if (!definition) continue;
      results.push({
        partOfSpeech: this.DATAMUSE_POS[abbr] ?? abbr,
        definition,
      });
    }
    return results.length > 0 ? results : null;
  }

  async fetchDefinition(word) {
    if (!word || await this.validateWord(word) === false) return null;

    try {
      const result = await this.#fetchDefinitionFromDatamuse(word);
      if (result) return result;
    } catch {
      // fall through to fallback provider
    }

    try {
      const result = await this.#fetchDefinitionFromDictionaryApi(word);
      if (result) return result;
    } catch {
      return null;
    }

    return null;
  }

  async validateWord(word) {
    if (!word) return false;
    if (word.length < 4 || word.length > 6) return false;
    const words = await this.getWords(word.length);
    return words.has(word);
  }
}

const definitionsService = new DefinitionsService();
export default definitionsService;
