// Quick print page (Bubbler 2.4.0): pick a competition, paste a roster, print.
import {
  PRESETS, parseQuickRoster, previousDigitsByName, buildRows, mergeRoster, rowsToJobs,
  applyBulkTest, tickRange, stateSheetGaps, nameKey,
  STATE_TEST_BY_ID, STATE_ROUNDS, TOPIC_BLANK, TOPIC_NONE,
} from "./presets.js";
import { downloadScantronPdf } from "./pdf.js";
import { extractPdfText } from "./pdf-import.js";

const $ = (id) => document.getElementById(id);
const store = {
  get(k) { try { return localStorage.getItem(`famatQuick.${k}`); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(`famatQuick.${k}`, v); } catch { /* private mode */ } },
};
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The one editable list. Every change (re-read, competition, last year's roster)
// is recomputed from these rows, so names, IDs, piles set by hand and students
// left out or typed in survive.
let rows = [];
let lastPicked = null;
let pendingSchool = null; // roster's school name when it differs from the saved one
// topicChoice[round][division] = test id, TOPIC_BLANK or TOPIC_NONE (remembered per computer).
let topicChoice = {};
try { topicChoice = JSON.parse(store.get("topics") ?? "{}") ?? {}; } catch { topicChoice = {}; }
const choseThisVisit = new Set(); // "round|division" picked on this visit (others are remembered)
// Regional: the host's three-digit code per test, typed for this competition only (not remembered).
let testCodes = {};

function preset() { return PRESETS[$("preset").value]; }
function lastYearMap() { return $("lastYear").value.trim() ? previousDigitsByName($("lastYear").value) : new Map(); }

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
  if (rows.length) { recompute(); sortRows(); render(); }
});
$("school").addEventListener("input", () => {
  store.set("school", $("school").value.trim());
  if (pendingSchool) { pendingSchool = null; $("schoolPick").hidden = true; render(); }
});

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
  if (rows.length) { recompute(); render(); }
});
$("lastYear").addEventListener("change", () => { if (rows.length) { recompute(); render(); } });
$("read").addEventListener("click", readRoster);
$("addRow").addEventListener("click", () => {
  rows.push({ typed: true, name: "", id: "", previousIds: [] });
  recompute();
  lastPicked = null;
  render();
  const cells = $("rows").lastElementChild?.querySelectorAll("td.edit");
  cells?.[0]?.focus();
  $("rows").lastElementChild?.scrollIntoView({ block: "nearest" });
});
$("make").addEventListener("click", makePdf);
$("schoolUseRoster").addEventListener("click", () => chooseSchool(pendingSchool));
$("schoolKeep").addEventListener("click", () => chooseSchool($("school").value.trim()));

function chooseSchool(name) {
  $("school").value = name;
  store.set("school", name);
  pendingSchool = null;
  $("schoolPick").hidden = true;
  render();
}

function recompute() {
  const p = preset();
  // Team IDs are only for competitions that use teams; the others print the No Team ID.
  if (!p.teams && p.teamDigit != null) {
    rows.forEach((r) => { if (/^\d{9}$/.test(r.id)) r.id = r.id.slice(0, 8) + p.teamDigit; });
  }
  rows = buildRows(p, rows, lastYearMap());
}

function sortRows() {
  const p = preset();
  // Highlighted rows first: a pile to choose, then a pile to check.
  const rank = (r) => (!r.eligible ? 999 : !r.pile ? -2 : r.check ? -1 : Math.max(0, p.pileOrder.indexOf(r.pile)));
  rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  lastPicked = null;
}

function readRoster() {
  const p = preset();
  const { schoolName, students, skipped } = parseQuickRoster($("roster").value, { teamDigit: p.teamDigit });
  const saved = $("school").value.trim();
  if (schoolName && !saved) {
    $("school").value = schoolName;
    store.set("school", schoolName);
  } else if (schoolName && nameKey(schoolName) !== nameKey(saved)) {
    pendingSchool = schoolName;
    $("schoolUseRoster").textContent = `Use "${schoolName}"`;
    $("schoolKeep").textContent = `Keep "${saved}"`;
    $("schoolPick").hidden = false;
  }
  const typedBefore = rows.filter((r) => !r.srcKey && r.typed).length;
  const { students: merged, kept } = mergeRoster(rows, students);
  rows = buildRows(p, merged, lastYearMap());
  sortRows();
  render();
  const parts = [];
  if (students.length === 0) parts.push("No students found. Paste the roster lines that include the 9-digit IDs.");
  else parts.push(`Read ${plural(students.length, "student")}.`);
  if (kept) parts.push(`Kept your changes to the ${plural(kept, "student")} already in the list.`);
  if (typedBefore) parts.push(`Kept ${plural(typedBefore, "student")} you added by hand.`);
  if (skipped) parts.push(`Skipped ${plural(skipped, "line")} with no name and 9-digit ID (headers are skipped too).`);
  $("readStatus").textContent = parts.join(" ");
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
      if (e.shiftKey && lastPicked !== null) tickRange(rows, lastPicked, i, box.checked);
      else r.sel = box.checked;
      lastPicked = i;
      render();
    });
    pick.append(box);
    if (r.sel) tr.classList.add("sel");
    if (r.off || !r.eligible) tr.classList.add("out");
    else if (!r.pile) tr.classList.add("need");
    else if (r.check) tr.classList.add("check");
    tr.title = r.reason ?? "";
    const name = document.createElement("td");
    name.contentEditable = "true"; name.className = "edit"; name.textContent = r.name;
    name.addEventListener("blur", () => {
      const v = name.textContent.trim();
      if (v === r.name) return;
      r.name = v; recompute(); render();
    });
    const id = document.createElement("td");
    id.contentEditable = "true"; id.className = "edit mono"; id.textContent = r.id;
    id.addEventListener("blur", () => {
      const v = id.textContent.replace(/\D/g, "");
      if (v === r.id) return;
      if (v.length !== 9) { id.textContent = r.id; setStatus("A FAMAT ID has 9 digits."); return; }
      r.id = p.teamDigit == null || (p.teams ?? []).includes(v[8]) ? v : v.slice(0, 8) + p.teamDigit;
      recompute(); render();
    });
    const test = document.createElement("td");
    if (r.choices.length && r.eligible && !r.off) {
      const sel = document.createElement("select");
      if (!r.pile) sel.append(new Option("Choose...", ""));
      r.choices.forEach((c) => sel.append(new Option(c, c)));
      sel.value = r.pile ?? "";
      sel.addEventListener("change", () => {
        Object.assign(r, { pile: sel.value || null, manualPile: sel.value || undefined, check: false });
        if (r.pile) r.reason = "Set by you";
        render();
      });
      test.append(sel);
    } else {
      test.textContent = r.eligible ? (r.pile ?? "") : r.id ? "Not printed" : "Type the ID";
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
  const live = rows.filter((r) => !r.off && r.eligible);
  const need = live.filter((r) => !r.pile).length;
  const statsCheck = live.filter((r) => r.pile && r.check && !r.dupName).length;
  const dupCheck = live.filter((r) => r.pile && r.dupName).length;
  const out = rows.filter((r) => r.off || !r.eligible).length;
  const msgs = [];
  if (need) msgs.push(p.sheets || p.chooseWhat
    ? `Choose ${p.chooseWhat ?? "the Individual"} for ${plural(need, "student")} (highlighted).`
    : `Choose a Dostal pile for ${plural(need, "Statistics student")} (highlighted).`);
  if (statsCheck) msgs.push(`${plural(statsCheck, "Statistics student")} start${statsCheck === 1 ? "s" : ""} in Dostal Precalculus. Switch to Dostal Calculus anyone who took Precalculus before or is taking Calculus now (highlighted; printing isn't blocked).`);
  if (dupCheck) msgs.push(`${plural(dupCheck, "student")} share${dupCheck === 1 ? "s" : ""} a name with another student, so last year's roster wasn't used for them. Check their test (highlighted).`);
  if (out) msgs.push(`${plural(out, "student")} won't be printed (crossed out).`);
  renderTopics(p);
  const badCodes = renderCodes(p, counts);
  if (badCodes.length) msgs.push(`A test code has 3 digits. Fix or clear the code for ${badCodes.join(", ")}.`);
  if (p.sheets) msgs.push(...gapMessages(p));
  $("needs").hidden = msgs.length === 0;
  $("needs").replaceChildren(...msgs.map((m) => { const d = document.createElement("div"); d.textContent = m; return d; }));
  const total = p.sheets ? rowsToJobs(p, rows, "x", topicChoice).length : [...counts.values()].reduce((a, b) => a + b, 0);
  $("reviewCard").hidden = rows.length === 0;
  $("printCard").hidden = rows.length === 0;
  $("make").disabled = need > 0 || total === 0 || Boolean(pendingSchool) || badCodes.length > 0;
  $("make").textContent = pendingSchool ? "Pick the school name first"
    : need > 0 ? `Choose ${plural(need, p.chooseWhat ? "test" : "pile")} first`
    : badCodes.length ? "Fix the test code first" : `Make ${plural(total, "scantron")}`;
  $("printNote").textContent = p.printNote ?? "";
}

/** Names list for a message: up to 5 names, then "and N more". */
function someNames(names) {
  // Names are "Last, First", so separate them with semicolons.
  return names.length <= 5 ? names.join("; ") : `${names.slice(0, 5).join("; ")} and ${names.length - 5} more`;
}

/** State: say who gets no test code or no sheet in each round, before printing. */
function gapMessages() {
  const gaps = stateSheetGaps(rows, topicChoice);
  const printed = rows.filter((r) => !r.off && r.eligible && r.pile).length;
  const msgs = [];
  for (const { group, label } of STATE_ROUNDS) {
    const g = gaps[group];
    const round = label.replace(" topic test", "");
    if (g.mismatch.length) msgs.push(`${round}: ${someNames(g.mismatch)} can't take the chosen test (previous-year rule), so they get a name-and-ID sheet with no test code.`);
    if (g.blank.length && g.blank.length === printed) msgs.push(`${round}: no sheet has a test code yet; students bubble it at the test, or pick the tests above.`);
    else if (g.blank.length) msgs.push(`${round}: ${plural(g.blank.length, "sheet")} will have no test code (${someNames(g.blank)}); students bubble it at the test.`);
    if (g.none.length) msgs.push(`${round}: no sheet for ${someNames(g.none)}.`);
  }
  return msgs;
}

/** One Round 1 / Round 2 picker per Individual division present in the list. */
function renderTopics(p) {
  const box = $("topics");
  const grid = $("topicGrid");
  grid.replaceChildren();
  const groups = new Map(); // individual test name -> division key, names, union of allowed topic ids
  if (p.topicRounds) {
    for (const r of rows) {
      if (r.off || !r.eligible || !r.pile) continue;
      const ind = [...STATE_TEST_BY_ID.values()].find((t) => t.group === "individual" && t.name === r.pile);
      if (!ind) continue;
      const g = groups.get(ind.name) ?? { division: ind.division, names: [], allowed: {} };
      g.names.push(r.name);
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
    const label = document.createElement("b"); label.textContent = `${name} (${g.names.length})`;
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
        choseThisVisit.add(`${group}|${g.division}`);
        store.set("topics", JSON.stringify(topicChoice));
        render();
      });
      lab.append(sel);
      if (sel.value !== TOPIC_BLANK && !choseThisVisit.has(`${group}|${g.division}`)) {
        const mem = document.createElement("span"); mem.className = "remembered";
        mem.textContent = "remembered from last time";
        lab.append(mem);
      }
      row.append(lab);
    }
    const who = document.createElement("div"); who.className = "who";
    who.textContent = someNames(g.names);
    row.append(who);
    grid.append(row);
  }
}

/**
 * Regional: one optional code box per test in the list. Blank prints no code
 * (students bubble it at the test). Returns the tests whose code is not 3 digits.
 */
function renderCodes(p, counts) {
  const box = $("codes");
  const grid = $("codeGrid");
  const present = p.testCodes ? [...counts].filter(([, n]) => n > 0).map(([k]) => k) : [];
  box.hidden = present.length === 0;
  const focused = document.activeElement?.dataset?.test;
  if (!grid.querySelector("input") || [...grid.querySelectorAll("input")].map((i) => i.dataset.test).join("|") !== present.join("|")) {
    grid.replaceChildren(...present.map((name) => {
      const lab = document.createElement("label"); lab.className = "code-row";
      lab.append(`${name} (${counts.get(name)}) `);
      const inp = document.createElement("input");
      inp.dataset.test = name; inp.inputMode = "numeric"; inp.maxLength = 3; inp.size = 4;
      inp.placeholder = "blank"; inp.value = testCodes[name] ?? "";
      inp.addEventListener("input", () => { testCodes[name] = inp.value.replace(/\D/g, ""); inp.value = testCodes[name]; });
      inp.addEventListener("change", render);
      lab.append(inp);
      return lab;
    }));
    if (focused) grid.querySelector(`input[data-test="${CSS.escape(focused)}"]`)?.focus();
  } else {
    for (const lab of grid.querySelectorAll("label")) {
      const inp = lab.querySelector("input");
      lab.firstChild.textContent = `${inp.dataset.test} (${counts.get(inp.dataset.test)}) `;
    }
  }
  return present.filter((name) => (testCodes[name] ?? "") !== "" && !/^\d{3}$/.test(testCodes[name]));
}

/* ---- Tick several students, then change or delete them together ---- */
function renderBulk(p) {
  const picked = rows.filter((r) => r.sel);
  const all = $("pickAll");
  all.checked = rows.length > 0 && picked.length === rows.length;
  all.indeterminate = picked.length > 0 && picked.length < rows.length;
  $("bulk").hidden = picked.length === 0;
  $("bulkCount").textContent = `${picked.length} selected`;
  $("bulkTeam").hidden = !p.teams;
  const sel = $("bulkTest");
  const keep = sel.value;
  sel.replaceChildren(new Option("Set test to...", ""), ...p.pileOrder.map((t) => new Option(t, t)));
  sel.value = p.pileOrder.includes(keep) ? keep : "";
}

$("pickAll").addEventListener("change", () => { rows.forEach((r) => { r.sel = $("pickAll").checked; }); lastPicked = null; render(); });
$("bulkTest").addEventListener("change", () => {
  const test = $("bulkTest").value;
  if (!test) return;
  const { changed, skipped } = applyBulkTest(rows, test);
  setStatus(`${test}: set for ${plural(changed, "student")}` +
    (skipped ? `; ${skipped} not allowed to take it, left as they were.` : "."));
  $("bulkTest").value = ""; render();
});
$("bulkTeam").addEventListener("change", () => {
  const team = $("bulkTeam").value;
  if (!team) return;
  let n = 0;
  rows.forEach((r) => { if (r.sel && /^\d{9}$/.test(r.id)) { r.id = r.id.slice(0, 8) + team; n += 1; } });
  recompute();
  setStatus(`${team === "0" ? "No Team" : `Team ${team}`}: set for ${plural(n, "student")}.`);
  $("bulkTeam").value = ""; render();
});
$("bulkOut").addEventListener("click", () => { rows.forEach((r) => { if (r.sel) r.off = true; }); render(); });
$("bulkIn").addEventListener("click", () => { rows.forEach((r) => { if (r.sel) r.off = false; }); render(); });
$("bulkDelete").addEventListener("click", () => {
  const n = rows.filter((r) => r.sel).length;
  rows = rows.filter((r) => !r.sel); lastPicked = null;
  recompute();
  setStatus(`Deleted ${plural(n, "student")} from the list. Read the roster again to bring them back.`);
  render();
});
$("bulkClear").addEventListener("click", () => { rows.forEach((r) => { r.sel = false; }); lastPicked = null; render(); });

function setStatus(t) { $("status").textContent = t; }

async function makePdf() {
  const p = preset();
  const school = $("school").value.trim();
  if (!school) { setStatus("Enter the school name first."); $("school").focus(); return; }
  const jobs = rowsToJobs(p, rows, school, topicChoice, testCodes);
  const safe = school.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const now = new Date();
  const date = p.testDate ?? [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  try {
    setStatus("Making the PDF...");
    await downloadScantronPdf({ jobs, filename: `${safe}-${p.filenamePrefix}-${date}.pdf` });
    setStatus(`Done: ${jobs.length} pages, in pile order. Print one page first to check it.`);
  } catch (err) {
    setStatus(`Could not make the PDF: ${err.message}`);
  }
}
