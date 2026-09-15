/**
 * @fileoverview GameTile Web Component for Wordley.
 * A reusable tile component that supports both display and input modes
 * with customizable appearance based on game state.
 * @module game-tile
 */

import { validateTarget } from "games/futile/shared";

/**
 * Visual states supported by a game tile.
 * @typedef {'correct'|'success'|'green'|'present'|'warning'|'yellow'|'absent'|'info'|'blue'|'error'|'danger'|'red'|''} TileStatus
 */

/**
 * Input mode used to determine validation and keyboard behavior.
 * @typedef {'letter'|'number'} TileType
 */

/**
 * Detail emitted with the `tile-input` event.
 * @typedef {object} TileInputDetail
 * @property {string} value Sanitized tile value.
 * @property {number} index Tile index from the element's `index` attribute.
 */

/**
 * Custom event emitted when an editable tile's value changes.
 * @typedef {CustomEvent<TileInputDetail>} TileInputEvent
 */

/**
 * Detail emitted with the `tile-focus` event.
 * @typedef {object} TileFocusDetail
 * @property {number} index Tile index from the element's `index` attribute.
 */

/**
 * Detail emitted with the `tile-keydown` event.
 * @typedef {object} TileKeydownDetail
 * @property {string} key Keyboard key pressed.
 * @property {number} index Tile index from the element's `index` attribute.
 * @property {boolean} shiftKey Whether Shift was held.
 * @property {boolean} ctrlKey Whether Control was held.
 * @property {boolean} altKey Whether Alt was held.
 * @property {KeyboardEvent} originalEvent Original keyboard event.
 */

/**
 * Custom event emitted when an editable tile receives focus.
 * @typedef {CustomEvent<TileFocusDetail>} TileFocusEvent
 */

/**
 * Custom event emitted when a key is pressed while an editable tile is focused.
 * @typedef {CustomEvent<TileKeydownDetail>} TileKeydownEvent
 */

/** Custom element that renders an editable or readonly game tile. */
class GameTile extends HTMLElement {
  /**
   * Attributes that cause the tile to rerender when changed.
   * @returns {string[]} Observed attribute names.
   */
  static get observedAttributes() {
    return ['value', 'name', 'label', 'role', 'readonly', 'type', 'status', 'index', 'disabled', 'placeholder', 'selected'];
  }

  /** Creates the shadow DOM and renders the initial tile. */
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.#render();
  }

  /**
   * Renders the tile according to its current attributes and mode.
   * @returns {void}
   */
  #render() {
    const isReadonly = this.hasAttribute('readonly');
    const value = this.getAttribute('value') || '';
    const name = this.getAttribute('name') || '';
    const label = this.getAttribute('label') || 'Tile';
    const type = this.getAttribute('type') || 'letter';
    const disabled = this.hasAttribute('disabled');
    const placeholder = this.getAttribute('placeholder') || '';

    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          --tile-scale: var(--scale, 1);
          --tile-font-size: calc(2rem * var(--tile-scale));
          --tile-size: calc(4rem * var(--tile-scale));
          --tile-border-radius: calc(var(--radius-small, 0.25rem) * var(--tile-scale));
          --tile-border-width: var(--border-sm, 2px);
          --tile-bg: var(--colour-tile-bg, #ffffff);
          --tile-border: var(--border-colour, #d3d6da);
          --tile-text: var(--colour-tile-text, #1a1a1b);
        }

        :host([status="correct"]), :host([status="success"]), :host([status="green"]) {
          --tile-bg: var(--colour-success-bg, rgba(34, 197, 94, 0.18));
          --tile-border: var(--colour-success-border, rgba(34, 197, 94, 0.55));
          --tile-text: var(--colour-success-text, #dcfce7);
        }

        :host([status="present"]), :host([status="warning"]), :host([status="yellow"]) {
          --tile-bg: var(--colour-warning-bg, rgba(234, 179, 8, 0.18));
          --tile-border: var(--colour-warning-border, rgba(234, 179, 8, 0.55));
          --tile-text: var(--colour-warning-text, #fef9c3);
        }

        :host([status="absent"]) {
          --tile-bg: var(--colour-absent-bg, rgba(71, 85, 105, 0.3));
          --tile-border: var(--colour-absent-border, rgba(71, 85, 105, 0.7));
          --tile-text: var(--colour-absent-text, #cbd5e1);
        }

        :host([selected]) {
          --tile-border: var(--accent, #4a90d9);
          --colour-tile-border-filled: var(--accent, #4a90d9);
        }

        :host([disabled]) {
          opacity: 0.35;
          pointer-events: none;
        }

        :host([status="info"]), :host([status="blue"]) {
          --tile-bg: var(--colour-info-bg, rgba(59, 130, 246, 0.18));
          --tile-border: var(--colour-info-border, rgba(59, 130, 246, 0.55));
          --tile-text: var(--colour-info-text, #dbeafe);
        }

        :host([status="error"]), :host([status="danger"]), :host([status="red"]) {
          --tile-bg: var(--colour-danger-bg, rgba(239, 68, 68, 0.18));
          --tile-border: var(--colour-danger-border, rgba(239, 68, 68, 0.55));
          --tile-text: var(--colour-danger-text, #fee2e2);
        }

        .tile {
          aspect-ratio: 1 / 1;
          display: flex;
          align-items: center;
          justify-content: center;
          width: var(--tile-size);
          height: var(--tile-size);
          font-family: var(--font-family, "Space Grotesk", "Segoe UI", system-ui, -apple-system, sans-serif);
          font-size: var(--tile-font-size);
          font-weight: bold;
          text-transform: uppercase;
          background: var(--tile-bg);
          border: var(--tile-border-width) solid var(--tile-border);
          border-radius: var(--tile-border-radius);
          color: var(--tile-text);
          box-sizing: border-box;
          user-select: none;
          transition: background-color 0.2s, border-color 0.2s, transform 0.1s;
        }

        .tile.filled {
          border-color: var(--colour-tile-border-filled, #878a8c);
        }

        input.tile {
          text-align: center;
          caret-color: transparent;
          cursor: pointer;
        }

        input.tile:focus,
        input.tile:focus-visible {
          outline: 3px solid var(--accent-colour);
          outline-offset: 4px;
          border-radius: var(--spacing-small);
        }

        input.tile::selection {
          background: transparent;
        }

        input.tile::placeholder {
          color: var(--colour-success, #22c55e);
          opacity: 0.8;
          font-weight: bold;
        }
      </style>
      ${isReadonly
        ? `<div class="tile${value ? ' filled' : ''}" data-tooltip="${value ? value + ' ' : ''}${this.status ? this.status : ''}" part="tile" ${this.status ? this.status : ''}">${value}</div>`
        : `<input 
            class="tile${value ? ' filled' : ''}" 
            part="tile"
            type="text"
            maxlength="1"
            value="${value}"
            name="${name}"
            placeholder="${placeholder}"
            ${disabled ? 'disabled' : ''}
            autocomplete="off"
            autocapitalize="characters"
            spellcheck="false"
            inputmode="${type === 'number' ? 'numeric' : 'text'}"
            pattern="${type === 'number' ? '[0-9]' : '[a-zA-Z]'}"
            aria-label="Tile ${label}"
          />`
      }
    `;

    if (!isReadonly) {
      this.#attachInputListeners();
    }
  }

  /**
   * Connects input listeners to the shadow input element.
   * @returns {void}
   */
  #attachInputListeners() {
    const input = this.shadowRoot?.querySelector('input');
    if (!input) return;

    input.addEventListener('input', (event) => {
      const target = validateTarget(event.target, HTMLInputElement);
      const type = this.getAttribute('type') || 'letter';

      if (!target) return;
      let value = target.value;

      if (type === 'letter') {
        value = value.replace(/[^a-zA-Z]/g, '').toUpperCase();
      } else if (type === 'number') {
        value = value.replace(/[^0-9]/g, '');
      }

      if (target) target.value = value;
      this.setAttribute('value', value);
      target.classList.toggle('filled', value.length > 0);

      this.dispatchEvent(
        new CustomEvent('tile-input', {
          bubbles: true,
          composed: true,
          detail: {
            value,
            index: parseInt(this.getAttribute('index') || '0', 10),
          },
        }),
      );
    });

    input.addEventListener('focus', () => {
      input.select();
      this.dispatchEvent(
        new CustomEvent('tile-focus', {
          bubbles: true,
          composed: true,
          detail: {
            index: parseInt(this.getAttribute('index') || '0', 10),
          },
        }),
      );
    });

    input.addEventListener('keydown', (event) => {
      const index = parseInt(this.getAttribute('index') || '0', 10);

      this.dispatchEvent(
        new CustomEvent('tile-keydown', {
          bubbles: true,
          composed: true,
          detail: {
            key: event.key,
            index,
            shiftKey: event.shiftKey,
            ctrlKey: event.ctrlKey,
            altKey: event.altKey,
            originalEvent: event,
          },
        }),
      );

      if (event.key === 'Enter') {
        const form = this.closest('form');
        if (form) {
          form.requestSubmit();
        }
      }

      if (event.key === 'Backspace' && !input.value) {
        event.preventDefault();
      }
    });
  }

  /**
   * Applies the default letter input type when the element is connected.
   * @returns {void}
   */
  connectedCallback() {
    if (!this.hasAttribute('type')) {
      this.setAttribute('type', 'letter');
    }
  }

  /**
   * Keeps the rendered tile synchronized with observed attributes.
   * @param {string} name Changed attribute name.
   * @param {string|null} oldValue Previous attribute value.
   * @param {string|null} newValue New attribute value.
   * @returns {void}
   */
  attributeChangedCallback(name, oldValue, newValue) {
    if (oldValue === newValue) return;

    if (name === 'value') {
      const input = this.shadowRoot?.querySelector('input');
      const div = this.shadowRoot?.querySelector('div.tile');

      if (input && input.value !== newValue) {
        input.value = newValue || '';
        input.classList.toggle('filled', (newValue || '').length > 0);
      }
      if (div) {
        div.textContent = newValue || '';
        div.classList.toggle('filled', (newValue || '').length > 0);
      }
    } else if (name === 'placeholder') {
      const input = this.shadowRoot?.querySelector('input');
      if (input) {
        input.placeholder = newValue || '';
      }
    } else if (name === 'readonly' || name === 'disabled' || name === 'status' || name === 'selected') {
      this.#render();
    }
  }

  /**
   * Returns the displayed tile value.
   * @returns {string} Current tile value.
   */
  get value() {
    return this.getAttribute('value') || '';
  }

  /**
   * Sets the displayed tile value.
   * @param {string} val New tile value.
   * @returns {void}
   */
  set value(val) {
    this.setAttribute('value', val || '');
  }

  /**
   * Returns the form name associated with the tile.
   * @returns {string} Current tile name.
   */
  get name() {
    return this.getAttribute('name') || '';
  }

  /**
   * Sets or removes the form name associated with the tile.
   * @param {string} val New tile name.
   * @returns {void}
   */
  set name(val) {
    if (val) {
      this.setAttribute('name', val);
    } else {
      this.removeAttribute('name');
    }
  }

  /**
   * Returns the input placeholder text.
   * @returns {string} Current placeholder.
   */
  get placeholder() {
    return this.getAttribute('placeholder') || '';
  }

  /**
   * Sets or removes the input placeholder text.
   * @param {string} val New placeholder.
   * @returns {void}
   */
  set placeholder(val) {
    if (val) {
      this.setAttribute('placeholder', val);
    } else {
      this.removeAttribute('placeholder');
    }
  }

  /**
   * Returns whether the tile is readonly.
   * @returns {boolean} Whether readonly mode is enabled.
   */
  get readonly() {
    return this.hasAttribute('readonly');
  }

  /**
   * Enables or disables readonly mode.
   * @param {boolean} val Whether readonly mode should be enabled.
   * @returns {void}
   */
  set readonly(val) {
    if (val) {
      this.setAttribute('readonly', '');
    } else {
      this.removeAttribute('readonly');
    }
  }

  /**
   * Returns the tile's visual status.
   * @returns {TileStatus|string} Current status value.
   */
  get status() {
    return this.getAttribute('status') || '';
  }

  /**
   * Sets or removes the tile's visual status.
   * @param {TileStatus|string} val New status value.
   * @returns {void}
   */
  set status(val) {
    if (val) {
      this.setAttribute('status', val);
    } else {
      this.removeAttribute('status');
    }
  }

  /**
   * Returns whether the tile is disabled.
   * @returns {boolean} Whether input is disabled.
   */
  get disabled() {
    return this.hasAttribute('disabled');
  }

  /**
   * Enables or disables tile input.
   * @param {boolean} val Whether input should be disabled.
   * @returns {void}
   */
  set disabled(val) {
    if (val) {
      this.setAttribute('disabled', '');
    } else {
      this.removeAttribute('disabled');
    }
  }

  /**
   * Returns whether the tile is selected.
   * @returns {boolean} Whether selected styling is enabled.
   */
  get selected() {
    return this.hasAttribute('selected');
  }

  /**
   * Enables or disables selected styling.
   * @param {boolean} val Whether the tile should be selected.
   * @returns {void}
   */
  set selected(val) {
    if (val) {
      this.setAttribute('selected', '');
    } else {
      this.removeAttribute('selected');
    }
  }

  /**
   * Returns the tile's numeric index.
   * @returns {number} Tile index.
   */
  get index() {
    return parseInt(this.getAttribute('index') || '0', 10);
  }

  /**
   * Sets the tile's numeric index.
   * @param {number} val New tile index.
   * @returns {void}
   */
  set index(val) {
    this.setAttribute('index', String(val));
  }

  /**
   * Focuses the internal input when the tile is editable.
   * @returns {void}
   */
  focus() {
    const input = this.shadowRoot?.querySelector('input');
    if (input) {
      input.focus();
    }
  }

  /**
   * Clears the tile value.
   * @returns {void}
   */
  clear() {
    this.value = '';
  }
}

customElements.define('game-tile', GameTile);

if (typeof window !== 'undefined') {
  /**
   * Window extended with the globally exposed GameTile constructor.
  * @type {Window & {GameTile?: typeof GameTile}}
   */
  const gameWindow = window;
  gameWindow.GameTile = GameTile;
}

export default GameTile;
