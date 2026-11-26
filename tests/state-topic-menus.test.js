import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, parseQuickRoster, buildRows, rowsToJobs, mergeRoster, STATE_TEST_BY_ID, stateSheets } from "../preview/src/presets.js";

// Made-up students in the famat.org roster layout: one line per student per division.
const ROSTER = [
  "Roster: Sample High School #9999",
  "Able, Ann Geometry 9999 001 21 9999 001 22 9999 001 20",
  "Able, Ann Algebra II 9999 001 31 9999 001 32 9999 001 30",
  "Cole, Cam Precalculus 9999 003 41 9999 003 42 9999 003 40",
  "Dunn, Dee Calculus 9999 004 51 9999 004 52 9999 004 50",
  "Dunn, Dee Statistics 9999 004 61 9999 004 62 9999 004 60",
  "Ezra, Eve Statistics 9999 005 61 9999 005 62 9999 005 60",
  "Fox, Fay Geometry 9999 006 21 9999 006 22 9999 006 20",
  "Fox, Fay Statistics 9999 006 61 9999 006 62 9999 006 60",
].join("\n");

const p = PRESETS["state-convention"];
const rows = () => buildRows(p, parseQuickRoster(ROSTER, { teamDigit: p.teamDigit }).students);
const row = (rs, name) => rs.find((r) => r.name === name);
const divisions = (ids) => ids.map((id) => STATE_TEST_BY_ID.get(id).division);
const lastIndex = (arr, f) => arr.map(f).lastIndexOf(true);

test("State Individual comes from the course on the IDs", () => {
  const rs = rows();
  assert.match(row(rs, "Able, Ann").pile, /Theta/);
  assert.match(row(rs, "Cole, Cam").pile, /Alpha/);
  assert.match(row(rs, "Dunn, Dee").pile, /Calculus/);
  assert.match(row(rs, "Ezra, Eve").pile, /Calculus/, "Statistics-only starts in Calculus");
  assert.ok(row(rs, "Ezra, Eve").allowedPiles.some((x) => /Theta/.test(x)), "Statistics-only is not held to a level");
  assert.match(row(rs, "Fox, Fay").pile, /Theta/, "Geometry + Statistics is Theta by course");
  assert.ok(row(rs, "Dunn, Dee").allowedPiles.some((x) => /Statistics/.test(x)), "Calculus student may switch to Statistics");
  assert.ok(!row(rs, "Cole, Cam").allowedPiles.some((x) => /Theta/.test(x)), "no testing down");
});

test("topic menus never go below the course and list easiest first, Open last", () => {
  const rs = rows();
  for (const r of rs) {
    for (const g of ["round_1", "round_2"]) {
      const d = divisions(r.topicOptions[g]);
      assert.ok(d.includes("open"), `${r.name} ${g} has Open`);
      assert.equal(lastIndex(d, (x) => x !== "open") < d.indexOf("open"), true, "Open comes last");
      const rank = { theta: 1, alpha: 2, mu: 3 };
      const ranks = d.filter((x) => rank[x]).map((x) => rank[x]);
      assert.deepEqual(ranks, [...ranks].sort((a, b) => a - b), "easiest division first");
    }
  }
  assert.deepEqual([...new Set(divisions(row(rs, "Dunn, Dee").topicOptions.round_1))], ["mu", "open"]);
  assert.deepEqual([...new Set(divisions(row(rs, "Cole, Cam").topicOptions.round_2))], ["alpha", "mu", "open"]);
  assert.deepEqual([...new Set(divisions(row(rs, "Able, Ann").topicOptions.round_1))], ["theta", "alpha", "mu", "open"]);
});

test("rounds start on the student's own division and print with that code", () => {
  const rs = rows();
  const ann = stateSheets(row(rs, "Able, Ann"));
  assert.equal(ann.length, 3);
  assert.equal(STATE_TEST_BY_ID.get(row(rs, "Able, Ann").topicDefaults.round_1).division, "theta");
  assert.ok(ann.every((s) => s.id.slice(0, 8) === "99990013"), "one State ID on all three sheets");
  assert.equal(STATE_TEST_BY_ID.get(row(rs, "Ezra, Eve").topicDefaults.round_1).division, "mu");
  assert.ok(divisions(row(rs, "Ezra, Eve").topicOptions.round_1).includes("theta"), "Statistics-only may pick any level");
  const fay = stateSheets(row(rs, "Fox, Fay"));
  assert.equal(fay[0].id[7], "2", "Geometry ID, not the Statistics ID");
});

test("a student's pick is used, survives a re-read, and a pick they may not take prints a blank code", () => {
  let rs = rows();
  const cam = row(rs, "Cole, Cam");
  const mu = cam.topicOptions.round_1.find((id) => STATE_TEST_BY_ID.get(id).division === "mu");
  cam.topics = { round_1: mu };
  assert.equal(stateSheets(cam)[1].testCode, STATE_TEST_BY_ID.get(mu).code);
  const { students } = mergeRoster(rs, parseQuickRoster(ROSTER, { teamDigit: p.teamDigit }).students);
  rs = buildRows(p, students);
  assert.equal(row(rs, "Cole, Cam").topics.round_1, mu);
  const dee = row(rs, "Dunn, Dee");
  const theta = [...STATE_TEST_BY_ID.values()].find((t) => t.group === "round_1" && t.division === "theta");
  dee.topics = { round_1: theta.id };
  assert.equal(stateSheets(dee)[1].testCode, "");
});

test("State prints 3 sheets per student", () => {
  assert.equal(rowsToJobs(p, rows(), "Sample").length, 15);
});
