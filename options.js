const PREFIX = "rtlDomain:";

async function loadDomains() {
  const all = await chrome.storage.sync.get(null);
  const domains = Object.keys(all)
    .filter((k) => k.startsWith(PREFIX))
    .map((k) => k.replace(PREFIX, ""))
    .sort();

  const ul = document.getElementById("domains");
  ul.innerHTML = "";
  document.getElementById("empty").style.display = domains.length
    ? "none"
    : "block";

  for (const d of domains) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.textContent = d;
    const btn = document.createElement("button");
    btn.textContent = "حذف";
    btn.onclick = async () => {
      await chrome.storage.sync.remove(PREFIX + d);
      loadDomains();
    };
    li.append(span, btn);
    ul.appendChild(li);
  }
}

document.getElementById("clear").addEventListener("click", async () => {
  if (!confirm("همهٔ دامنه‌ها حذف شوند؟")) return;
  const all = await chrome.storage.sync.get(null);
  const keys = Object.keys(all).filter((k) => k.startsWith(PREFIX));
  await chrome.storage.sync.remove(keys);
  loadDomains();
});

document.getElementById("export").addEventListener("click", async () => {
  const all = await chrome.storage.sync.get(null);
  const blob = new Blob([JSON.stringify(all, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rtl-toggle-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("import").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  const msg = document.getElementById("importMsg");
  if (!file) return;
  try {
    const data = JSON.parse(await file.text());
    await chrome.storage.sync.set(data);
    msg.textContent = "✅ تنظیمات با موفقیت بارگذاری شد.";
    loadDomains();
  } catch (err) {
    msg.textContent = "❌ فایل نامعتبر: " + err.message;
  }
});

loadDomains();
