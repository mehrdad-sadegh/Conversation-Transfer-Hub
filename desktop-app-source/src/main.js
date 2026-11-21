"use strict";
/* Main process: window lifecycle + privileged IPC (file dialogs, LLM calls with
   no CORS limits, OS-encrypted API keys, local history). */

const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const ACT = require("./engine.js");

const USER_DIR = () => app.getPath("userData");
const KEYS_FILE = () => path.join(USER_DIR(), "keys.json");
const HIST_FILE = () => path.join(USER_DIR(), "history.json");
const SETTINGS_FILE = () => path.join(USER_DIR(), "settings.json");

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch (_) { return fallback; }
}
function writeJson(file, obj) {
  try { fs.writeFileSync(file, JSON.stringify(obj), "utf8"); return true; } catch (_) { return false; }
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1120, height: 840, minWidth: 760, minHeight: 600,
    backgroundColor: "#0d1015",
    title: "Conversation Transfer Hub",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  win.loadFile(path.join(__dirname, "index.html"));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });

/* ---- file open / save ---- */
ipcMain.handle("dialog:open", async () => {
  const r = await dialog.showOpenDialog(win, {
    title: "Open conversation or package",
    properties: ["openFile"],
    filters: [
      { name: "Conversation / package", extensions: ["json", "ai-transfer", "txt", "md"] },
      { name: "All files", extensions: ["*"] }
    ]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  try { return { name: path.basename(r.filePaths[0]), text: fs.readFileSync(r.filePaths[0], "utf8") }; }
  catch (e) { return { error: String(e && e.message || e) }; }
});

ipcMain.handle("dialog:save", async (_e, { defaultName, content }) => {
  const r = await dialog.showSaveDialog(win, { title: "Save", defaultPath: defaultName || "output.txt" });
  if (r.canceled || !r.filePath) return null;
  try { fs.writeFileSync(r.filePath, content, "utf8"); return { path: r.filePath }; }
  catch (e) { return { error: String(e && e.message || e) }; }
});

/* ---- API keys (encrypted with OS keystore: DPAPI on Windows) ---- */
ipcMain.handle("keys:get", (_e, provider) => {
  const store = readJson(KEYS_FILE(), {});
  const enc = store[provider];
  if (!enc) return "";
  try {
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(Buffer.from(enc, "base64"));
  } catch (_) {}
  return "";
});
ipcMain.handle("keys:set", (_e, { provider, key }) => {
  const store = readJson(KEYS_FILE(), {});
  try {
    if (key && safeStorage.isEncryptionAvailable()) store[provider] = safeStorage.encryptString(key).toString("base64");
    else delete store[provider];
  } catch (_) { return false; }
  return writeJson(KEYS_FILE(), store);
});

/* ---- LLM extraction (runs here → no CORS, key never touches the page) ---- */
ipcMain.handle("llm:extract", async (_e, { provider, key, model, conv }) => {
  try {
    if (!key) throw new Error("missing API key");
    const { system, user } = ACT.buildExtractionPrompt(conv);
    let text;
    if (provider === "claude") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model, max_tokens: 1500, system, messages: [{ role: "user", content: user }] })
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 300));
      const j = await r.json(); text = (j.content || []).map((p) => p.text || "").join("");
    } else if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: "Bearer " + key },
        body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } })
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 300));
      const j = await r.json(); text = j.choices[0].message.content;
    } else {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key), {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json" } })
      });
      if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 300));
      const j = await r.json(); text = (j.candidates[0].content.parts || []).map((p) => p.text || "").join("");
    }
    const obj = JSON.parse(ACT.extractJson(text));
    const verbatimCode = ACT.extractContext(conv).important_code;
    return { ok: true, context: ACT.validateContext(obj, verbatimCode) };
  } catch (e) {
    return { ok: false, error: String(e && e.message || e) };
  }
});

/* ---- local history (titles only by default) ---- */
ipcMain.handle("history:list", () => readJson(HIST_FILE(), []));
ipcMain.handle("history:add", (_e, entry) => {
  const list = readJson(HIST_FILE(), []);
  list.unshift({ ...entry, at: Date.now() });
  writeJson(HIST_FILE(), list.slice(0, 25));
  return true;
});
ipcMain.handle("history:clear", () => writeJson(HIST_FILE(), []));

ipcMain.handle("settings:get", () => readJson(SETTINGS_FILE(), {}));
ipcMain.handle("settings:set", (_e, obj) => writeJson(SETTINGS_FILE(), obj || {}));

/* ---- open an external link (e.g. the Telegram channel) in the OS browser ---- */
ipcMain.handle("open:external", (_e, url) => {
  if (typeof url === "string" && /^https?:\/\//.test(url)) shell.openExternal(url);
  return true;
});
