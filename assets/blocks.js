/* Блоки урока. Каждый тип блока — функция (данные, контекст) → DOM-элемент.
   Новый тип добавляется сюда; неизвестный тип просто пропускается, поэтому старые уроки не ломаются. */
(function () {
  const L = window.Learn;

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function widget(label) {
    const w = el("div", "widget");
    if (label) w.appendChild(el("div", "widget-label", L.esc(label)));
    return w;
  }
  function button(text, cls) {
    const b = el("button", "btn " + (cls || ""));
    b.type = "button";
    b.textContent = text;
    return b;
  }

  const CALLOUT = {
    note: "Важно",
    example: "Пример",
    analogy: "Аналогия",
    warning: "Частая ошибка",
    tip: "Совет"
  };

  const B = {};

  B.text = b => el("div", "content", L.md(b.md));

  B.heading = b => el("div", "content", `<h2>${L.inline(b.text)}</h2>`);

  B.callout = b => {
    const kind = CALLOUT[b.kind] ? b.kind : "note";
    const c = el("div", "callout content " + kind);
    c.innerHTML = `<div class="callout-title">${L.esc(b.title || CALLOUT[kind])}</div>${L.md(b.md)}`;
    return c;
  };

  B.figure = b => {
    const f = el("figure", "figure");
    f.style.margin = "0";
    if (b.svg) f.insertAdjacentHTML("beforeend", b.svg);
    else if (b.src) { const img = el("img"); img.src = b.src; img.alt = b.alt || ""; img.loading = "lazy"; f.appendChild(img); }
    if (b.caption) f.appendChild(el("figcaption", "", L.inline(b.caption)));
    return f;
  };

  B.table = b => {
    const wrap = el("div");
    const t = el("div", "table-wrap");
    const head = (b.head || []).map(h => `<th>${L.inline(h)}</th>`).join("");
    const rows = (b.rows || []).map(r => "<tr>" + r.map(c => `<td>${L.inline(c)}</td>`).join("") + "</tr>").join("");
    t.innerHTML = `<table>${head ? `<thead><tr>${head}</tr></thead>` : ""}<tbody>${rows}</tbody></table>`;
    wrap.appendChild(t);
    if (b.caption) wrap.appendChild(el("div", "caption", L.inline(b.caption)));
    return wrap;
  };

  B.terms = b => {
    const dl = el("dl", "terms");
    dl.style.margin = "0";
    (b.items || []).forEach(i => dl.appendChild(el("div", "term", `<dt>${L.inline(i.term)}</dt><dd>${L.inline(i.def)}</dd>`)));
    return dl;
  };

  B.reveal = b => {
    const w = widget(b.label || "Подумай, потом открой");
    w.appendChild(el("div", "content", L.md(b.question)));
    const ans = el("div", "reveal-answer content hidden", L.md(b.answer));
    const btn = button("Показать ответ");
    btn.addEventListener("click", () => { ans.classList.remove("hidden"); btn.remove(); });
    w.append(btn, ans);
    return w;
  };

  B.steps = b => {
    const w = widget(b.title || "По шагам");
    const items = b.items || [];
    const ol = el("ol", "steps-list content");
    w.appendChild(ol);
    let shown = 0;
    const row = el("div", "widget-row");
    const next = button("Дальше", "btn-primary");
    const all = button("Показать все");
    const add = () => {
      const i = items[shown++];
      ol.appendChild(el("li", "", `${i.title ? `<b class="step-title">${L.inline(i.title)}</b>` : ""}${L.md(i.md)}`));
      if (shown >= items.length) row.remove();
    };
    next.addEventListener("click", add);
    all.addEventListener("click", () => { while (shown < items.length) add(); });
    row.append(next, all);
    w.appendChild(row);
    if (items.length) add();
    return w;
  };

  B.tabs = b => {
    const w = widget(b.title || null);
    const bar = el("div", "tabs-bar");
    bar.setAttribute("role", "tablist");
    const body = el("div", "content");
    const items = b.items || [];
    const select = i => {
      bar.querySelectorAll(".tab").forEach((t, k) => t.setAttribute("aria-selected", String(k === i)));
      body.innerHTML = L.md(items[i].md);
    };
    items.forEach((it, i) => {
      const t = el("button", "tab");
      t.type = "button";
      t.setAttribute("role", "tab");
      t.textContent = it.label;
      t.addEventListener("click", () => select(i));
      bar.appendChild(t);
    });
    w.append(bar, body);
    if (items.length) select(0);
    return w;
  };

  B.flashcards = b => {
    const cards = b.cards || [];
    const w = widget(b.title || "Карточки: вспомни, потом переверни");
    let i = 0, back = false;
    const card = el("div", "flash-card");
    const nav = el("div", "flash-nav");
    const prev = button("←"), next = button("→");
    const count = el("span");
    nav.append(prev, count, next);
    const show = () => {
      const c = cards[i];
      card.classList.toggle("back", back);
      card.innerHTML = `<div>${L.inline(back ? c.back : c.front)}</div>`;
      count.textContent = `${i + 1} из ${cards.length} · ${back ? "ответ" : "нажми, чтобы перевернуть"}`;
    };
    card.addEventListener("click", () => { back = !back; show(); });
    prev.addEventListener("click", () => { i = (i - 1 + cards.length) % cards.length; back = false; show(); });
    next.addEventListener("click", () => { i = (i + 1) % cards.length; back = false; show(); });
    w.append(card, nav);
    if (cards.length) show();
    return w;
  };

  B.quiz = (b, ctx) => {
    const qs = b.questions || [];
    const w = widget(b.title || "Мини-проверка");
    let answered = 0, correct = 0;
    const score = el("div", "score hidden");
    qs.forEach((q, qi) => {
      const box = el("div", "q");
      box.appendChild(el("div", "q-text", `${qi + 1}. ${L.inline(q.q)}`));
      const opts = q.options.map((o, oi) => {
        const btn = el("button", "opt", L.inline(o));
        btn.type = "button";
        btn.addEventListener("click", () => {
          answered++;
          const ok = oi === q.answer;
          if (ok) correct++;
          opts.forEach((x, k) => { x.disabled = true; if (k === q.answer) x.classList.add("correct"); });
          if (!ok) btn.classList.add("wrong");
          if (q.explain) box.appendChild(el("div", "explain", (ok ? "Верно. " : "Неверно. ") + L.inline(q.explain)));
          if (answered === qs.length) {
            score.classList.remove("hidden");
            score.textContent = `Результат: ${correct} из ${qs.length}`;
            if (ctx && ctx.onQuiz) ctx.onQuiz(correct, qs.length);
          }
        });
        box.appendChild(btn);
        return btn;
      });
      w.appendChild(box);
    });
    w.appendChild(score);
    return w;
  };

  B.recall = b => {
    const w = widget(b.label || "Объясни своими словами");
    w.classList.add("recall");
    w.appendChild(el("div", "content", L.md(b.prompt)));
    const ta = el("textarea");
    ta.placeholder = "Напиши ответ, не подглядывая выше";
    const row = el("div", "widget-row");
    const check = button("Сравнить с образцом", "btn-primary");
    const ans = el("div", "reveal-answer hidden");
    ans.innerHTML = `<div class="widget-label">Образец</div><div class="content">${L.md(b.answer)}</div>
      <div class="muted sans" style="font-size:14px;margin-top:6px">Насколько твой ответ совпал по смыслу?</div>
      <div class="self-check">
        <button class="chip" type="button">Всё понял</button>
        <button class="chip" type="button">Частично</button>
        <button class="chip" type="button">Не смог</button>
      </div>`;
    ans.querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => {
      ans.querySelectorAll(".chip").forEach(x => x.setAttribute("aria-pressed", String(x === c)));
    }));
    check.addEventListener("click", () => {
      if (!ta.value.trim() && !confirm("Ответ пустой. Всё равно показать образец?")) return;
      ans.classList.remove("hidden");
      row.remove();
    });
    if (b.hint) {
      const hint = button("Подсказка");
      hint.addEventListener("click", () => { L.toast(b.hint); });
      row.append(check, hint);
    } else row.append(check);
    w.append(ta, row, ans);
    return w;
  };

  B.order = b => {
    const right = b.items || [];
    const w = widget(b.label || "Расставь по порядку");
    w.appendChild(el("div", "content", L.md(b.prompt || "Нажимай на пункты в правильном порядке.")));
    const answer = el("div", "order-answer");
    const pool = el("div", "order-pool");
    const row = el("div", "widget-row");
    const check = button("Проверить", "btn-primary");
    const reset = button("Сначала");
    const result = el("div", "score hidden");
    let picked = [];
    const draw = () => {
      answer.innerHTML = ""; pool.innerHTML = "";
      picked.forEach(i => answer.appendChild(item(i, true)));
      order.filter(i => !picked.includes(i)).forEach(i => pool.appendChild(item(i, false)));
      check.disabled = picked.length !== right.length;
    };
    const item = (i, inAnswer) => {
      const btn = el("button", "order-item", L.inline(right[i]));
      btn.type = "button";
      btn.addEventListener("click", () => {
        picked = inAnswer ? picked.filter(x => x !== i) : picked.concat(i);
        result.classList.add("hidden");
        draw();
      });
      return btn;
    };
    let order = L.shuffle(right.map((_, i) => i));
    check.addEventListener("click", () => {
      let ok = 0;
      [...answer.children].forEach((c, pos) => {
        const good = picked[pos] === pos;
        if (good) ok++;
        c.classList.add(good ? "correct" : "wrong");
      });
      result.classList.remove("hidden");
      result.textContent = ok === right.length ? "Всё верно" : `На своём месте ${ok} из ${right.length}. Подумай и попробуй ещё.`;
    });
    reset.addEventListener("click", () => { picked = []; order = L.shuffle(order); result.classList.add("hidden"); draw(); });
    row.append(check, reset);
    w.append(answer, pool, row, result);
    draw();
    return w;
  };

  B.summary = b => {
    const s = el("div", "summary content");
    s.id = "summary";
    s.innerHTML = `<h2>${L.esc(b.title || "Итог")}</h2><ol>${(b.points || []).map(p => `<li>${L.inline(p)}</li>`).join("")}</ol>` +
      ((b.next && b.next.length) ? `<div class="next-list"><b class="sans" style="font-size:15px">Что изучить дальше</b><ul>${b.next.map(n => `<li>${L.inline(n)}</li>`).join("")}</ul></div>` : "");
    return s;
  };

  L.blocks = B;
  L.renderBlock = function (b, ctx) {
    const fn = B[b && b.type];
    if (!fn) { console.warn("Неизвестный тип блока:", b && b.type); return null; }
    try {
      const node = fn(b, ctx);
      const wrap = el("section", "block");
      wrap.dataset.type = b.type;
      wrap.appendChild(node);
      return wrap;
    } catch (e) {
      console.error("Ошибка блока", b, e);
      return null;
    }
  };
})();
