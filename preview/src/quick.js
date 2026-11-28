// Quick print page (Bubbler 2.4.0): pick a competition, paste a roster, print.
import {
  PRESETS, parseQuickRoster, previousDigitsByName, buildRows, mergeRoster, rowsToJobs,
  applyBulkTest, tickRange, stateSheetGaps, nameKey, regionalSecond, regionalSecondClash,
  STATE_TEST_BY_ID, STATE_ROUNDS, TOPIC_BLANK, stateTopic, topicGroupLabel,
} from "./presets.js";
import { downloadScantronPdf, describeCutText } from "./pdf.js";
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
// Regional: the host's three-digit code per test, typed for this competition only (not remembered).
let testCodes = {};
// Regional: Open tests the sponsor names for this competition: [{ key, name, code }].
// Who takes each one is kept on the rows (row.opens holds the keys). Not remembered.
let opens = [];
let openSeq = 0;

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
  // Clean table like the original Bubbler: Name | FAMAT ID | Test | Going.
  // Name and ID are editable in place; unticking Going greys the row out.
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
    // A student famat.org lists for two divisions can be switched to the other one.
    // State: every student gets the Individual menu when more than one is allowed.
    const options = r.choices.length ? r.choices
      : ((p.sheets || r.also?.length) && (r.allowedPiles ?? []).length > 1 ? r.allowedPiles : []);
    if (options.length && r.eligible && !r.off) {
      const sel = document.createElement("select");
      if (!r.pile) sel.append(new Option("Choose...", ""));
      options.forEach((c) => sel.append(new Option(c, c)));
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
    if (p.topicRounds && r.eligible && !r.off && r.pile) test.append(topicMenus(p, r));
    if (p.regionalSheets && r.eligible && !r.off && r.pile) {
      // Registered in two divisions the guide lets them take together: a second Individual.
      const second = regionalSecond(r);
      if (second) {
        const lab = document.createElement("label"); lab.className = "second";
        const tick = document.createElement("input"); tick.type = "checkbox"; tick.checked = !r.noSecond;
        tick.setAttribute("aria-label", `${r.name} also takes ${second.name}`);
        tick.addEventListener("change", () => { r.noSecond = !tick.checked; render(); });
        lab.append(tick, ` Also ${second.name}`);
        test.append(lab);
        if (!r.noSecond) {
          // Teams are per division: the second sheet's team digit is set on its own.
          const team = document.createElement("select"); team.className = "secondteam";
          team.setAttribute("aria-label", `Team for ${r.name}'s ${second.name} sheet`);
          [["0", "No Team"], ["1", "Team 1"], ["2", "Team 2"]].forEach(([v, t]) => team.append(new Option(t, v)));
          team.value = ["1", "2"].includes(String(r.secondTeam)) ? String(r.secondTeam) : "0";
          team.addEventListener("change", () => { r.secondTeam = team.value; render(); });
          lab.append(" ", team);
        }
      }
      const mine = opens.filter((o) => (r.opens ?? []).includes(o.key));
      if (mine.length) {
        const tag = document.createElement("span"); tag.className = "opentag";
        tag.textContent = `Open: ${mine.map(openName).join("; ")}`;
        test.append(tag);
      }
    }
    // Going: everyone starts ticked; untick a student who isn't competing.
    const del = document.createElement("td"); del.className = "del going";
    const going = document.createElement("input"); going.type = "checkbox"; going.checked = !r.off;
    going.setAttribute("aria-label", `${r.name} is going`);
    going.title = r.off ? "Not going: no scantron" : "Going: gets a scantron";
    going.addEventListener("change", () => { r.off = !going.checked; render(); });
    del.append(going);
    tr.append(pick, name, id, test, del);
    tbody.append(tr);
  });

  renderBulk(p);
  const counts = new Map(p.pileOrder.map((k) => [k, 0]));
  // Regional counts every sheet (second Individuals and Opens too); others count students.
  const regionalJobs = p.regionalSheets ? rowsToJobs(p, rows, "x", {}, testCodes, opens) : null;
  if (regionalJobs) regionalJobs.forEach((j) => { if (counts.has(j.testName)) counts.set(j.testName, counts.get(j.testName) + 1); });
  else rows.forEach((r) => { if (!r.off && r.eligible && r.pile) counts.set(r.pile, (counts.get(r.pile) ?? 0) + 1); });
  const chips = [...counts];
  if (regionalJobs) opens.forEach((o) => chips.push([openName(o), openTakers(o).length]));
  $("summary").replaceChildren(...chips.map(([k, n]) => {
    const s = document.createElement("span"); s.className = "chip"; s.append(`${k}: `);
    const b = document.createElement("b"); b.textContent = String(n); s.append(b); return s;
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
  if (out) msgs.push(`${plural(out, "student")} won't get a scantron (not going, or no ID; crossed out).`);
  if (regionalJobs) {
    const two = live.filter((r) => r.pile && regionalSecond(r));
    const both = two.filter((r) => !r.noSecond).length;
    if (two.length) msgs.push(`${plural(two.length, "student")} registered in two divisions can take both Individuals; ${both} will get both sheets. Untick "Also ..." under the test to print only one.`);
    const clash = two.filter((r) => !r.noSecond && regionalSecondClash(r));
    if (clash.length) msgs.push(`${someNames(clash.map((r) => r.name))}: both Individuals are in the same round of the regional schedule. Check that this competition allows it.`);
    const unused = opens.filter((o) => openTakers(o).length === 0);
    if (unused.length) msgs.push(`No student has ${unused.map(openName).join("; ")} yet. Tick students, then press Give to ticked.`);
  }
  $("topics").hidden = true;
  const badCodes = [...renderCodes(p, counts), ...renderOpens(p)];
  if (badCodes.length) msgs.push(`A test code has 3 digits. Fix or clear the code for ${badCodes.join(", ")}.`);
  if (p.sheets) msgs.push(...gapMessages(p));
  $("needs").hidden = msgs.length === 0;
  $("needs").replaceChildren(...msgs.map((m) => { const d = document.createElement("div"); d.textContent = m; return d; }));
  const total = regionalJobs ? regionalJobs.length
    : p.sheets ? rowsToJobs(p, rows, "x").length : [...counts.values()].reduce((a, b) => a + b, 0);
  $("reviewCard").hidden = rows.length === 0;
  $("printCard").hidden = rows.length === 0;
  $("make").disabled = need > 0 || total === 0 || Boolean(pendingSchool) || badCodes.length > 0;
  $("make").textContent = pendingSchool ? "Pick the school name first"
    : need > 0 ? `Choose ${plural(need, p.chooseWhat ? "test" : "pile")} first`
    : badCodes.length ? "Fix the test code first" : `Make ${plural(total, "scantron")}`;
  $("printNote").textContent = p.printNote ?? "";
}

/** State: this student's Round 1 and Round 2 menus, limited to the tests they may take. */
function topicMenus(p, r) {
  const box = document.createElement("div"); box.className = "rounds";
  for (const { group, label } of p.topicRounds) {
    const lab = document.createElement("label");
    lab.textContent = `${label.replace(" topic test", "")} `;
    const sel = document.createElement("select");
    sel.setAttribute("aria-label", `${label} for ${r.name}`);
    let og = null, lastDiv = null;
    for (const id of r.topicOptions?.[group] ?? []) {
      const t = STATE_TEST_BY_ID.get(id);
      if (!t) continue;
      if (t.division !== lastDiv) {
        og = document.createElement("optgroup"); og.label = topicGroupLabel(t.division);
        sel.append(og); lastDiv = t.division;
      }
      og.append(new Option(`${t.code} ${t.name}`, t.id));
    }
    sel.append(new Option("Leave the test code blank", TOPIC_BLANK));
    const current = stateTopic(r, group);
    sel.value = [...sel.options].some((o) => o.value === current) ? current : TOPIC_BLANK;
    sel.addEventListener("change", () => {
      r.topics = { ...(r.topics ?? {}), [group]: sel.value };
      render();
    });
    lab.append(sel);
    box.append(lab);
  }
  return box;
}

/** Names list for a message: up to 5 names, then "and N more". */
function someNames(names) {
  // Names are "Last, First", so separate them with semicolons.
  return names.length <= 5 ? names.join("; ") : `${names.slice(0, 5).join("; ")} and ${names.length - 5} more`;
}

/** State: say who gets no test code or no sheet in each round, before printing. */
function gapMessages() {
  const gaps = stateSheetGaps(rows);
  const printed = rows.filter((r) => !r.off && r.eligible && r.pile).length;
  const msgs = [];
  for (const { group, label } of STATE_ROUNDS) {
    const g = gaps[group];
    const round = label.replace(" topic test", "");
    if (g.mismatch.length) msgs.push(`${round}: ${someNames(g.mismatch)} can't take the chosen test (previous-year rule), so they get a name-and-ID sheet with no test code.`);
    if (g.blank.length && g.blank.length === printed) msgs.push(`${round}: no sheet has a test code yet; students bubble it at the test, or pick each student's test in the list.`);
    else if (g.blank.length) msgs.push(`${round}: ${plural(g.blank.length, "sheet")} will have no test code (${someNames(g.blank)}); students bubble it at the test.`);
    if (g.none.length) msgs.push(`${round}: no sheet for ${someNames(g.none)}.`);
  }
  return msgs;
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

/* ---- Regional Open tests: named by the sponsor, given to ticked students ---- */
function openName(o) { return o.name.trim() || `Open test ${opens.indexOf(o) + 1}`; }
function openTakers(o) { return rows.filter((r) => !r.off && r.eligible && r.pile && (r.opens ?? []).includes(o.key)); }

/** Draw the Open tests list. Returns the Opens whose code is not 3 digits. */
function renderOpens(p) {
  $("opens").hidden = !p.regionalSheets || rows.length === 0;
  if ($("opens").hidden) return [];
  const list = $("openList");
  const keys = opens.map((o) => o.key).join("|");
  if (list.dataset.keys !== keys) {
    list.dataset.keys = keys;
    list.replaceChildren(...opens.map((o) => {
      const row = document.createElement("div"); row.className = "open-row"; row.dataset.key = o.key;
      const name = document.createElement("input"); name.className = "oname"; name.value = o.name;
      name.placeholder = "Name, e.g. Geometry Open"; name.setAttribute("aria-label", "Open test name");
      name.addEventListener("input", () => { o.name = name.value; });
      name.addEventListener("change", render);
      const code = document.createElement("input"); code.className = "ocode"; code.value = o.code;
      code.inputMode = "numeric"; code.maxLength = 3; code.placeholder = "code";
      code.setAttribute("aria-label", "Open test code (optional)");
      code.addEventListener("input", () => { o.code = code.value.replace(/\D/g, ""); code.value = o.code; });
      code.addEventListener("change", render);
      const count = document.createElement("span"); count.className = "ocount";
      const give = button("Give to ticked", () => setOpen(o, (r) => r.sel, true));
      const take = button("Take from ticked", () => setOpen(o, (r) => r.sel, false));
      const all = button("Everyone going", () => setOpen(o, () => true, true));
      const del = button("Remove", () => {
        opens = opens.filter((x) => x !== o);
        rows.forEach((r) => { if (r.opens) r.opens = r.opens.filter((k) => k !== o.key); });
        render();
      });
      del.className = "danger";
      row.append(name, code, count, give, take, all, del);
      return row;
    }));
  }
  for (const row of list.children) {
    const o = opens.find((x) => x.key === row.dataset.key);
    row.querySelector(".ocount").textContent = plural(openTakers(o).length, "student");
  }
  return opens.filter((o) => o.code !== "" && !/^\d{3}$/.test(o.code)).map(openName);
}

function button(text, onClick) {
  const b = document.createElement("button"); b.type = "button"; b.textContent = text;
  b.addEventListener("click", onClick);
  return b;
}

function setOpen(o, which, on) {
  let n = 0;
  rows.forEach((r) => {
    if (r.off || !r.eligible || !r.pile || !which(r)) return;
    const has = (r.opens ?? []).includes(o.key);
    if (on && !has) { r.opens = [...(r.opens ?? []), o.key]; n += 1; }
    if (!on && has) { r.opens = r.opens.filter((k) => k !== o.key); n += 1; }
  });
  if (n === 0 && !rows.some((r) => which(r))) setStatus("Tick students in the list first.");
  else setStatus(`${openName(o)}: ${on ? "given to" : "taken from"} ${plural(n, "student")}.`);
  render();
}

$("addOpen").addEventListener("click", () => {
  openSeq += 1;
  opens.push({ key: `open${openSeq}`, name: "", code: "" });
  render();
  $("openList").lastElementChild?.querySelector(".oname")?.focus();
});

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
  const jobs = rowsToJobs(p, rows, school, {}, testCodes, opens);
  const safe = school.replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const now = new Date();
  const date = p.testDate ?? [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((n) => String(n).padStart(2, "0")).join("-");
  try {
    setStatus("Making the PDF...");
    const doc = await downloadScantronPdf({ jobs, filename: `${safe}-${p.filenamePrefix}-${date}.pdf` });
    const cutNote = describeCutText(doc?.famatCutText);
    setStatus(`Done: ${jobs.length} pages, in pile order. Print one page first to check it.${cutNote ? ` ${cutNote}` : ""}`);
  } catch (err) {
    setStatus(`Could not make the PDF: ${err.message}`);
  }
}
