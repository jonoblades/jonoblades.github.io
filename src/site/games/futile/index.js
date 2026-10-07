/**
 * Browser entry point for the Futile game.
 * @module futile-entry
 */
// Instantiating here keeps the Futile class importable by tests without
// starting a game during module import.
import { Futile } from './futile.js';

new Futile();
