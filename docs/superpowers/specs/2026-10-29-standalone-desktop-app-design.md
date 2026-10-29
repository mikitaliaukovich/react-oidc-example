# Move the OIDC test client off GitHub Pages into a portable desktop app

## Why

QA engineers use this app to test OIDC logins with real client IDs, client
secrets and tokens. Today it runs at
`https://mikitaliaukovich.github.io/react-oidc-example/` and keeps all of that
in the browser's localStorage. That origin, `mikitaliaukovich.github.io`, is
shared by every GitHub Pages project of the owner (`formatter`, `group21`,
`react-oidc-example`, `simple-arcanoid`), so any of them, or a compromised
dependency in any of them, can read the saved secret and the signed-in
user's tokens. The owner doesn't want to rely on GitHub Pages and the app
for that data.

## Goals

1. GitHub Pages serves only a static placeholder page. It says the app has
   moved, links to the GitHub Releases page to download it, explains how to
   run it from source, and deletes the data the old app left in the browser.
2. The app runs as a standalone portable Windows app: no installer, no admin
   rights, double-click to run.
3. Secrets and tokens are no longer readable by other websites or apps.

## Non-goals

- macOS and Linux builds. (Builder's call; easy to add later.)
- Code signing, for now. It's not known whether the QA machines block
  unsigned executables, so both a portable `.exe` and a `.zip` ship. The
  `.zip` runs from any folder the user picks, not `%TEMP%`, so it's more
  likely to get past policies. The README and placeholder recommend the
  `.zip` if the `.exe` is blocked, and mention the SmartScreen warning.
- Auto-update.
- Moving existing users' settings from the browser into the desktop app.
  The owner said re-entering the OIDC settings once is fine.

## Anti-goals

- The placeholder page must not damage the owner's other GitHub Pages
  projects on the shared origin (see "Open questions").
- The desktop app must not open a network port that other local processes
  could talk to.
- No new place where the client secret sits on disk in plain text.

## Decisions

### Technology: Electron (Claude's call)

Electron, not Edge WebView2, because:

- The app is already JavaScript/React built by Vite. Electron keeps one
  language and one toolchain. A WebView2 host would need a separate C#/.NET
  (or C++) project.
- Electron can serve the app at a normal `http://localhost` URL by
  intercepting requests inside the app, with no real network listener. This
  keeps the redirect URI a normal loopback URL that every IdP accepts.
- `safeStorage` encrypts saved settings with Windows DPAPI, tied to the
  Windows user.
- Bundled Chromium gives the same behaviour on every machine. WebView2
  depends on the runtime installed on the machine.

The trade-off is size: about 80–100 MB, against a few MB for WebView2.

### How the app is served

- The renderer loads `http://localhost:8080/react-oidc-example/`. That's the
  same URL as `npm run dev`, so one redirect URI registration covers both.
  The app intercepts `http` requests to `localhost:8080` with
  `session.protocol.handle` and answers them from the built `dist/` files,
  with SPA fallback to `index.html`. Every other `http` request goes out
  unchanged through the same session's fetch. No port is opened.
- Redirect URI and post-logout redirect URI to register with the IdP:
  `http://localhost:8080/react-oidc-example/`.
- Responses for app files carry a Content-Security-Policy header:
  `script-src 'self'`. `connect-src` stays open because the authority is
  user-supplied.

### Storage

- The browsing session is an in-memory partition, so Chromium writes no
  localStorage, sessionStorage, cookies or cache to disk.
- OIDC settings, client secret included, persist across launches. They are
  saved by the main process to a file in Electron's `userData` folder,
  encrypted with `safeStorage`. The renderer reads and writes them through a
  small preload API exposed with `contextBridge`.
- Tokens (`userStore`) live in `sessionStorage` and are gone when the app
  closes. Closing the app means signing in again. (Claude's call: a test
  tool doesn't need to keep sessions alive, and it's safer.)
- When the app runs in a plain browser (`npm run dev`), settings fall back
  to localStorage and tokens use sessionStorage. That's acceptable because
  the origin is the developer's own `localhost`.

### Electron hardening

- `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`.
- `window.open` and new windows are denied. Links open in the default
  browser through `shell.openExternal`, http/https only.
- Top-level navigation is allowed to any http(s) URL, because IdPs redirect
  through federated providers. Nothing else is allowed.
- DevTools stay available from the menu. QA engineers inspect tokens and
  network calls; this is a test tool.
- Permission requests (camera, notifications and so on) are denied.

### Packaging and releases

- `electron-builder` produces a Windows x64 portable `.exe` and a `.zip` of
  the unpacked app. The portable `.exe` unpacks itself on every launch, so
  it starts slower; the zip starts instantly.
- A GitHub Actions workflow on `v*` tags builds on `windows-latest` and
  attaches both files to a GitHub Release.
- The `package.json` scripts keep `dev`/`build`/`lint`, and add `start`
  (build, then launch Electron from source) and `dist` (package).

### Placeholder page

- A self-contained static page in its own folder, `pages/`. The Pages
  workflow deploys only that folder instead of building the app. It
  includes a `404.html` copy so old deep links land on it too.
- Content: the app has moved to a desktop app; a "Download from Releases"
  link (`https://github.com/mikitaliaukovich/react-oidc-example/releases/latest`);
  how to run from source (`git clone`, `npm ci`, `npm start`); the new
  redirect URI to register; and a line saying stored data has been removed.
- On load it deletes **only this app's data** (owner's decision), so the
  other Pages projects on the shared origin are untouched:
  - localStorage and sessionStorage: the `oidc-settings-overrides` key and
    every key starting with `oidc.`, the prefix oidc-client-ts uses.
  - Cookies visible on `/react-oidc-example/`. The old app set none, so this
    is belt-and-braces.
  - IndexedDB, Cache Storage and service workers are left alone. They are
    shared by the whole origin, and the old app never used them.
  - It can't send the `Clear-Site-Data` header because GitHub Pages doesn't
    allow custom headers. That header would wipe the whole origin anyway.
- The page says how many items it removed, so users can see it worked.
- Rollout order: publish the first GitHub Release before the placeholder
  goes live, so the download link works from day one.

### Bug fixes to the app

- **Confirmed bug:** `oidc.config.js` passes `onerror`, which is not a
  `react-oidc-context` prop, so it never runs. After a failed sign-in, the
  `?error=…&state=…` (or a stale `?code=…`) stays in the URL. Remounting
  `AuthProvider`, for example after editing settings, re-processes it and
  fails again. Fix: clean the URL when the sign-in callback fails.
- README says the dev server runs at `http://localhost:8080`, but it runs at
  `http://localhost:8080/react-oidc-example/`.
- `onClick={auth.signinRedirect}` passes the click event as sign-in
  arguments. It's harmless today but fragile; change it to
  `() => auth.signinRedirect()`, as the library's docs do. Same for
  `signoutRedirect`.

## Calls made while writing this up (Claude's, not the owner's)

- The preload settings API exists only when the page's origin is
  `http://localhost:8080`. The main process also checks the sender frame's
  URL on every IPC call, because IdP pages load in the same window.
- If `safeStorage` encryption isn't available, the client secret is not
  saved. The other settings still are, and the form says why the secret
  wasn't kept.
- The release version comes from the git tag (`v1.2.3` → `1.2.3`). The
  workflow sets it in `package.json` before packaging.
- The hardcoded example values in `src/oidc.config.js` stay as defaults,
  except the example client secret, which becomes empty.

## Left to the builder

File layout of the Electron main and preload code, the exact CSP string,
the placeholder's styling (it should match the app's current look), the
Electron and electron-builder versions (latest stable), and the app name and
icon.
