# Conversation Transfer Hub — Desktop app (Electron)

Local-first desktop hub to import, analyze, compress and repackage AI
conversations for moving them between ChatGPT, Claude and Gemini.

- Paste a conversation, open an export file, or open a `.ai-transfer` package.
- Analyze it, choose a transfer mode (Full / Smart / Compact / Custom), edit the
  extracted context, then copy or **save** a paste-ready briefing or a
  `.ai-transfer` package (real file save — unlike the browser build).
- Optional AI refinement using your own API key. The key is encrypted with the
  OS keystore (DPAPI on Windows) and the request runs in the app's main process,
  so there are no browser CORS limits and the key never touches the page.
- Recent conversations are kept locally (on this PC only).

The browser **extension** (separate) is what reads a conversation directly off an
open ChatGPT/Claude/Gemini tab; this desktop app is the management/analysis hub.

## Run the portable build (no install needed)

Just run `ConversationTransferHub-0.3.0-portable.exe` — it needs no installation
and can run from anywhere, including a USB stick.

## Run from source (developers)

```bash
npm install
```

```bash
npm start
```

## Build a Windows installer (.exe / Setup) — on Windows

```bash
npm install
```

```bash
npm run dist
```

This produces a branded NSIS `Setup .exe` and a single-file portable `.exe` in `dist/`.
(Building the installer on Linux requires Wine; on Windows it just works.)

## Project layout

- `src/main.js` — window + privileged IPC (file dialogs, LLM calls, encrypted keys, history)
- `src/preload.js` — the `window.desktop` bridge (context-isolated)
- `src/engine.js` — shared engine (parsing, context extraction, compression, briefing) — the same logic as the extension
- `src/renderer.js` / `src/index.html` — the UI
- `build/icon.ico` — app icon
