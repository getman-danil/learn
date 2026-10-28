// Проверка уроков перед публикацией: node tools/validate.mjs
// Проверяет каталог, файлы уроков и обязательные поля каждого блока.
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dir = join(root, "lessons");
const errors = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);

const REQUIRED = {
  text: ["md"],
  heading: ["text"],
  callout: ["md"],
  figure: [],
  table: ["rows"],
  terms: ["items"],
  reveal: ["question", "answer"],
  steps: ["items"],
  tabs: ["items"],
  flashcards: ["cards"],
  quiz: ["questions"],
  recall: ["prompt", "answer"],
  order: ["items"],
  summary: ["points"]
};

function read(path) {
  try { return JSON.parse(readFileSync(path, "utf8")); }
  catch (e) { err(path, "не читается как JSON: " + e.message); return null; }
}

const catalog = read(join(dir, "catalog.json"));
const ids = new Set();
if (catalog) {
  if (!Array.isArray(catalog.lessons)) err("catalog.json", "нет массива lessons");
  for (const item of catalog.lessons || []) {
    const w = `catalog.json[${item.id}]`;
    if (!/^[a-z0-9-]{1,80}$/.test(item.id || "")) err(w, "id только из a-z, 0-9 и дефиса");
    if (ids.has(item.id)) err(w, "повторяющийся id");
    ids.add(item.id);
    for (const k of ["title", "summary", "created"]) if (!item[k]) err(w, `нет поля ${k}`);
    if (!existsSync(join(dir, item.id + ".json"))) err(w, "нет файла урока");
  }
}

for (const f of readdirSync(dir)) {
  if (!f.endsWith(".json") || f === "catalog.json") continue;
  const id = f.replace(/\.json$/, "");
  const data = read(join(dir, f));
  if (!data) continue;
  if (data.id !== id) err(f, `id в файле (${data.id}) не совпадает с именем файла`);
  if (!ids.has(id)) err(f, "урок не добавлен в catalog.json");
  for (const k of ["title", "goal", "blocks"]) if (!data[k]) err(f, `нет поля ${k}`);
  (data.blocks || []).forEach((b, i) => {
    const w = `${f} блок ${i} (${b.type})`;
    if (!REQUIRED[b.type]) { err(w, "неизвестный тип блока"); return; }
    for (const k of REQUIRED[b.type]) if (b[k] == null) err(w, `нет поля ${k}`);
    if (b.type === "figure" && !b.svg && !b.src) err(w, "нужен svg или src");
    if (b.type === "figure" && b.svg && /<script|\son\w+=/i.test(b.svg)) err(w, "в svg нельзя скрипты и обработчики событий");
    if (b.type === "quiz") (b.questions || []).forEach((q, j) => {
      if (!q.q || !Array.isArray(q.options) || q.options.length < 2) err(w, `вопрос ${j}: нужен q и минимум 2 варианта`);
      else if (!(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < q.options.length)) err(w, `вопрос ${j}: answer вне диапазона`);
    });
    if (b.type === "summary" && (b.points || []).length !== 3) err(w, "в итоге должно быть ровно 3 пункта");
  });
  const types = (data.blocks || []).map(b => b.type);
  if (!types.includes("quiz")) err(f, "в уроке нет мини-теста (quiz)");
  if (!types.includes("recall")) err(f, "в уроке нет задания «объясни своими словами» (recall)");
  if (!types.includes("summary")) err(f, "в уроке нет итога (summary)");
}

if (errors.length) {
  console.error("Найдены ошибки:\n- " + errors.join("\n- "));
  process.exit(1);
}
console.log(`OK: уроков в каталоге ${ids.size}`);
