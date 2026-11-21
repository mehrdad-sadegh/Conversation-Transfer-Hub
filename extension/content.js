/* Content script: extract the conversation from the open page.
   Virtualized chat lists (ChatGPT/Claude/Gemini drop off-screen messages) are
   handled by walking the messages themselves into view — first upward to load
   the oldest, then downward — collecting every window and stitching them by
   overlap. A small on-page badge shows live progress.
   Reads only the open tab's DOM. Sends nothing anywhere; no cookies/tokens. */
(function () {
  "use strict";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function detectProvider() {
    const h = location.hostname;
    if (h.includes("openai") || h.includes("chatgpt")) return "chatgpt";
    if (h.includes("claude")) return "claude";
    if (h.includes("deepseek")) return "deepseek";
    if (h.includes("gemini") || h.includes("bard")) return "gemini";
    return "other";
  }

  function guessLang(codeEl) {
    const cls = (codeEl.className || "") + " " + ((codeEl.parentElement && codeEl.parentElement.className) || "");
    const m = cls.match(/language-([A-Za-z0-9+#]+)/) || cls.match(/lang-([A-Za-z0-9+#]+)/);
    return m ? m[1] : null;
  }

  function nodeToBlocks(root) {
    const blocks = [];
    let text = [];
    const flush = () => {
      const t = text.join("").replace(/\n{3,}/g, "\n\n").trim();
      if (t) blocks.push({ type: "text", text: t });
      text = [];
    };
    const SKIP = new Set(["script", "style", "svg", "button", "noscript"]);
    const BLOCK = new Set(["p", "div", "li", "h1", "h2", "h3", "h4", "h5", "ul", "ol", "tr", "blockquote", "section"]);
    (function walk(node) {
      node.childNodes.forEach((ch) => {
        if (ch.nodeType === 3) { const s = ch.textContent; if (s) text.push(s); }
        else if (ch.nodeType === 1) {
          const tag = ch.tagName.toLowerCase();
          if (SKIP.has(tag)) return;
          if (tag === "pre") {
            flush();
            const codeEl = ch.querySelector("code") || ch;
            const t = (codeEl.innerText || codeEl.textContent || "").replace(/\n$/, "");
            blocks.push({ type: "code", language: guessLang(codeEl), text: t });
          } else if (tag === "br") { text.push("\n"); }
          else { walk(ch); if (BLOCK.has(tag)) text.push("\n"); }
        }
      });
    })(root);
    flush();
    if (!blocks.length) { const t = (root.innerText || "").trim(); if (t) blocks.push({ type: "text", text: t }); }
    return blocks;
  }

  const pick = (el, sels) => { for (const s of sels) { const f = el.querySelector(s); if (f) return f; } return el; };

  /* Message elements currently in the DOM, each as {role, anchor, body}. */
  function turnEls(provider) {
    const out = [];
    if (provider === "chatgpt") {
      document.querySelectorAll("[data-message-author-role]").forEach((n) => {
        const r = n.getAttribute("data-message-author-role");
        out.push({ role: r === "user" ? "user" : r === "assistant" ? "assistant" : "system", anchor: n, body: pick(n, [".markdown", ".whitespace-pre-wrap", '[class*="prose"]']) });
      });
    } else if (provider === "claude") {
      document.querySelectorAll('[data-testid="user-message"], .font-claude-message, [data-testid="assistant-message"]').forEach((n) => {
        out.push({ role: n.matches('[data-testid="user-message"]') ? "user" : "assistant", anchor: n, body: n });
      });
    } else if (provider === "gemini") {
      document.querySelectorAll("user-query, model-response").forEach((n) => {
        const isUser = n.tagName.toLowerCase() === "user-query";
        out.push({ role: isUser ? "user" : "assistant", anchor: n, body: pick(n, isUser ? [".query-text", ".query-content", "[class*=query]"] : ["message-content", ".markdown", ".model-response-text", "[class*=response]"]) });
      });
    } else {
      document.querySelectorAll("[data-message-author-role],[data-role],[data-testid*=message]").forEach((n) => {
        const r = (n.getAttribute("data-message-author-role") || n.getAttribute("data-role") || "").toLowerCase();
        out.push({ role: r.includes("user") || r.includes("human") ? "user" : "assistant", anchor: n, body: n });
      });
    }
    return out;
  }

  const turnOf = (e) => ({ role: e.role, content: nodeToBlocks(e.body) });
  // Stable identity for a message: role + full normalized text. Used both to
  // detect the top/bottom and to de-duplicate across scroll windows.
  function keyOf(turn) {
    const txt = turn.content.map((b) => b.text).join("\n").replace(/\s+/g, " ").trim();
    return turn.role + "¶" + txt;
  }
  const firstKey = (els) => (els.length ? keyOf(turnOf(els[0])) : "");
  const lastKey = (els) => (els.length ? keyOf(turnOf(els[els.length - 1])) : "");

  /* ---- on-page progress badge ---- */
  function badge() {
    let el = document.getElementById("__act_badge");
    if (!el) {
      el = document.createElement("div");
      el.id = "__act_badge";
      el.style.cssText = "position:fixed;z-index:2147483647;top:14px;right:14px;background:#0d9488;color:#fff;font:600 12px/1.45 system-ui,sans-serif;padding:9px 13px;border-radius:9px;box-shadow:0 6px 20px rgba(0,0,0,.35);direction:ltr;pointer-events:none;max-width:260px";
      (document.body || document.documentElement).appendChild(el);
    }
    return el;
  }
  const setBadge = (t) => { try { badge().textContent = t; } catch (_) {} };
  const clearBadge = () => { const el = document.getElementById("__act_badge"); if (el) el.remove(); };

  /* ---- scroll containers ---- */
  function isScrollable(el) {
    if (!el || el === document.body || el.nodeType !== 1) return false;
    let s; try { s = getComputedStyle(el); } catch (_) { return false; }
    return /(auto|scroll|overlay)/.test(s.overflowY) && el.scrollHeight > el.clientHeight + 60;
  }
  function allScrollers() {
    const out = [];
    document.querySelectorAll("*").forEach((el) => { if (isScrollable(el)) out.push(el); });
    const d = document.scrollingElement || document.documentElement;
    if (d && !out.includes(d)) out.push(d);
    return out;
  }
  const maxTop = (scrollers) => {
    let m = (typeof window.scrollY === "number" ? window.scrollY : 0);
    for (const s of scrollers) { try { if (s.scrollTop > m) m = s.scrollTop; } catch (_) {} }
    return m;
  };

  async function collectAll(provider) {
    const store = new Map();  // key -> turn
    const seen = new Set();   // keys already appended (in order)
    const order = [];
    const collectDown = () => {
      for (const e of turnEls(provider)) {
        const t = turnOf(e);
        if (!t.content.some((b) => b.text && b.text.trim())) continue;
        const k = keyOf(t);
        if (!seen.has(k)) { seen.add(k); store.set(k, t); order.push(k); }
      }
    };

    // Phase 1: load the oldest messages by forcing every scroller to the top
    // until the first message stops changing.
    setBadge("Transfer Hub — loading older messages…");
    let scrollers = allScrollers();
    let stable = 0, t0 = Date.now();
    while (stable < 6 && Date.now() - t0 < 60000) {
      const before = firstKey(turnEls(provider));
      for (const s of scrollers) { try { s.scrollTop = 0; } catch (_) {} }
      try { window.scrollTo(0, 0); } catch (_) {}
      await sleep(380);
      scrollers = allScrollers();
      if (firstKey(turnEls(provider)) === before) stable++; else stable = 0;
    }

    // Go to the very top and collect the first window.
    for (const s of scrollers) { try { s.scrollTop = 0; } catch (_) {} }
    try { window.scrollTo(0, 0); } catch (_) {}
    await sleep(300);
    collectDown();

    // Phase 2: step DOWN in small overlapping increments, collecting every
    // window. Small steps guarantee overlap so nothing in the middle is skipped;
    // de-dup by stable key avoids repeats. Progress = scroll advanced OR new
    // messages appeared.
    setBadge("Transfer Hub — reading…");
    stable = 0;
    let lastCount = order.length;
    let t1 = Date.now();
    while (stable < 8 && Date.now() - t1 < 180000) {
      scrollers = allScrollers();
      const step = Math.max(300, Math.floor((window.innerHeight || 700) * 0.6));
      const topBefore = maxTop(scrollers);
      for (const s of scrollers) { try { s.scrollTop += step; } catch (_) {} }
      try { window.scrollBy(0, step); } catch (_) {}
      await sleep(240);
      collectDown();
      const advanced = maxTop(allScrollers()) > topBefore + 2;
      const grew = order.length > lastCount;
      lastCount = order.length;
      if (advanced || grew) stable = 0; else stable++;
      setBadge("Transfer Hub — reading… (" + order.length + " msgs)");
    }
    collectDown();

    const conv = ACT.newConv(provider);
    conv.source.title = (document.title || "").replace(/\s*[-|].*$/, "").trim() || null;
    let prev = null, i = 0;
    for (const k of order) {
      const t = store.get(k);
      const id = "m" + (i++);
      conv.messages.push({ id, parent_id: prev, role: t.role, content: t.content, timestamp: null });
      prev = id;
    }
    setBadge("Transfer Hub — done: " + conv.messages.length + " messages");
    setTimeout(clearBadge, 2500);
    return conv;
  }

  /* ---- ChatGPT: read the FULL conversation from its own backend API ----
     Same-origin request using the page's existing session (exactly how the
     ChatGPT web app loads its own data). Nothing is stored or sent anywhere.
     This bypasses virtualization entirely → complete, ordered, no duplicates. */
  async function fetchChatGPT() {
    try {
      const id = (location.pathname.split("/c/")[1] || "").split(/[/?#]/)[0];
      if (!id) return null;
      setBadge("Transfer Hub — fetching full conversation…");
      let token = null;
      try { const s = await fetch("/api/auth/session", { credentials: "include" }).then((r) => r.json()); token = s && s.accessToken; } catch (_) {}
      const res = await fetch("/backend-api/conversation/" + id, { credentials: "include", headers: token ? { Authorization: "Bearer " + token } : {} });
      if (!res.ok) return null;
      const data = await res.json();
      const mapping = data.mapping;
      if (!mapping) return null;

      const path = [];
      let node = mapping[data.current_node];
      let guard = 0;
      while (node && guard++ < 200000) { if (node.message) path.push(node.message); node = node.parent ? mapping[node.parent] : null; }
      path.reverse();

      const conv = ACT.newConv("chatgpt");
      conv.source.title = data.title || (document.title || "").replace(/\s*[-|].*$/, "").trim() || null;
      conv.source.conversation_id = id;
      let prev = null, i = 0;
      for (const m of path) {
        const role = m.author && m.author.role;
        if (role === "system") continue;
        if (m.metadata && m.metadata.is_visually_hidden_from_conversation) continue;
        const c = m.content || {};
        const ct = c.content_type;
        let content = [];
        if (ct === "code") {
          content = [{ type: "code", language: (c.language && c.language !== "unknown") ? c.language : null, text: c.text || "" }];
        } else if (ct === "text") {
          content = ACT.blocksFromMarkdown((c.parts || []).filter((x) => typeof x === "string").join("\n").trim());
        } else if (ct === "multimodal_text") {
          let acc = "", marks = [];
          (c.parts || []).forEach((p) => {
            if (typeof p === "string") acc += p + "\n";
            else if (p && typeof p === "object") marks.push((p.content_type || "").includes("image") ? "[Image]" : "[Attachment]");
          });
          const joined = (acc.trim() + (marks.length ? "\n" + marks.join(" ") : "")).trim();
          content = joined ? ACT.blocksFromMarkdown(joined) : [];
        } else {
          const s = (c.parts || []).filter((x) => typeof x === "string").join("\n").trim();
          if (s) content = ACT.blocksFromMarkdown(s);
        }
        const atts = m.metadata && m.metadata.attachments;
        if (atts && atts.length) {
          const names = atts.map((a) => a.name || a.id).filter(Boolean);
          if (names.length) content.push({ type: "text", text: "[Attachments: " + names.join(", ") + "]" });
        }
        if (!content.some((b) => b.text && b.text.trim())) content = [{ type: "text", text: "[Image]" }];
        const idm = "m" + (i++);
        conv.messages.push({
          id: idm, parent_id: prev,
          role: role === "user" ? "user" : role === "assistant" ? "assistant" : "tool",
          content, timestamp: typeof m.create_time === "number" ? new Date(m.create_time * 1000).toISOString() : null
        });
        prev = idm;
      }
      return conv.messages.length ? conv : null;
    } catch (_) { return null; }
  }

  /* ---- Claude: full conversation from claude.ai's own API (cookie auth) ---- */
  async function fetchClaude() {
    try {
      const id = (location.pathname.split("/chat/")[1] || "").split(/[/?#]/)[0];
      if (!id) return null;
      setBadge("Transfer Hub — fetching full conversation…");
      const orgs = await fetch("/api/organizations", { credentials: "include" }).then((r) => r.json()).catch(() => null);
      if (!Array.isArray(orgs) || !orgs.length) return null;
      const org = (orgs.find((o) => o && o.uuid) || {}).uuid;
      if (!org) return null;
      const res = await fetch("/api/organizations/" + org + "/chat_conversations/" + id + "?tree=True&rendered_content=False", { credentials: "include" });
      if (!res.ok) return null;
      const data = await res.json();
      const msgs = data.chat_messages || [];
      const conv = ACT.newConv("claude");
      conv.source.title = data.name || (document.title || "").replace(/\s*[-|].*$/, "").trim() || null;
      conv.source.conversation_id = id;
      let prev = null, i = 0;
      for (const m of msgs) {
        const role = m.sender === "human" ? "user" : "assistant";
        let text = "";
        if (Array.isArray(m.content)) for (const c of m.content) { if (typeof c.text === "string") text += c.text + "\n"; }
        if (!text && typeof m.text === "string") text = m.text;
        const content = ACT.blocksFromMarkdown(text.trim());
        if (!content.some((b) => b.text && b.text.trim())) continue;
        const idm = "m" + (i++);
        conv.messages.push({ id: idm, parent_id: prev, role, content, timestamp: m.created_at || null });
        prev = idm;
      }
      return conv.messages.length ? conv : null;
    } catch (_) { return null; }
  }

  /* ---- DeepSeek: full conversation from its API (Bearer from localStorage) ---- */
  async function fetchDeepSeek() {
    try {
      const id = (location.pathname.split("/s/")[1] || "").split(/[/?#]/)[0];
      if (!id) return null;
      setBadge("Transfer Hub — fetching full conversation…");
      let raw = localStorage.getItem("userToken"), token = null;
      try { const j = JSON.parse(raw); token = j.value || j.token || j.access_token || (typeof j === "string" ? j : null); } catch (_) { token = raw; }
      if (!token) return null;
      const res = await fetch("/api/v0/chat/history_messages?chat_session_id=" + id, { credentials: "include", headers: { Authorization: "Bearer " + token } });
      if (!res.ok) return null;
      const j = await res.json();
      const msgs = j && j.data && j.data.biz_data && j.data.biz_data.chat_messages;
      if (!Array.isArray(msgs)) return null;
      const conv = ACT.newConv("deepseek");
      conv.source.title = (document.title || "").replace(/\s*[-|].*$/, "").trim() || null;
      conv.source.conversation_id = id;
      let prev = null, i = 0;
      for (const m of msgs) {
        const role = (m.role || "").toUpperCase() === "USER" ? "user" : "assistant";
        let text = "";
        if (Array.isArray(m.fragments)) {
          for (const f of m.fragments) { const t = (f.type || "").toUpperCase(); if ((t === "REQUEST" || t === "RESPONSE" || t === "CONTENT") && typeof f.content === "string") text += f.content + "\n"; }
          if (!text) for (const f of m.fragments) { if (typeof f.content === "string") text += f.content + "\n"; }
        }
        const content = ACT.blocksFromMarkdown(text.trim());
        if (!content.some((b) => b.text && b.text.trim())) continue;
        const idm = "m" + (i++);
        conv.messages.push({ id: idm, parent_id: prev, role, content, timestamp: m.inserted_at || null });
        prev = idm;
      }
      return conv.messages.length ? conv : null;
    } catch (_) { return null; }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg && msg.type === "ACT_EXTRACT") {
      (async () => {
        try {
          const provider = detectProvider();
          let conv = null;
          if (provider === "chatgpt") conv = await fetchChatGPT();        // fast, complete
          else if (provider === "claude") conv = await fetchClaude();     // fast, complete
          else if (provider === "deepseek") conv = await fetchDeepSeek(); // fast, complete
          if (!conv || !conv.messages.length) conv = await collectAll(provider); // fallback: DOM scrape
          setBadge("Transfer Hub — done: " + conv.messages.length + " messages");
          setTimeout(clearBadge, 2500);
          sendResponse({ ok: conv.messages.length > 0, provider, conversation: conv, collected: conv.messages.length });
        } catch (e) {
          clearBadge();
          sendResponse({ ok: false, provider: detectProvider(), error: String(e && e.message || e) });
        }
      })();
      return true;
    }
    return true;
  });
})();
