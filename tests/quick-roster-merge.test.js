import test from "node:test";
import assert from "node:assert/strict";
import { PRESETS, parseQuickRoster, buildRows, rowsToJobs, mergeRoster, regionalSecond } from "../preview/src/presets.js";

// Made-up students in the famat.org roster layout: one line per student per division.
const ROSTER = [
  "Roster: Sample High School #9999",
  "Student Division Team 1 ID Team 2 ID No Team ID",
  "Able, Ann Geometry 9999 001 21 9999 001 22 9999 001 20",
  "Baker, Ben Geometry 9999 002 21 9999 002 22 9999 002 20",
  "Able, Ann Algebra II 9999 001 31 9999 001 32 9999 001 30",
  "Cole, Cam Precalculus 9999 003 41 9999 003 42 9999 003 40",
  "Dunn, Dee Calculus 9999 004 51 9999 004 52 9999 004 50",
  " Student Division Team 1 ID Team 2 ID No Team ID",
  "Dunn, Dee Statistics 9999 004 61 9999 004 62 9999 004 60",
  "Ezra, Eve Statistics 9999 005 61 9999 005 62 9999 005 60",
].join("\n");

const read = (key) => {
  const p = PRESETS[key];
  const { students, schoolName } = parseQuickRoster(ROSTER, { teamDigit: p.teamDigit });
  return { p, rows: buildRows(p, students), schoolName };
};

test("famat.org lines for the same student merge into one row with the higher division", () => {
  const { students } = parseQuickRoster(ROSTER);
  assert.equal(students.length, 5);
  const ann = students.find((s) => s.name === "Able, Ann");
  assert.equal(ann.sourceId.slice(0, 8), "99990013");
  assert.deepEqual(ann.also.map((x) => x.slice(0, 8)), ["99990012"]);
  const dee = students.find((s) => s.name === "Dunn, Dee");
  assert.equal(dee.sourceId.slice(0, 8), "99990045");
  assert.deepEqual(dee.also.map((x) => x.slice(0, 8)), ["99990046"]);
});

test("everyone starts as going", () => {
  const { rows } = read("regional-invitational");
  assert.ok(rows.every((r) => !r.off));
});

test("Hiller / Nunn / Dostal prints one sheet per student", () => {
  const { p, rows, schoolName } = read("hiller-nunn-dostal");
  const jobs = rowsToJobs(p, rows, schoolName);
  assert.equal(jobs.length, 5);
  const pile = (n) => rows.find((r) => r.name === n).pile;
  assert.match(pile("Able, Ann"), /Nunn/);
  assert.match(pile("Dunn, Dee"), /Dostal\W+Calculus/);
  const eve = rows.find((r) => r.name === "Ezra, Eve");
  assert.match(eve.pile, /Dostal\W+Calculus/);
  assert.equal(eve.check, false);
  assert.ok(eve.choices.length > 1);
});

test("Regional prints one sheet per student, Statistics or higher division first, switchable", () => {
  const { p, rows, schoolName } = read("regional-invitational");
  const jobs = rowsToJobs(p, rows, schoolName);
  assert.equal(jobs.length, 6, "five students, and Dee also takes Calculus");
  const dee = rows.find((r) => r.name === "Dunn, Dee");
  assert.match(dee.pile, /^Statistics/);
  assert.ok(dee.allowedPiles.some((x) => /^Calculus/.test(x)));
  assert.match(rows.find((r) => r.name === "Ezra, Eve").pile, /^Statistics/);
  const deeJob = jobs.find((j) => j.studentName === "Dunn, Dee" && /^Statistics/.test(j.testName));
  assert.ok(JSON.stringify(deeJob).includes("999900460"));
  assert.match(dee.reason, /Also on the roster for Statistics/);
  const ann = rows.find((r) => r.name === "Able, Ann");
  assert.match(ann.pile, /^Algebra II/);
  assert.ok(ann.allowedPiles.some((x) => /^Geometry/.test(x)));
});

test("State prints three sheets per student", () => {
  const { p, rows, schoolName } = read("state-convention");
  assert.equal(rowsToJobs(p, rows, schoolName).length, 15);
});

test("unticking Going drops the student's sheets", () => {
  const { p, rows, schoolName } = read("state-convention");
  rows[0].off = true;
  assert.equal(rowsToJobs(p, rows, schoolName).length, 12);
});

test("reading the roster again keeps who is going", () => {
  const { p, rows } = read("regional-invitational");
  rows.find((r) => r.name === "Able, Ann").off = true;
  const again = parseQuickRoster(ROSTER, { teamDigit: p.teamDigit }).students;
  const { students, kept } = mergeRoster(rows, again);
  assert.equal(kept, 5);
  assert.equal(students.find((s) => s.name === "Able, Ann").off, true);
});

test("Regional: a second Individual only for a pair famat.org registered and the guide allows", () => {
  const { p, rows, schoolName } = read("regional-invitational");
  const dee = rows.find((r) => r.name === "Dunn, Dee");
  assert.equal(regionalSecond(dee).name, "Calculus Individual");
  const deeJobs = rowsToJobs(p, rows, schoolName).filter((j) => j.studentName === "Dunn, Dee");
  assert.deepEqual(deeJobs.map((j) => j.stateId[7]).sort(), ["5", "6"], "each sheet uses that division's registered ID");
  assert.equal(regionalSecond(rows.find((r) => r.name === "Able, Ann")), null, "Geometry with Algebra II is not allowed as two Individuals");
  assert.equal(regionalSecond(rows.find((r) => r.name === "Ezra, Eve")), null, "registered in one division only");
  dee.noSecond = true;
  assert.equal(rowsToJobs(p, rows, schoolName).length, 5);
});

test("Regional: Open tests the sponsor names print for the students given them", () => {
  const { p, rows, schoolName } = read("regional-invitational");
  const opens = [{ key: "a", name: "Geometry Open", code: "777" }, { key: "b", name: "Mental Math", code: "" }];
  rows.find((r) => r.name === "Able, Ann").opens = ["a", "b"];
  rows.find((r) => r.name === "Dunn, Dee").opens = ["b"];
  const jobs = rowsToJobs(p, rows, schoolName, {}, {}, opens);
  assert.equal(jobs.length, 9);
  assert.deepEqual(jobs.slice(-3).map((j) => j.testName), ["Geometry Open", "Mental Math", "Mental Math"], "Opens come last, in the order added");
  assert.equal(jobs.find((j) => j.testName === "Geometry Open").testCode, "777");
  assert.equal(jobs.find((j) => j.testName === "Mental Math" && j.studentName === "Dunn, Dee").stateId[7], "6", "an Open uses the first Individual's ID");
});
