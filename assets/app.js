/* Общий код для всех страниц: настройки, хранилище прогресса, разметка текста, тема. */
(function () {
  const CONFIG = {
    repo: "getman-danil/learn",
    requestLabel: "заявка",
    reviewIntervals: [1, 3, 7, 16, 35] // дни между повторениями
  };

  const KEY = "learn.v1";
  const DAY = 86400000;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  let state = load();
  state.lessons = state.lessons || {};
  state.prefs = state.prefs || {};

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* приватный режим */ }
  }

  function lesson(id) {
    return state.lessons[id] || {};
  }
  function updateLesson(id, patch) {
    state.lessons[id] = Object.assign({}, state.lessons[id], patch);
    save();
    return state.lessons[id];
  }

  function today() { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function addDays(t, n) { return t + n * DAY; }
  function fmtDate(t) {
    return new Date(t).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  }

  /* Статус: "new" | "progress" | "done" */
  function statusOf(id) { return lesson(id).status || "new"; }
  function markOpened(id) {
    const l = lesson(id);
    if (!l.status) updateLesson(id, { status: "progress", openedAt: Date.now() });
  }
  function markDone(id) {
    const l = lesson(id);
    const patch = { status: "done" };
    if (!l.doneAt) {
      patch.doneAt = Date.now();
      patch.reviewStage = 0;
      patch.nextReview = addDays(today(), CONFIG.reviewIntervals[0]);
    }
    return updateLesson(id, patch);
  }
  function markProgress(id) {
    return updateLesson(id, { status: "progress", doneAt: null, nextReview: null, reviewStage: null });
  }
  function isDue(id) {
    const l = lesson(id);
    return l.status === "done" && l.nextReview && l.nextReview <= Date.now();
  }
  function markReviewed(id) {
    const l = lesson(id);
    const stage = Math.min((l.reviewStage || 0) + 1, CONFIG.reviewIntervals.length - 1);
    const done = (l.reviewStage || 0) + 1 >= CONFIG.reviewIntervals.length;
    return updateLesson(id, {
      reviewStage: stage,
      nextReview: done ? null : addDays(today(), CONFIG.reviewIntervals[stage]),
      reviewedAt: Date.now()
    });
  }
  function togglePin(id) {
    return updateLesson(id, { pinned: !lesson(id).pinned }).pinned;
  }

  /* ===== Мини-Markdown ===== */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function inline(s) {
    s = esc(s);
    s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>");
    s = s.replace(/==([^=]+)==/g, "<mark>$1</mark>");
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+|[^)\s:]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
    return s;
  }
  function md(src) {
    if (!src) return "";
    const lines = String(src).replace(/\r/g, "").split("\n");
    let out = [], para = [], list = null;
    const flushPara = () => { if (para.length) { out.push("<p>" + inline(para.join(" ")) + "</p>"); para = []; } };
    const flushList = () => { if (list) { out.push(`<${list.tag}>` + list.items.map(i => "<li>" + inline(i) + "</li>").join("") + `</${list.tag}>`); list = null; } };
    for (const raw of lines) {
      const line = raw.trimEnd();
      let m;
      if (!line.trim()) { flushPara(); flushList(); continue; }
      if ((m = line.match(/^(#{2,3})\s+(.*)$/))) { flushPara(); flushList(); const h = m[1].length; out.push(`<h${h}>${inline(m[2])}</h${h}>`); continue; }
      if ((m = line.match(/^\s*[-•]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
      if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) { flushPara(); if (!list || list.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
      if ((m = line.match(/^>\s?(.*)$/))) { flushPara(); flushList(); out.push("<blockquote>" + inline(m[1]) + "</blockquote>"); continue; }
      flushList();
      para.push(line.trim());
    }
    flushPara(); flushList();
    return out.join("");
  }

  /* ===== Тема и размер шрифта ===== */
  const SIZES = { s: 17, m: 19, l: 21, xl: 23 };
  function applyPrefs() {
    const root = document.documentElement;
    const t = state.prefs.theme || "auto";
    if (t === "auto") root.removeAttribute("data-theme"); else root.setAttribute("data-theme", t);
    root.style.setProperty("--fs", (SIZES[state.prefs.size] || SIZES.m) + "px");
  }
  function setPref(k, v) { state.prefs[k] = v; save(); applyPrefs(); }
  applyPrefs();

  function readerPanel() {
    const panel = document.createElement("div");
    panel.className = "reader-panel";
    panel.innerHTML = `
      <div class="wrap">
        <div class="reader-row"><span>Размер текста</span>
          <div class="seg" data-k="size">
            <button data-v="s" aria-label="Мелкий">A</button><button data-v="m" style="font-size:17px">A</button>
            <button data-v="l" style="font-size:19px">A</button><button data-v="xl" style="font-size:21px">A</button>
          </div></div>
        <div class="reader-row"><span>Тема</span>
          <div class="seg" data-k="theme">
            <button data-v="light">Светлая</button><button data-v="dark">Тёмная</button><button data-v="auto">Авто</button>
          </div></div>
        <button class="btn btn-block" data-close>Готово</button>
      </div>`;
    document.body.appendChild(panel);
    const sync = () => panel.querySelectorAll(".seg").forEach(seg => {
      const k = seg.dataset.k, cur = state.prefs[k] || (k === "size" ? "m" : "auto");
      seg.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.v === cur)));
    });
    panel.addEventListener("click", e => {
      const b = e.target.closest("button");
      if (!b) return;
      if (b.hasAttribute("data-close")) { panel.classList.remove("open"); return; }
      const seg = b.closest(".seg");
      if (seg) { setPref(seg.dataset.k, b.dataset.v); sync(); }
    });
    sync();
    return { open() { sync(); panel.classList.add("open"); } };
  }

  let toastEl, toastTimer;
  function toast(text) {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.appendChild(toastEl); }
    toastEl.textContent = text;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-cache" });
    if (!r.ok) throw new Error(r.status + " " + url);
    return r.json();
  }

  /* Офлайн-режим */
  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
  // Сохраняет все уроки из каталога для чтения без интернета.
  function saveForOffline(ids) {
    if (!("serviceWorker" in navigator) || !navigator.onLine) return;
    navigator.serviceWorker.ready.then(() => {
      ids.forEach(id => fetch("lessons/" + id + ".json", { cache: "no-cache" }).catch(() => {}));
    });
  }

  window.Learn = {
    CONFIG, state, lesson, updateLesson, statusOf, markOpened, markDone, markProgress, isDue, markReviewed, togglePin,
    md, inline, esc, fmtDate, readerPanel, toast, shuffle, fetchJSON, saveForOffline
  };
})();
