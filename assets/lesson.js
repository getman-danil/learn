/* Страница урока: загружает lessons/<id>.json и собирает его из блоков. */
(function () {
  const L = window.Learn;
  const root = document.getElementById("lesson");
  const params = new URLSearchParams(location.search);
  const id = params.get("id") || "";

  function fail(text) {
    root.innerHTML = `<div class="empty" style="margin:40px 0">${L.esc(text)}<br><br><a href="./">Вернуться в библиотеку</a></div>`;
  }

  function endBlock(data) {
    const box = document.createElement("div");
    box.className = "lesson-end";
    const draw = () => {
      const s = L.lesson(id);
      box.innerHTML = "";
      const note = document.createElement("div");
      note.className = "status-note";
      if (s.status === "done") {
        if (L.isDue(id)) {
          const b = btn("Повторил, отложить следующее повторение", "btn-primary");
          b.addEventListener("click", () => { const r = L.markReviewed(id); L.toast(r.nextReview ? "Следующий повтор " + L.fmtDate(r.nextReview) : "Тема закреплена"); draw(); });
          box.appendChild(b);
        }
        note.textContent = s.nextReview
          ? `Тема пройдена. Следующее повторение: ${L.fmtDate(s.nextReview)}.`
          : "Тема пройдена и закреплена повторениями.";
        const undo = btn("Вернуть в «в процессе»");
        undo.addEventListener("click", () => { L.markProgress(id); draw(); });
        box.append(note, undo);
      } else {
        const done = btn("Отметить пройденным", "btn-primary");
        done.addEventListener("click", () => { const r = L.markDone(id); L.toast("Отлично. Повтор " + L.fmtDate(r.nextReview)); draw(); });
        note.textContent = "Отметь, когда пройдёшь проверку. Сайт напомнит повторить тему через 1, 3, 7, 16 и 35 дней.";
        box.append(done, note);
      }
      const back = document.createElement("a");
      back.className = "btn";
      back.href = "./";
      back.textContent = "← В библиотеку";
      box.appendChild(back);
    };
    draw();
    return box;
  }
  function btn(text, cls) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-block " + (cls || "");
    b.textContent = text;
    return b;
  }

  function render(data) {
    document.title = data.title + " · Библиотека";
    root.innerHTML = "";
    const head = document.createElement("header");
    head.className = "lesson-head";
    const meta = [];
    if (data.minutes) meta.push(`${data.minutes} мин`);
    if (data.depth) meta.push(L.esc(data.depth));
    if (data.created) meta.push(new Date(data.created).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }));
    head.innerHTML = `<h1>${L.esc(data.title)}</h1><div class="lesson-meta">${meta.map(m => `<span>${m}</span>`).join("<span>·</span>")}</div>`;
    root.appendChild(head);

    if (data.assumptions && data.assumptions.length) {
      const a = document.createElement("div");
      a.className = "assume content";
      a.innerHTML = `<b>Допущения при подготовке урока</b><ul style="margin:6px 0 0">${data.assumptions.map(x => `<li>${L.inline(x)}</li>`).join("")}</ul>`;
      root.appendChild(a);
    }
    if (data.goal) {
      const g = document.createElement("div");
      g.className = "goal";
      g.innerHTML = `<b>Цель</b>${L.inline(data.goal)}`;
      root.appendChild(g);
    }

    const ctx = {
      onQuiz(correct, total) {
        const prev = L.lesson(id).quizBest || 0;
        if (correct > prev) L.updateLesson(id, { quizBest: correct, quizTotal: total });
      }
    };
    (data.blocks || []).forEach(b => {
      const node = L.renderBlock(b, ctx);
      if (node) root.appendChild(node);
    });
    root.appendChild(endBlock(data));

    if (params.get("review")) {
      const target = root.querySelector('[data-type="recall"], [data-type="flashcards"], [data-type="quiz"]');
      if (target) setTimeout(() => target.scrollIntoView({ behavior: "smooth", block: "start" }), 150);
      L.toast("Режим повторения: сначала вспомни, потом проверь себя");
    }
  }

  const bar = document.getElementById("progress");
  window.addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    bar.style.width = (h > 0 ? Math.min(100, (scrollY / h) * 100) : 0) + "%";
  }, { passive: true });

  const reader = L.readerPanel();
  document.getElementById("readerBtn").addEventListener("click", () => reader.open());

  if (!/^[a-z0-9-]{1,80}$/.test(id)) { fail("Урок не найден."); return; }
  L.fetchJSON("lessons/" + id + ".json")
    .then(data => { L.markOpened(id); render(data); })
    .catch(() => fail("Не получилось загрузить урок."));
})();
