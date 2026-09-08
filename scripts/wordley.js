/**
 * @fileoverview Wordley - A Wordle-style word guessing game.
 * Features: configurable word lengths (4-6), timer mode, 1-2 player support,
 * localStorage persistence for settings and statistics.
 * @module game
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const STATUS_PRIORITY = Object.freeze({
  absent: 0,
  present: 1,
  correct: 2,
});

async function loadWords(length = 5) {
  const response = await fetch(`../data/words-${length}-letter.json`);
  if (!response.ok) throw new Error(`Unable to load words-${length}-letter.json`);
  return response.json();
}

const DATAMUSE_POS = Object.freeze({
  n: 'noun',
  v: 'verb',
  adj: 'adjective',
  adv: 'adverb',
  u: 'unknown',
});

async function fetchDefinitionFromDictionaryApi(word) {
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

// Fallback used when dictionaryapi.dev is unreachable (it has had recurring outages).
async function fetchDefinitionFromDatamuse(word) {
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
      partOfSpeech: DATAMUSE_POS[abbr] ?? abbr,
      definition,
    });
  }
  return results.length > 0 ? results : null;
}

async function fetchDefinition(word) {
  if (!word) return null;

  const isLocalHost =
    typeof window !== 'undefined' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (isLocalHost) {
    // return null;
  }

  try {
    return await fetchDefinitionFromDatamuse(word);
  } catch {
    // fall through to fallback provider
  }

  try {
    const result = await fetchDefinitionFromDictionaryApi(word);
    if (result) return result;
  } catch {
    return null;
  }
}

class Wordley {
  static STATS_KEY = 'wordley_stats';
  static SETTINGS_KEY = 'wordley_settings';

  #board = null;
  #form = null;
  #button = null;
  #resetButton = null;
  #lengthSelect = null;
  #lengthValue = null;
  #messageBox = null;
  #rowTemplate = null;
  #letterInputs = [];
  #alphaCols = [];
  #settingsDialog = null;
  #settingsBtn = null;
  #closeSettingsBtn = null;
  #timerSelect = null;
  #playerCountInputs = [];
  #turnIndicator = null;

  #alphabetTiles = new Map();
  #letterStatusMap = new Map();
  #allowedWords = [];
  #allowedWordsSet = new Set();
  #secret = null;
  #row = 0;
  #gameOver = false;
  #wordLength;
  #maxRows;
  #stats;
  #correctPositions = new Array(6).fill(null);
  #timerDuration = 0;
  #timerInterval = null;
  #timerElapsed = 0;
  #timerStartedFirstRow = false;
  #playerCount = 1;
  #currentPlayer = 1;
  #winner = null;

  constructor(options = {}) {
    this.options = {
      boardId: 'board',
      formId: 'guessForm',
      lengthSelectId: 'lengthSelect',
      resetButtonId: 'resetGame',
      alphaLeftId: 'alphaLeft',
      alphaRightId: 'alphaRight',
      buttonSelector: 'button',
      allowedWords: null,
      wordLength: 5,
      maxRows: 6,
      ...options,
    };

    this.#allowedWords = this.options.allowedWords ?? [];
    this.#allowedWordsSet = new Set(this.#allowedWords);
    this.#wordLength = this.options.wordLength;
    this.#maxRows = this.options.maxRows;
    this.#stats = this.#loadStats();
  }

  async init() {
    this.#board = this.options.board || document.getElementById(this.options.boardId);
    this.#form = this.options.form || document.getElementById(this.options.formId);
    this.#lengthSelect = this.options.lengthSelect || document.getElementById(this.options.lengthSelectId);
    this.#button = this.options.button || (this.#form ? this.#form.querySelector(this.options.buttonSelector) : null);
    this.#resetButton = this.options.resetButton || document.getElementById(this.options.resetButtonId);
    this.#alphaCols = [
      this.options.alphaLeft || document.getElementById(this.options.alphaLeftId),
      this.options.alphaRight || document.getElementById(this.options.alphaRightId),
    ];
    this.#messageBox = this.options.messageBox || document.getElementById('message');
    this.#rowTemplate = document.getElementById('RowTemplate');
    this.#letterInputs = Array.from(document.querySelectorAll('.guess-letter'));
    this.#lengthValue = document.getElementById('lengthValue');
    this.#settingsDialog = document.getElementById('settingsDialog');
    this.#settingsBtn = document.getElementById('settingsBtn');
    this.#closeSettingsBtn = document.getElementById('closeSettings');
    this.#timerSelect = document.getElementById('timerSelect');
    this.#playerCountInputs = document.querySelectorAll('input[name="playerCount"]');
    this.#turnIndicator = document.getElementById('turnIndicator');

    if (
      !this.#board ||
      !this.#form ||
      !this.#rowTemplate ||
      this.#letterInputs.length === 0 ||
      this.#alphaCols.some((col) => !col) ||
      !this.#messageBox
    ) {
      throw new Error('Missing required DOM elements for the game.');
    }

    this.#loadSettings();

    if (this.#lengthSelect) {
      this.#lengthSelect.value = String(this.#wordLength);
      this.#lengthSelect.addEventListener('change', this.#handleLengthChange);
    }

    await this.#applyLength(this.#wordLength);

    this.#form.addEventListener('submit', this.#handleSubmit);
    if (this.#resetButton) {
      this.#resetButton.addEventListener('click', this.#handleReset);
    }

    if (this.#settingsBtn && this.#settingsDialog) {
      this.#settingsBtn.addEventListener('click', this.#openSettings);
    }
    if (this.#closeSettingsBtn && this.#settingsDialog) {
      this.#closeSettingsBtn.addEventListener('click', this.#closeSettings);
    }
    if (this.#settingsDialog) {
      this.#settingsDialog.addEventListener('click', this.#handleDialogBackdrop);
    }

    if (this.#timerSelect) {
      this.#timerSelect.addEventListener('change', this.#handleTimerChange);
    }

    this.#playerCountInputs.forEach((input) => {
      input.addEventListener('change', this.#handlePlayerCountChange);
    });

    this.#letterInputs.forEach((input) => {
      input.addEventListener('tile-input', this.#handleLetterInput);
      input.addEventListener('tile-keydown', this.#handleLetterKeydown);
    });

    this.#focusFirstLetter();
  }

  async #applyLength(length) {
    this.#wordLength = Number(length) || 5;
    const baseRows = Math.max(6, this.#wordLength + 1);

    if (this.#playerCount === 2) {
      const extraRows = baseRows + 2;
      this.#maxRows = extraRows % 2 === 0 ? extraRows : extraRows + 1;
    } else {
      this.#maxRows = baseRows;
    }

    this.#allowedWords = await loadWords(this.#wordLength);
    this.#allowedWordsSet = new Set(this.#allowedWords);

    if (this.#lengthSelect) {
      this.#lengthSelect.setAttribute('data-length', String(this.#wordLength));
    }
    this.#updateLengthValue(this.#wordLength);
    this.#resetAlphabetStatuses();

    this.#letterInputs.forEach((input, idx) => {
      const active = idx < this.#wordLength;
      input.disabled = !active;
      input.value = '';
    });

    this.#secret = this.#pickSecret();
    this.#row = 0;
    this.#gameOver = false;
    this.#timerStartedFirstRow = false;
    this.#currentPlayer = 1;
    this.#winner = null;
    if (this.#button) this.#button.disabled = false;
    this.#buildBoard();
    this.#focusFirstLetter();
    this.#updateRemainingMessage();
    this.#updateTurnIndicator();
    this.#resetTimer();
  }

  #buildBoard() {
    const turnIndicator = this.#turnIndicator;
    this.#board.innerHTML = '';
    if (turnIndicator) {
      this.#board.appendChild(turnIndicator);
    }
    this.#buildAlphabet();
    this.#resetAlphabetStatuses();

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < this.#maxRows; i++) {
      const clone = this.#rowTemplate.content.firstElementChild.cloneNode(true);
      clone.dataset.row = String(i);
      fragment.appendChild(clone);
    }
    this.#board.appendChild(fragment);
  }

  #pickSecret() {
    return this.#allowedWords[Math.floor(Math.random() * this.#allowedWords.length)];
  }

  #buildAlphabet() {
    const letters = ALPHABET.split('');
    const slices = [letters.slice(0, 13), letters.slice(13)];

    this.#alphabetTiles.clear();

    slices.forEach((arr, idx) => {
      const container = this.#alphaCols[idx];
      const fragment = document.createDocumentFragment();

      arr.forEach((ch) => {
        const tile = document.createElement('game-tile');
        tile.classList.add('alpha-tile');
        tile.setAttribute('readonly', '');
        tile.value = ch;
        tile.dataset.letter = ch;
        fragment.appendChild(tile);
        this.#alphabetTiles.set(ch, tile);
      });

      if (container) {
        container.innerHTML = '';
        container.appendChild(fragment);
      }
    });
  }

  #resetAlphabetStatuses() {
    this.#letterStatusMap.clear();
    this.#alphabetTiles.forEach((tile) => {
      tile.status = '';
    });
    this.#correctPositions = new Array(6).fill(null);
    this.#updateInputPlaceholders();
  }

  #updateInputPlaceholders() {
    const inputs = this.#getActiveInputs();
    if (!inputs || inputs.length === 0) return;
    inputs.forEach((input, i) => {
      input.placeholder = this.#correctPositions[i] || '';
    });
  }

  #remainingGuesses() {
    return Math.max(0, this.#maxRows - this.#row);
  }

  #remainingMessage() {
    const remaining = this.#remainingGuesses();
    const label = remaining === 1 ? 'guess' : 'guesses';
    return `${remaining} ${label} remaining`;
  }

  #updateRemainingMessage() {
    if (this.#gameOver) return;
    this.#setMessage(this.#remainingMessage(), 'info');
  }

  #updateLengthValue(length) {
    if (this.#lengthValue) {
      this.#lengthValue.textContent = String(length);
    }
  }

  #setMessage(text, tone = 'info') {
    if (!this.#messageBox) return;
    let content = text;

    if (!content) {
      this.#messageBox.textContent = '';
      this.#messageBox.classList.remove('show', 'error', 'success', 'info');
      return;
    }
    this.#messageBox.textContent = content;
    this.#messageBox.classList.remove('error', 'success', 'info');
    this.#messageBox.classList.add('show', tone);
  }

  #updateTurnIndicator() {
    if (!this.#turnIndicator) return;

    let content;
    let playerClass = '';

    if (this.#gameOver) {
      if (this.#winner) {
        const winnerLabel = this.#winner === 1 ? 'Player 1' : 'Player 2';
        content = `${winnerLabel} wins!`;
        playerClass = `player-${this.#winner}`;
      } else {
        content = 'Game Over';
      }
    } else {
      const playerLabel = this.#currentPlayer === 1 ? 'Player 1' : 'Player 2';
      content = `${playerLabel}'s turn`;
      playerClass = `player-${this.#currentPlayer}`;
    }

    this.#turnIndicator.innerHTML = content;
    this.#turnIndicator.classList.remove('player-1', 'player-2');
    this.#messageBox?.classList.remove('player-1', 'player-2');
    if (playerClass) {
      this.#turnIndicator.classList.add(playerClass);
      this.#messageBox?.classList.add(playerClass);
    }
  }

  #setLetterStatus(letter, status) {
    const upper = letter.toUpperCase();
    const current = this.#letterStatusMap.get(upper);
    if (current && STATUS_PRIORITY[current] >= STATUS_PRIORITY[status]) return;

    this.#letterStatusMap.set(upper, status);
    const tile = this.#alphabetTiles.get(upper);
    if (tile) {
      tile.status = status;
      const statusText =
        status === 'correct'
          ? 'correct position'
          : status === 'present'
            ? 'in word, wrong position'
            : 'not in word';
      tile.setAttribute('aria-label', `${upper}, ${statusText}`);
    }
  }

  #handleSubmit = (event) => {
    event.preventDefault();
    this.#makeGuess();
  };

  #handleLengthChange = async (event) => {
    try {
      await this.#applyLength(event.target.value);
      this.#saveSettings();
    } catch (err) {
      console.error(err);
    }
  };

  #handleReset = async () => {
    try {
      await this.#applyLength(this.#wordLength);
    } catch (err) {
      console.error(err);
    }
  };

  #openSettings = () => {
    this.#settingsDialog?.showModal();
  };

  #closeSettings = () => {
    this.#settingsDialog?.close();
  };

  #handleDialogBackdrop = (event) => {
    if (event.target === this.#settingsDialog) {
      this.#closeSettings();
    }
  };

  #handleTimerChange = (event) => {
    this.#timerDuration = parseInt(event.target.value, 10) || 0;
    this.#resetTimer();
    this.#saveSettings();
  };

  #handlePlayerCountChange = async (event) => {
    const newCount = parseInt(event.target.value, 10) || 1;
    if (newCount !== this.#playerCount) {
      this.#playerCount = newCount;
      this.#saveSettings();
      await this.#applyLength(this.#wordLength);
    }
  };

  #loadSettings() {
    try {
      const stored = localStorage.getItem(Wordley.SETTINGS_KEY);
      if (stored) {
        const settings = JSON.parse(stored);

        if (settings.wordLength && this.#lengthSelect) {
          this.#wordLength = settings.wordLength;
          this.#lengthSelect.value = String(settings.wordLength);
        }

        if (settings.timerDuration !== undefined && this.#timerSelect) {
          this.#timerDuration = settings.timerDuration;
          this.#timerSelect.value = String(settings.timerDuration);
        }

        if (settings.playerCount) {
          this.#playerCount = settings.playerCount;
          this.#playerCountInputs.forEach((input) => {
            input.checked = parseInt(input.value, 10) === settings.playerCount;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
    }
  }

  #saveSettings() {
    try {
      const settings = {
        wordLength: this.#wordLength,
        timerDuration: this.#timerDuration,
        playerCount: this.#playerCount,
      };
      localStorage.setItem(Wordley.SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }
  }

  #startTimer() {
    if (this.#timerDuration <= 0 || this.#gameOver) return;

    this.#stopTimer();
    this.#timerElapsed = 0;
    this.#updateTimerProgress();

    this.#timerInterval = setInterval(() => {
      this.#timerElapsed++;
      this.#updateTimerProgress();

      if (this.#timerElapsed >= this.#timerDuration) {
        this.#stopTimer();
        this.#handleTimerExpired();
      }
    }, 1000);
  }

  #stopTimer() {
    if (this.#timerInterval) {
      clearInterval(this.#timerInterval);
      this.#timerInterval = null;
    }
  }

  #resetTimer() {
    this.#stopTimer();
    this.#timerElapsed = 0;

    this.#messageBox?.classList.add('timer-reset');
    this.#updateTimerProgress(true);
    requestAnimationFrame(() => {
      this.#messageBox?.classList.remove('timer-reset');
    });

    if (!this.#gameOver && (this.#row > 0 || this.#timerStartedFirstRow)) {
      this.#startTimer();
    }
  }

  #updateTimerProgress(reset = false) {
    if (this.#messageBox && !reset && this.#timerDuration > 0) {
      const percent = ((this.#timerElapsed + 1) / this.#timerDuration) * 100;
      this.#messageBox.style.setProperty('--timer-progress', `${percent}%`);

      let color;
      if (percent < 50) {
        color = 'var(--colour-success)';
      } else if (percent < 80) {
        color = 'var(--colour-warning)';
      } else {
        color = 'var(--colour-danger)';
      }
      this.#messageBox.style.setProperty('--timer-color', color);
    } else if (this.#messageBox) {
      this.#messageBox.style.setProperty('--timer-progress', '0%');
      this.#messageBox.style.setProperty('--timer-color', 'var(--colour-success)');
    }
  }

  #handleTimerExpired() {
    if (this.#gameOver) return;

    const rowEl = this.#board?.querySelector(`.row[data-row="${this.#row}"]`);
    if (rowEl) {
      if (this.#playerCount === 2) {
        rowEl.classList.add(`player-${this.#currentPlayer}`);
      }
      const tiles = Array.from(rowEl.querySelectorAll('.tiles game-tile'));
      tiles.slice(0, this.#wordLength).forEach((tile) => {
        tile.value = '';
        tile.status = 'absent';
      });
    }

    this.#setMessage("Time's up!", 'error');
    this.#row++;

    if (this.#playerCount === 2 && this.#row < this.#maxRows) {
      this.#currentPlayer = this.#currentPlayer === 1 ? 2 : 1;
      this.#updateTurnIndicator();
    }

    this.#clearGuessInputs();
    this.#focusFirstLetter();

    if (this.#row >= this.#maxRows) {
      this.#recordStat(this.#wordLength, 'failed');
      this.#setMessage(`Out of guesses! The word was ${this.#secret.toUpperCase()}.`, 'error');
      this.#endGame();
    } else {
      this.#updateRemainingMessage();
      this.#timerElapsed = 0;
      this.#messageBox?.classList.add('timer-reset');
      this.#updateTimerProgress(true);
      requestAnimationFrame(() => {
        this.#messageBox?.classList.remove('timer-reset');
        this.#startTimer();
      });
    }
  }

  #handleLetterInput = (event) => {
    const { value, index } = event.detail;

    if (value) {
      if (this.#row === 0 && !this.#timerStartedFirstRow && this.#timerDuration > 0) {
        this.#timerStartedFirstRow = true;
        this.#startTimer();
      }

      const next = this.#letterInputs.find((el, idx) => idx > index && !el.disabled);
      next?.focus();
    }

    this.#updateRemainingMessage();
  };

  #handleLetterKeydown = (event) => {
    const { key, index, originalEvent } = event.detail;
    const input = this.#letterInputs[index];

    if (key === 'Backspace' && !input.value) {
      for (let i = index - 1; i >= 0; i--) {
        const candidate = this.#letterInputs[i];
        if (!candidate.disabled) {
          candidate.value = '';
          candidate.focus();
          originalEvent?.preventDefault();
          break;
        }
      }
    } else if (key === 'ArrowLeft') {
      originalEvent?.preventDefault();
      for (let i = index - 1; i >= 0; i--) {
        const candidate = this.#letterInputs[i];
        if (!candidate.disabled) {
          candidate.focus();
          break;
        }
      }
    } else if (key === 'ArrowRight') {
      originalEvent?.preventDefault();
      for (let i = index + 1; i < this.#letterInputs.length; i++) {
        const candidate = this.#letterInputs[i];
        if (!candidate.disabled) {
          candidate.focus();
          break;
        }
      }
    }
  };

  #getActiveInputs() {
    return this.#letterInputs.slice(0, this.#wordLength).filter((input) => !input.disabled);
  }

  #clearGuessInputs() {
    this.#getActiveInputs().forEach((input) => {
      input.value = '';
    });
  }

  #focusFirstLetter() {
    this.#getActiveInputs()[0]?.focus();
  }

  #makeGuess() {
    if (this.#gameOver || this.#row >= this.#maxRows) return;

    const activeInputs = this.#getActiveInputs();
    const letters = activeInputs.map((input) => (input.value || '').toLowerCase());
    const guess = letters.join('');

    if (letters.some((ch) => ch.length !== 1)) {
      this.#setMessage(`Enter a ${this.#wordLength}-letter word.`, 'error');
      return;
    }
    if (!this.#allowedWordsSet.has(guess)) {
      this.#setMessage('Word not in list.', 'error');
      return;
    }

    const rowEl = this.#board?.querySelector(`.row[data-row='${this.#row}']`);
    const tiles = rowEl
      ? Array.from(rowEl.querySelectorAll('.tiles game-tile')).slice(0, this.#wordLength)
      : [];

    if (this.#playerCount === 2 && rowEl) {
      rowEl.classList.add(`player-${this.#currentPlayer}`);
    }

    this.#scoreGuess(guess, tiles);
    this.#displayDefinition(guess, rowEl || null);

    const isWin = guess === this.#secret;
    const isLoss = this.#row === this.#maxRows - 1;

    if (isWin) {
      this.#winner = this.#currentPlayer;
      this.#recordStat(this.#wordLength, this.#row + 1);
      this.#setMessage(`You win! The word was ${this.#secret.toUpperCase()}.`, 'success');
      this.#endGame();
    } else if (isLoss) {
      this.#recordStat(this.#wordLength, 'failed');
      this.#setMessage(`Out of guesses! The word was ${this.#secret.toUpperCase()}.`, 'error');
      this.#endGame();
    }

    this.#row++;

    if (this.#playerCount === 2 && !isWin && !isLoss) {
      this.#currentPlayer = this.#currentPlayer === 1 ? 2 : 1;
      this.#updateTurnIndicator();
    }

    if (!isWin && !isLoss) {
      this.#updateRemainingMessage();
      this.#resetTimer();
    }

    this.#clearGuessInputs();
    this.#focusFirstLetter();
  }

  #scoreGuess(guess, tiles) {
    const secretArr = this.#secret.split('');
    const guessArr = guess.split('');

    for (let i = 0; i < this.#wordLength; i++) {
      const letter = guess[i].toUpperCase();
      tiles[i].value = letter;
      if (guessArr[i] === secretArr[i]) {
        tiles[i].status = 'correct';
        tiles[i].setAttribute('aria-label', `${letter}, correct`);
        this.#setLetterStatus(guess[i], 'correct');
        this.#correctPositions[i] = letter;
        secretArr[i] = null;
        guessArr[i] = null;
      }
    }

    this.#updateInputPlaceholders();

    for (let i = 0; i < this.#wordLength; i++) {
      if (guessArr[i] === null) continue;

      const letter = guessArr[i].toUpperCase();
      const idx = secretArr.indexOf(guessArr[i]);
      if (idx !== -1) {
        tiles[i].status = 'present';
        tiles[i].setAttribute('aria-label', `${letter}, present in word`);
        secretArr[idx] = null;
        this.#setLetterStatus(guessArr[i], 'present');
      } else {
        tiles[i].status = 'absent';
        tiles[i].setAttribute('aria-label', `${letter}, not in word`);
        this.#setLetterStatus(guessArr[i], 'absent');
      }
    }
  }

  async #displayDefinition(word, rowEl) {
    if (!rowEl) return;

    const definitions = await fetchDefinition(word);
    if (definitions && definitions.length > 0) {
      const htmlRowEl = rowEl;
      const tooltipId = `tooltip-${htmlRowEl.dataset.row}-${Date.now()}`;
      
      rowEl.setAttribute('aria-describedby', tooltipId);

      htmlRowEl.dataset.tooltip = definitions
        .slice(0, 5)
        .map((d) => `${d.partOfSpeech}: ${d.definition}`)
        .join('\n\r');
      htmlRowEl.hidden = false;
      rowEl.setAttribute('aria-label', `Definition of ${word}`);
    }
  }

  #endGame() {
    this.#gameOver = true;
    this.#stopTimer();
    this.#timerElapsed = 0;
    this.#messageBox?.classList.add('timer-reset');
    this.#updateTimerProgress(true);
    requestAnimationFrame(() => {
      this.#messageBox?.classList.remove('timer-reset');
    });
    this.#getActiveInputs().forEach((input) => {
      input.disabled = true;
    });
    if (this.#button) this.#button.disabled = true;
    if (this.#resetButton) {
      setTimeout(() => {
        this.#resetButton.focus();
      }, 100);
    }
    this.#updateTurnIndicator();
  }

  #loadStats() {
    try {
      const stored = localStorage.getItem(Wordley.STATS_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to load stats from localStorage:', e);
    }
    return this.#createEmptyStats();
  }

  #createEmptyStats() {
    const stats = {
      singlePlayer: {},
      twoPlayer: {
        player1: {},
        player2: {},
        draws: {},
      },
    };
    for (let len = 4; len <= 6; len++) {
      stats.singlePlayer[len] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, failed: 0 };
      stats.twoPlayer.player1[len] = { wins: 0, losses: 0 };
      stats.twoPlayer.player2[len] = { wins: 0, losses: 0 };
      stats.twoPlayer.draws[len] = 0;
    }
    return stats;
  }

  #saveStats() {
    try {
      localStorage.setItem(Wordley.STATS_KEY, JSON.stringify(this.#stats));
    } catch (e) {
      console.warn('Failed to save stats to localStorage:', e);
    }
  }

  #recordStat(wordLength, guesses) {
    this.#ensureStatsStructure(wordLength);

    if (this.#playerCount === 1) {
      const key = guesses === 'failed' ? 'failed' : guesses;
      if (this.#stats.singlePlayer[wordLength][key] !== undefined) {
        this.#stats.singlePlayer[wordLength][key]++;
      }
    } else {
      if (this.#winner === 1) {
        this.#stats.twoPlayer.player1[wordLength].wins++;
        this.#stats.twoPlayer.player2[wordLength].losses++;
      } else if (this.#winner === 2) {
        this.#stats.twoPlayer.player2[wordLength].wins++;
        this.#stats.twoPlayer.player1[wordLength].losses++;
      } else {
        this.#stats.twoPlayer.draws[wordLength]++;
      }
    }
    this.#saveStats();
  }

  #ensureStatsStructure(wordLength) {
    if (!this.#stats.singlePlayer) {
      const oldStats = this.#stats;
      this.#stats = this.#createEmptyStats();
      for (let len = 4; len <= 6; len++) {
        if (oldStats[len]) {
          this.#stats.singlePlayer[len] = oldStats[len];
        }
      }
    }
    if (!this.#stats.singlePlayer[wordLength]) {
      this.#stats.singlePlayer[wordLength] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, failed: 0 };
    }
    if (!this.#stats.twoPlayer.player1[wordLength]) {
      this.#stats.twoPlayer.player1[wordLength] = { wins: 0, losses: 0 };
    }
    if (!this.#stats.twoPlayer.player2[wordLength]) {
      this.#stats.twoPlayer.player2[wordLength] = { wins: 0, losses: 0 };
    }
    if (this.#stats.twoPlayer.draws[wordLength] === undefined) {
      this.#stats.twoPlayer.draws[wordLength] = 0;
    }
  }

  getStats(mode, wordLength) {
    if (!this.#stats.singlePlayer) {
      this.#ensureStatsStructure(4);
    }

    if (mode === 'singlePlayer') {
      if (wordLength) {
        return this.#stats.singlePlayer[wordLength] || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, failed: 0 };
      }
      return this.#stats.singlePlayer;
    }

    if (mode === 'twoPlayer') {
      if (wordLength) {
        return {
          player1: this.#stats.twoPlayer.player1[wordLength] || { wins: 0, losses: 0 },
          player2: this.#stats.twoPlayer.player2[wordLength] || { wins: 0, losses: 0 },
          draws: this.#stats.twoPlayer.draws[wordLength] || 0,
        };
      }
      return this.#stats.twoPlayer;
    }

    return this.#stats;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const game = new Wordley();
    game.init().catch((err) => console.error(err));
  });
}
