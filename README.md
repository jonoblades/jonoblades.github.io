# Jonathan Blades | Personal site

The personal website of Jonathan Blades, a software developer, writer and maker based near Glasgow, Scotland.

The site brings together professional experience, writing, personal projects and browser games in a small, accessible
static website.

## Live site

[Visit jonoblades.github.io](https://jonoblades.github.io/)

## Site sections

- [About](https://jonoblades.github.io/) - background, professional interests and projects.
- [Writing](https://jonoblades.github.io/writing) - fiction, story ideas and work in progress.
- [Resume](https://jonoblades.github.io/resume) - professional experience, skills and development.
- [Games](https://jonoblades.github.io/games) - playable browser projects:
	- [Wordley](https://jonoblades.github.io/games/wordley), a word guessing game with configurable word length, timer
		and player count.
	- [Sudoku](https://jonoblades.github.io/games/sudoku), a generated 9x9 number puzzle with validation.
	- [Futile](https://jonoblades.github.io/games/futile), a turn-based tile game for two to four players.

## Technology

The site is built with:

- Jekyll and GitHub Pages for page generation and deployment.
- Liquid layouts and includes for shared page structure, navigation and footers.
- Semantic HTML and modern CSS, including custom properties, responsive styles, colour-scheme support and print styles.
- Vanilla JavaScript modules for progressive enhancements, theme settings, sharing, table-of-contents generation and
	game logic.
- A reusable `game-tile` Web Component shared by the games.

There is no front-end framework or client-side package dependency. The site is designed to remain useful without
JavaScript, with JavaScript adding enhancements and powering the interactive games.

## Accessibility

Accessibility is part of the site's design and implementation. It includes semantic landmarks and headings, a skip
link, keyboard focus styles, native controls, responsive layouts, light and dark colour schemes, forced-colour support,
print styles and progressive enhancement.

## Local development

Install Ruby and Bundler, then install the project's GitHub Pages dependencies:

```sh
bundle install
```

Start the local Jekyll server:

```sh
bundle exec jekyll serve
```

Open `http://localhost:4000` in a browser. Jekyll writes generated output to `_site/`; edit the source files instead of
editing generated files there.

## Testing

The JavaScript modules and interactive pages are tested with Vitest in a jsdom environment. Tests are grouped by
the code they cover:

- `tests/scripts/` - shared services, base classes and site enhancements.
- `tests/pages/` - page and game behavior for the resume, Sudoku and Wordley pages.

Run the test suite once:

```sh
yarn test:run
```

Run Vitest in watch mode while developing:

```sh
yarn test
```

Generate text, HTML and LCOV coverage reports:

```sh
yarn test:coverage
```

Coverage is collected with V8 and the configured minimum threshold is 80% for statements, branches, functions and
lines. HTML coverage output is written to `coverage/`.

[![codecov](https://codecov.io/gh/jonoblades/jonoblades.github.io/graph/badge.svg?token=4MR3XADLM4)](https://codecov.io/gh/jonoblades/jonoblades.github.io)

## Project structure

```text
.
├── _config.yml              # Jekyll site configuration
├── _includes/               # Shared head, header, navigation and footer markup
├── _layouts/                # Default and game page layouts
├── games/                   # Games index, game pages and game data
├── resume/                  # Resume page and supporting styles/scripts
├── scripts/                 # Shared JavaScript and game-tile Web Component
├── styles/                  # Global, game and variable-based stylesheets
├── writing/                 # Writing page
├── index.html               # About page
├── Gemfile                  # GitHub Pages/Jekyll dependencies
└── _site/                   # Generated Jekyll output
```

The published site is configured in `_config.yml` for GitHub Pages at `https://jonoblades.github.io`.
- `contrast-color()`
