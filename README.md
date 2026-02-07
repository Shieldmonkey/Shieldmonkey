[![Build Extension](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/build.yml/badge.svg)](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/build.yml)
[![Test](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/test.yml/badge.svg)](https://github.com/Shieldmonkey/Shieldmonkey/actions/workflows/test.yml)
[![GitHub last commit](https://img.shields.io/github/last-commit/Shieldmonkey/Shieldmonkey?style=flat-square)](https://github.com/Shieldmonkey/Shieldmonkey/commits/main)
[![GitHub issues](https://img.shields.io/github/issues/Shieldmonkey/Shieldmonkey?style=flat-square&color=blue)](https://github.com/Shieldmonkey/Shieldmonkey/issues)
[![License](https://img.shields.io/github/license/Shieldmonkey/Shieldmonkey?style=flat-square&color=orange)](LICENSE)

[日本語版 README (Japanese)](README.ja.md)

# Shieldmonkey

Shieldmonkey is an open-source, Manifest V3 compliant userscript manager designed with security and auditability as the top priorities.

## Design and Features

### Strict Content Security Policy (CSP)
Shieldmonkey enforces a strict Content Security Policy (CSP) to prevent the extension from communicating with external entities unintentionally.
External connections from Background Scripts and injected pages are blocked. Consequently, the following features are intentionally excluded:

- Functions that bypass CORS, such as `GM_xmlHttpRequest`
- Dynamic loading of external scripts via `require`
- Automatic backup to cloud services
- Automatic script updates

All updates are performed manually by the user, preventing unintentional code replacement or execution in the background.

### Supply Chain Security
We leverage [pnpm's supply chain security features](https://pnpm.io/supply-chain-security) throughout the development and build processes to enhance resilience against attacks.

- **`ignore-scripts=true`**: This setting is enforced via `.npmrc`, so running `pnpm install` will never automatically execute scripts like `postinstall` from dependencies. This proactively prevents the execution of malicious scripts.
- **Strict Dependency Management**: By default, pnpm does not create a flat `node_modules`, preventing access to undeclared dependencies (phantom dependencies).
- **`pnpm-lock.yaml`**: We rely on `pnpm install --frozen-lockfile` (default behavior in CI) to enforce strict version management based on the lockfile, preventing unintended package injection.

### Auditable Builds
To ensure transparency, we follow these build policies:

- The source code of the built extension is intentionally not minified (compressed or obfuscated) to prioritize ease of auditing.
- SourceMaps are included for debugging and verification.
- A minified version is also provided for distribution size considerations, but we recommend using the non-minified version.

We place the highest importance on users being able to build the extension from source and verify its content. While installation from stores is possible, building from the GitHub source code is primarily recommended.

## Features

- Script management (install, edit, delete, disable)
- Editing environment powered by Monaco Editor (TypeScript/JavaScript support)
- `.user.js` format support
- Local import/export

## Tech Stack

- React 19
- Vite (w/ CRXJS)
- TypeScript
- Monaco Editor
- IndexedDB
- Vanilla CSS / Sass

## Installation and Build

1. Clone the repository
   ```bash
   git clone https://github.com/shieldmonkey/shieldmonkey.git
   cd shieldmonkey
   ```

2. Install dependencies
   Since `ignore-scripts=true` is set in `.npmrc`, you can safely install dependencies using:
   ```bash
   pnpm install
   ```

3. Build
   ```bash
   pnpm run build
   ```

4. Load the extension
   Open `chrome://extensions` in Chrome, enable Developer Mode, and load the generated `dist` directory.

## testing

You can run E2E tests to verify Shieldmonkey's functionality.

```bash
# Install Playwright Browsers (first time only)
pnpm exec playwright install chromium --with-deps

# Build the extension
pnpm run build

# Run E2E tests
pnpm run test:e2e
```

Tests include:
- Script installation and import
- Script management on the options page (create, edit, delete)
- Backup and restore functionality
- CSP policy verification
- Popup page behavior check
