import { afterEach, describe, expect, it, vi } from 'vitest';
import GameTile from '../../scripts/components/game-tile.js';

function createTile(attributes = {}) {
  const tile = new GameTile();
  Object.entries(attributes).forEach(([name, value]) => {
    if (value === true) {
      tile.setAttribute(name, '');
    } else {
      tile.setAttribute(name, String(value));
    }
  });
  document.body.appendChild(tile);
  return tile;
}

function inputFor(tile) {
  return tile.shadowRoot.querySelector('input');
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('GameTile', () => {
  it('renders an editable letter input by default', () => {
    const tile = createTile({ label: 'Guess', name: 'guess-1', index: 3 });
    const input = inputFor(tile);

    expect(tile.getAttribute('type')).toBe('letter');
    expect(input.name).toBe('guess-1');
    expect(input.getAttribute('inputmode')).toBe('text');
    expect(input.getAttribute('pattern')).toBe('[a-zA-Z]');
    expect(input.getAttribute('aria-label')).toBe('Tile Guess');
    expect(tile.index).toBe(3);
  });

  it('exposes empty defaults and updates boolean properties', () => {
    const tile = createTile();

    expect(tile.value).toBe('');
    expect(tile.name).toBe('');
    expect(tile.placeholder).toBe('');
    expect(tile.readonly).toBe(false);
    expect(tile.disabled).toBe(false);
    expect(tile.selected).toBe(false);

    tile.readonly = true;
    tile.disabled = true;
    tile.selected = true;
    expect(tile.readonly).toBe(true);
    expect(tile.disabled).toBe(true);
    expect(tile.selected).toBe(true);
  });

  it('preserves an explicitly configured numeric type when connected', () => {
    const tile = createTile({ type: 'number' });
    const input = inputFor(tile);

    expect(input.getAttribute('inputmode')).toBe('numeric');
    expect(input.getAttribute('pattern')).toBe('[0-9]');
  });

  it('renders readonly content and updates it through properties', () => {
    const tile = createTile({ readonly: true, value: 'A', status: 'correct' });

    expect(inputFor(tile)).toBeNull();
    expect(tile.shadowRoot.querySelector('div.tile').textContent).toBe('A');
    expect(tile.shadowRoot.querySelector('div.tile').classList.contains('filled')).toBe(true);

    tile.value = 'B';
    expect(tile.shadowRoot.querySelector('div.tile').textContent).toBe('B');
    tile.clear();
    expect(tile.shadowRoot.querySelector('div.tile').classList.contains('filled')).toBe(false);

    tile.readonly = false;
    expect(inputFor(tile)).not.toBeNull();
    tile.disabled = true;
    tile.selected = true;
    expect(inputFor(tile).disabled).toBe(true);
    expect(tile.hasAttribute('selected')).toBe(true);
    tile.disabled = false;
    tile.selected = false;
    expect(tile.hasAttribute('disabled')).toBe(false);
    expect(tile.hasAttribute('selected')).toBe(false);
  });

  it('sanitizes letter and numeric input and emits the input detail', () => {
    const tile = createTile({ index: 2 });
    const details = [];
    tile.addEventListener('tile-input', (event) => details.push(event.detail));
    const input = inputFor(tile);

    input.value = 'a!';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(tile.value).toBe('A');
    expect(input.value).toBe('A');
    expect(input.classList.contains('filled')).toBe(true);
    expect(details).toEqual([{ value: 'A', index: 2 }]);

    tile.setAttribute('type', 'number');
    const numberInput = inputFor(tile);
    numberInput.value = 'a4';
    numberInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(tile.value).toBe('4');
    expect(numberInput.getAttribute('inputmode')).toBe('numeric');
    expect(numberInput.getAttribute('pattern')).toBe('[0-9]');
  });

  it('synchronizes name and placeholder setters with the rendered input', () => {
    const tile = createTile();

    tile.name = 'letter-1';
    tile.placeholder = 'C';
    expect(inputFor(tile).name).toBe('letter-1');
    expect(inputFor(tile).placeholder).toBe('C');

    tile.name = '';
    tile.placeholder = '';
    tile.status = 'present';
    expect(tile.hasAttribute('name')).toBe(false);
    expect(inputFor(tile).placeholder).toBe('');
    expect(tile.status).toBe('present');
    tile.status = '';
    expect(tile.status).toBe('');

    tile.readonly = true;
    tile.placeholder = 'ignored';
    expect(inputFor(tile)).toBeNull();
  });

  it('emits focus and keyboard events, submitting a containing form on Enter', () => {
    const form = document.createElement('form');
    form.requestSubmit = vi.fn();
    const tile = new GameTile();
    tile.setAttribute('index', '4');
    form.appendChild(tile);
    document.body.appendChild(form);
    const input = inputFor(tile);
    const focusDetails = [];
    const keyDetails = [];
    tile.addEventListener('tile-focus', (event) => focusDetails.push(event.detail));
    tile.addEventListener('tile-keydown', (event) => keyDetails.push(event.detail));

    input.focus();
    expect(focusDetails).toEqual([{ index: 4 }]);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(form.requestSubmit).toHaveBeenCalledOnce();
    expect(keyDetails[0]).toMatchObject({ key: 'Enter', index: 4, originalEvent: expect.any(KeyboardEvent) });

    const backspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    input.value = '';
    input.dispatchEvent(backspace);
    expect(backspace.defaultPrevented).toBe(true);
  });

  it('handles non-submitting keyboard input and safe focus without an input', () => {
    const tile = createTile();
    const input = inputFor(tile);
    const keyEvent = new KeyboardEvent('keydown', { key: 'A', bubbles: true });

    input.dispatchEvent(keyEvent);
    expect(keyEvent.defaultPrevented).toBe(false);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    input.value = 'A';
    const filledBackspace = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true });
    input.dispatchEvent(filledBackspace);
    expect(filledBackspace.defaultPrevented).toBe(false);

    tile.setAttribute('type', 'other');
    const unfilteredInput = inputFor(tile);
    unfilteredInput.value = 'a!';
    unfilteredInput.dispatchEvent(new Event('input', { bubbles: true }));
    expect(tile.value).toBe('a!');

    tile.focus();
    tile.readonly = true;
    expect(() => tile.focus()).not.toThrow();
  });
});