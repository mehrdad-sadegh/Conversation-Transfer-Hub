# Conversation Transfer Hub

Move a whole AI conversation — **with its context intact and its code preserved
verbatim** — from one assistant to another (ChatGPT → Claude → Gemini →
DeepSeek …). It reads the chat you already have open, pulls out what matters, and
produces a paste-ready briefing for the destination AI.

Local-first: everything is processed in your own browser / on your own machine.
Nothing is uploaded unless you deliberately enable the optional AI-refine step
with your own API key.

> **فارسی:** این پروژه یک مکالمه‌ی کامل را به‌همراه context آن از یک هوش مصنوعی به
> هوش مصنوعی دیگر منتقل می‌کند؛ کدها دست‌نخورده می‌مانند و هیچ‌چیز بدون اجازه‌ی
> شما جایی آپلود نمی‌شود. راهنمای کامل فارسی/انگلیسی در فایل `Guide.html` است.

## Download

**[⬇ Open the latest release](https://github.com/mehrdad-sadegh/Conversation-Transfer-Hub/releases/latest)** — the browser extension and the Windows builds.

The **browser extension is the main reader** — it reads your open conversation
directly. The desktop app is an optional hub for deeper editing. Most people just
need the extension.

Direct downloads (v0.3.0):

- [**Browser extension** (`extension.zip`)](https://github.com/mehrdad-sadegh/Conversation-Transfer-Hub/releases/download/v0.3.0/extension.zip) — unzip, then load it unpacked (see [Install — the extension](#install--the-extension))
- [**Desktop — Portable**](https://github.com/mehrdad-sadegh/Conversation-Transfer-Hub/releases/download/v0.3.0/ConversationTransferHub-0.3.0-portable.exe) — no install, runs from anywhere, even a USB stick
- [**Desktop — Installer**](https://github.com/mehrdad-sadegh/Conversation-Transfer-Hub/releases/download/v0.3.0/Conversation.Transfer.Hub.Setup.0.3.0.exe) — Setup with Start-menu and desktop shortcuts

On first run Windows SmartScreen may warn because the files aren't code-signed —
choose **More info → Run anyway**. (The extension's source also lives in the
`extension/` folder of this repo.)

> **فارسی:** افزونه‌ی مرورگر بخش اصلیه — همون که چت‌ها رو می‌خونه؛ برنامه‌ی دسکتاپ
> اختیاریه. فایل `extension.zip` رو دانلود و اکسترکت کن و طبق بخش «Install — the
> extension» به‌صورت unpacked لودش کن. در صورت نیاز نسخه‌ی دسکتاپ (Portable یا
> Installer) رو هم از همون لینک‌ها بگیر. بار اول اگر ویندوز هشدار داد، روی
> More info → Run anyway بزن.

---

## The two parts

| | What it does |
|---|---|
| **`extension/`** | The reader. A Chrome/Edge/Brave (Manifest V3) extension that runs inside your own logged-in browser and reads the open conversation directly. |
| **`desktop-app-source/`** | The hub. An Electron desktop app that takes a conversation (pasted, or a file) and lets you analyze, compress, edit the context, and package it. Optional, for deeper work. |

For everyday use the **extension alone** is enough. A full, bilingual visual
walkthrough is in **`Guide.html`** (open it in any browser).

## Features

- Reads **ChatGPT, Claude and DeepSeek** through each service's own internal API
  — complete, in-order, no scrolling and no gaps. **Gemini** and others are
  supported through generic on-page reading.
- Transfer modes: **Full / Smart / Compact / Custom** (Custom is desktop-only).
- **Code blocks are preserved verbatim** and never summarized.
- Rule-based context extraction (goal, decisions, constraints, open issues, …),
  bilingual (Persian / English).
- Output as a readable **`.md` briefing** or a structured **`.ai-transfer`**
  package (with a SHA-256 integrity hash).
- Conversation content is wrapped as **data, not instructions** (a basic
  prompt-injection guard) before it reaches the destination AI.
- Optional context refinement with your own API key — the key is encrypted with
  the OS keystore (DPAPI on Windows) and never touches the page.

## Install — the extension

1. Open `chrome://extensions` (or `edge://extensions`).
2. Turn on **Developer mode** (top-right).
3. Click **Load unpacked** and select the `extension/` folder (the unzipped `extension.zip`).
4. Pin the extension so its button is visible.

Then open a conversation on ChatGPT / Claude / Gemini / DeepSeek, click the
extension, pick the destination AI and a mode, and **Copy** the briefing (or
download `.md` / `.ai-transfer.json`). Paste it as your first message in the
destination AI.

## Install — the desktop app

Download a build from the [**Releases**](https://github.com/mehrdad-sadegh/Conversation-Transfer-Hub/releases/latest) page and run either:

- `ConversationTransferHub-<version>-portable.exe` — runs with no install, even
  from a USB stick, or
- `Conversation Transfer Hub Setup <version>.exe` — a normal installer with Start
  menu / desktop shortcuts.

The first run may trigger Windows SmartScreen because the file isn't
code-signed — choose **More info → Run anyway**.

## Build from source (desktop app)

```bash
cd desktop-app-source
```

```bash
npm install
```

Run it in development:

```bash
npm start
```

Build the Windows portable `.exe` and installer (on Windows):

```bash
npm run dist
```

The output lands in `desktop-app-source/dist/`. (Building the installer on Linux
requires Wine; on Windows it just works.)

## How it works

1. The extension detects the service from the page's hostname.
2. For ChatGPT / Claude / DeepSeek it calls the site's own internal conversation
   API in your authenticated session (same-origin) to get the full, ordered
   transcript. For other sites it reads the rendered page, scrolling to load
   older messages.
3. The shared engine turns the transcript into an internal format, extracts the
   context, applies the chosen transfer mode, and renders the briefing or
   `.ai-transfer` package.

The same engine lives in both the extension (`extension/core.js`) and the desktop
app (`desktop-app-source/src/engine.js`).

## Privacy & limits

- **Local-first.** Reading and briefing generation happen entirely on your
  device. Nothing is uploaded unless you turn on AI-refine with your own key.
- It uses your **existing logged-in session** on each site via same-origin
  requests. It does **not** read, store, or transmit your passwords or tokens.
- **Images and attachments are not transferred** — only an `[Image]` /
  `[Attachment]` marker (with the file name) is kept, so you know something was
  there. Re-upload important files manually in the destination AI.

## Project structure

```
extension/              Browser extension (Manifest V3)
  manifest.json
  content.js            per-site conversation readers
  core.js               shared engine
  popup.html / popup.js UI
  icons/

desktop-app-source/     Electron desktop app
  src/
    main.js             window + privileged IPC
    preload.js          context-isolated bridge
    engine.js           shared engine
    renderer.js / index.html   UI
  build/icon.ico
  package.json
  build-installer.bat

Guide.html              Full bilingual user guide
```

## License

[MIT](LICENSE) © 2026 Mehrdad Sadegh

## Author & support

Developed by **Mehrdad Sadegh**.
Questions, feedback and support: Telegram [@softserv_ir](https://t.me/softserv_ir)
