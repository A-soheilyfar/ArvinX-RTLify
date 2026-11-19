/* ArvinX RTLify v2.1.0 — content script (Full Version) */

const STYLE_ID = "__rtl_pro_style__";
const HOST = location.hostname;
const LTR_CLASS = "rtl-pro-ltr";

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "NOSCRIPT",
  "SVG",
  "CANVAS",
]);

const CODE_ROOT_SELECTOR = `
  pre, code, kbd, samp,
  .hljs, .highlight, .shiki,
  [class*="language-"], [class*="highlight-"],
  [class*="syntax-"], [class*="prism-"],
  [class*="code-block"], [class*="codeblock"], [class*="codeBlock"],
  [data-language], [data-code]
`;

const CODE_CLASS_PREFIXES = [
  "language-",
  "highlight-",
  "syntax-",
  "prism-",
  "code-block",
  "codeblock",
];
const CODE_CLASS_EXACT = ["hljs", "highlight", "shiki", "codeBlock"];

let observer = null;
let idleHandle = null;
let pendingText = new Set();

async function getSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  return {
    textAlign: settings?.textAlign ?? false,
    fontFamily: settings?.fontFamily ?? false,
    defaultGlobal: settings?.defaultGlobal ?? false,
    smartMode: settings?.smartMode ?? "safe",
  };
}

async function getEffectiveState(host) {
  if (!host) return false;
  const key = "domainState:" + host;
  const r = await chrome.storage.sync.get([key, "settings"]);
  if (r[key] === "on") return true;
  if (r[key] === "off") return false;
  return r.settings?.defaultGlobal ?? false;
}

async function setDomainState(host, on) {
  if (!host) return;
  await chrome.storage.sync.set({ ["domainState:" + host]: on ? "on" : "off" });
}

function buildCSS(s) {
  const rules = [
    `html[data-rtl-pro], html[data-rtl-pro] body { direction: rtl !important; }`,
    `html[data-rtl-pro] body *:not(
       pre, code, kbd, samp, bdi,
       textarea, input, select,
       [dir="ltr"], [contenteditable="true"], .${LTR_CLASS}
     ) {
       direction: rtl !important;
     }`,
    `html[data-rtl-pro] body :is(${CODE_ROOT_SELECTOR}) {
       direction: ltr !important;
       text-align: left !important;
       unicode-bidi: isolate !important;
     }`,
    `html[data-rtl-pro] body :is(${CODE_ROOT_SELECTOR}) * {
       direction: ltr !important;
       unicode-bidi: isolate !important;
     }`,
    `html[data-rtl-pro] input[type="url"], html[data-rtl-pro] input[type="email"],
     html[data-rtl-pro] input[type="tel"], html[data-rtl-pro] input[type="password"],
     html[data-rtl-pro] input[type="number"], html[data-rtl-pro] input[type="search"] {
       direction: ltr !important; text-align: left !important;
     }`,
    `html[data-rtl-pro] .${LTR_CLASS} {
       direction: ltr !important; unicode-bidi: isolate !important; display: inline !important;
     }`,
  ];

  if (s.smartMode === "safe") {
    rules.push(`html[data-rtl-pro] body p, html[data-rtl-pro] body li,
      html[data-rtl-pro] body td, html[data-rtl-pro] body th,
      html[data-rtl-pro] body dd, html[data-rtl-pro] body dt,
      html[data-rtl-pro] body label,
      html[data-rtl-pro] body h1, html[data-rtl-pro] body h2,
      html[data-rtl-pro] body h3, html[data-rtl-pro] body h4,
      html[data-rtl-pro] body h5, html[data-rtl-pro] body h6 {
        unicode-bidi: plaintext;
      }`);
  }
  if (s.fontFamily) {
    rules.push(`html[data-rtl-pro], html[data-rtl-pro] body, html[data-rtl-pro] body *:not(:is(${CODE_ROOT_SELECTOR})) {
      font-family: ${s.fontFamily} !important;
    }`);
  }
  if (s.textAlign) {
    rules.push(`html[data-rtl-pro] body { text-align: right !important; }`);
  }
  return rules.join("\n");
}

function applyRTL(s) {
  const html = document.documentElement;
  if (!html.hasAttribute("data-rtl-pro")) {
    html.setAttribute("data-rtl-pro-orig-dir", html.getAttribute("dir") ?? "");
    html.setAttribute("dir", "rtl");
    html.setAttribute("data-rtl-pro", "");
  }
  document.getElementById(STYLE_ID)?.remove();
  const st = document.createElement("style");
  st.id = STYLE_ID;
  st.textContent = buildCSS(s);
  (document.head || html).appendChild(st);

  if (s.smartMode === "aggressive") startSmartDetection();
  else {
    stopSmartDetection();
    cleanupLTR();
  }
}

function removeRTL() {
  stopSmartDetection();
  cleanupLTR();
  const html = document.documentElement;
  const orig = html.getAttribute("data-rtl-pro-orig-dir");
  if (orig === null || orig === "") html.removeAttribute("dir");
  else html.setAttribute("dir", orig);
  html.removeAttribute("data-rtl-pro");
  html.removeAttribute("data-rtl-pro-orig-dir");
  document.getElementById(STYLE_ID)?.remove();
}

const LTR_PATTERNS = [
  /https?:\/\/[^\s<>"']+/g,
  /www\.[^\s<>"']+/g,
  /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g,
  /\b\d+(?:\.\d+){1,3}\b/g,
  /\+?\d[\d\s\-()]{7,}\d/g,
  /[A-Za-z][A-Za-z0-9]+(?:['\-][A-Za-z0-9]+)*/g,
];

function findLTRSegments(text) {
  const found = [];
  for (const re of LTR_PATTERNS) {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(text)) !== null) {
      found.push({ start: m.index, end: m.index + m[0].length });
    }
  }
  if (!found.length) return [];
  found.sort((a, b) => a.start - b.start);
  const merged = [found[0]];
  for (let i = 1; i < found.length; i++) {
    const last = merged[merged.length - 1];
    if (found[i].start <= last.end) last.end = Math.max(last.end, found[i].end);
    else merged.push({ ...found[i] });
  }
  for (const seg of merged) {
    while (seg.start < seg.end && /\s/.test(text[seg.start])) seg.start++;
    while (seg.end > seg.start && /\s/.test(text[seg.end - 1])) seg.end--;
  }
  return merged.filter((s) => s.end > s.start);
}

function isCodeBlockElement(el) {
  if (!el) return false;
  if (el.hasAttribute?.("data-language") || el.hasAttribute?.("data-code"))
    return true;
  if (!el.classList?.length) return false;
  for (const cls of el.classList) {
    if (CODE_CLASS_EXACT.includes(cls)) return true;
    if (CODE_CLASS_PREFIXES.some((p) => cls.startsWith(p))) return true;
  }
  return false;
}

function shouldSkipNode(node) {
  let el = node.parentElement;
  while (el) {
    if (SKIP_TAGS.has(el.tagName)) return true;
    if (el.classList?.contains(LTR_CLASS)) return true;
    if (isCodeBlockElement(el)) return true;
    el = el.parentElement;
  }
  return false;
}

function processTextNode(node) {
  if (!node || !node.nodeValue) return;
  if (node.nodeValue.length > 10000) return;
  if (shouldSkipNode(node)) return;
  const text = node.nodeValue;
  if (!/[\u0600-\u06FF]/.test(text)) return;
  if (!/[A-Za-z0-9]/.test(text)) return;

  const segs = findLTRSegments(text);
  if (!segs.length) return;

  const frag = document.createDocumentFragment();
  let last = 0;
  for (const { start, end } of segs) {
    if (start > last)
      frag.appendChild(document.createTextNode(text.slice(last, start)));
    const span = document.createElement("span");
    span.className = LTR_CLASS;
    span.dir = "ltr";
    span.textContent = text.slice(start, end);
    frag.appendChild(span);
    last = end;
  }
  if (last < text.length)
    frag.appendChild(document.createTextNode(text.slice(last)));

  try {
    node.parentNode.replaceChild(frag, node);
  } catch {}
}

function scanTree(root) {
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      if (shouldSkipNode(n)) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  const nodes = [];
  let n;
  while ((n = walker.nextNode())) nodes.push(n);
  for (const node of nodes) processTextNode(node);
}

function flushPending() {
  idleHandle = null;
  for (const node of pendingText) processTextNode(node);
  pendingText.clear();
}

function startSmartDetection() {
  if (observer) return;
  if (document.body) scanTree(document.body);
  else
    document.addEventListener(
      "DOMContentLoaded",
      () => document.body && scanTree(document.body),
      { once: true },
    );

  observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      if (m.type === "childList") {
        for (const node of m.addedNodes) {
          if (node.nodeType === Node.TEXT_NODE) pendingText.add(node);
          else if (node.nodeType === Node.ELEMENT_NODE) scanTree(node);
        }
      } else if (m.type === "characterData") {
        pendingText.add(m.target);
      }
    }
    if (pendingText.size && !idleHandle) {
      if (typeof requestIdleCallback === "function") {
        idleHandle = requestIdleCallback(flushPending, { timeout: 200 });
      } else {
        idleHandle = setTimeout(flushPending, 200);
      }
    }
  });
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });
}

function stopSmartDetection() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
  if (idleHandle) {
    if (typeof cancelIdleCallback === "function")
      cancelIdleCallback(idleHandle);
    else clearTimeout(idleHandle);
    idleHandle = null;
  }
  pendingText.clear();
}

function cleanupLTR() {
  document.querySelectorAll("." + LTR_CLASS).forEach((span) => {
    const parent = span.parentNode;
    if (!parent) return;
    try {
      parent.replaceChild(document.createTextNode(span.textContent), span);
      parent.normalize();
    } catch {}
  });
}

async function init() {
  if (!HOST) return;
  const [s, state] = await Promise.all([
    getSettings(),
    getEffectiveState(HOST),
  ]);
  if (state) applyRTL(s);
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === "getState") {
    sendResponse({
      state: document.documentElement.hasAttribute("data-rtl-pro"),
      host: HOST,
    });
    return false;
  }
  if (msg.type === "toggle") {
    (async () => {
      const s = await getSettings();
      const on = document.documentElement.hasAttribute("data-rtl-pro");
      if (on) {
        removeRTL();
        await setDomainState(HOST, false);
        sendResponse({ state: false, host: HOST });
      } else {
        applyRTL(s);
        await setDomainState(HOST, true);
        sendResponse({ state: true, host: HOST });
      }
    })();
    return true;
  }
  if (msg.type === "applySettings") {
    (async () => {
      const [s, state] = await Promise.all([
        getSettings(),
        getEffectiveState(HOST),
      ]);
      if (state) applyRTL(s);
      else removeRTL();
      sendResponse({ ok: true });
    })();
    return true;
  }
});

init();
