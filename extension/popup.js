/* Popup logic: ask the content script for the open conversation, analyze it
   locally, and (optionally) refine the context with an LLM using the user's own
   API key — with an explicit cost/consent line before anything is sent. */
"use strict";

const T = {
  fa: {
    dir: "rtl", title: "هاب انتقال مکالمه", lang: "EN",
    to: "به (مقصد)", mode: "حالت انتقال", out: "خروجی آماده برای Paste",
    copy: "کپی", copied: "کپی شد ✓", dlMd: "دانلود .md", dlJson: "دانلود .json",
    detected: "شناسایی شد", messages: "پیام", code: "کد", decisions: "تصمیم", issues: "مسائل",
    modeFull: "کامل — همه‌چیز", modeSmart: "هوشمند — حذف گپ و تکرار", modeCompact: "فشرده — فقط کد و تصمیم‌ها",
    note: "این مکالمه از روی همان صفحه‌ی باز خوانده شد. چیزی آپلود نمی‌شود؛ همه‌چیز داخل مرورگر پردازش می‌شود. کد عیناً حفظ می‌شود.",
    emptyTitle: "مکالمه‌ای پیدا نشد",
    emptyMsg: "یک صفحه‌ی ChatGPT، Claude یا Gemini را باز کن که مکالمه‌ای داخلش باشد، صفحه را یک‌بار رفرش کن (F5) و دوباره این افزونه را باز کن.",
    loadingTitle: "در حال خواندن کل مکالمه…",
    loadingMsg: "صفحه خودکار تا بالا اسکرول می‌شود تا همه‌ی پیام‌ها لود شوند. چند ثانیه صبر کن…",
    providers: { chatgpt: "ChatGPT", claude: "Claude", deepseek: "DeepSeek", gemini: "Gemini", other: "نامشخص" },
    toOpts: [["claude", "Claude"], ["chatgpt", "ChatGPT"], ["deepseek", "DeepSeek"], ["gemini", "Gemini"], ["other", "سایر / عمومی"]],
    srcLocal: "Context: قواعد محلی", srcAI: "Context: AI",
    aiSummary: "تحلیل دقیق‌تر با AI (اختیاری)",
    aiProvider: "سرویس", aiModel: "مدل", aiKey: "کلید API",
    aiRun: "دقیق‌سازی Context با AI",
    aiConsent: (n, p) => `با زدن دکمه، حدود ${n.toLocaleString()} توکن از این مکالمه به ${p} ارسال می‌شود. کلید فقط روی همین سیستم ذخیره می‌شود.`,
    aiBusy: "در حال ارسال به سرویس…",
    aiOk: "Context با AI به‌روزرسانی شد ✓",
    aiNoKey: "اول کلید API را وارد کن.",
    aiErr: (e) => "خطا: " + e
  },
  en: {
    dir: "ltr", title: "Conversation Transfer Hub", lang: "فا",
    to: "To (destination)", mode: "Transfer mode", out: "Ready to paste",
    copy: "Copy", copied: "Copied ✓", dlMd: "Download .md", dlJson: "Download .json",
    detected: "detected", messages: "msgs", code: "code", decisions: "decisions", issues: "issues",
    modeFull: "Full — everything", modeSmart: "Smart — drop chatter & dupes", modeCompact: "Compact — code & decisions only",
    note: "Read from the page you already have open. Nothing is uploaded; all processing is local. Code is preserved verbatim.",
    emptyTitle: "No conversation found",
    emptyMsg: "Open a ChatGPT, Claude or Gemini page that has a conversation, refresh it once (F5), then open this extension again.",
    loadingTitle: "Reading the whole conversation…",
    loadingMsg: "Auto-scrolling to the top so every message loads. This takes a few seconds…",
    providers: { chatgpt: "ChatGPT", claude: "Claude", deepseek: "DeepSeek", gemini: "Gemini", other: "Unknown" },
    toOpts: [["claude", "Claude"], ["chatgpt", "ChatGPT"], ["deepseek", "DeepSeek"], ["gemini", "Gemini"], ["other", "Other / Generic"]],
    srcLocal: "Context: local rules", srcAI: "Context: AI",
    aiSummary: "Refine context with AI (optional)",
    aiProvider: "Provider", aiModel: "Model", aiKey: "API key",
    aiRun: "Refine context with AI",
    aiConsent: (n, p) => `Clicking sends ~${n.toLocaleString()} tokens of this conversation to ${p}. Your key is stored only on this machine.`,
    aiBusy: "Sending to provider…",
    aiOk: "Context updated with AI ✓",
    aiNoKey: "Enter your API key first.",
    aiErr: (e) => "Error: " + e
  }
};

const DEFAULT_MODEL = { claude: "claude-3-5-haiku-latest", openai: "gpt-4o-mini", gemini: "gemini-1.5-flash" };

let lang = "fa";
let conv = null;
let editedContext = null;
let ctxSource = "local"; // "local" | "ai"
const $ = (s) => document.querySelector(s);

function lsGet(k) { try { return localStorage.getItem(k); } catch (_) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (_) {} }

function applyLang() {
  const L = T[lang];
  document.documentElement.lang = lang; document.documentElement.dir = L.dir;
  $("#title").textContent = L.title;
  $("#langBtn").textContent = L.lang;
  $("#lblTo").textContent = L.to; $("#lblMode").textContent = L.mode; $("#lblOut").textContent = L.out;
  $("#copyBtn").textContent = L.copy; $("#dlMd").textContent = L.dlMd; $("#dlJson").textContent = L.dlJson;
  $("#note").textContent = L.note;
  $("#emptyTitle").textContent = L.emptyTitle; $("#emptyMsg").textContent = L.emptyMsg;
  $("#aiSummary").textContent = L.aiSummary;
  $("#lblAiProvider").textContent = L.aiProvider; $("#lblAiModel").textContent = L.aiModel; $("#lblAiKey").textContent = L.aiKey;
  $("#aiRun").textContent = L.aiRun;

  const to = $("#toSel"); const curTo = to.value; to.innerHTML = "";
  L.toOpts.forEach(([v, t]) => { const o = document.createElement("option"); o.value = v; o.textContent = t; to.appendChild(o); });
  to.value = curTo || "claude";
  const md = $("#modeSel"); const curMd = md.value; md.innerHTML = "";
  [["smart", L.modeSmart], ["full", L.modeFull], ["compact", L.modeCompact]].forEach(([v, t]) => {
    const o = document.createElement("option"); o.value = v; o.textContent = t; md.appendChild(o);
  });
  md.value = curMd || "full";
  updateConsent();
  if (conv) render();
}

function showEmpty(msgOverride) {
  const L = T[lang];
  $("#emptyState").hidden = false; $("#main").hidden = true;
  $("#emptyTitle").textContent = L.emptyTitle;
  $("#emptyMsg").textContent = msgOverride || L.emptyMsg;
}
function showLoading() {
  const L = T[lang];
  $("#emptyState").hidden = false; $("#main").hidden = true;
  $("#emptyTitle").textContent = L.loadingTitle;
  $("#emptyMsg").textContent = L.loadingMsg;
}
function statTile(n, label) { const d = document.createElement("div"); d.className = "stat"; d.innerHTML = `<b>${n}</b><span>${label}</span>`; return d; }

function updateConsent() {
  const L = T[lang];
  const p = $("#aiProvider").value;
  const n = conv ? ACT.estTokens(conv) : 0;
  const pname = { claude: "Anthropic", openai: "OpenAI", gemini: "Google" }[p] || p;
  $("#aiConsent").textContent = L.aiConsent(n, pname);
}

function render() {
  const L = T[lang];
  const md = $("#modeSel").value;
  const comp = ACT.compress(conv, md, null, editedContext);
  const a = ACT.analyze(conv, comp, editedContext);
  const st = $("#stats"); st.innerHTML = "";
  st.append(statTile(a.messages, L.messages), statTile(a.code, L.code),
    statTile(a.decisions, L.decisions), statTile(a.unresolved, L.issues));
  comp.source.provider = conv.source.provider;
  $("#output").value = ACT.renderBriefing(comp, editedContext);
  const badge = $("#ctxSrc");
  badge.textContent = ctxSource === "ai" ? L.srcAI : L.srcLocal;
  badge.className = "srcbadge" + (ctxSource === "ai" ? " ai" : "");
}

function download(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function sha256(str) {
  try {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
  } catch (_) { return "unavailable"; }
}
async function buildPackage() {
  const md = $("#modeSel").value, dest = $("#toSel").value;
  const compressed = ACT.compress(conv, md, null, editedContext);
  const convJson = JSON.stringify(compressed, null, 2);
  const manifest = {
    package_version: "1.0", format_version: "1.0", source_provider: conv.source.provider,
    dest_provider: dest, compression_mode: md, conversation_sha256: await sha256(convJson),
    title: conv.source.title || null, message_count: compressed.messages.length,
    context_source: ctxSource
  };
  return JSON.stringify({ manifest, conversation: compressed, context_md: ACT.renderBriefing(compressed, editedContext) }, null, 2);
}

/* ---- LLM extraction ---- */
function extractJson(t) {
  t = String(t || "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  return (a >= 0 && b > a) ? t.slice(a, b + 1) : t;
}
async function callLLM(provider, key, model, c) {
  const { system, user } = ACT.buildExtractionPrompt(c);
  let text;
  if (provider === "claude") {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json", "x-api-key": key,
        "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({ model, max_tokens: 1500, system, messages: [{ role: "user", content: user }] })
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
    const j = await r.json(); text = (j.content || []).map(p => p.text || "").join("");
  } else if (provider === "openai") {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", "authorization": "Bearer " + key },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content: user }], response_format: { type: "json_object" } })
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
    const j = await r.json(); text = j.choices[0].message.content;
  } else {
    const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(model) + ":generateContent?key=" + encodeURIComponent(key), {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ parts: [{ text: user }] }], generationConfig: { responseMimeType: "application/json" } })
    });
    if (!r.ok) throw new Error("HTTP " + r.status + " " + (await r.text()).slice(0, 200));
    const j = await r.json(); text = (j.candidates[0].content.parts || []).map(p => p.text || "").join("");
  }
  const obj = JSON.parse(extractJson(text));
  const verbatimCode = ACT.extractContext(c).important_code; // keep code from local (verbatim)
  return ACT.validateContext(obj, verbatimCode);
}

async function runAI() {
  const L = T[lang];
  const provider = $("#aiProvider").value;
  const key = $("#aiKey").value.trim();
  const model = $("#aiModel").value.trim() || DEFAULT_MODEL[provider];
  const status = $("#aiStatus");
  if (!key) { status.textContent = L.aiNoKey; return; }
  lsSet("act_key_" + provider, key);
  lsSet("act_model_" + provider, model);
  const btn = $("#aiRun"); btn.disabled = true; status.textContent = L.aiBusy;
  try {
    const ctx = await callLLM(provider, key, model, conv);
    editedContext = ctx; ctxSource = "ai";
    status.textContent = L.aiOk;
    render();
  } catch (e) {
    status.textContent = L.aiErr(e && e.message ? e.message : String(e));
  } finally {
    btn.disabled = false;
  }
}

function loadAIPrefs() {
  const p = lsGet("act_ai_provider"); if (p) $("#aiProvider").value = p;
  const cur = $("#aiProvider").value;
  $("#aiModel").value = lsGet("act_model_" + cur) || DEFAULT_MODEL[cur];
  $("#aiKey").value = lsGet("act_key_" + cur) || "";
}

function init() {
  const l = lsGet("act_lang"); if (l === "en" || l === "fa") lang = l;
  loadAIPrefs();
  applyLang();

  $("#langBtn").addEventListener("click", () => { lang = lang === "fa" ? "en" : "fa"; lsSet("act_lang", lang); applyLang(); });
  $("#toSel").addEventListener("change", render);
  $("#modeSel").addEventListener("change", render);
  $("#aiProvider").addEventListener("change", () => {
    const p = $("#aiProvider").value; lsSet("act_ai_provider", p);
    $("#aiModel").value = lsGet("act_model_" + p) || DEFAULT_MODEL[p];
    $("#aiKey").value = lsGet("act_key_" + p) || "";
    updateConsent();
  });
  $("#aiRun").addEventListener("click", runAI);

  $("#copyBtn").addEventListener("click", async () => {
    const L = T[lang];
    try { await navigator.clipboard.writeText($("#output").value); }
    catch (_) { $("#output").select(); document.execCommand("copy"); }
    const b = $("#copyBtn"); b.textContent = L.copied; b.disabled = true;
    setTimeout(() => { b.textContent = L.copy; b.disabled = false; }, 1400);
  });
  $("#dlMd").addEventListener("click", () => {
    const name = (conv.source.title || "conversation").replace(/[^\w.-]+/g, "_").slice(0, 40);
    download(name + ".briefing.md", $("#output").value);
  });
  $("#dlJson").addEventListener("click", async () => {
    const name = (conv.source.title || "conversation").replace(/[^\w.-]+/g, "_").slice(0, 40);
    download(name + ".ai-transfer.json", await buildPackage());
  });

  $("#rereadBtn").addEventListener("click", runCapture);
  runCapture();
}

function runCapture() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !/^https:\/\/(chatgpt\.com|chat\.openai\.com|claude\.ai|chat\.deepseek\.com|gemini\.google\.com)/.test(tab.url || "")) { showEmpty(); return; }
    showLoading();
    chrome.tabs.sendMessage(tab.id, { type: "ACT_EXTRACT" }, (resp) => {
      if (chrome.runtime.lastError || !resp || !resp.ok || !resp.conversation || !resp.conversation.messages.length) { showEmpty(); return; }
      conv = resp.conversation;
      editedContext = ACT.extractContext(conv);
      ctxSource = "local";
      const L = T[lang];
      $("#providerName").textContent = L.providers[resp.provider] || resp.provider;
      $("#detectedTxt").textContent = L.detected;
      $("#toSel").value = resp.provider === "claude" ? "chatgpt" : "claude";
      $("#emptyState").hidden = true; $("#main").hidden = false;
      updateConsent();
      render();
    });
  });
}

document.addEventListener("DOMContentLoaded", init);
