/* Главная: список уроков, поиск, закрепление, статусы, повторение, заявки. */
(function () {
  const L = window.Learn;
  const $ = s => document.querySelector(s);
  let catalog = [];
  let filter = "all";
  let query = "";

  const STATUS = { new: "Новый", progress: "В процессе", done: "Пройдено" };

  function plural(n, one, few, many) {
    const m10 = n % 10, m100 = n % 100;
    if (m10 === 1 && m100 !== 11) return one;
    if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
    return many;
  }

  function card(item) {
    const st = L.statusOf(item.id);
    const s = L.lesson(item.id);
    const due = L.isDue(item.id);
    const a = document.createElement("a");
    a.className = "card";
    a.href = "lesson.html?id=" + encodeURIComponent(item.id) + (due ? "&review=1" : "");
    a.innerHTML = `
      <h3>${L.esc(item.title)}</h3>
      <p>${L.esc(item.summary || "")}</p>
      <div class="meta">
        <span class="badge ${st}">${STATUS[st]}</span>
        ${due ? '<span class="badge due">Пора повторить</span>' : ""}
        ${item.minutes ? `<span>${item.minutes} мин</span>` : ""}
        ${s.status === "done" && s.nextReview && !due ? `<span>повтор ${L.fmtDate(s.nextReview)}</span>` : ""}
      </div>`;
    const pin = document.createElement("button");
    pin.className = "pin-btn";
    pin.setAttribute("aria-label", "Закрепить");
    pin.setAttribute("aria-pressed", String(!!s.pinned));
    pin.textContent = s.pinned ? "★" : "☆";
    pin.addEventListener("click", e => {
      e.preventDefault();
      const on = L.togglePin(item.id);
      L.toast(on ? "Закреплено" : "Откреплено");
      render();
    });
    a.appendChild(pin);
    return a;
  }

  function section(el, title, items) {
    el.innerHTML = "";
    if (!items.length) return;
    const h = document.createElement("div");
    h.className = "section-title";
    h.textContent = title;
    const box = document.createElement("div");
    box.className = "cards";
    items.forEach(i => box.appendChild(card(i)));
    el.append(h, box);
  }

  function matches(item) {
    if (filter !== "all" && L.statusOf(item.id) !== filter) return false;
    if (!query) return true;
    const hay = [item.title, item.summary, (item.tags || []).join(" ")].join(" ").toLowerCase();
    return query.split(/\s+/).every(w => hay.includes(w));
  }

  function render() {
    const list = catalog.filter(matches);
    const searching = !!query || filter !== "all";
    section($("#due"), "Повторить сегодня", searching ? [] : catalog.filter(i => L.isDue(i.id)));
    section($("#pinned"), "Закреплённые", searching ? [] : catalog.filter(i => L.lesson(i.id).pinned));
    const all = $("#all");
    if (!catalog.length) {
      all.innerHTML = '<div class="section-title">Все темы</div><div class="empty">Уроков пока нет. Напиши тему ниже, и урок появится здесь.</div>';
    } else if (!list.length) {
      all.innerHTML = '<div class="section-title">Все темы</div><div class="empty">Ничего не нашлось.</div>';
    } else {
      section(all, searching ? "Найдено" : "Все темы", list);
    }
    const done = catalog.filter(i => L.statusOf(i.id) === "done").length;
    const n = catalog.length;
    $("#stats").textContent = n
      ? `${n} ${plural(n, "тема", "темы", "тем")}, пройдено ${done}`
      : "Здесь будут твои уроки";
  }

  async function init() {
    try {
      const data = await L.fetchJSON("lessons/catalog.json");
      catalog = (data.lessons || []).slice().sort((a, b) => (b.created || "").localeCompare(a.created || ""));
    } catch (e) {
      catalog = [];
    }
    render();
    L.saveForOffline(catalog.map(i => i.id));
  }

  $("#search").addEventListener("input", e => { query = e.target.value.trim().toLowerCase(); render(); });
  document.querySelectorAll("[data-f]").forEach(b => b.addEventListener("click", () => {
    filter = b.dataset.f;
    document.querySelectorAll("[data-f]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
    render();
  }));

  const reader = L.readerPanel();
  $("#readerBtn").addEventListener("click", () => reader.open());

  let depth = "Запомнить надолго";
  document.querySelectorAll("[data-d]").forEach(b => b.addEventListener("click", () => {
    depth = b.dataset.d;
    document.querySelectorAll("[data-d]").forEach(x => x.setAttribute("aria-pressed", String(x === b)));
  }));
  $("#sendRequest").addEventListener("click", () => {
    const topic = $("#topic").value.trim().replace(/\s+/g, " ");
    if (!topic) { L.toast("Сначала напиши тему"); $("#topic").focus(); return; }
    if (!navigator.onLine) { L.toast("Нет интернета. Заявку можно отправить, когда появится сеть"); return; }
    const title = "Хочу изучить: " + topic.slice(0, 200);
    const body = `Тема: ${topic}\nГлубина: ${depth}`;
    const url = `https://github.com/${L.CONFIG.repo}/issues/new?` +
      new URLSearchParams({ title, body, labels: L.CONFIG.requestLabel }).toString();
    window.open(url, "_blank", "noopener");
  });

  init();
})();
