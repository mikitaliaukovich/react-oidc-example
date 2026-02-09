# React OIDC Demo

This project is a simple demo application for testing integration with OIDC providers using `oidc-client-ts` and `react-oidc-context` libraries.

## Configuration

All OIDC settings must be applied in [src/main.jsx](src/oidc.config.js). Update the `oidcConfig` values there to match your provider (authority, client ID, redirect URI, scopes, and any extra query parameters).

## Run locally

1. Install dependencies:
   - npm install
2. Start the dev server:
   - npm run dev

The app will be available at http://localhost:8080.

