/*!
 * Portfolio Agent widget — Siwar's AI assistant.
 * Usage: <script src="https://<agent-host>/widget.js" defer></script>
 * Optional attributes on the script tag:
 *   data-api="https://<agent-host>/api/chat"   (default: same host as this script)
 *   data-default-theme="dark|light"            (used when the page sets no theme class; default dark)
 * Any element with [data-agent-open] opens the chat. JS API: window.PortfolioAgent.open() / .close()
 */
(() => {
  if (window.PortfolioAgent) return;

  const script = document.currentScript;
  const scriptUrl = new URL(script?.src || "/widget.js", location.href);
  const BASE = scriptUrl.href.replace(/[^/]*$/, "");
  const API = script?.dataset.api || new URL("api/chat", BASE).href;
  const DEFAULT_THEME = script?.dataset.defaultTheme === "light" ? "light" : "dark";
  const BOOKING_URL = script?.dataset.bookingUrl || "https://cal.com/siwar-m-sellem-nhcfh6/intro-call";
  const isBookingLink = (url) => /^https:\/\/(app\.)?cal\.com\//.test(url);
  const STORE_KEY = "portfolio-agent:conversation";
  const MAX_INPUT = 2000;

  const STARTERS = [
    "Who is Siwar, in 3 sentences?",
    "What AI and LLM work has she shipped?",
    "Tell me about a hard problem she solved.",
    "I'll paste a job description: is she a fit?",
  ];

  const css = `
:host { all: initial; }
* { box-sizing: border-box; }
.root { --bg:#111118; --bg2:#17171f; --ink:#f4f3f8; --muted:#9a98a8; --line:rgba(255,255,255,.1);
  --accent:#7c6cff; --accent2:#3ef0c0; --on-accent:#0b0a14; --user:#24203f; --danger:#ff8a7a; --shadow:0 18px 50px rgba(0,0,0,.45);
  font-family:"Inter Tight", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color:var(--ink); }
.root.light { --bg:#ffffff; --bg2:#f3f2ee; --ink:#111018; --muted:#5d5b68; --line:rgba(17,16,24,.1);
  --accent:#5a48f5; --accent2:#0fb98a; --on-accent:#ffffff; --user:#ece9ff; --danger:#c2412d; --shadow:0 18px 50px rgba(17,16,24,.18); }

.launcher { position:fixed; right:22px; bottom:22px; z-index:2147483000; width:64px; height:64px; border:0; padding:0;
  border-radius:50%; background:transparent; cursor:pointer; -webkit-tap-highlight-color:transparent; }
.launcher:focus-visible, button:focus-visible, textarea:focus-visible { outline:2px solid var(--accent2); outline-offset:3px; }
.av { position:relative; display:inline-block; border-radius:50%; flex:none; background:var(--bg2); }
.av img { width:100%; height:100%; border-radius:50%; display:block; object-fit:cover; }
.av::before { content:""; position:absolute; inset:-4px; border-radius:50%; border:2px solid var(--accent2); }
.av::after { content:""; position:absolute; inset:-4px; border-radius:50%; border:2px solid transparent; border-top-color:var(--accent); opacity:0; }
.thinking .av::after { opacity:1; animation:spin 1s linear infinite; }
.launcher .av { width:64px; height:64px; box-shadow:var(--shadow); transition:transform .2s ease; }
.launcher:hover .av { transform:scale(1.05); }
.badge { position:absolute; right:-6px; bottom:-2px; font:700 10px/1 ui-sans-serif, system-ui, sans-serif; letter-spacing:.04em;
  color:var(--on-accent); background:var(--accent); border:2px solid var(--bg); border-radius:999px; padding:3px 5px; }
/* Full-body mascot greeter (wider screens only) */
.mascot { position:fixed; right:18px; bottom:10px; z-index:2147483000; width:118px; height:152px; border:0; padding:0; background:transparent;
  cursor:pointer; -webkit-tap-highlight-color:transparent; animation:enter .5s cubic-bezier(.2,.9,.3,1.2) both; }
.mascot[hidden] { display:none; }
.mascot .body { position:absolute; inset:0; animation:breathe 3.2s ease-in-out infinite; transform-origin:50% 100%; }
.mascot img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; opacity:0; transition:opacity 90ms linear; pointer-events:none; }
.mascot img.on { opacity:1; }
.mascot.hop .body { animation:hop .42s ease-out 1; }
.mascot .badge { right:6px; bottom:18px; }
.mascot:hover .body { filter:brightness(1.06); }
.root.with-mascot .launcher { display:none; }
.root.with-mascot .panel { bottom:22px; height:min(660px, calc(100vh - 44px)); }
.nudge { position:fixed; right:146px; bottom:104px; z-index:2147483000; max-width:220px; background:var(--bg); color:var(--ink);
  border:1px solid var(--line); border-radius:14px 14px 4px 14px; padding:10px 12px; font-size:13px; line-height:1.4; box-shadow:var(--shadow);
  cursor:pointer; animation:pop .25s ease both; }

.panel { position:fixed; right:22px; bottom:98px; z-index:2147483001; width:min(400px, calc(100vw - 32px)); height:min(620px, calc(100vh - 130px));
  display:flex; flex-direction:column; background:var(--bg); border:1px solid var(--line); border-radius:20px; box-shadow:var(--shadow);
  overflow:hidden; animation:pop .2s ease both; }
.panel[hidden], .nudge[hidden] { display:none; }
header { display:flex; align-items:center; gap:12px; padding:14px 14px 14px 18px; border-bottom:1px solid var(--line); }
header .av { width:40px; height:40px; }
.title { flex:1; min-width:0; }
.title strong { display:flex; align-items:center; gap:6px; font-size:15px; font-weight:600; }
.title span { display:block; font-size:12px; color:var(--muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.dot { width:7px; height:7px; border-radius:50%; background:var(--accent2); }
.icon { width:36px; height:36px; border:0; border-radius:10px; background:transparent; color:var(--muted); cursor:pointer; display:grid; place-items:center; }
.icon:hover { background:var(--bg2); color:var(--ink); }
.icon svg { width:18px; height:18px; }

.log { flex:1; overflow-y:auto; padding:18px; display:flex; flex-direction:column; gap:12px; overscroll-behavior:contain; }
.msg { max-width:88%; padding:10px 13px; border-radius:16px; font-size:14px; line-height:1.55; overflow-wrap:anywhere; }
.msg.user { align-self:flex-end; background:var(--user); border-bottom-right-radius:4px; white-space:pre-wrap; }
.msg.bot { align-self:flex-start; background:var(--bg2); border-bottom-left-radius:4px; }
.msg.bot p { margin:0 0 8px; } .msg.bot p:last-child { margin:0; }
.msg.bot ul { margin:4px 0 8px; padding-left:18px; } .msg.bot li { margin:2px 0; }
.msg.bot a { color:var(--accent2); text-underline-offset:2px; }
.root.light .msg.bot a { color:var(--accent); }
.msg.bot a.cta, .root.light .msg.bot a.cta { display:inline-flex; align-items:center; gap:8px; margin:4px 0; padding:9px 14px; border-radius:12px;
  background:var(--accent); color:var(--on-accent); font-weight:600; font-size:13.5px; text-decoration:none; }
.msg.bot a.cta:hover { filter:brightness(1.08); }
.msg.bot a.cta svg { width:16px; height:16px; flex:none; }
.msg.bot code { font-family:"JetBrains Mono", ui-monospace, monospace; font-size:12.5px; background:var(--bg); padding:1px 5px; border-radius:5px; }
.msg.error { align-self:stretch; max-width:100%; background:transparent; border:1px solid var(--danger); color:var(--danger); font-size:13px; }
.typing { display:inline-flex; gap:4px; padding:4px 0; }
.typing i { width:6px; height:6px; border-radius:50%; background:var(--muted); animation:blink 1.2s infinite ease-in-out; }
.typing i:nth-child(2) { animation-delay:.15s; } .typing i:nth-child(3) { animation-delay:.3s; }
.intro { font-size:14px; line-height:1.55; color:var(--ink); margin:0 0 4px; }
.chips { display:flex; flex-direction:column; gap:8px; margin-top:4px; }
.chip { text-align:left; font:inherit; font-size:13px; color:var(--ink); background:transparent; border:1px solid var(--line); border-radius:12px;
  padding:9px 12px; cursor:pointer; transition:border-color .15s, background .15s; }
.chip:hover { border-color:var(--accent); background:var(--bg2); }

form { display:flex; gap:8px; align-items:flex-end; padding:12px 12px 6px; border-top:1px solid var(--line); }
textarea { flex:1; resize:none; min-height:44px; max-height:140px; padding:11px 12px; border-radius:12px; border:1px solid var(--line);
  background:var(--bg2); color:var(--ink); font:inherit; font-size:14px; line-height:1.4; }
textarea::placeholder { color:var(--muted); }
.send { width:44px; height:44px; border:0; border-radius:12px; background:var(--accent); color:var(--on-accent); cursor:pointer; display:grid; place-items:center; flex:none; }
.send:disabled { opacity:.45; cursor:default; }
.send svg { width:18px; height:18px; }
.note { margin:0; padding:0 14px 10px; font-size:11px; line-height:1.4; color:var(--muted); text-align:center; }

@keyframes spin { to { transform:rotate(360deg); } }
@keyframes pop { from { opacity:0; transform:translateY(8px) scale(.98); } to { opacity:1; transform:none; } }
@keyframes blink { 0%,80%,100% { opacity:.3; } 40% { opacity:1; } }
@keyframes enter { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:none; } }
@keyframes breathe { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-3px); } }
@keyframes hop { 0% { transform:translateY(0); } 40% { transform:translateY(-10px) rotate(-2deg); } 100% { transform:translateY(0); } }
@media (max-width:520px) {
  .panel { right:0; bottom:0; width:100vw; height:100dvh; border-radius:0; border:0; }
  .launcher { right:16px; bottom:16px; }
  .nudge { right:88px; bottom:26px; }
}
@media (prefers-reduced-motion:reduce) { *, *::before, *::after { animation:none !important; transition:none !important; } }
`;

  const ICONS = {
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
    send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  };

  // ---------- helpers ----------
  const store = {
    load() { try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || "[]"); } catch { return []; } },
    save(m) { try { sessionStorage.setItem(STORE_KEY, JSON.stringify(m.slice(-30))); } catch {} },
    clear() { try { sessionStorage.removeItem(STORE_KEY); } catch {} },
    once(key) { try { if (sessionStorage.getItem(key)) return false; sessionStorage.setItem(key, "1"); return true; } catch { return false; } },
  };

  const escapeHtml = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function safeHref(url) {
    try {
      const u = new URL(url, location.href);
      return u.protocol === "https:" || u.protocol === "http:" || u.protocol === "mailto:" ? u.href : null;
    } catch { return null; }
  }

  // Minimal, safe Markdown: escape first, then inline code, bold, links, bullet lists, paragraphs.
  function renderMarkdown(src) {
    const inline = (t) => escapeHtml(t)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => {
        const url = safeHref(href.replace(/&amp;/g, "&"));
        if (!url) return label;
        const external = new URL(url).origin !== location.origin;
        const attrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
        if (isBookingLink(url)) return `<a class="cta" href="${escapeHtml(url)}"${attrs}>${ICONS.calendar}<span>${label}</span></a>`;
        return `<a href="${escapeHtml(url)}"${attrs}>${label}</a>`;
      });
    const out = [];
    let list = null;
    for (const line of src.split("\n")) {
      const item = line.match(/^\s*[-*•]\s+(.*)$/);
      if (item) { (list ??= []).push(`<li>${inline(item[1])}</li>`); continue; }
      if (list) { out.push(`<ul>${list.join("")}</ul>`); list = null; }
      if (line.trim()) out.push(`<p>${inline(line)}</p>`);
    }
    if (list) out.push(`<ul>${list.join("")}</ul>`);
    return out.join("");
  }

  const el = (tag, attrs = {}, html) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === true) n.setAttribute(k, "");
      else if (v !== false && v != null) n.setAttribute(k, String(v));
    }
    if (html != null) n.innerHTML = html;
    return n;
  };

  const asset = (name) => new URL(name, BASE).href;

  const avatar = (size) => {
    const a = el("span", { class: "av" });
    const img = el("img", {
      src: asset(size > 48 ? "mascot-head-256.webp" : "mascot-head-128.webp"),
      srcset: `${asset("mascot-head-128.webp")} 128w, ${asset("mascot-head-256.webp")} 256w`,
      sizes: `${size}px`, alt: "", width: size, height: size, decoding: "async",
    });
    a.append(img);
    return a;
  };

  // Full-body mascot: three aligned poses, cross-faded to animate a wave.
  const FRAMES = { idle: "mascot-idle.webp", wave: "mascot-wave.webp", present: "mascot-present.webp" };
  const WAVE = [["wave", 0], ["present", 260], ["wave", 520], ["present", 780], ["wave", 1040], ["idle", 1500]];
  const SHORT_WAVE = [["wave", 0], ["present", 240], ["wave", 480], ["idle", 900]];

  // ---------- DOM ----------
  const host = el("div", { id: "portfolio-agent" });
  const shadow = host.attachShadow({ mode: "open" });
  shadow.append(el("style", {}, css));
  const root = el("div", { class: "root" });
  shadow.append(root);

  const launcher = el("button", { class: "launcher", type: "button", "aria-label": "Open Siwar's AI assistant", "aria-expanded": "false", "aria-controls": "pa-panel" });
  const launcherAv = avatar(64);
  launcherAv.append(el("span", { class: "badge", "aria-hidden": "true" }, "AI"));
  launcher.append(launcherAv);

  const mascot = el("button", { class: "mascot", type: "button", hidden: true, "aria-label": "Open Siwar's AI assistant", "aria-controls": "pa-panel" });
  const mascotBody = el("span", { class: "body" });
  const frameImgs = {};
  for (const [name, file] of Object.entries(FRAMES)) {
    frameImgs[name] = el("img", { src: asset(file), alt: "", decoding: "async" });
    mascotBody.append(frameImgs[name]);
  }
  frameImgs.idle.classList.add("on");
  mascotBody.append(el("span", { class: "badge", "aria-hidden": "true" }, "AI"));
  mascot.append(mascotBody);

  const nudge = el("div", { class: "nudge", hidden: true, role: "button", tabindex: "0" }, "Hi! I'm Siwar's AI assistant. Ask me about her projects or your role.");

  const panel = el("section", { class: "panel", id: "pa-panel", hidden: true, role: "dialog", "aria-label": "Siwar's AI assistant" });
  const header = el("header");
  const headerAv = avatar(40);
  const title = el("div", { class: "title" },
    '<strong>Siwar\'s AI assistant <span class="dot" aria-hidden="true"></span></strong><span>Ask about her projects, skills or fit for your role</span>');
  const bookBtn = el("a", { class: "icon", href: BOOKING_URL, target: "_blank", rel: "noopener noreferrer",
    "aria-label": "Book a 20-minute intro call with Siwar", title: "Book a 20-min intro call" }, ICONS.calendar);
  const resetBtn = el("button", { class: "icon", type: "button", "aria-label": "New conversation", title: "New conversation" }, ICONS.reset);
  const closeBtn = el("button", { class: "icon", type: "button", "aria-label": "Close assistant", title: "Close" }, ICONS.close);
  header.append(headerAv, title, bookBtn, resetBtn, closeBtn);

  const log = el("div", { class: "log", role: "log", "aria-live": "polite" });
  const form = el("form");
  const input = el("textarea", { rows: "1", placeholder: "Ask anything about Siwar…", "aria-label": "Your message", maxlength: String(MAX_INPUT) });
  const sendBtn = el("button", { class: "send", type: "submit", "aria-label": "Send" }, ICONS.send);
  form.append(input, sendBtn);
  const note = el("p", { class: "note" }, "AI-generated answers can contain mistakes. Messages are processed by a third-party AI service; please don't share sensitive information.");
  panel.append(header, log, form, note);

  root.append(nudge, panel, mascot, launcher);

  // ---------- theme ----------
  function applyTheme() {
    const b = document.body.classList;
    const light = b.contains("light") ? true : b.contains("dark") ? false : DEFAULT_THEME === "light";
    root.classList.toggle("light", light);
  }

  // ---------- state ----------
  let messages = store.load();
  let busy = false;
  let lastFocus = null;

  function scrollDown() { log.scrollTop = log.scrollHeight; }

  function addBubble(role, text) {
    const b = el("div", { class: `msg ${role}` });
    if (role === "bot") b.innerHTML = renderMarkdown(text);
    else b.textContent = text;
    log.append(b);
    scrollDown();
    return b;
  }

  function renderAll() {
    log.textContent = "";
    if (!messages.length) {
      const wrap = el("div", { class: "msg bot" });
      wrap.append(el("p", { class: "intro" }, "Hi, I'm Siwar's AI assistant. I can walk you through her experience, projects and skills, or check her fit against your job description."));
      const chips = el("div", { class: "chips" });
      for (const s of STARTERS) {
        const c = el("button", { class: "chip", type: "button" });
        c.textContent = s;
        c.addEventListener("click", () => {
          if (s.startsWith("I'll paste")) { input.value = "Here is the job description:\n\n"; input.focus(); autosize(); return; }
          ask(s);
        });
        chips.append(c);
      }
      wrap.append(chips);
      log.append(wrap);
      return;
    }
    for (const m of messages) addBubble(m.role === "user" ? "user" : "bot", m.content);
  }

  function setBusy(b) {
    busy = b;
    sendBtn.disabled = b;
    root.classList.toggle("thinking", b);
  }

  function autosize() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 140) + "px";
  }

  async function ask(text) {
    const content = text.trim().slice(0, MAX_INPUT);
    if (busy || !content) return;
    if (!messages.length) log.textContent = "";
    messages.push({ role: "user", content });
    store.save(messages);
    addBubble("user", content);
    input.value = "";
    autosize();
    setBusy(true);

    const bubble = addBubble("bot", "");
    bubble.innerHTML = '<span class="typing" aria-label="Thinking"><i></i><i></i><i></i></span>';
    let answer = "";

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(res.status === 429
          ? body.error || "Too many messages. Please wait a little before asking again."
          : "The assistant is unavailable right now. Please try again in a moment.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (!line.trim()) continue;
          const ev = JSON.parse(line);
          if (ev.type === "text") {
            answer += ev.text;
            bubble.innerHTML = renderMarkdown(answer);
            scrollDown();
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        }
      }
      if (!answer) throw new Error("No answer this time. Please try again.");
      messages.push({ role: "assistant", content: answer });
      store.save(messages);
    } catch (err) {
      messages.pop(); // keep the conversation valid: drop the unanswered question
      store.save(messages);
      if (!answer) bubble.remove();
      const msg = err instanceof TypeError ? "Connection problem. Check your network and try again." : err.message;
      addBubble("error", msg);
    } finally {
      setBusy(false);
      input.focus();
    }
  }

  // ---------- mascot animation ----------
  const wide = window.matchMedia("(min-width: 700px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let frameTimers = [];
  let waving = false;

  function showFrame(name) {
    for (const [n, img] of Object.entries(frameImgs)) img.classList.toggle("on", n === name);
  }
  function playFrames(sequence) {
    if (reducedMotion.matches || waving) return;
    waving = true;
    frameTimers.forEach(clearTimeout);
    mascot.classList.remove("hop");
    void mascot.offsetWidth; // restart the hop animation
    mascot.classList.add("hop");
    frameTimers = sequence.map(([name, at]) => setTimeout(() => showFrame(name), at));
    const end = sequence[sequence.length - 1][1];
    frameTimers.push(setTimeout(() => { waving = false; mascot.classList.remove("hop"); }, end + 50));
  }
  const usingMascot = () => root.classList.contains("with-mascot");

  // ---------- open / close ----------
  function open() {
    if (!panel.hidden) return;
    lastFocus = document.activeElement;
    nudge.hidden = true;
    panel.hidden = false;
    if (usingMascot()) mascot.hidden = true;
    launcher.setAttribute("aria-expanded", "true");
    renderAll();
    setTimeout(() => input.focus(), 50);
  }
  function close() {
    if (panel.hidden) return;
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    if (usingMascot()) { mascot.hidden = false; showFrame("idle"); }
    const fallback = usingMascot() ? mascot : launcher;
    (lastFocus && document.contains(lastFocus) && lastFocus !== document.body ? lastFocus : fallback).focus?.();
  }
  const toggle = () => (panel.hidden ? open() : close());

  launcher.addEventListener("click", toggle);
  mascot.addEventListener("click", open);
  mascot.addEventListener("mouseenter", () => playFrames(SHORT_WAVE));
  closeBtn.addEventListener("click", close);
  resetBtn.addEventListener("click", () => { if (busy) return; messages = []; store.clear(); renderAll(); input.focus(); });
  nudge.addEventListener("click", open);
  nudge.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); } });
  form.addEventListener("submit", (e) => { e.preventDefault(); ask(input.value); });
  input.addEventListener("input", autosize);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(input.value); } });
  panel.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

  // Any element with [data-agent-open] on the page opens the assistant (e.g. a hero button).
  document.addEventListener("click", (e) => {
    const trigger = e.target instanceof Element && e.target.closest("[data-agent-open]");
    if (trigger) { e.preventDefault(); open(); }
  });

  // Wide screens: full-body mascot. Small screens: round head bubble.
  function applyLayout() {
    const useMascot = wide.matches;
    root.classList.toggle("with-mascot", useMascot);
    if (!useMascot) { mascot.hidden = true; nudge.hidden = true; return; }
    if (panel.hidden && mascot.dataset.ready) mascot.hidden = false;
  }

  function mount() {
    document.body.append(host);
    applyTheme();
    new MutationObserver(applyTheme).observe(document.body, { attributes: true, attributeFilter: ["class"] });
    wide.addEventListener?.("change", applyLayout);
    applyLayout();
    if (!wide.matches) return;

    const firstVisit = store.once("portfolio-agent:greeted");
    const appear = () => {
      mascot.dataset.ready = "1";
      if (!panel.hidden || !wide.matches) return;
      mascot.hidden = false;
      if (!firstVisit) return;
      // First page of the visit: wave hello and say hi, once.
      setTimeout(() => playFrames(WAVE), 350);
      setTimeout(() => { if (panel.hidden) nudge.hidden = false; }, 700);
      setTimeout(() => { nudge.hidden = true; }, 12000);
    };
    // Let the page load first, and wait for the frames so the wave never flickers.
    const ready = Promise.all(Object.values(frameImgs).map((img) => img.decode().catch(() => {})));
    Promise.all([ready, new Promise((r) => setTimeout(r, firstVisit ? 1200 : 0))]).then(appear);
  }
  if (document.body) mount();
  else document.addEventListener("DOMContentLoaded", mount);

  window.PortfolioAgent = { open, close };
})();
