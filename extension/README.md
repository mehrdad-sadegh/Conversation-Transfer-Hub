# Conversation Transfer Hub — Browser Extension

Reads the conversation from the ChatGPT / Claude / Gemini page **you already have
open**, analyzes it, and gives you a ready-to-paste context briefing for another
AI. Everything runs locally in your browser — nothing is uploaded, and it never
reads cookies, tokens, or credentials.

## Install (Chrome / Edge / Brave)

1. Open the browser and go to the extensions page:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked** and choose this `extension` folder.
4. Pin the extension (puzzle-piece icon → pin) so its button is visible.

## Use

1. Open a conversation on **chatgpt.com**, **claude.ai**, or **gemini.google.com**.
2. If the extension was just installed, refresh that tab once (F5).
3. Click the extension button. It reads the open conversation, shows a quick
   analysis, and produces the briefing.
4. Pick the destination AI and the transfer mode, then **Copy** (or download
   `.md` / `.ai-transfer.json`).
5. Paste the briefing as your first message in the destination AI.

## Notes & limits

- Extraction depends on each site's page structure. If a site changes its
  markup, a scraper may need updated selectors (see `content.js`).
- It reads the currently open conversation. To capture a very long chat, scroll
  up first so all messages are loaded in the page.
- Code blocks are preserved verbatim and never summarized. Conversation content
  is treated as data, not instructions (prompt-injection defense).

## Files

- `manifest.json` — MV3 manifest
- `content.js` — per-site DOM readers (ChatGPT / Claude / Gemini)
- `core.js` — shared engine (context extraction, compression, briefing)
- `popup.html` / `popup.js` — the toolbar UI
