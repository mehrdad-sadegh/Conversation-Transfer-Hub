"use strict";
/* Renderer: workflow UI on top of the shared engine (window.ACT) and the
   privileged bridge (window.desktop). */

const ACT = window.ACT;
const D = window.desktop;
const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));

const I18N = {
  en: {
    dir: "ltr", sub: "Move a conversation between AIs — with its context intact",
    from: "From", to: "To", input: "Conversation input", tabPaste: "Paste text", tabFile: "Open / drop file",
    paste: "Paste the whole conversation here — raw text (with \"You:\" / \"ChatGPT:\" lines) or an export/.ai-transfer JSON.",
    drop: "Drop an export or .ai-transfer file", dropHint: "JSON · .ai-transfer · txt · md",
    analyze: "Analyze", open: "Open file…", sample: "Load a sample",
    analysis: "Analysis", ctxsize: "Estimated context size", messages: "Messages", user: "You", ai: "AI",
    code: "Code blocks", files: "Files", images: "Images", decisions: "Decisions", unresolved: "Open issues",
    before: "before", after: "after", retHigh: "Retention: High", retMed: "Retention: Medium", retLow: "Retention: Low",
    capImport: "Import file", capExt: "Browser extension", capPkg: "Export package", capApi: "Continue via API", capWeb: "Create in web app", capFiles: "Attachments",
    capsNote: "“Create in web app” is impossible for every service — none offers an API to inject a conversation into its web app. The real transfer is the paste-ready briefing (or continuing in an API context).",
    mode: "Transfer mode", full: "Full", fullD: "Keep everything.", smart: "Smart", smartD: "Drop small talk & duplicates.",
    compact: "Compact", compactD: "Only code, decisions & context.", custom: "Custom", customD: "Pick what to include.",
    ckUser: "Your messages", ckAssistant: "AI messages", ckDecisions: "Decisions", ckCode: "Code", ckFiles: "Files", ckContext: "Project context", ckSmall: "Small talk", ckRepeat: "Repeated",
    ctx: "Context editor", reExtract: "Re-extract (local)",
    ctxhint: "Edit anything before generating. Code is preserved verbatim and never summarized.",
    aisum: "Refine context with AI (optional)", aiprov: "Provider", aimodel: "Model", aikey: "API key",
    aiRun: "Refine context with AI", aiConsent: (n, p) => `Sends ~${n.toLocaleString()} tokens to ${p}. Your key is encrypted on this PC (never leaves it except to the provider).`,
    aiBusy: "Contacting provider…", aiOk: "Context updated with AI ✓", aiNoKey: "Enter your API key first.", aiErr: (e) => "Error: " + e,
    goal: "Project goal", currentState: "Current state", requirements: "Requirements", constraints: "Constraints",
    decisionsF: "Important decisions", completed: "Completed tasks", issues: "Open issues", importantFiles: "Important files", nextTask: "Next task", listHint: "one per line",
    out: "Transfer output", copy: "Copy", copied: "Copied ✓", save: "Save file…", saved: "Saved ✓",
    brief: "Briefing (.md)", pkg: "Package (.ai-transfer)", outhint: "Paste into the destination AI as your first message, or save the package to move it later.",
    srcLocal: "Context: local rules", srcAI: "Context: AI", history: "Recent", clear: "clear",
    foot: "Local-first. Nothing leaves this computer except an AI request you explicitly trigger.",
    errParse: "Couldn't read this as a conversation. Paste raw text or a valid export JSON.", errEmpty: "Nothing to analyze — paste or open a conversation.",
    detected: "detected", other: "Other / Generic"
  },
  fa: {
    dir: "rtl", sub: "انتقال مکالمه بین هوش‌های مصنوعی — همراه با حفظ context",
    from: "از", to: "به", input: "ورودی مکالمه", tabPaste: "چسباندن متن", tabFile: "باز/رها کردن فایل",
    paste: "کل مکالمه را اینجا بچسبان — متن خام (با خط‌های «من:» / «ChatGPT:») یا فایل JSON خروجی/‎.ai-transfer.",
    drop: "فایل خروجی یا .ai-transfer را رها کن", dropHint: "JSON · .ai-transfer · txt · md",
    analyze: "تحلیل", open: "باز کردن فایل…", sample: "بارگذاری نمونه",
    analysis: "تحلیل", ctxsize: "حجم تخمینی context", messages: "پیام‌ها", user: "تو", ai: "هوش مصنوعی",
    code: "بلوک کد", files: "فایل‌ها", images: "تصاویر", decisions: "تصمیم‌ها", unresolved: "مسائل باز",
    before: "قبل", after: "بعد", retHigh: "حفظ اطلاعات: بالا", retMed: "حفظ اطلاعات: متوسط", retLow: "حفظ اطلاعات: پایین",
    capImport: "Import فایل", capExt: "افزونه‌ی مرورگر", capPkg: "خروجی بسته", capApi: "ادامه با API", capWeb: "ساخت در وب‌اپ", capFiles: "ضمیمه‌ها",
    capsNote: "«ساخت در وب‌اپ» برای هیچ سرویسی ممکن نیست — هیچ‌کدام API برای تزریق مکالمه به وب‌اپ ندارند. انتقال واقعی همان بریفینگ آماده‌ی Paste است (یا ادامه در بستر API).",
    mode: "حالت انتقال", full: "کامل", fullD: "همه‌چیز حفظ شود.", smart: "هوشمند", smartD: "حذف گپ‌وگفت و تکراری.",
    compact: "فشرده", compactD: "فقط کد، تصمیم‌ها و context.", custom: "دلخواه", customD: "خودت انتخاب کن چه برود.",
    ckUser: "پیام‌های تو", ckAssistant: "پیام‌های هوش مصنوعی", ckDecisions: "تصمیم‌ها", ckCode: "کد", ckFiles: "فایل‌ها", ckContext: "context پروژه", ckSmall: "گپ‌وگفت", ckRepeat: "تکراری",
    ctx: "ویرایش Context", reExtract: "استخراج مجدد (لوکال)",
    ctxhint: "قبل از تولید خروجی هرچه لازم بود ویرایش کن. کد عیناً حفظ می‌شود و خلاصه نمی‌شود.",
    aisum: "دقیق‌سازی Context با AI (اختیاری)", aiprov: "سرویس", aimodel: "مدل", aikey: "کلید API",
    aiRun: "دقیق‌سازی Context با AI", aiConsent: (n, p) => `حدود ${n.toLocaleString()} توکن به ${p} ارسال می‌شود. کلید روی همین سیستم رمز می‌شود و جز به همان سرویس جایی نمی‌رود.`,
    aiBusy: "در حال تماس با سرویس…", aiOk: "Context با AI به‌روزرسانی شد ✓", aiNoKey: "اول کلید API را وارد کن.", aiErr: (e) => "خطا: " + e,
    goal: "هدف پروژه", currentState: "وضعیت فعلی", requirements: "نیازمندی‌ها", constraints: "محدودیت‌ها",
    decisionsF: "تصمیم‌های مهم", completed: "کارهای انجام‌شده", issues: "مسائل باز", importantFiles: "فایل‌های مهم", nextTask: "کار بعدی", listHint: "هر مورد در یک خط",
    out: "خروجی انتقال", copy: "کپی", copied: "کپی شد ✓", save: "ذخیره‌ی فایل…", saved: "ذخیره شد ✓",
    brief: "بریفینگ (.md)", pkg: "بسته (.ai-transfer)", outhint: "این را به‌عنوان اولین پیام در AI مقصد Paste کن، یا بسته را ذخیره کن تا بعداً منتقلش کنی.",
    srcLocal: "Context: قواعد محلی", srcAI: "Context: AI", history: "اخیر", clear: "پاک‌کردن",
    foot: "لوکال‌محور. جز درخواستی که خودت به AI بدهی، چیزی از این کامپیوتر خارج نمی‌شود.",
    errParse: "نتوانستم این را به‌عنوان مکالمه بخوانم. متن خام یا JSON خروجی معتبر بده.", errEmpty: "چیزی برای تحلیل نیست — مکالمه را بچسبان یا باز کن.",
    detected: "شناسایی شد", other: "سایر / عمومی"
  }
};
const DEFAULT_MODEL = { claude: "claude-3-5-haiku-latest", openai: "gpt-4o-mini", gemini: "gemini-1.5-flash" };

let lang = "fa", theme = "system", mode = "smart", outView = "brief";
let conv = null, editedContext = null, ctxSource = "local";
const custom = { include_user: 1, include_assistant: 1, include_decisions: 1, include_code: 1, include_files: 1, include_project_context: 1, include_small_talk: 0, include_repeated: 0 };
const t = () => I18N[lang];

/* ---- persistence for UI prefs (renderer localStorage is fine here) ---- */
const lget = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
const lset = (k, v) => { try { localStorage.setItem(k, v); } catch (_) {} };

function applyTheme() {
  if (theme === "light" || theme === "dark") document.documentElement.setAttribute("data-theme", theme);
  else document.documentElement.removeAttribute("data-theme");
  $("#themeIcon").textContent = theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐";
}

function fillProviders() {
  const L = t();
  for (const sel of [$("#fromSel"), $("#toSel")]) {
    const cur = sel.value; sel.innerHTML = "";
    for (const p of ACT.PROVIDERS) {
      const o = document.createElement("option");
      o.value = p.id; o.textContent = p.id === "other" ? L.other : p.name; sel.appendChild(o);
    }
    if (cur) sel.value = cur;
  }
  if (!$("#toSel").value) $("#toSel").value = "claude";
}

function buildModes() {
  const L = t();
  const defs = [["full", L.full, L.fullD], ["smart", L.smart, L.smartD], ["compact", L.compact, L.compactD], ["custom", L.custom, L.customD]];
  const box = $("#modes"); box.innerHTML = "";
  for (const [id, tt, dd] of defs) {
    const el = document.createElement("label"); el.className = "mode"; el.dataset.on = (mode === id);
    el.innerHTML = `<span class="t"><input type="radio" name="mode" value="${id}" ${mode === id ? "checked" : ""}> ${tt}</span><span class="d">${dd}</span>`;
    el.querySelector("input").addEventListener("change", () => { mode = id; $$("#modes .mode").forEach((m) => m.dataset.on = (m.querySelector("input").value === mode)); $("#checklist").hidden = mode !== "custom"; if (conv) { renderAnalysis(); renderOutput(); } });
    box.appendChild(el);
  }
  const cl = $("#checklist"); cl.innerHTML = ""; cl.hidden = mode !== "custom";
  const items = [["include_user", L.ckUser], ["include_assistant", L.ckAssistant], ["include_decisions", L.ckDecisions], ["include_code", L.ckCode], ["include_files", L.ckFiles], ["include_project_context", L.ckContext], ["include_small_talk", L.ckSmall], ["include_repeated", L.ckRepeat]];
  for (const [k, lab] of items) {
    const el = document.createElement("label");
    el.innerHTML = `<input type="checkbox" ${custom[k] ? "checked" : ""}> ${lab}`;
    el.querySelector("input").addEventListener("change", (e) => { custom[k] = e.target.checked ? 1 : 0; if (conv) { renderAnalysis(); renderOutput(); } });
    cl.appendChild(el);
  }
}

const tile = (n, l) => `<div class="tile"><div class="n">${n}</div><div class="l">${l}</div></div>`;
function renderAnalysis() {
  const L = t();
  const comp = ACT.compress(conv, mode, custom, editedContext);
  const a = ACT.analyze(conv, comp, editedContext);
  $("#tiles").innerHTML = [tile(a.messages, L.messages), tile(a.user, L.user), tile(a.ai, L.ai), tile(a.code, L.code), tile(a.files, L.files), tile(a.images, L.images), tile(a.decisions, L.decisions), tile(a.unresolved, L.unresolved)].join("");
  const pct = a.before ? Math.max(4, Math.round(a.after / a.before * 100)) : 100;
  $("#tokFill").style.width = pct + "%";
  $("#tokBefore").textContent = `${a.before.toLocaleString()} ${L.before}`;
  $("#tokAfter").textContent = `${a.after.toLocaleString()} ${L.after}`;
  const rk = a.retention;
  $("#retentionWrap").innerHTML = `<span class="badge ${rk}">${rk === "high" ? L.retHigh : rk === "medium" ? L.retMed : L.retLow}</span>`;
  const c = ACT.caps($("#toSel").value);
  const ci = (on, lab) => `<div class="cap"><span class="dot ${on ? "y" : "n"}"></span>${lab}</div>`;
  $("#caps").innerHTML = [ci(c.import_file, L.capImport), ci(c.import_extension, L.capExt), ci(c.export_package, L.capPkg), ci(c.continue_via_api, L.capApi), ci(c.create_in_web, L.capWeb), ci(c.file_support, L.capFiles)].join("");
  $("#capsNote").textContent = L.capsNote;
  const badge = $("#ctxSrc"); badge.textContent = ctxSource === "ai" ? L.srcAI : L.srcLocal; badge.className = "srcbadge" + (ctxSource === "ai" ? " ai" : "");
}

const CTX_FIELDS = [["project_goal", "goal", "opt"], ["current_state", "currentState", "opt"], ["requirements", "requirements", "list"], ["constraints", "constraints", "list"], ["decisions", "decisionsF", "list"], ["completed_tasks", "completed", "list"], ["unresolved_issues", "issues", "list"], ["important_files", "importantFiles", "list"], ["next_task", "nextTask", "opt"]];
const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
const escA = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function buildContextEditor() {
  const L = t(); const g = $("#ctxGrid"); g.innerHTML = "";
  for (const [key, labK, kind] of CTX_FIELDS) {
    const wrap = document.createElement("div"); wrap.className = "field";
    const val = editedContext[key];
    const value = kind === "list" ? (Array.isArray(val) ? val.join("\n") : "") : (val || "");
    const control = kind === "list"
      ? `<textarea data-key="${key}" data-kind="list">${esc(value)}</textarea><div class="ctx-hint">${L.listHint}</div>`
      : `<input type="text" data-key="${key}" data-kind="opt" value="${escA(value)}">`;
    wrap.innerHTML = `<label>${L[labK]}</label>${control}`;
    g.appendChild(wrap);
  }
  g.querySelectorAll("[data-key]").forEach((el) => el.addEventListener("input", () => {
    const k = el.dataset.key;
    editedContext[k] = el.dataset.kind === "list" ? el.value.split("\n").map((s) => s.trim()).filter(Boolean) : (el.value.trim() || null);
    renderOutput();
  }));
}

let lastPackage = "";
async function renderOutput() {
  const c = ACT.compress(conv, mode, custom, editedContext); c.context = editedContext;
  if (outView === "brief") $("#output").textContent = ACT.renderBriefing(c, editedContext);
  else { lastPackage = await ACT.buildPackage(conv, $("#toSel").value, mode, custom, editedContext, ctxSource); $("#output").textContent = lastPackage; }
}

function showCards(on) { ["#cardAnalysis", "#cardMode", "#cardCtx", "#cardOut"].forEach((s) => $(s).hidden = !on); }

function loadConversation(c, addHist) {
  conv = ACT.normalize(c);
  $("#fromSel").value = ACT.PROVIDERS.some((p) => p.id === conv.source.provider) ? conv.source.provider : "other";
  editedContext = ACT.extractContext(conv); ctxSource = "local";
  showCards(true); renderAnalysis(); buildContextEditor(); renderOutput();
  updateConsent();
  if (addHist && D) D.historyAdd({ title: conv.source.title || "(untitled)", provider: conv.source.provider, conv }).then(refreshHistory);
  $("#cardAnalysis").scrollIntoView({ behavior: "smooth", block: "start" });
}

function runAnalyze() {
  const L = t(); const m = $("#inputMsg"); m.hidden = true;
  const text = $("#paste").value.trim();
  if (!text) { m.textContent = L.errEmpty; m.hidden = false; return; }
  const parsed = ACT.detectAndParse(text, null);
  if (!parsed.length) { m.textContent = L.errParse; m.hidden = false; return; }
  loadConversation(parsed[0], true);
}

function updateConsent() {
  const L = t(); const p = $("#aiProvider").value;
  const n = conv ? ACT.estTokens(conv) : 0;
  const pname = { claude: "Anthropic", openai: "OpenAI", gemini: "Google" }[p] || p;
  $("#aiConsent").textContent = L.aiConsent(n, pname);
}

async function runAI() {
  const L = t(); const provider = $("#aiProvider").value;
  const key = $("#aiKey").value.trim(); const model = $("#aiModel").value.trim() || DEFAULT_MODEL[provider];
  const status = $("#aiStatus");
  if (!key) { status.textContent = L.aiNoKey; return; }
  await D.setKey(provider, key); lset("model_" + provider, model); lset("ai_provider", provider);
  const btn = $("#aiRun"); btn.disabled = true; status.textContent = L.aiBusy;
  const res = await D.llmExtract(provider, key, model, conv);
  btn.disabled = false;
  if (res && res.ok) { editedContext = res.context; ctxSource = "ai"; status.textContent = L.aiOk; buildContextEditor(); renderAnalysis(); renderOutput(); }
  else status.textContent = L.aiErr(res ? res.error : "unknown");
}

async function refreshHistory() {
  if (!D) return;
  const list = await D.historyList();
  const bar = $("#histbar");
  if (!list || !list.length) { bar.hidden = true; return; }
  const L = t();
  bar.hidden = false; bar.innerHTML = `<span class="hlabel">${L.history}:</span>`;
  list.slice(0, 12).forEach((h) => {
    const b = document.createElement("button"); b.className = "chip";
    b.textContent = (h.title || "(untitled)");
    b.title = h.provider + " · " + new Date(h.at).toLocaleString();
    b.addEventListener("click", () => { $("#paste").value = ACT.buildTranscript(h.conv); $("#analyzeBtn").disabled = false; loadConversation(structuredClone(h.conv), false); });
    bar.appendChild(b);
  });
  const clr = document.createElement("button"); clr.className = "linklike"; clr.style.marginInlineStart = "6px"; clr.textContent = L.clear;
  clr.addEventListener("click", async () => { await D.historyClear(); refreshHistory(); });
  bar.appendChild(clr);
}

function sampleTranscript() {
  return `You: My goal is to build a task tracker web app. Requirement: it must work offline. Constraint: no external database, use SQLite only.
ChatGPT: Good. I decided to use Rust + Tauri for offline support. Here is a start:
\`\`\`toml
[dependencies]
rusqlite = "0.31"
\`\`\`
You: I don't want that approach. Use plain files instead of SQLite for now. TODO: add search later. There is a bug: the app crashes on empty input.
ChatGPT: Understood. I'll switch to a JSON file store and guard against empty input.
You: thanks!`;
}

function applyLang() {
  const L = t();
  document.documentElement.lang = lang; document.documentElement.dir = L.dir;
  $("#t-sub").textContent = L.sub; $("#t-from").textContent = L.from; $("#t-to").textContent = L.to;
  $("#t-input").textContent = L.input; $("#tabPaste").textContent = L.tabPaste; $("#tabFile").textContent = L.tabFile;
  $("#paste").placeholder = L.paste; $("#t-drop").textContent = L.drop; $("#t-dropHint").textContent = L.dropHint;
  $("#t-analyze").textContent = L.analyze; $("#t-open").textContent = L.open; $("#sampleBtn").textContent = L.sample;
  $("#t-analysis").textContent = L.analysis; $("#t-ctxsize").textContent = L.ctxsize; $("#t-mode").textContent = L.mode;
  $("#t-ctx").textContent = L.ctx; $("#reExtract").textContent = L.reExtract; $("#t-ctxhint").textContent = L.ctxhint;
  $("#t-aisum").textContent = L.aisum; $("#t-aiprov").textContent = L.aiprov; $("#t-aimodel").textContent = L.aimodel; $("#t-aikey").textContent = L.aikey; $("#aiRun").textContent = L.aiRun;
  $("#t-out").textContent = L.out; $("#t-copy").textContent = L.copy; $("#t-save").textContent = L.save; $("#t-outhint").textContent = L.outhint;
  $("#segBrief").textContent = L.brief; $("#segPkg").textContent = L.pkg; $("#t-foot").textContent = L.foot; $("#langBtn").textContent = lang === "fa" ? "EN" : "فا";
  fillProviders(); buildModes(); updateConsent();
  if (conv) { renderAnalysis(); buildContextEditor(); renderOutput(); }
  refreshHistory();
}

async function init() {
  const sl = lget("lang"); if (sl === "en" || sl === "fa") lang = sl;
  theme = lget("theme") || "system"; applyTheme();

  // AI prefs
  const savedProv = lget("ai_provider"); if (savedProv) $("#aiProvider").value = savedProv;
  const prov0 = $("#aiProvider").value;
  $("#aiModel").value = lget("model_" + prov0) || DEFAULT_MODEL[prov0];
  if (D) { const k = await D.getKey(prov0); if (k) $("#aiKey").value = k; }

  applyLang();

  const setTab = (paste) => { $("#tabPaste").setAttribute("aria-selected", paste); $("#tabFile").setAttribute("aria-selected", !paste); $("#panePaste").hidden = !paste; $("#paneFile").hidden = paste; };
  $("#tabPaste").addEventListener("click", () => setTab(true));
  $("#tabFile").addEventListener("click", () => setTab(false));
  $("#paste").addEventListener("input", () => $("#analyzeBtn").disabled = !$("#paste").value.trim());
  $("#analyzeBtn").addEventListener("click", runAnalyze);
  $("#sampleBtn").addEventListener("click", () => { setTab(true); $("#paste").value = sampleTranscript(); $("#analyzeBtn").disabled = false; runAnalyze(); });

  $("#openBtn").addEventListener("click", async () => {
    const r = await D.openFile(); if (!r || r.error) { if (r && r.error) { $("#inputMsg").textContent = r.error; $("#inputMsg").hidden = false; } return; }
    $("#paste").value = r.text; $("#analyzeBtn").disabled = false; runAnalyze();
  });
  const drop = $("#drop");
  drop.addEventListener("click", () => $("#openBtn").click());
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("hot"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("hot"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault(); drop.classList.remove("hot");
    const f = e.dataTransfer.files[0]; if (!f) return;
    const rd = new FileReader(); rd.onload = () => { $("#paste").value = String(rd.result); $("#analyzeBtn").disabled = false; runAnalyze(); }; rd.readAsText(f);
  });

  $("#toSel").addEventListener("change", () => { if (conv) { renderAnalysis(); renderOutput(); } });
  $("#fromSel").addEventListener("change", () => { if (conv) { conv.source.provider = $("#fromSel").value; renderOutput(); } });
  $("#reExtract").addEventListener("click", () => { if (conv) { editedContext = ACT.extractContext(conv); ctxSource = "local"; buildContextEditor(); renderAnalysis(); renderOutput(); } });

  $("#aiProvider").addEventListener("change", async () => {
    const p = $("#aiProvider").value; lset("ai_provider", p);
    $("#aiModel").value = lget("model_" + p) || DEFAULT_MODEL[p];
    $("#aiKey").value = D ? (await D.getKey(p) || "") : "";
    updateConsent();
  });
  $("#aiRun").addEventListener("click", runAI);

  $("#segBrief").addEventListener("click", () => { outView = "brief"; $("#segBrief").setAttribute("aria-selected", "true"); $("#segPkg").setAttribute("aria-selected", "false"); renderOutput(); });
  $("#segPkg").addEventListener("click", () => { outView = "pkg"; $("#segPkg").setAttribute("aria-selected", "true"); $("#segBrief").setAttribute("aria-selected", "false"); renderOutput(); });

  $("#copyBtn").addEventListener("click", async () => {
    const L = t();
    try { await navigator.clipboard.writeText($("#output").textContent); } catch (_) { const r = document.createRange(); r.selectNodeContents($("#output")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); document.execCommand("copy"); s.removeAllRanges(); }
    const b = $("#copyBtn"), sp = $("#t-copy"); sp.textContent = L.copied; b.disabled = true; setTimeout(() => { sp.textContent = L.copy; b.disabled = false; }, 1300);
  });
  $("#saveBtn").addEventListener("click", async () => {
    const L = t(); const base = (conv.source.title || "conversation").replace(/[^\w.-]+/g, "_").slice(0, 40);
    const name = outView === "brief" ? base + ".briefing.md" : base + ".ai-transfer.json";
    const content = outView === "brief" ? $("#output").textContent : (lastPackage || await ACT.buildPackage(conv, $("#toSel").value, mode, custom, editedContext, ctxSource));
    const r = await D.saveFile(name, content);
    if (r && r.path) { const sp = $("#t-save"); sp.textContent = L.saved; setTimeout(() => sp.textContent = L.save, 1300); }
  });

  // About modal
  const overlay = $("#aboutOverlay");
  $("#aboutBtn").addEventListener("click", () => overlay.hidden = false);
  $("#aboutClose").addEventListener("click", () => overlay.hidden = true);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.hidden = true; });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") overlay.hidden = true; });
  $("#tgBtn").addEventListener("click", () => { if (D && D.openExternal) D.openExternal("https://t.me/softserv_ir"); });

  $("#langBtn").addEventListener("click", () => { lang = lang === "fa" ? "en" : "fa"; lset("lang", lang); applyLang(); });
  $("#themeBtn").addEventListener("click", () => { theme = theme === "system" ? "light" : theme === "light" ? "dark" : "system"; lset("theme", theme); applyTheme(); });
}

document.addEventListener("DOMContentLoaded", init);
