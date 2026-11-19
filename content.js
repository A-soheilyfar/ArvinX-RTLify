/* محتوای تزریق‌شده در هر صفحه (و آی‌فریم) */
const STYLE_ID = "__rtl_pro_style__";
const KEY_PREFIX = "rtlDomain:";
const HOST = location.hostname;

function buildCSS(settings) {
  const fontPart = settings.fontFamily
    ? `html[data-rtl-pro], html[data-rtl-pro] body, html[data-rtl-pro] body * { font-family: ${settings.fontFamily} !important; }`
    : "";
  const alignPart = settings.textAlign
    ? `html[data-rtl-pro] body { text-align: right !important; }`
    : "";

  return `
    html[data-rtl-pro], html[data-rtl-pro] body { direction: rtl !important; }
    html[data-rtl-pro] body *:not(pre):not(code):not(kbd):not(samp):not(bdi):not(textarea):not(input):not([dir="ltr"]):not([contenteditable="true"]) {
      direction: rtl !important;
    }
    html[data-rtl-pro] pre, html[data-rtl-pro] code,
    html[data-rtl-pro] kbd, html[data-rtl-pro] samp {
      direction: ltr !important; text-align: left !important; unicode-bidi: embed;
    }
    html[data-rtl-pro] input[type="url"],
    html[data-rtl-pro] input[type="email"],
    html[data-rtl-pro] input[type="tel"],
    html[data-rtl-pro] input[type="password"],
    html[data-rtl-pro] input[type="number"],
    html[data-rtl-pro] input[type="search"] {
      direction: ltr !important; text-align: left !important;
    }
    ${fontPart}
    ${alignPart}
  `;
}

async function getSettings() {
  const { settings } = await chrome.storage.sync.get("settings");
  return {
    textAlign: settings?.textAlign ?? false,
    fontFamily: settings?.fontFamily ?? false,
  };
}

function applyRTL(settings) {
  const html = document.documentElement;
  if (html.hasAttribute("data-rtl-pro")) return;
  html.setAttribute("data-rtl-pro", "");
  html.setAttribute("data-rtl-pro-orig-dir", html.getAttribute("dir") ?? "");
  html.setAttribute("dir", "rtl");
  if (!document.getElementById(STYLE_ID)) {
    const s = document.createElement("style");
    s.id = STYLE_ID;
    s.textContent = buildCSS(settings);
    (document.head || html).appendChild(s);
  }
}

function removeRTL() {
  const html = document.documentElement;
  const orig = html.getAttribute("data-rtl-pro-orig-dir");
  if (orig === null || orig === "") html.removeAttribute("dir");
  else html.setAttribute("dir", orig);
  html.removeAttribute("data-rtl-pro");
  html.removeAttribute("data-rtl-pro-orig-dir");
  document.getElementById(STYLE_ID)?.remove();
}

async function isEnabled(host) {
  const key = KEY_PREFIX + host;
  const r = await chrome.storage.sync.get(key);
  return Boolean(r[key]);
}

async function setEnabled(host, on) {
  const key = KEY_PREFIX + host;
  if (on) await chrome.storage.sync.set({ [key]: true });
  else await chrome.storage.sync.remove(key);
}

async function init() {
  if (!HOST) return;
  const [enabled, settings] = await Promise.all([
    isEnabled(HOST),
    getSettings(),
  ]);
  if (enabled) applyRTL(settings);
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
      const settings = await getSettings();
      const on = document.documentElement.hasAttribute("data-rtl-pro");
      if (on) {
        removeRTL();
        await setEnabled(HOST, false);
        sendResponse({ state: false, host: HOST });
      } else {
        applyRTL(settings);
        await setEnabled(HOST, true);
        sendResponse({ state: true, host: HOST });
      }
    })();
    return true;
  }
  if (msg.type === "applySettings") {
    (async () => {
      const settings = await getSettings();
      if (document.documentElement.hasAttribute("data-rtl-pro")) {
        document.getElementById(STYLE_ID)?.remove();
        const s = document.createElement("style");
        s.id = STYLE_ID;
        s.textContent = buildCSS(settings);
        (document.head || document.documentElement).appendChild(s);
      }
      sendResponse({ ok: true });
    })();
    return true;
  }
});

init();
