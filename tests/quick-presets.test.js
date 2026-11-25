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

test("Statistics students need a choice unless last year settles it", () => {
  const open = assignHillerNunnDostal("123400160");
  assert.equal(open.pile, null);
  assert.deepEqual(open.choices, [NDH_PILES.DOSTAL_PRECALC, NDH_PILES.DOSTAL_CALC]);
  assert.equal(assignHillerNunnDostal("123400160", ["4"]).pile, NDH_PILES.DOSTAL_CALC);
  assert.equal(assignHillerNunnDostal("123400160", ["5"]).pile, NDH_PILES.DOSTAL_CALC);
  assert.equal(assignHillerNunnDostal("123400160", ["3"]).pile, NDH_PILES.DOSTAL_PRECALC);
  assert.equal(assignHillerNunnDostal("123400160", ["6"]).pile, null);
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
