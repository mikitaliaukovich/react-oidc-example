# Standalone Desktop App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the OIDC test client as a portable Electron app, and replace the GitHub Pages site with a placeholder that removes the old app's browser data.

**Architecture:** Electron loads the existing Vite build at `http://localhost:8080/react-oidc-example/`. `session.protocol.handle('http')` serves those requests from `dist/` inside an in-memory session, so no port is opened. Settings persist through a preload bridge to an encrypted file in the main process. The Pages workflow deploys a static `pages/` folder instead of the app.

**Tech Stack:** Electron 45, electron-builder 26, Vite 6, React 19, oidc-client-ts, Vitest 5.

**Spec:** `docs/superpowers/specs/2026-10-29-standalone-desktop-app-design.md`

## Global Constraints

- App origin `http://localhost:8080`, base path `/react-oidc-example/`, redirect URI `http://localhost:8080/react-oidc-example/`.
- The session partition has no `persist:` prefix (in-memory). Use `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- Windows x64 only. Targets: `portable` and `zip`. No code signing.
- Release download link: `https://github.com/mikitaliaukovich/react-oidc-example/releases/latest`.
- The placeholder removes only `oidc-settings-overrides` and the `oidc.*` keys, and cookies on path `/react-oidc-example/`. It never calls `localStorage.clear()` and never touches IndexedDB, caches or service workers.

## Review Focus

1. A path-traversal request such as `/react-oidc-example/../../secret` must not read files outside `dist/`. Test in Task 1.
2. An IdP page loaded in the window must not be able to read or write settings: there is no bridge and IPC calls are rejected. Test in Task 1 (`isAppUrl`) and Task 2.
3. `safeStorage` unavailable: the secret is dropped and the other settings are kept. Test in Task 2.
4. A corrupt or missing settings file: the app starts with defaults and doesn't crash. Test in Task 2.
5. The placeholder sees a `path=/` cookie or a non-`oidc.` key from another project: it leaves them untouched. Test in Task 4.

---

### Task 1: App serving and URL rules (main process)

**Files:**
- Create: `electron/appServer.js`, `electron/appServer.test.js`
- Modify: `package.json` (add `vitest`, `"test": "vitest run"`), `vite.config.js` (`test: { environment: 'node' }`), `eslint.config.js` (node globals for `electron/**`, `pages/**` browser)

**Interfaces — produces:**
- `APP_ORIGIN = 'http://localhost:8080'`, `APP_BASE = '/react-oidc-example/'`, `APP_URL = APP_ORIGIN + APP_BASE`
- `isAppUrl(url: string): boolean`: true when the origin equals `APP_ORIGIN`.
- `resolveAppFile(distDir: string, url: string): string | null`: returns an absolute file path. Returns `index.html` for paths without an extension under the base (SPA fallback), and `null` for anything outside the base or outside `distDir`.
- `CONTENT_SECURITY_POLICY: string`
- `registerAppProtocol(ses: Session, distDir: string): void`: serves app URLs with a CSP header and the correct content type, returns 404 for misses, and passes everything else through `ses.fetch(req, { bypassCustomProtocolHandlers: true })`.

- [ ] Write tests:
  - `resolveAppFile(d, APP_URL)` → `d/index.html`
  - `.../assets/x.js` → `d/assets/x.js`
  - `.../some/route` → `d/index.html`
  - `.../%2e%2e/%2e%2e/x` → `null`
  - `http://localhost:8080/other` → `null`
  - `isAppUrl('https://idp.example/login')` → `false`
  - `isAppUrl('http://localhost:8080/react-oidc-example/')` → `true`
  - `isAppUrl('http://localhost:8081/')` → `false`
- [ ] Run `npm test` and confirm it fails. Then implement. Run `npm test` and confirm it passes.
- [ ] Commit.

### Task 2: Encrypted settings store and IPC

**Files:**
- Create: `electron/settingsStore.js`, `electron/settingsStore.test.js`

**Interfaces — produces:**
- `createSettingsStore({ filePath: string, safeStorage: { isEncryptionAvailable(): boolean, encryptString(s): Buffer, decryptString(b): string } })`, which returns:
  - `load(): object | null`: `null` if the file is missing or unreadable.
  - `save(settings: object): { secretSaved: boolean }`.
  - `encryptionAvailable(): boolean`.
- File format: `{ "encrypted": "<base64>" }` when encryption is available. Otherwise `{ "plain": {...settings without client_secret} }`.

- [ ] Write tests with a fake `safeStorage` (reversible transform) and a temp dir:
  - round-trip keeps `client_secret`
  - the file on disk doesn't contain the secret text
  - when encryption is unavailable, `save` returns `{ secretSaved: false }` and `load()` lacks `client_secret`
  - a missing file gives `null`
  - a garbage file gives `null`
- [ ] Run `npm test` and confirm it fails. Then implement. Run `npm test` and confirm it passes.
- [ ] Commit.

### Task 3: Electron shell, renderer storage, bug fixes, packaging

**Files:**
- Create:
  - `electron/main.js`: in-memory session, `registerAppProtocol`, permission handler that denies all, window hardening (deny `window.open` and open http(s) via `shell.openExternal`; `will-navigate` allows only http/https), IPC `settings:load` (sync) and `settings:save` (invoke), both rejected unless `isAppUrl(event.senderFrame.url)`.
  - `electron/preload.cjs`: when `location.origin === 'http://localhost:8080'`, exposes `window.oidcApp = { settings: { initial, encryptionAvailable, save(settings) => Promise<{secretSaved}> } }`.
  - `src/settingsStorage.js`: `loadStoredSettings(): object | null` and `saveStoredSettings(settings): Promise<{ secretSaved: boolean }>`. Uses `window.oidcApp` when present; otherwise localStorage key `oidc-settings-overrides`.
- Modify:
  - `src/useOidcSettings.js`: use `settingsStorage`, and expose `secretNotSaved: boolean`.
  - `src/Configurator.jsx`: show a note when `secretNotSaved`.
  - `src/oidc.config.js`: `userStore` uses `window.sessionStorage`; remove the dead `onerror`; `client_secret: ''`.
  - `src/App.jsx`: when `auth.error`, strip auth params from the URL with `history.replaceState`; use `() => auth.signinRedirect()` and `() => auth.signoutRedirect()`.
  - `index.html`: title "OIDC Test Client".
  - `package.json`: `"main": "electron/main.js"`; scripts `start` (`vite build && electron .`) and `dist` (`vite build && electron-builder --win portable zip --x64`); a `build` block (appId `com.mikitaliaukovich.oidc-test-client`, productName `OIDC Test Client`, files `dist/**` and `electron/**`, output `release/`).
  - `.gitignore`: add `release`.
- Test: manual. Run `npm start`, then:
  - confirm DevTools shows origin `http://localhost:8080` and `crypto.subtle` is defined
  - fill in settings, restart, and confirm they persist
  - confirm `settings.json` in userData has no plaintext secret

- [ ] Implement, then run `npm run lint && npm test && npm run build`. All must pass.
- [ ] Run `npm start` and do the manual checks above.
- [ ] Run `npm run dist` and confirm `release/` contains a portable `.exe` and a `.zip`. Launch the unpacked exe once.
- [ ] Commit.

### Task 4: Placeholder page

**Files:**
- Create: `pages/cleanup.js`, `pages/cleanup.test.js`, `pages/index.html`
- Modify: `.github/workflows/deploy.yml`. It uploads `pages/` after `cp pages/index.html pages/404.html`, excluding `*.test.js`, and has no `npm` steps.

**Interfaces — produces:**
- `removeOldAppData({ storages: Storage[], getCookies(): string, setCookie(s: string): void }): number`. Returns the count of removed items. It removes `oidc-settings-overrides` and the keys starting with `oidc.` from each storage. For each cookie name present, it expires the cookie with `path=/react-oidc-example/` and with `path=/react-oidc-example`, and counts the names that disappear from `getCookies()`.

- [ ] Write tests:
  - a fake storage with `oidc-settings-overrides`, `oidc.user:x`, and `highscore` ends with only `highscore` left, and the count is 2
  - a cookie that the fake jar keeps (simulating `path=/`) isn't counted
- [ ] Run `npm test` and confirm it fails. Then implement. Run `npm test` and confirm it passes.
- [ ] Build `index.html`: self-contained, styled like the app, and showing:
  - the moved message
  - the Releases link
  - the `.zip` fallback note and the SmartScreen note
  - run-from-source steps (`git clone`, `npm ci`, `npm start`)
  - the redirect URI
  - the removed-items count
- [ ] Open it in the built-in browser and check the content.
- [ ] Commit.

### Task 5: Release workflow and README

**Files:**
- Create: `.github/workflows/release.yml`. It triggers on `push: tags: ['v*']`, runs on `windows-latest`, and needs `permissions: contents: write`. Steps:
  - `npm ci`
  - `npm version ${GITHUB_REF_NAME#v} --no-git-tag-version`
  - `npm run dist`
  - `gh release create "$GITHUB_REF_NAME" release/*.exe release/*.zip --generate-notes`
- Modify: `README.md`. Cover:
  - download from Releases
  - run from source
  - the redirect URI to register
  - the SmartScreen note
  - the correct dev URL
  - how to cut a release, and that a release must exist before the placeholder deploy

- [ ] Run `npm run lint && npm test` one last time and confirm both pass.
- [ ] Commit.
