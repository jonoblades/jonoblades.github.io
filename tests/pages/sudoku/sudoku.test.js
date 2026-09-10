import { beforeEach, describe, expect, it, vi } from 'vitest';

const puzzle = {
  id: 7,
  difficulty: 'Easy',
  puzzle: [
    [5, 3, 0, 0, 7, 0, 0, 0, 0],
    [6, 0, 0, 1, 9, 5, 0, 0, 0],
    [0, 9, 8, 0, 0, 0, 0, 6, 0],
    [8, 0, 0, 0, 6, 0, 0, 0, 3],
    [4, 0, 0, 8, 0, 3, 0, 0, 1],
    [7, 0, 0, 0, 2, 0, 0, 0, 6],
    [0, 6, 0, 0, 0, 0, 2, 8, 0],
    [0, 0, 0, 4, 1, 9, 0, 0, 5],
    [0, 0, 0, 0, 8, 0, 0, 7, 9]
  ],
  solution: [
    [5, 3, 4, 6, 7, 8, 9, 1, 2],
    [6, 7, 2, 1, 9, 5, 3, 4, 8],
    [1, 9, 8, 3, 4, 2, 5, 6, 7],
    [8, 5, 9, 7, 6, 1, 4, 2, 3],
    [4, 2, 6, 8, 5, 3, 7, 9, 1],
    [7, 1, 3, 9, 2, 4, 8, 5, 6],
    [9, 6, 1, 5, 3, 7, 2, 8, 4],
    [2, 8, 7, 4, 1, 9, 6, 3, 5],
    [3, 4, 5, 2, 8, 6, 1, 7, 9]
  ]
};

async function loadSudoku() {
  vi.resetModules();
  const addEventListener = vi.spyOn(document, 'addEventListener');
  await import('../../../games/sudoku/sudoku.js');
  const initialize = addEventListener.mock.calls.at(-1)[1];
  addEventListener.mockRestore();
  return initialize;
}

async function initializePage(initialize) {
  await initialize();
  await vi.waitFor(() => expect(document.querySelector('.sudoku-puzzle-number').textContent).toBe('7'));
}

describe('Sudoku page', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <span class="sudoku-puzzle-number"></span>
      <span class="sudoku-puzzle-difficulty"></span>
      <button id="validate-button">Validate</button>
      <div class="sudoku-grid">${'<input class="cell" />'.repeat(81)}</div>
    `;
    vi.spyOn(Math, 'random').mockReturnValue(0);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ json: () => Promise.resolve([puzzle]) }));
  });

  it('loads and renders the selected puzzle metadata and cells', async () => {
    const initialize = await loadSudoku();
    await initializePage(initialize);

    const cells = [...document.querySelectorAll('.cell')];
    expect(document.querySelector('.sudoku-puzzle-number').textContent).toBe('7');
    expect(document.querySelector('.sudoku-puzzle-difficulty').textContent).toBe('Easy');
    expect(cells[0]).toMatchObject({ value: '5', readonly: true, status: 'correct' });
    expect(cells[2]).toMatchObject({ value: '', readonly: false, status: '' });
    expect(fetch).toHaveBeenCalledWith('./sudoku-puzzles.json');
  });

  it('moves between editable cells with arrow keys, skipping fixed cells', async () => {
    const initialize = await loadSudoku();
    await initializePage(initialize);

    const cells = [...document.querySelectorAll('.cell')];
    cells[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(document.activeElement).toBe(cells[2]);
  });

  it('handles all directional moves, recursive skips, boundaries, and unrelated keys', async () => {
    const initialize = await loadSudoku();
    await initializePage(initialize);

    const cells = [...document.querySelectorAll('.cell')];
    const focusExpectations = [
      [20, 11, 'ArrowUp'],
      [0, 18, 'ArrowDown'],
      [3, 2, 'ArrowLeft'],
      [3, 5, 'ArrowRight']
    ];

    for (const [sourceIndex, targetIndex, key] of focusExpectations) {
      const focus = vi.spyOn(cells[targetIndex], 'focus');
      cells[sourceIndex].dispatchEvent(new KeyboardEvent('keydown', { key }));
      expect(focus).toHaveBeenCalledOnce();
    }

    expect(() => {
      cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      cells[9].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
      cells[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      cells[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      cells[80].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
      cells[80].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
      cells[40].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    }).not.toThrow();
  });

  it('marks entered values as correct or incorrect when validating', async () => {
    const initialize = await loadSudoku();
    await initializePage(initialize);

    const cells = [...document.querySelectorAll('.cell')];
    cells[2].value = '4';
    cells[3].value = '9';
    document.getElementById('validate-button').click();

    expect(cells[2]).toMatchObject({ status: 'correct', readonly: true });
    expect(cells[3].status).toBe('error');
  });
});