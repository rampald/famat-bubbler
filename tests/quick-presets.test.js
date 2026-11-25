import test from "node:test";
import assert from "node:assert/strict";
import {
  PRESETS, NDH_PILES, assignHillerNunnDostal, parseQuickRoster,
  previousDigitsByName, buildRows, rowsToJobs,
} from "../src/presets.js";
import { normalizePageJob } from "../src/pdf.js";

const ndh = PRESETS["hiller-nunn-dostal"];

test("division digit picks the Hiller/Nunn/Dostal pile", () => {
  assert.equal(assignHillerNunnDostal("123400110").pile, NDH_PILES.HILLER);
  assert.equal(assignHillerNunnDostal("123400120").pile, NDH_PILES.NUNN);
  assert.equal(assignHillerNunnDostal("123400130").pile, NDH_PILES.NUNN);
  assert.equal(assignHillerNunnDostal("123400140").pile, NDH_PILES.DOSTAL_PRECALC);
  assert.equal(assignHillerNunnDostal("123400150").pile, NDH_PILES.DOSTAL_CALC);
  const chi = assignHillerNunnDostal("123400190");
  assert.equal(chi.eligible, false);
});

test("Statistics: prior Precalculus -> Dostal Calculus, lower -> Precalculus, unknown -> Precalculus to check", () => {
  // Took Precalculus or Calculus before: Dostal Calculus, nothing to check.
  for (const prev of [["4"], ["5"], ["3", "4"]]) {
    const r = assignHillerNunnDostal("123400160", prev);
    assert.equal(r.pile, NDH_PILES.DOSTAL_CALC);
    assert.ok(!r.check);
  }
  // Only lower levels before: Dostal Precalculus, nothing to check.
  const lower = assignHillerNunnDostal("123400160", ["3"]);
  assert.equal(lower.pile, NDH_PILES.DOSTAL_PRECALC);
  assert.ok(!lower.check);
  // No history (or only Statistics before): Dostal Precalculus, flagged for the sponsor.
  for (const prev of [[], ["6"]]) {
    const open = assignHillerNunnDostal("123400160", prev);
    assert.equal(open.pile, NDH_PILES.DOSTAL_PRECALC);
    assert.equal(open.check, true);
    assert.deepEqual(open.choices, [NDH_PILES.DOSTAL_PRECALC, NDH_PILES.DOSTAL_CALC]);
  }
});

const ROSTER = `Roster: Example High School #1234
Student Division Team 1 ID Team 2 ID No Team ID
Doe, Jane Geometry 1234 001 21 1234 001 22 1234 001 20
Roe, Ann Lee Algebra II 1234 002 31 1234 002 32 1234 002 30
Poe, Yi Calculus 1234 003 51 1234 003 52 1234 003 50
Moe, Kim Statistics 1234 004 61 1234 004 62 1234 004 60
Student Division Team 1 ID Team 2 ID No Team ID
Loe, Sam Algebra I 1235 005 11 1235 005 12 1235 005 10`;

test("famat.org roster text: names, No Team IDs, school name", () => {
  const { schoolName, students } = parseQuickRoster(ROSTER, { teamDigit: "0" });
  assert.equal(schoolName, "Example High School");
  assert.deepEqual(students.map((s) => s.name), ["Doe, Jane", "Roe, Ann Lee", "Poe, Yi", "Moe, Kim", "Loe, Sam"]);
  assert.deepEqual(students.map((s) => s.id), ["123400120", "123400230", "123400350", "123400460", "123500510"]);
  assert.ok(students.every((s) => s.previousIds.length === 0));
});

test("CSV rows, team digit forced to 0, previous-year ID column", () => {
  const { students } = parseQuickRoster(`Name,ID,Previous Year IDs\n"Moe, Kim",123400461,123400441\nAl Bee\t123400111`, { teamDigit: "0" });
  assert.equal(students[0].name, "Moe, Kim");
  assert.equal(students[0].id, "123400460");
  assert.deepEqual(students[0].previousIds, ["123400441"]);
  assert.equal(students[1].name, "Al Bee");
  assert.equal(students[1].id, "123400110");
});

test("last year's roster decides Statistics piles by name", () => {
  const { students } = parseQuickRoster(ROSTER, { teamDigit: "0" });
  const lastYear = previousDigitsByName("Moe, Kim Precalculus 1234 004 41 1234 004 42 1234 004 40");
  const rows = buildRows(ndh, students, lastYear);
  assert.equal(rows.find((r) => r.name === "Moe, Kim").pile, NDH_PILES.DOSTAL_CALC);
});

test("jobs are in pile order with a blank test code", () => {
  const { students } = parseQuickRoster(ROSTER, { teamDigit: "0" });
  const rows = buildRows(ndh, students);
  rows.find((r) => r.name === "Moe, Kim").pile = NDH_PILES.DOSTAL_PRECALC;
  const jobs = rowsToJobs(ndh, rows, "Example High School");
  assert.deepEqual(jobs.map((j) => j.testName), ["Hiller", "Nunn", "Nunn", "Dostal - Precalculus", "Dostal - Calculus"]);
  const page = normalizePageJob(jobs[0]);
  assert.equal(page.testCode, "");
  assert.equal(page.stateId, "123500510");
});

test("a blank test code is still rejected unless the job allows it", () => {
  assert.throws(() => normalizePageJob({ name: "A", id: "123400120", school: "S", testName: "T", testCode: "" }));
});

/* ---- State Convention Quick print ---- */
import { assignState, stateSheets, TOPIC_NONE } from "../src/presets.js";
const state = PRESETS["state-convention"];

test("State: the ID's division picks the Individual automatically", () => {
  assert.equal(assignState("123400120").pile, "Theta Individual");
  assert.equal(assignState("123400130").pile, "Theta Individual");
  assert.equal(assignState("123400140").pile, "Alpha Individual");
  assert.equal(assignState("123400150").pile, "Calculus Individual");
  assert.equal(assignState("123400160").pile, "Statistics Individual");
  assert.equal(assignState("123400190").pile, "Chi Individual");
});

test("State: default sheets are the coded Individual plus name-and-ID round sheets", () => {
  const row = { name: "A", id: "123400140", ...assignState("123400140") };
  const sheets = stateSheets(row);
  assert.deepEqual(sheets.map((s) => [s.testName, s.testCode]),
    [["Alpha Individual", "241"], ["Round 1 topic test", ""], ["Round 2 topic test", ""]]);
  const picked = stateSheets(row, { round_1: { alpha: "round-1-alpha-equations-inequalities" }, round_2: { alpha: TOPIC_NONE } });
  assert.deepEqual(picked.map((s) => s.testCode), ["241", "341"]);
});

test("State: last year's level blocks testing down and asks for the Individual", () => {
  const r = assignState("123400140", ["5"]);
  assert.equal(r.pile, null);
  assert.ok(r.choices.includes("Calculus Individual"));
  assert.ok(!r.choices.includes("Alpha Individual"));
});

test("State: packet prints all Individuals first, then each round", () => {
  const { students } = parseQuickRoster(ROSTER, { teamDigit: "0" });
  const rows = buildRows(state, students);
  // The Algebra I student has no State division and is left out.
  assert.equal(rows.filter((r) => !r.eligible).length, 1);
  const n = rows.filter((r) => r.eligible).length;
  const jobs = rowsToJobs(state, rows, "Example High School");
  assert.equal(jobs.length, n * 3);
  assert.deepEqual(jobs.slice(0, n).map((j) => j.testCode), ["231", "231", "251", "261"]);
  assert.ok(jobs.slice(n).every((j) => j.testCode === "" && j.blankTestCode));
  for (const j of jobs) normalizePageJob(j);
});

test("bulk Set test can only move a student to a test their division allows", () => {
  assert.deepEqual(assignHillerNunnDostal("123400110").allowedPiles, [NDH_PILES.HILLER]);
  assert.deepEqual(assignHillerNunnDostal("123400230").allowedPiles, [NDH_PILES.NUNN]);
  assert.deepEqual(assignHillerNunnDostal("123400330").allowedPiles, [NDH_PILES.NUNN]);
  assert.deepEqual(assignHillerNunnDostal("123400440").allowedPiles, [NDH_PILES.DOSTAL_PRECALC]);
  assert.deepEqual(assignHillerNunnDostal("123400550").allowedPiles, [NDH_PILES.DOSTAL_CALC]);
  assert.deepEqual(assignHillerNunnDostal("123400660").allowedPiles,
    [NDH_PILES.DOSTAL_PRECALC, NDH_PILES.DOSTAL_CALC]);
  assert.deepEqual(assignHillerNunnDostal("123400990").allowedPiles, []);
  for (const pile of [NDH_PILES.NUNN, NDH_PILES.DOSTAL_PRECALC, NDH_PILES.DOSTAL_CALC]) {
    assert.ok(!assignHillerNunnDostal("123400110").allowedPiles.includes(pile));
  }
});

/* ---- Review fixes (Nov 2026) ---- */
import { applyBulkTest, tickRange, mergeRoster, stateSheetGaps } from "../src/presets.js";

test("bulk Set test on a mixed list changes only students allowed that test", () => {
  const { students } = parseQuickRoster(ROSTER, { teamDigit: "0" });
  const rows = buildRows(ndh, students);
  rows.forEach((r) => { r.sel = true; });
  const before = rows.map((r) => r.pile);
  const { changed, skipped } = applyBulkTest(rows, NDH_PILES.DOSTAL_CALC);
  // Calculus (already there) and Statistics may take Dostal Calculus; Geo, Alg II, Alg I may not.
  assert.equal(changed, 2);
  assert.equal(skipped, 3);
  assert.equal(rows.find((r) => r.name === "Moe, Kim").pile, NDH_PILES.DOSTAL_CALC);
  assert.equal(rows.find((r) => r.name === "Moe, Kim").check, false);
  rows.forEach((r, i) => { if (!["Moe, Kim", "Poe, Yi"].includes(r.name)) assert.equal(r.pile, before[i]); });
  // Test codes stay blank on the scantrons.
  assert.ok(rowsToJobs(ndh, rows, "S").every((j) => j.testCode === "" && j.blankTestCode));
});

test("an explicit previous ID beats a name match; duplicate names are flagged, not matched", () => {
  const lastYear = previousDigitsByName(
    "Moe, Kim Precalculus 1234 004 41 1234 004 42 1234 004 40\n" +
    "Twin, Al Precalculus 1234 008 41 1234 008 42 1234 008 40\n" +
    "Twin, Al Algebra II 1234 009 31 1234 009 32 1234 009 30");
  const rows = buildRows(ndh, [
    // Previous ID on the line says Algebra II, so the name match (Precalculus) is ignored.
    { name: "Moe, Kim", id: "123400460", previousIds: ["123400430"] },
    // Two "Twin, Al" last year: no match, highlighted.
    { name: "Twin, Al", id: "123400860", previousIds: [] },
    // Unique on both sides: matched.
    { name: "Solo, Bo", id: "123401060", previousIds: [] },
    { name: "Same, Cy", id: "123401160", previousIds: [] },
    { name: "Same, Cy", id: "123401260", previousIds: [] },
  ], new Map([...lastYear, ["solobo", [["4"]]], ["samecy", [["5"]]]]));
  const by = (n) => rows.filter((r) => r.name === n);
  assert.equal(by("Moe, Kim")[0].pile, NDH_PILES.DOSTAL_PRECALC);
  assert.ok(!by("Moe, Kim")[0].check);
  assert.equal(by("Twin, Al")[0].dupName, true);
  assert.equal(by("Twin, Al")[0].check, true);
  assert.equal(by("Solo, Bo")[0].pile, NDH_PILES.DOSTAL_CALC);
  assert.ok(!by("Solo, Bo")[0].dupName);
  // Same name twice this year: last year's single entry is not applied to either.
  assert.ok(by("Same, Cy").every((r) => r.dupName && r.pile === NDH_PILES.DOSTAL_PRECALC));
});

test("reading the roster again keeps edits, hand-typed students and piles set by hand", () => {
  const { students } = parseQuickRoster(ROSTER, { teamDigit: "0" });
  let rows = buildRows(ndh, students);
  rows.find((r) => r.name === "Doe, Jane").name = "Doe, Janet";
  rows.find((r) => r.name === "Loe, Sam").off = true;
  rows.find((r) => r.name === "Moe, Kim").manualPile = NDH_PILES.DOSTAL_CALC;
  rows.push({ typed: true, name: "New, Pat", id: "123409920", previousIds: [] });
  const again = parseQuickRoster(ROSTER, { teamDigit: "0" }).students;
  const { students: merged, kept, added } = mergeRoster(rows, again);
  assert.equal(kept, 5);
  assert.equal(added, 0);
  rows = buildRows(ndh, merged);
  assert.ok(rows.some((r) => r.name === "Doe, Janet"));
  assert.ok(!rows.some((r) => r.name === "Doe, Jane"));
  assert.equal(rows.find((r) => r.name === "Loe, Sam").off, true);
  assert.equal(rows.find((r) => r.name === "Moe, Kim").pile, NDH_PILES.DOSTAL_CALC);
  assert.equal(rows.find((r) => r.name === "New, Pat").pile, NDH_PILES.NUNN);
  // Switching competition recomputes from the same rows, edits included.
  const st = buildRows(state, rows);
  assert.ok(st.some((r) => r.name === "Doe, Janet"));
  assert.equal(st.find((r) => r.name === "Loe, Sam").off, true);
  // A manual Dostal pile is not a State test, so it is dropped there.
  assert.equal(st.find((r) => r.name === "Moe, Kim").pile, "Statistics Individual");
});

test("roster reading reports lines it skipped", () => {
  const r = parseQuickRoster(`${ROSTER}\nnot a student line\nNo ID here, Bob`, { teamDigit: "0" });
  assert.equal(r.students.length, 5);
  // Two column-header lines plus the two junk lines (the Roster: line is the school).
  assert.equal(r.skipped, 4);
});

test("shift-click range is clamped and survives a shorter list", () => {
  const rows = [{}, {}, {}].map((x) => ({ ...x, sel: false }));
  assert.equal(tickRange(rows, 0, 2, true), 3);
  assert.ok(rows.every((r) => r.sel));
  // A stale anchor past the end ticks only the clicked row.
  rows.forEach((r) => { r.sel = false; });
  assert.equal(tickRange(rows, 7, 1, true), 1);
  assert.deepEqual(rows.map((r) => r.sel), [false, true, false]);
  assert.equal(tickRange([], 0, 3, true), 0);
});

test("State: who gets a no-code or missing round sheet is listed", () => {
  const rows = buildRows(state, [
    { name: "Ann", id: "123400120" },
    { name: "Ben", id: "123400740" },
  ]);
  const gaps = stateSheetGaps(rows, { round_1: { alpha: "round-1-alpha-equations-inequalities" }, round_2: { theta: TOPIC_NONE } });
  assert.deepEqual(gaps.round_1.blank, ["Ann"]);
  assert.deepEqual(gaps.round_2.none, ["Ann"]);
  assert.deepEqual(gaps.round_2.blank, ["Ben"]);
  assert.deepEqual(gaps.round_1.mismatch, []);
});

test("State: each round lists coded sheets by test first, then the no-code sheets", () => {
  const rows = buildRows(state, [
    { name: "Ann", id: "123400120" },
    { name: "Zed", id: "123400740" },
    { name: "Cal", id: "123400850" },
  ]);
  const jobs = rowsToJobs(state, rows, "S", { round_1: { alpha: "round-1-alpha-equations-inequalities" } });
  const round1 = jobs.slice(3, 6);
  // Old order put the Theta (blank) sheet first because Theta comes first in division order.
  assert.deepEqual(round1.map((j) => [j.studentName, j.testCode]), [["Zed", "341"], ["Ann", ""], ["Cal", ""]]);
  assert.deepEqual(jobs.slice(0, 3).map((j) => j.studentName), ["Ann", "Zed", "Cal"]);
});
