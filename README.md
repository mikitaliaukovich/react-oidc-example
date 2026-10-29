# OIDC Test Client

A desktop app for testing integration with OIDC providers, built with `oidc-client-ts`, `react-oidc-context` and Electron.

The app used to run on GitHub Pages. It moved to a standalone app so client secrets and tokens are no longer kept in browser storage that other sites on the same origin can read. https://mikitaliaukovich.github.io/react-oidc-example/ now only shows a notice, and removes the data the old app left in the browser.

## Download

Get the latest build from [GitHub Releases](https://github.com/mikitaliaukovich/react-oidc-example/releases/latest):

- `OIDC-Test-Client-<version>-win-x64.zip`: extract it to any folder and run `OIDC Test Client.exe`. Use this one if your company blocks the portable `.exe`.
- `OIDC-Test-Client-<version>-portable.exe`: a single file with nothing to install. It unpacks itself on every start, so it opens more slowly.

The builds aren't code-signed. If Windows SmartScreen warns you, choose **More info** → **Run anyway**.

## Register the redirect URI

Register this URL as both the redirect URI and the post-logout redirect URI in your IdP application:

```
http://localhost:8080/react-oidc-example/
```

The desktop app doesn't open a network port. It serves itself at that address inside its own window only. The same URL is used by `npm run dev`.

## Where data is kept

- OIDC settings, including the client secret, are saved for the next launch in `settings.json` in the app's data folder. They are encrypted with Windows DPAPI, tied to your Windows account. If encryption isn't available, the client secret isn't saved.
- Tokens are kept in memory only. Closing the app signs you out.

## Run from source

Requires Node.js 22.12 or later.

1. Install dependencies:
   - `npm ci`
2. Start the desktop app:
   - `npm start`

To work on the UI in a browser instead, run `npm run dev` and open http://localhost:8080/react-oidc-example/. In the browser, settings are stored in localStorage on your own localhost origin.

Other scripts:

- `npm test`: unit tests (Vitest)
- `npm run lint`: ESLint
- `npm run dist`: build the portable `.exe` and `.zip` into `release/`

## Releasing

Push a version tag, for example:

```
git tag v1.0.0
git push origin v1.0.0
```

The `Release desktop app` workflow builds both files on Windows and attaches them to a GitHub Release for that tag.

### First rollout

Every push to `main` deploys the placeholder to GitHub Pages, and the placeholder's download link points at the latest release. So publish a release before the placeholder goes live:

1. Push the feature branch (not `main`).
2. Tag the branch head, e.g. `v1.0.0`, and push the tag.
3. Wait for the `Release desktop app` workflow to publish the release.
4. Merge the branch into `main`, which deploys the placeholder.
