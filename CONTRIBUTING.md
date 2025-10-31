# λ: Contribution Guide

Thank you for your interest in contributing to getty! Here you'll find how to prepare your environment, run the project in development mode, code style, tests, and the flow to submit changes.

## Requirements

- Node.js >= 22 (< 23). We rely on features introduced in 22.x.
- pnpm 10.x (managed automatically through Corepack; see below).
- Windows, macOS, or Linux.

## Initial setup

```bash
# 1) Enable Corepack (once per machine) and install dependencies
corepack enable
pnpm install

# 2) Environment variables (optional, depending on your needs)
# Create a .env file at the repo root if you need to tweak behavior
# Useful examples:
# PORT=3000
# GETTY_ENABLE_CSP=1
# GETTY_REQUIRE_SESSION=0
# GETTY_LIVEVIEWS_TTL_MS=10000
# GETTY_LIVEVIEWS_RL_ENABLED=0
# GETTY_LIVEVIEWS_RL_WINDOW_MS=60000
# GETTY_LIVEVIEWS_RL_MAX=120
# GETTY_CSP_CONNECT_EXTRA=https://your-domains.com
# GETTY_ALLOW_ORIGINS=https://studio.obs,https://your-domains.com
```

Quick notes:

- If you use sessions with Redis, define REDIS_URL.
- By default, the server listens on port 3000.

## Main scripts

- Server + CSS + public pages in development (watch):

  ```bash
  pnpm run dev
  ```

  This starts nodemon (server), Tailwind in watch mode, and the Vite dev server embedded behind Express so every page (landing, welcome, dashboard, 404) is served from http://localhost:3000 with HMR.

- Admin SPA (Vite) in development:

  ```bash
  pnpm run admin:dev
  ```

  Use it in a separate terminal while the server is running.

- Lint (JS/Vue and CSS):

  ```bash
  pnpm run lint      # ESLint (admin-frontend/src, modules, routes, scripts, server.js)
  pnpm run lint:fix  # Auto-fixes
  pnpm run lint:css
  pnpm run lint:css:fix
  ```

- Tests (Jest):

  ```bash
  pnpm test
  ```

- Production build (CSS, i18n, admin, minified HTML and JS):
  ```bash
  pnpm run build
  ```

## Relevant structure

- `server.js`: Express server, routes, WS, and basic security (Helmet, rate-limit).
- `routes/`: APIs for widgets and admin.
- `modules/`: product logic (tip goal, last tip, chat, etc.).
- `admin-frontend/`: Vue (Vite) SPA for administration.
- `public/`: static assets and the synced output from `dist-frontend/`.
- `shared-i18n/`: language strings (en/es). Generate runtime with `npm run build:i18n`.
- `config/`: JSON configuration persisted in local mode.
- `tests/`: integration/unit tests with Jest and Supertest.

## Widget and styles development

- CSS: Tailwind. During development use `pnpm run dev` (watch). For one-off builds:
  ```bash
  pnpm run build-css && pnpm run minify-css
  ```
- Widgets (OBS overlays) now live under `frontend/widgets/**` + `frontend/src/widgets/**` and are built with Vite:
  ```bash
  pnpm frontend:build   # compile widget bundles into dist-frontend/
  pnpm sync:frontend    # copy dist-frontend/ into public/ and refresh SRI
  ```
- Landing, welcome, dashboard, and 404 pages are built via Vite (also used automatically by `pnpm run dev`):
  ```bash
  pnpm frontend:build
  ```

## i18n

- Edit `shared-i18n/en.json` and/or `shared-i18n/es.json`.
- Generate the runtime for the admin:
  ```bash
  pnpm run build:i18n
  ```
- Add tests if you introduce critical keys or change user-facing texts in routes.

## Code style

- Follow the repo's ESLint and Stylelint rules.
- Prefer pure functions and validate inputs (Zod is used in several modules).
- Avoid breaking public APIs (routes or WebSocket contracts). If you need changes, document them in `docs/` and `README.md`.
- Commits: Conventional Commits are recommended (feat, fix, chore, docs, test, refactor…).

## Tests

Before opening a PR, make sure to run:

```bash
pnpm run lint
pnpm test
pnpm run build
```

## Tips

- Cover the happy path and 1–2 edge cases.
- For new endpoints, add tests in `tests/` using Supertest.

## Useful environment variables

- Security/CSP: `GETTY_ENABLE_CSP`, `GETTY_CSP_*` (whitelists for connect/script/img/media).
- Sessions/hosted: `REDIS_URL`, `GETTY_REQUIRE_SESSION`, `SESSION_TTL_SECONDS`, `COOKIE_SECURE`.
- WebSocket: `GETTY_ALLOW_ORIGINS` (allowed origins for upgrade).
- Liveviews proxy: `GETTY_LIVEVIEWS_TTL_MS`, `GETTY_LIVEVIEWS_RL_ENABLED`, `GETTY_LIVEVIEWS_RL_WINDOW_MS`, `GETTY_LIVEVIEWS_RL_MAX`, `GETTY_ALLOW_IPS`.

Keep default values unless you need to harden production.

## Workflow (fork & PR)

1. Fork the repository and create a descriptive branch:
   ```bash
   git checkout -b feat/short-name
   ```
2. Make small, focused changes; update/add tests.
3. Run lint, tests, and build (see Tests section).
4. Update documentation if applicable (`README.md`, `docs/`, `INTERNATIONALIZATION.md`).
5. Open a Pull Request describing:
   - The problem it solves or improvement it provides.
   - Risks/compatibility (breaking changes, migrations).
   - How to test it (steps and screenshots if applicable).

## Security and responsible disclosure

- To report vulnerabilities, follow `SECURITY.md`.
- Do not open public issues with vulnerability details; use the secure channel indicated.

## License

By contributing, you agree that your changes will be licensed under the same license as the project (see `LICENSE`).

Thanks for helping improve getty!

## λ
