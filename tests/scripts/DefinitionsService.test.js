import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadService() {
  vi.resetModules();
  const module = await import('../../scripts/DefinitionsService.js');
  return module.default;
}

function response(body, ok = true) {
  return {
    ok,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe('DefinitionsService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  describe('getWords', () => {
    it('loads five-letter words by default and returns a Set', async () => {
      const fetch = vi.fn().mockResolvedValue(response(['cigar', 'arise']));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      const words = await service.getWords();

      expect(words).toEqual(new Set(['cigar', 'arise']));
      expect(words).toBeInstanceOf(Set);
      expect(fetch).toHaveBeenCalledWith('../data/words-5-letter.json');
    });

    it.each([
      [null, 'Word length is required'],
      [0, 'Word length is required'],
      [3, 'Word length must be at least 4'],
      [7, 'Word length must be at most 6'],
    ])('rejects invalid word length %s', async (length, message) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.getWords(length)).rejects.toThrow(message);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('loads each supported word length from the matching URL', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['four']))
        .mockResolvedValueOnce(response(['five']))
        .mockResolvedValueOnce(response(['six']));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.getWords(4)).resolves.toEqual(new Set(['four']));
      await expect(service.getWords(5)).resolves.toEqual(new Set(['five']));
      await expect(service.getWords(6)).resolves.toEqual(new Set(['six']));

      expect(fetch).toHaveBeenNthCalledWith(1, '../data/words-4-letter.json');
      expect(fetch).toHaveBeenNthCalledWith(2, '../data/words-5-letter.json');
      expect(fetch).toHaveBeenNthCalledWith(3, '../data/words-6-letter.json');
    });

    it('caches loaded words for subsequent requests of the same length', async () => {
      const fetch = vi.fn().mockResolvedValue(response(['cigar']));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      const first = await service.getWords(5);
      const second = await service.getWords(5);

      expect(second).toBe(first);
      expect(fetch).toHaveBeenCalledOnce();
    });

    it('reloads an empty word list', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response([]))
        .mockResolvedValueOnce(response(['cigar']));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.getWords(5)).resolves.toEqual(new Set());
      await expect(service.getWords(5)).resolves.toEqual(new Set(['cigar']));
      expect(fetch).toHaveBeenCalledTimes(2);
    });

    it('rejects when the word-list response is unsuccessful', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, false)));
      const service = await loadService();

      await expect(service.getWords(4)).rejects.toThrow('Unable to load words-4-letter.json');
    });

    it('propagates word-list fetch errors', async () => {
      const error = new Error('network unavailable');
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(error));
      const service = await loadService();

      await expect(service.getWords(6)).rejects.toBe(error);
    });
  });

  describe('validateWord', () => {
    it('returns true for a word in the requested length list', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['cigar'])));
      const service = await loadService();

      await expect(service.validateWord('cigar')).resolves.toBe(true);
    });

    it('returns false for a word absent from the list', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(['cigar'])));
      const service = await loadService();

      await expect(service.validateWord('arise')).resolves.toBe(false);
    });

    it.each(['', null, undefined, 'cat', 'elephant'])('rejects invalid word input %s', async (word) => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.validateWord(word)).resolves.toBe(false);
      expect(fetch).not.toHaveBeenCalled();
    });

    it('uses the cached word list when validating multiple words', async () => {
      const fetch = vi.fn().mockResolvedValue(response(['cigar', 'arise']));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.validateWord('cigar')).resolves.toBe(true);
      await expect(service.validateWord('arise')).resolves.toBe(true);
      expect(fetch).toHaveBeenCalledOnce();
    });
  });

  describe('fetchDefinition', () => {
    it('returns null without making requests for an invalid word', async () => {
      const fetch = vi.fn();
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('')).resolves.toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });

    it('returns Datamuse definitions with known and unknown part-of-speech codes', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['cigar']))
        .mockResolvedValueOnce(response([
          { defs: ['n\ta smoking cylinder', 'xyz\ta made-up definition'] },
        ]));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('cigar')).resolves.toEqual([
        { partOfSpeech: 'noun', definition: 'a smoking cylinder' },
        { partOfSpeech: 'xyz', definition: 'a made-up definition' },
      ]);
      expect(fetch).toHaveBeenNthCalledWith(
        2,
        'https://api.datamuse.com/words?sp=cigar&md=d&max=1',
      );
    });

    it('filters empty Datamuse definitions and returns null when none remain', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['cigar']))
        .mockResolvedValueOnce(response([{ defs: ['n\t'] }]));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('cigar')).resolves.toBeNull();
    });

    it('falls back to the dictionary API when Datamuse fails', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['cigar']))
        .mockRejectedValueOnce(new Error('Datamuse unavailable'))
        .mockResolvedValueOnce(response({
          0: {
            meanings: [
              { partOfSpeech: 'noun', definitions: [{ definition: 'a smoking cylinder' }] },
              { partOfSpeech: 'verb', definitions: [{ definition: 'to smoke' }] },
            ],
          },
        }));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('cigar')).resolves.toEqual([
        { partOfSpeech: 'noun', definition: 'a smoking cylinder' },
        { partOfSpeech: 'verb', definition: 'to smoke' },
      ]);
      expect(fetch).toHaveBeenLastCalledWith(
        'https://api.dictionaryapi.dev/api/v2/entries/en/cigar',
        { headers: { Accept: 'application/json' } },
      );
    });

    it('falls back when Datamuse returns no result', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['cigar']))
        .mockResolvedValueOnce(response([{ defs: [] }]))
        .mockResolvedValueOnce(response({ 0: { meanings: [] } }));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('cigar')).resolves.toBeNull();
      expect(fetch).toHaveBeenCalledWith(
        'https://api.dictionaryapi.dev/api/v2/entries/en/cigar',
        { headers: { Accept: 'application/json' } },
      );
    });

    it('returns null for an unsuccessful dictionary response', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['cigar']))
        .mockResolvedValueOnce(response({}, false))
        .mockResolvedValueOnce(response({}, false));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('cigar')).resolves.toBeNull();
    });

    it('returns null when dictionary meanings contain no usable entries', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['cigar']))
        .mockRejectedValueOnce(new Error('Datamuse unavailable'))
        .mockResolvedValueOnce(response({
          0: {
            meanings: [
              { partOfSpeech: '', definitions: [{ definition: 'ignored' }] },
              { partOfSpeech: 'noun', definitions: [{}] },
            ],
          },
        }));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('cigar')).resolves.toBeNull();
    });

    it('returns null when both definition providers fail', async () => {
      const fetch = vi.fn()
        .mockResolvedValueOnce(response(['cigar']))
        .mockRejectedValueOnce(new Error('Datamuse unavailable'))
        .mockRejectedValueOnce(new Error('Dictionary unavailable'));
      vi.stubGlobal('fetch', fetch);
      const service = await loadService();

      await expect(service.fetchDefinition('cigar')).resolves.toBeNull();
    });
  });
});