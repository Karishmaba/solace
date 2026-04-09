# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm start          # Start Expo dev server (all platforms)
npm run ios        # Start with iOS simulator
npm run android    # Start with Android emulator
npm run web        # Start with web browser
```

No test runner is configured. No lint script is configured.

## Architecture

**Solace** is a private couple's chat app built with React Native + Expo. It integrates with the Matrix protocol for end-to-end encrypted messaging.

### Entry points
- `index.ts` — registers the root component via `registerRootComponent`
- `App.tsx` — current root component (placeholder; the real UI is in `SolaceChatScreen.jsx`)

### Key file
`SolaceChatScreen.jsx` is the main chat UI. It is currently written as a **web preview** using HTML elements (`<div>`, `<textarea>`, CSS-in-JS) rather than React Native primitives. The file header documents the required substitutions when porting to native (e.g., `<div>` → `<View>`, CSS → `StyleSheet.create()`, etc.).

### Trigger engine (`SolaceChatScreen.jsx`)
A regex-based on-device keyword parser scans outgoing messages for four action patterns:
- `buy <item>` → grocery list
- `dinner at/@ <time>` → calendar event
- `budget $<amount> <desc>` → expense log
- `note: <text>` → notebook

Matched triggers produce colored chips attached to the message bubble. `detectTriggers()` runs on every input change (live preview) and again on send.

### Sentiment scoring
`scoreSentiment(text)` is a mock on-device model returning scores for joy, affection, stress, and conflict. It powers the "Relationship Pulse" panel in the header. No external calls — all local regex matching.

### State management
Currently uses local `useState`. Zustand (`zustand`) is installed and intended to replace local state, wired to `matrix-js-sdk` for real messaging.

### Matrix integration
`matrix-js-sdk` is installed but not yet wired up. `expo-secure-store` is available for persisting Matrix credentials. `@matrix-org/olm` is included for end-to-end encryption.

### Deployment
The app is deployed to Fly.io as `solace-matrix` (region: `yyz`). The Dockerfile builds a Node.js production image and starts on port 3000. Deploy with `fly deploy`.
