// Quick print page (Bubbler 2.4.0): pick a competition, paste a roster, print.
import {
  PRESETS, parseQuickRoster, previousDigitsByName, buildRows, rowsToJobs,
  STATE_TEST_BY_ID, TOPIC_BLANK, TOPIC_NONE,
} from "./presets.js";
import { downloadScantronPdf } from "./pdf.js";
import { extractPdfText } from "./pdf-import.js";

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(`famatQuick.${k}`); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`famatQuick.${k}`, v); } catch { /* private mode */ } },
};

let rows = [];
let lastPicked = null;
// topicChoice[round][division] = test id, TOPIC_BLANK or TOPIC_NONE (remembered per computer).
let topicChoice = {};
try { topicChoice = JSON.parse(store.get("topics") ?? "{}") ?? {}; } catch { topicChoice = {}; }

function preset() { return PRESETS[$("preset").value]; }

function showLastYearText() {
  const p = preset();
  $("lastYearSummary").textContent = p.lastYearSummary ?? "Optional: last year's roster";
  $("lastYearHint").textContent = p.lastYearHint ?? "";
}

for (const p of Object.values(PRESETS)) {
  $("preset").append(new Option(p.label, p.id));
}
$("preset").value = store.get("preset") && PRESETS[store.get("preset")] ? store.get("preset") : Object.keys(PRESETS)[0];
$("school").value = store.get("school") ?? "";
showLastYearText();
$("preset").addEventListener("change", () => {
  store.set("preset", $("preset").value);
  showLastYearText();
  if (rows.length) readRoster();
});
$("school").addEventListener("input", () => store.set("school", $("school").value.trim()));

async function fileText(file) {
  if (/\.pdf$/i.test(file.name)) return extractPdfText(await file.arrayBuffer(), window.FAMAT_PDFJS_PATHS);
  return file.text();
}
$("rosterFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $("roster").value += ($("roster").value ? "\n" : "") + (await fileText(f));
  readRoster();
});
$("lastYearFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  $("lastYear").value += ($("lastYear").value ? "\n" : "") + (await fileText(f));
  if (rows.length) readRoster();
});
$("lastYear").addEventListener("change", () => { if (rows.length) readRoster(); });
$("read").addEventListener("click", readRoster);
$("addRow").addEventListener("click", () => {
  rows.push({ name: "", id: "", eligible: false, pile: null, choices: [], reason: "Type a name and 9-digit ID", prevDigits: [] });
  render();
  const cells = $("rows").lastElementChild?.querySelectorAll("td.edit");
  cells?.[0]?.focus();
});
$("make").addEventListener("click", makePdf);

function readRoster() {
  const p = preset();
  const { schoolName, students } = parseQuickRoster($("roster").value, { teamDigit: p.teamDigit });
  if (schoolName && !$("school").value.trim()) {
    $("school").value = schoolName;
    store.set("school", schoolName);
  }
  const lastYear = $("lastYear").value.trim() ? previousDigitsByName($("lastYear").value) : new Map();
  const rank = (r) => (!r.eligible ? 999 : !r.pile ? -1 : Math.max(0, p.pileOrder.indexOf(r.pile)));
  rows = buildRows(p, students, lastYear).sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  render();
  if (students.length === 0) setStatus("No students found. Paste the roster lines that include the IDs.");
  else setStatus("");
}

function render() {
  const p = preset();
  const tbody = $("rows");
  tbody.replaceChildren();
  // Clean table like the original Bubbler: Name | FAMAT ID | Test | Delete.
  // Name and ID are editable in place; Delete greys the row out (click again to restore).
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    const pick = document.createElement("td"); pick.className = "pick";
    const box = document.createElement("input"); box.type = "checkbox"; box.checked = Boolean(r.sel);
    box.setAttribute("aria-label", `Select ${r.name}`);
    box.addEventListener("click", (e) => {
      if (e.shiftKey && lastPicked !== null) {
        const [a, b] = [Math.min(lastPicked, i), Math.max(lastPicked, i)];
        for (let k = a; k <= b; k += 1) rows[k].sel = box.checked;
      } else r.sel = box.checked;
      lastPicked = i;
      render();
    });
    pick.append(box);
    if (r.sel) tr.classList.add("sel");
    if (r.off || !r.eligible) tr.classList.add("out");
    else if (!r.pile) tr.classList.add("need");
    tr.title = r.reason ?? "";
    const name = document.createElement("td");
    name.contentEditable = "true"; name.className = "edit"; name.textContent = r.name;
    name.addEventListener("blur", () => { r.name = name.textContent.trim(); });
    const id = document.createElement("td");
    id.contentEditable = "true"; id.className = "edit mono"; id.textContent = r.id;
    id.addEventListener("blur", () => {
      const v = id.textContent.replace(/\D/g, "");
      if (v === r.id) return;
      if (v.length !== 9) { id.textContent = r.id; setStatus("A FAMAT ID has 9 digits."); return; }
      const fresh = { name: r.name, id: p.teamDigit == null ? v : v.slice(0, 8) + p.teamDigit, prevDigits: r.prevDigits ?? [] };
      Object.assign(r, { choices: [], topicsFor: undefined }, fresh, p.assign(fresh.id, fresh.prevDigits));
      render();
    });
    const test = document.createElement("td");
    if (r.choices.length && r.eligible && !r.off) {
      const sel = document.createElement("select");
      sel.append(new Option("Choose...", ""));
      r.choices.forEach((c) => sel.append(new Option(c, c)));
      sel.value = r.pile ?? "";
      sel.addEventListener("change", () => { r.pile = sel.value || null; r.reason = r.pile ? "Chosen by you" : r.reason; render(); });
      test.append(sel);
    } else {
      test.textContent = r.eligible ? (r.pile ?? "") : "Not printed";
    }
    const del = document.createElement("td"); del.className = "del";
    const x = document.createElement("button"); x.className = "x";
    x.title = r.off ? "Put back" : "Leave out"; x.textContent = r.off ? "↺" : "✕";
    x.addEventListener("click", () => { r.off = !r.off; render(); });
    del.append(x);
    tr.append(pick, name, id, test, del);
    tbody.append(tr);
  });

  renderBulk(p);
  const counts = new Map(p.pileOrder.map((k) => [k, 0]));
  rows.forEach((r) => { if (!r.off && r.eligible && r.pile) counts.set(r.pile, (counts.get(r.pile) ?? 0) + 1); });
  $("summary").replaceChildren(...[...counts].map(([k, n]) => {
    const s = document.createElement("span"); s.className = "chip"; s.innerHTML = `${k}: <b>${n}</b>`; return s;
  }));
  const need = rows.filter((r) => !r.off && r.eligible && !r.pile).length;
  const out = rows.filter((r) => r.off || !r.eligible).length;
  const msgs = [];
  if (need) msgs.push(p.sheets
    ? `Choose the Individual for ${need} student${need > 1 ? "s" : ""} (highlighted).`
    : `Choose a Dostal pile for ${need} Statistics student${need > 1 ? "s" : ""} (highlighted).`);
  if (out) msgs.push(`${out} student${out > 1 ? "s" : ""} won't be printed (crossed out).`);
  renderTopics(p);
  const mismatched = p.sheets
    ? rows.filter((r) => !r.off && r.eligible && r.pile && p.sheets(r, topicChoice).some((s) => s.mismatch)).length : 0;
  if (mismatched) msgs.push(`${mismatched} student${mismatched > 1 ? "s" : ""} can't take a chosen topic test (previous-year rule); they get a name-and-ID sheet for that round.`);
  $("needs").hidden = msgs.length === 0;
  $("needs").textContent = msgs.join(" ");
  const total = p.sheets ? rowsToJobs(p, rows, "x", topicChoice).length : [...counts.values()].reduce((a, b) => a + b, 0);
  $("reviewCard").hidden = rows.length === 0;
  $("printCard").hidden = rows.length === 0;
  $("make").disabled = need > 0 || total === 0;
  $("make").textContent = need > 0 ? `Choose ${need} pile${need > 1 ? "s" : ""} first` : `Make ${total} scantron${total === 1 ? "" : "s"}`;
  $("printNote").textContent = p.printNote ?? "";
}

/** One Round 1 / Round 2 picker per Individual division present in the list. */
function renderTopics(p) {
  const box = $("topics");
  const grid = $("topicGrid");
  grid.replaceChildren();
  const groups = new Map(); // individual test name -> division key + union of allowed topic ids
  if (p.topicRounds) {
    for (const r of rows) {
      if (r.off || !r.eligible || !r.pile) continue;
      const ind = [...STATE_TEST_BY_ID.values()].find((t) => t.group === "individual" && t.name === r.pile);
      if (!ind) continue;
      const g = groups.get(ind.name) ?? { division: ind.division, count: 0, allowed: {} };
      g.count += 1;
      const topics = r.topicsFor ? r.topicsFor(ind) : {};
      for (const { group } of p.topicRounds) {
        g.allowed[group] ??= new Set();
        (topics[group] ?? []).forEach((id) => g.allowed[group].add(id));
      }
      groups.set(ind.name, g);
    }
  }
  box.hidden = groups.size === 0;
  const ordered = [...groups].sort((a, b) => p.pileOrder.indexOf(a[0]) - p.pileOrder.indexOf(b[0]));
  for (const [name, g] of ordered) {
    const row = document.createElement("div"); row.className = "topic-row";
    const label = document.createElement("b"); label.textContent = `${name} (${g.count})`;
    row.append(label);
    for (const { group, label: roundLabel } of p.topicRounds) {
      const lab = document.createElement("label"); lab.textContent = `${roundLabel.replace(" topic test", "")} `;
      const sel = document.createElement("select");
      sel.append(new Option("Name and ID only", TOPIC_BLANK), new Option("No sheet", TOPIC_NONE));
      [...(g.allowed[group] ?? [])].map((id) => STATE_TEST_BY_ID.get(id)).filter(Boolean)
        .forEach((t) => sel.append(new Option(`${t.name} (${t.code})`, t.id)));
      const current = topicChoice[group]?.[g.division] ?? TOPIC_BLANK;
      sel.value = [...sel.options].some((o) => o.value === current) ? current : TOPIC_BLANK;
      sel.addEventListener("change", () => {
        topicChoice[group] = { ...(topicChoice[group] ?? {}), [g.division]: sel.value };
        store.set("topics", JSON.stringify(topicChoice));
        render();
      });
      lab.append(sel);
      row.append(lab);
    }
    grid.append(row);
  }
}

/* ---- Tick several students, then change or delete them together ---- */
function renderBulk(p) {
  const picked = rows.filter((r) => r.sel);
  const all = $("pickAll");
  all.checked = rows.length > 0 && picked.length === rows.length;
  all.indeterminate = picked.length > 0 && picked.length < rows.length;
  $("bulk").hidden = picked.length === 0;
  $("bulkCount").textContent = `${picked.length} selected`;
  const sel = $("bulkTest");
  const keep = sel.value;
  sel.replaceChildren(new Option("Set test to...", ""), ...p.pileOrder.map((t) => new Option(t, t)));
  sel.value = p.pileOrder.includes(keep) ? keep : "";
}

function applyTest(p, test) {
  let changed = 0, skipped = 0;
  for (const r of rows.filter((x) => x.sel)) {
    const ok = r.eligible && (p.sheets ? (r.allowedPiles ?? []).includes(test) : true);
    if (!ok) { skipped += 1; continue; }
    r.pile = test; r.reason = "Set by you"; r.off = false; changed += 1;
  }
  setStatus(`${test}: set for ${changed} student${changed === 1 ? "" : "s"}` +
    (skipped ? `; ${skipped} not allowed to take it, left as they were.` : "."));
}

$("pickAll").addEventListener("change", () => { rows.forEach((r) => { r.sel = $("pickAll").checked; }); lastPicked = null; render(); });
$("bulkTest").addEventListener("change", () => {
  if (!$("bulkTest").value) return;
  applyTest(preset(), $("bulkTest").value); $("bulkTest").value = ""; render();
});
$("bulkOut").addEventListener("click", () => { rows.forEach((r) => { if (r.sel) r.off = true; }); render(); });
$("bulkIn").addEventListener("click", () => { rows.forEach((r) => { if (r.sel) r.off = false; }); render(); });
$("bulkDelete").addEventListener("click", () => {
  const n = rows.filter((r) => r.sel).length;
  rows = rows.filter((r) => !r.sel); lastPicked = null;
  setStatus(`Deleted ${n} student${n === 1 ? "" : "s"} from the list. Read the roster again to bring them back.`);
  render();
});
$("bulkClear").addEventListener("click", () => { rows.forEach((r) => { r.sel = false; }); lastPicked = null; render(); });

function setStatus(t) { $("status").textContent = t; }

async function makePdf() {
  const p = preset();
  const school = $("school").value.trim();
  if (!school) { setStatus("Enter the school name first."); $("school").focus(); return; }
  const jobs = rowsToJobs(p, rows, school, topicChoice);
  const safe = school.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  try {
    setStatus("Making the PDF...");
    await downloadScantronPdf({ jobs, filename: `${safe}-${p.filenamePrefix}-${p.testDate}.pdf` });
    setStatus(`Done: ${jobs.length} pages, in pile order. Print one page first to check it.`);
  } catch (err) {
    setStatus(`Could not make the PDF: ${err.message}`);
  }
}
