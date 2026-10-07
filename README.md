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

## Site visits dashboard

GitHub Pages serves `/site-visits/` and its assets. A Cloudflare Worker routes all clients to one SQLite-backed
Durable Object, which stores the snapshot and global refresh throttle. Hibernating WebSockets keep idle connections
without keeping the object active. Durable alarms refresh nine GoatCounter reports at most once every 15 minutes
while clients are connected. Failed attempts count toward this interval, including after reconnects and deployments.
An in-progress refresh may finish after the last disconnect; no further refresh is started without clients.

Each report retains its last successful data, update timestamp, and date range independently. The browser stores its
latest snapshot locally and keeps displaying it during outages. This local snapshot is not available to new visitors.
Deployments disconnect clients, which reconnect with exponential backoff and jitter (up to five minutes).

### Zero-cost requirement

Use **Workers Free**, not Workers Paid. SQLite-backed Durable Objects are supported on Free. This configuration
does not enable a paid plan, but cannot enforce your account's subscription: confirm it in the Cloudflare dashboard
before deploying. On Free, quota exhaustion causes errors rather than overage billing. Dashboard unavailability
until quotas reset is intentional. Account quotas are shared with other applications; free allowances and pricing
can change. See [Cloudflare's current limits and pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

There is one fixed object and a cap of 64 simultaneous connections. Incoming application messages are rejected
except for automatic `ping`/`pong` heartbeats. These measures limit normal usage, not denial of service against
the public endpoint. Continuous viewing causes at most 96 refresh batches (864 upstream requests) per day.
Check GoatCounter's rate limits separately. Each upstream request has a 10-second deadline.

### Run locally

Install JavaScript dependencies with `yarn install`. Store these values in the ignored `site-visits/.dev.vars`:

```dotenv
GOATCOUNTER_API_BASE_URL=https://YOUR-CODE.goatcounter.com/api/v0/stats
GOATCOUNTER_API_TOKEN=YOUR-TOKEN
```

Wrangler also supports the existing ignored `site-visits/.env` when `.dev.vars` is absent. Never put the token
in Jekyll configuration, frontend code, or committed files.

```sh
yarn dev:site-visits
```

Open `http://localhost:4000/site-visits/`. This starts Jekyll with `_config.local.yml` and Wrangler on port 4174,
with local SQLite storage. `yarn site-visits` starts only Wrangler. Local refreshes call the configured GoatCounter
API; do not use production credentials for mock tests.

### Deploy

After confirming the account uses Workers Free:

```sh
yarn wrangler login
yarn check:site-visits
yarn deploy:site-visits
yarn wrangler secret put GOATCOUNTER_API_BASE_URL --config site-visits/wrangler.jsonc
yarn wrangler secret put GOATCOUNTER_API_TOKEN --config site-visits/wrangler.jsonc
```

Enter each value directly at the Wrangler prompt. The dashboard remains unavailable until both secrets exist.
Set `dashboard_api_url` in `_config.yml` to the HTTPS Worker URL printed by deployment, then publish GitHub Pages.
Until configured, the public frontend displays an unavailable state instead of connecting to localhost.
The optional `?dashboard-api=https://YOUR-WORKER.workers.dev` parameter overrides the endpoint for testing.
If the frontend domain changes, update `DASHBOARD_ORIGIN` in `site-visits/wrangler.jsonc`; this is an origin check,
not authentication, and the analytics are public.

Run `yarn test:run tests/site-visits` for coordination, restored state, partial failure, disconnect, and browser
recovery tests. `yarn check:site-visits` builds the deployment bundle without deploying it. Keep the migration
and fixed object name unchanged to preserve the stored snapshot and throttle across future deployments.

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
