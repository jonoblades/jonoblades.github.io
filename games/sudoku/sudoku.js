class Sudoku {
  #grid;
  #puzzles = [];
  #selectedPuzzle;

  constructor() {
    document.addEventListener('DOMContentLoaded', async () => {
      this.#grid = document.querySelectorAll('.sudoku-grid .cell');
      this.#puzzles = await this.#loadPuzzles();
      this.#selectedPuzzle = this.#selectPuzzle();
      this.#renderPuzzle(this.#selectedPuzzle);

      document.getElementById('validate-button').addEventListener('click', () => {
        this.#validatePuzzle();
      });
    });
  }

  async #loadPuzzles() {
    const puzzles = await fetch('./sudoku-puzzles.json');
    return puzzles.json();
  }

  #selectPuzzle() {
    const index = Math.floor(Math.random() * this.#puzzles.length);
    return this.#puzzles[index];
  }

  #renderPuzzle(puzzle) {
    console.table(puzzle.puzzle);
    console.table(puzzle.solution);
    const puzzleNumberElement = document.querySelector('.sudoku-puzzle-number');
    const puzzleDifficultyElement = document.querySelector('.sudoku-puzzle-difficulty');
    puzzleNumberElement.textContent = puzzle.id;
    puzzleDifficultyElement.textContent = puzzle.difficulty;
    puzzle.puzzle.forEach((row, rowIndex) => {
      row.forEach((cell, cellIndex) => {
        const index = rowIndex * 9 + cellIndex;
        const cellElement = this.#grid[index];
        
        if (cell) {
          cellElement.value = cell;
          cellElement.readonly = true;
          cellElement.status = 'correct';
        } else {
          cellElement.value = '';
          cellElement.readonly = false;
          cellElement.status = '';
        }

        cellElement.addEventListener('keydown', (event) => {
          if (event.key === 'ArrowUp') {
            this.#moveUp(index);
          } else if (event.key === 'ArrowDown') {
            this.#moveDown(index);
          } else if (event.key === 'ArrowLeft') {
            this.#moveLeft(index);
          } else if (event.key === 'ArrowRight') {
            this.#moveRight(index);
          }
        });
      });
    });
  }

  #moveUp(index) {
    const newIndex = index - 9;
    if (newIndex >= 0 && this.#grid[newIndex].readonly === false) {
      this.#grid[newIndex].focus();
    } else if (newIndex >= 0) {
      this.#moveUp(newIndex);
    }
  }

  #moveDown(index) {
    const newIndex = index + 9;
    if (newIndex < this.#grid.length && this.#grid[newIndex].readonly === false) {
      this.#grid[newIndex].focus();
    } else if (newIndex < this.#grid.length) {
      this.#moveDown(newIndex);
    }
  }

  #moveLeft(index) {
    const newIndex = index - 1;
    if (newIndex >= 0 && this.#grid[newIndex].readonly === false) {
      this.#grid[newIndex].focus();
    } else if (newIndex >= 0) {
      this.#moveLeft(newIndex);
    }
  }

  #moveRight(index) {
    const newIndex = index + 1;
    if (newIndex < this.#grid.length && this.#grid[newIndex].readonly === false) {
      this.#grid[newIndex].focus();
    } else if (newIndex < this.#grid.length) {
      this.#moveRight(newIndex);
    }
  }

  #validatePuzzle() {
    this.#selectedPuzzle.solution.forEach((row, rowIndex) => {
      row.forEach((cell, cellIndex) => {
        const index = rowIndex * 9 + cellIndex;
        const cellElement = this.#grid[index];
        if (cellElement.value && cellElement.value != cell) {
          cellElement.status = 'error';
        } else if (cellElement.value && cellElement.value == cell) {
          cellElement.status = 'correct';
          cellElement.readonly = true;
        } else {
          cellElement.status = '';
        }
      });
    });
  }
}

new Sudoku();
