// @ts-check

/**
 * Features: configurable word lengths (4-6), timer mode, 1-2 player support,
 * localStorage persistence for settings and statistics.
 * @module game
 */
import { validateTarget } from 'games/futile/shared';
import BaseClass from '/scripts/BaseClass.js';
import definitionsService from '/scripts/DefinitionsService.js';
import GameTile from '/scripts/components/game-tile';

/**
 * @typedef {object} WordleyOptions
 * @property {HTMLElement|null} [board]
 * @property {HTMLFormElement|null} [form]
 * @property {HTMLSelectElement|null} [lengthSelect]
 * @property {HTMLButtonElement|null} [resetButton]
 * @property {HTMLDivElement|null} [alphaLeft]
 * @property {HTMLDivElement|null} [alphaRight]
 * @property {HTMLButtonElement|null} [button]
 * @property {HTMLDivElement|null} [messageBox]
 * @property {HTMLTemplateElement|null} [rowTemplate]
 * @property {NodeListOf<HTMLInputElement>|null} [letterInputs]
 * @property {HTMLElement|null} [lengthValue]
 * @property {HTMLDialogElement|null} [settingsDialog]
 * @property {HTMLButtonElement|null} [settingsBtn]
 * @property {string} boardId
 * @property {string} formId
 * @property {string} lengthSelectId
 * @property {string} resetButtonId
 * @property {string} alphaLeftId
 * @property {string} alphaRightId
 * @property {string} buttonSelector
 * @property {string[]|null} allowedWords
 * @property {number} wordLength
 * @property {1|2|3|4|5|6} maxRows 
 */

/**
 * Event emitted by a GameTile after its input value has been sanitized.
 * @typedef {import('/scripts/components/game-tile.js').TileInputEvent} TileInputEvent
 * @typedef {import('/scripts/components/game-tile.js').TileFocusEvent} TileFocusEvent
 * @typedef {import('/scripts/components/game-tile.js').TileKeydownEvent} TileKeydownEvent
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const STATUS_PRIORITY = Object.freeze({
  absent: 0,
  present: 1,
  correct: 2,
});

/**
 * Word guessing game supporting configurable lengths and player modes.
 */
class Wordley extends BaseClass {
  /**
   * Storage key for Wordley statistics.
   * @type {string}
   */
  static STATS_KEY = 'wordley_stats';
  /**
   * Storage key for Wordley settings.
   * @type {string}
   */
  static SETTINGS_KEY = 'wordley_settings';

  /**
   * @type {HTMLElement|null}
   */
  #board = null;
  /**
   * @type {HTMLFormElement|null}
   */
  #form = null;
  /**
   * @type {HTMLButtonElement|null}
   */
  #button = null;
  /**
   * @type {HTMLButtonElement|null}
   */
  #resetButton = null;
  /**
   * @type {HTMLSelectElement|null}
   */
  #lengthSelect = null;
  /**
   * @type {HTMLElement|null}
   */
  #lengthValue = null;
  /**
   * @type {HTMLElement|null}
   */
  #messageBox = null;
  /**
   * @type {HTMLTemplateElement|null}
   */
  #rowTemplate = null;
  /**
   * @type {HTMLInputElement[]}
   */
  #letterInputs = [];
  /**
   * @type {HTMLElement[]}
   */
  #alphaCols = [];
  /**
   * @type {HTMLDialogElement|null}
   */
  #settingsDialog = null;
  /**
   * @type {HTMLElement|null}
   */
  #settingsBtn = null;
  /**
   * @type {HTMLElement|null}
   */
  #closeSettingsBtn = null;
  /**
   * @type {HTMLSelectElement|null}
   */
  #timerSelect = null;
  /**
   * @type {NodeListOf<HTMLInputElement>|null}
   */
  #playerCountInputs = null;
  /**
   * @type {HTMLElement|null}
   */
  #turnIndicator = null;

  /**
   * @type {Map<string, GameTile>}
   */
  #alphabetTiles = new Map();
  /**
   * @type {Map<string, 'absent'|'present'|'correct'>}
   */
  #letterStatusMap = new Map();
  // #allowedWords = [];
  // #allowedWordsSet = new Set();
  /**
   * @type {string}
   */
  #secret = '';
  /**
   * @type {number}
   */
  #row = 0;
  /**
   * @type {boolean}
   */
  #gameOver = false;
  /**
   * @type {number}
   */
  #wordLength;
  /**
   * @type {number}
   */
  #maxRows;
  /**
   * @type {import('/scripts/settings').WordleyStats}
   */
  #stats;
  /**
   * @type {(string|null)[]}
   */
  #correctPositions = new Array(6).fill(null);
  /**
   * @type {number}
   */
  #timerDuration = 0;
  /**
   * @type {ReturnType<typeof setInterval>|null}
   */
  #timerInterval = null;
  /**
   * @type {number}
   */
  #timerElapsed = 0;
  /**
   * @type {boolean}
   */
  #timerStartedFirstRow = false;
  /**
   * @type {number}
   */
  #playerCount = 1;
  /**
   * @type {1|2}
   */
  #currentPlayer = 1;
  /**
   * @type {1|2|null}
   */
  #winner = null;

  /**
   * @type {WordleyOptions}
   */
  options;

  /**
   * Creates a Wordley game with optional DOM and game configuration.
    * @param {Partial<WordleyOptions>} [options={}] Game and DOM configuration overrides.
   */
  constructor(options = {}) {
    super();
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

    this.#wordLength = this.options.wordLength || 5;
    this.#maxRows = this.options.maxRows || 6;
    this.#stats = this.#loadStats();

    this.init(async () => {
      await this.#init();
    });
  }

  async #init() {
    this.#board = this.options.board || document.getElementById(this.options.boardId);
    this.#form = this.options.form || document.querySelector(`form#${this.options.formId}`);
    this.#lengthSelect = this.options.lengthSelect || document.querySelector(`select#${this.options.lengthSelectId}`);
    /* c8 ignore next */
    this.#button = this.options.button || (this.#form ? this.#form.querySelector(this.options.buttonSelector) : null);
    this.#resetButton = this.options.resetButton || document.querySelector(`button#${this.options.resetButtonId}`);
    const alphaLeft = this.options.alphaLeft || document.querySelector(`div#${this.options.alphaLeftId}`);
    const alphaRight = this.options.alphaRight || document.querySelector(`div#${this.options.alphaRightId}`);
    if (!alphaLeft || !alphaRight) {
      throw new Error('Missing required alpha columns for the game.');
    }
    this.#alphaCols = [
      alphaLeft,
      alphaRight,
    ];
    this.#messageBox = this.options.messageBox || document.querySelector(`div#message`);
    this.#rowTemplate = document.querySelector(`template#RowTemplate`);
    this.#letterInputs = Array.from(document.querySelectorAll('.guess-letter'));
    this.#lengthValue = document.querySelector(`span#lengthValue`);
    this.#settingsDialog = document.querySelector(`dialog#settingsDialog`);
    this.#settingsBtn = document.querySelector(`button#SettingsButton`);
    this.#closeSettingsBtn = document.querySelector(`button#closeSettings`);
    this.#timerSelect = document.querySelector(`select#timerSelect`);
    this.#playerCountInputs = document.querySelectorAll('input[name="playerCount"]');
    this.#turnIndicator = document.querySelector(`div#turnIndicator`);

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
      this.addListener(this.#lengthSelect, 'change', this.#handleLengthChange);
    }

    await this.#applyLength(this.#wordLength);

    this.addListener(this.#form, 'submit', this.#handleSubmit);
    if (this.#resetButton) {
      this.addListener(this.#resetButton, 'click', this.#handleReset);
    }

    if (this.#settingsBtn && this.#settingsDialog) {
      this.#settingsBtn.classList.remove('hidden');
      this.addListener(this.#settingsBtn, 'click', this.#openSettings);
    }
    if (this.#closeSettingsBtn && this.#settingsDialog) {
      this.addListener(this.#closeSettingsBtn, 'click', this.#closeSettings);
    }
    if (this.#settingsDialog) {
      this.addListener(this.#settingsDialog, 'click', this.#handleDialogBackdrop);
    }

    if (this.#timerSelect) {
      this.addListener(this.#timerSelect, 'change', this.#handleTimerChange);
    }

    this.#playerCountInputs.forEach((input) => {
      this.addListener(input, 'change', this.#handlePlayerCountChange);
    });

    this.#letterInputs.forEach((input) => {
      this.addListener(input, 'tile-input', (event) => {
        this.#handleLetterInput(/** @type {TileInputEvent} */(event));
      });
      this.addListener(input, 'tile-keydown', (event) => {
        this.#handleLetterKeydown(/** @type {TileKeydownEvent} */(event));
      });
    });

    this.#focusFirstLetter();
  }

  /**
   * 
   * @param {string|number} length 
   */
  async #applyLength(length) {
    this.#wordLength = Number(length) || 5;
    const baseRows = Math.max(6, this.#wordLength + 1);

    if (this.#playerCount === 2) {
      const extraRows = baseRows + 2;
      this.#maxRows = extraRows % 2 === 0 ? extraRows : extraRows + 1;
    } else {
      this.#maxRows = baseRows;
    }

    await definitionsService.getWords(this.#wordLength);

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

    this.#secret = await this.#pickSecret();
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
    if (!this.#board) {
      return;
    }
    const turnIndicator = this.#turnIndicator;
    this.#board.innerHTML = '';
    if (turnIndicator) {
      this.#board.appendChild(turnIndicator);
    }
    this.#buildAlphabet();
    this.#resetAlphabetStatuses();

    const fragment = document.createDocumentFragment();
    for (let i = 0; i < this.#maxRows; i++) {
      const clone = validateTarget(this.#rowTemplate?.content.firstElementChild?.cloneNode(true), HTMLElement);
      if (clone) {
        clone.dataset.row = String(i);
        fragment.appendChild(clone);
      }
    }
    this.#board.appendChild(fragment);
  }

  async #pickSecret() {
    const words = await definitionsService.getWords(this.#wordLength);
    return Array.from(words)[Math.floor(Math.random() * words.size)];
  }

  #buildAlphabet() {
    const letters = ALPHABET.split('');
    const slices = [letters.slice(0, 13), letters.slice(13)];

    this.#alphabetTiles.clear();

    slices.forEach((arr, idx) => {
      const container = this.#alphaCols[idx];
      const fragment = document.createDocumentFragment();

      arr.forEach((ch) => {
        const tile = validateTarget(document.createElement('game-tile'), GameTile);
        if (!tile) {
          return;
        }
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

  /**
   * 
   * @param {number} length 
   */
  #updateLengthValue(length) {
    if (this.#lengthValue) {
      this.#lengthValue.textContent = String(length);
    }
  }

  /**
   * 
   * @param {string} text 
   * @param {string} status 
   * @returns {void}
   */
  #setMessage(text, status = 'info') {
    if (!this.#messageBox) return;
    let content = text;

    if (!content) {
      this.#messageBox.textContent = '';
      this.#messageBox.classList.remove('show', 'error', 'success', 'info');
      return;
    }
    this.#messageBox.textContent = content;
    this.#messageBox.classList.remove('error', 'success', 'info');
    this.#messageBox.classList.add('show', status);
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

  /**
   * 
   * @param {string} letter 
   * @param {keyof typeof STATUS_PRIORITY} status 
   * @returns {void}
   */
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

  /**
   * 
   * @param {Event} event 
   */
  #handleSubmit = async (event) => {
    event.preventDefault();
    await this.#makeGuess();
  };

  /**
   * 
   * @param {Event} event 
   */
  #handleLengthChange = async (event) => {
    try {
      const target = validateTarget(event.target, HTMLSelectElement);
      target && await this.#applyLength(target.value);
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

  /**
   * 
   * @param {Event} event 
   */
  #handleDialogBackdrop = (event) => {
    if (event.target === this.#settingsDialog) {
      this.#closeSettings();
    }
  };

  /**
   * 
   * @param {Event} event 
   */
  #handleTimerChange = (event) => {
    const target = validateTarget(event.target, HTMLSelectElement);
    if (target) {
      this.#timerDuration = parseInt(target.value, 10) || 0;
      this.#resetTimer();
      this.#saveSettings();
    }
  };

  /**
   * 
   * @param {Event} event 
   */
  #handlePlayerCountChange = async (event) => {
    const target = validateTarget(event.target, HTMLInputElement);
    const newCount = target ? parseInt(target.value, 10) || 1 : this.#playerCount;
    if (newCount !== this.#playerCount) {
      this.#playerCount = newCount;
      this.#saveSettings();
      await this.#applyLength(this.#wordLength);
    }
  };

  #loadSettings() {
    try {
      const settings = this.settingsService.wordley_settings;
      if (settings) {
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
          this.#playerCountInputs?.forEach((input) => {
            input.checked = parseInt(input.value, 10) === settings.playerCount;
          });
        }
      }
    } catch (e) {
      console.warn('Failed to load settings from localStorage:', e);
    }
  }

  #saveSettings() {
    this.settingsService.wordley_settings = {
      wordLength: this.#wordLength,
      timerDuration: this.#timerDuration,
      playerCount: this.#playerCount,
    };
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
        const gameTile = validateTarget(tile, GameTile);
        if (!gameTile) {
          return;
        }
        gameTile.value = '';
        gameTile.status = 'absent';
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
      this.#recordSinglePlayerStat(this.#wordLength, 'failed');
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

  /**
   * 
   * @param {TileInputEvent} event 
   */
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

  /**
   * 
   * @param {TileKeydownEvent} event 
   */
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

  async #makeGuess() {
    if (this.#gameOver || this.#row >= this.#maxRows) return;

    const activeInputs = this.#getActiveInputs();
    const letters = activeInputs.map((input) => (input.value || '').toLowerCase());
    const guess = letters.join('');

    if (letters.some((ch) => ch.length !== 1)) {
      this.#setMessage(`Enter a ${this.#wordLength}-letter word.`, 'error');
      return;
    }
    if (!(await definitionsService.validateWord(guess))) {
      this.#setMessage('Word not in list.', 'error');
      return;
    }

    const rowEl = validateTarget(this.#board?.querySelector(`.row[data-row='${this.#row}']`), HTMLElement);

    if (!rowEl) return;

    const tiles = rowEl
      ? Array.from(rowEl.querySelectorAll('.tiles game-tile'))
        .slice(0, this.#wordLength)
        .map((tile) => validateTarget(tile, GameTile))
        .filter(tile => tile !== false)
      : [];

    if (this.#playerCount === 2 && rowEl) {
      rowEl.classList.add(`player-${this.#currentPlayer}`);
    }

    this.#scoreGuess(guess, tiles);

    this.#displayDefinition(guess, rowEl || null);

    this.#row++;

    const isWin =
      guess === this.#secret &&
      this.#row <= this.#maxRows;
    const isLoss = this.#row >= this.#maxRows;

    if (isWin) {
      this.#winner = this.#currentPlayer;
      if (this.#playerCount === 2) {
        this.#recordTwoPlayerStat(this.#wordLength, this.#winner);
      } else if (this.#row === 1 || this.#row === 2 || this.#row === 3 || this.#row === 4 || this.#row === 5 || this.#row === 6) {
        this.#recordSinglePlayerStat(this.#wordLength, this.#row);
      }
      this.#setMessage(`You win! The word was ${this.#secret.toUpperCase()}.`, 'success');
      this.#endGame();
    } else if (isLoss) {
      this.#recordSinglePlayerStat(this.#wordLength, 'failed');
      this.#setMessage(`Out of guesses! The word was ${this.#secret.toUpperCase()}.`, 'error');
      this.#endGame();
    }

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

  /**
   * 
   * @param {string} guess 
   * @param {GameTile[]} tiles 
   */
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
        secretArr[i] = '';
        guessArr[i] = '';
      }
    }

    this.#updateInputPlaceholders();

    for (let i = 0; i < this.#wordLength; i++) {
      if (guessArr[i] === '') continue;

      const letter = guessArr[i].toUpperCase();
      const idx = secretArr.indexOf(guessArr[i]);
      if (idx !== -1) {
        tiles[i].status = 'present';
        tiles[i].setAttribute('aria-label', `${letter}, present in word`);
        secretArr[idx] = '';
        this.#setLetterStatus(guessArr[i], 'present');
      } else {
        tiles[i].status = 'absent';
        tiles[i].setAttribute('aria-label', `${letter}, not in word`);
        this.#setLetterStatus(guessArr[i], 'absent');
      }
    }
  }

  /**
   * 
   * @param {string} word 
   * @param {HTMLElement} rowEl 
   * @returns 
   */
  async #displayDefinition(word, rowEl) {
    if (!rowEl) return;

    const definitions = await definitionsService.fetchDefinition(word);
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
        this.#resetButton?.focus();
      }, 100);
    }
    this.#updateTurnIndicator();
  }

  #loadStats() {
    return this.settingsService.wordley_stats || this.#createEmptyStats();
  }

  /**
   * 
   * @returns {import('/scripts/settings').WordleyStats}
   */
  #createEmptyStats() {
    /** @type {import('/scripts/settings').WordleyStats} */
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
    this.settingsService.wordley_stats = this.#stats;
  }

  /**
   * 
   * @param {number} wordLength 
   * @param {1|2|3|4|5|6|'failed'} guesses 
   */
  #recordSinglePlayerStat(wordLength, guesses) {
    this.#ensureStatsStructure(wordLength);

    if (this.#stats.singlePlayer[wordLength][guesses] !== undefined) {
      this.#stats.singlePlayer[wordLength][guesses]++;
    }
    this.#saveStats();
  }

  /**
   * 
   * @param {number} wordLength 
   * @param {1|2|null} winner 1 for player 1 win, 2 for player 2 win, null for draw.
   */
  #recordTwoPlayerStat(wordLength, winner) {
    this.#ensureStatsStructure(wordLength);

    if (winner === 1) {
      this.#stats.twoPlayer.player1[wordLength].wins++;
      this.#stats.twoPlayer.player2[wordLength].losses++;
    } else if (winner === 2) {
      this.#stats.twoPlayer.player2[wordLength].wins++;
      this.#stats.twoPlayer.player1[wordLength].losses++;
    } else {
      this.#stats.twoPlayer.draws[wordLength]++;
    }
    this.#saveStats();
  }

  /**
   * 
   * @param {number} wordLength 
   */
  #ensureStatsStructure(wordLength) {
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

  /**
   * Returns persisted statistics for a mode and optional word length.
    * @param {'singlePlayer'|'twoPlayer'|string} mode Statistics mode to read.
    * @param {number} [wordLength] Optional word length to filter by.
    * @returns {object} Statistics for the requested mode and word length.
   */
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

export { Wordley };

const game = new Wordley();
