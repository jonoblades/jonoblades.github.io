import { beforeEach, describe, expect, it, vi } from 'vitest';
import BaseClass from '../../scripts/BaseClass.js';

describe('BaseClass', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('stores the shared settings service on each instance', () => {
    const instance = new BaseClass();

    expect(instance.settingsService).toBeDefined();
    expect(instance.settingsService.theme).toBe('system');
  });

  it('waits for DOMContentLoaded before running its initializer', () => {
    const initializer = vi.fn();
    const instance = new BaseClass();

    instance.init(initializer);
    expect(initializer).not.toHaveBeenCalled();

    document.dispatchEvent(new Event('DOMContentLoaded'));

    expect(initializer).toHaveBeenCalledOnce();
  });

  it('does not fail when no initializer is provided', () => {
    const instance = new BaseClass();

    expect(() => instance.init()).not.toThrow();
    expect(() => document.dispatchEvent(new Event('DOMContentLoaded'))).not.toThrow();
  });

  it('registers listeners and invokes them with the dispatched event', () => {
    const button = document.createElement('button');
    const handler = vi.fn();
    const instance = new BaseClass();
    document.body.appendChild(button);

    instance.addListener(button, 'click', handler);
    button.click();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(expect.any(MouseEvent));
    expect(instance.eventListeners).toHaveLength(1);
    expect(instance.eventListeners[0]).toMatchObject({
      element: button,
      event: 'click',
      handler
    });
  });

  it('removes all tracked listeners and clears the listener registry', () => {
    const button = document.createElement('button');
    const firstHandler = vi.fn();
    const secondHandler = vi.fn();
    const instance = new BaseClass();
    document.body.appendChild(button);

    instance.addListener(button, 'click', firstHandler);
    instance.addListener(button, 'dblclick', secondHandler);

    instance.tearDown();
    button.click();
    button.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));

    expect(firstHandler).not.toHaveBeenCalled();
    expect(secondHandler).not.toHaveBeenCalled();
    expect(instance.eventListeners).toEqual([]);
  });

  it('can be called repeatedly without throwing', () => {
    const instance = new BaseClass();

    expect(() => {
      instance.tearDown();
      instance.tearDown();
    }).not.toThrow();
    expect(instance.eventListeners).toEqual([]);
  });
});