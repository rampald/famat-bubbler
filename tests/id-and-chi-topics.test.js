import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, parseQuickRoster, buildRows, STATE_TEST_BY_ID, stateSheets } from "../preview/src/presets.js";
import { STATE_TEST_CATALOG } from "../preview/src/catalog.js";
import { idForTest } from "../src/eligibility.js";

// Made-up students in the famat.org roster layout.
const ROSTER = [
  "Roster: Sample High School #9999",
  "Gray, Gus Chi 9999 007 91 9999 007 92 9999 007 90",
  "Hale, Hal Precalculus 9999 008 41 9999 008 42 9999 008 40",
  "Ives, Ivy Statistics 9999 009 61 9999 009 62 9999 009 60",
].join("\n");
const p = PRESETS["state-convention"];
const rows = () => buildRows(p, parseQuickRoster(ROSTER, { teamDigit: p.teamDigit }).students);
const row = (rs, name) => rs.find((r) => r.name === name);
const individual = (division) => STATE_TEST_CATALOG.find((t) => t.group === "individual" && t.division === division);

test("Chi student: Chi Individual, Theta topics to start, any topic offered (Radleigh)", () => {
  const gus = row(rows(), "Gray, Gus");
  assert.match(gus.pile, /Chi/);
  for (const g of ["round_1", "round_2"]) {
    assert.equal(STATE_TEST_BY_ID.get(gus.topicDefaults[g]).division, "theta");
    const d = new Set(gus.topicOptions[g].map((id) => STATE_TEST_BY_ID.get(id).division));
    for (const x of ["theta", "alpha", "mu", "open"]) assert.ok(d.has(x), `${g} offers ${x}`);
  }
  assert.ok(stateSheets(gus).every((s) => s.id[7] === "9"), "Chi digit on all sheets");
});

test("changing the Individual keeps the issued ID and changes only the division digit (Derek, Nov 28)", () => {
  const rs = rows();
  const hal = row(rs, "Hale, Hal");
  hal.pile = individual("mu").name;
  const sheets = stateSheets(hal);
  assert.ok(sheets.length >= 1);
  for (const s of sheets) {
    assert.equal(s.id.slice(0, 7), hal.id.slice(0, 7), "school and student as issued");
    assert.equal(s.id[7], "5", "Mu digit");
    assert.equal(s.id[8], hal.id[8], "team digit as issued");
  }
  const ivy = row(rs, "Ives, Ivy");
  ivy.pile = individual("theta").name;
  assert.ok(stateSheets(ivy).every((s) => s.id[7] === "2" && s.id.slice(0, 7) === ivy.id.slice(0, 7)));
  ivy.pile = individual("statistics").name;
  assert.ok(stateSheets(ivy).every((s) => s.id[7] === "6"), "back on Statistics: registered ID");
});

test("builder idForTest follows the test's division at State", () => {
  assert.equal(idForTest("999900460", individual("mu"), "state"), "999900450");
  assert.equal(idForTest("999900461", individual("alpha"), "state"), "999900441");
  assert.equal(idForTest("999900431", individual("theta"), "state"), "999900431", "Algebra II stays Theta 3");
  assert.equal(idForTest("999900451", individual("theta"), "state"), "999900421");
  assert.equal(idForTest("999900491", individual("chi"), "state"), "999900491");
});
