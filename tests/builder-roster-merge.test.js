import test from "node:test";
import assert from "node:assert/strict";
import { parseRegistrationInput } from "../src/parser.js";
import { buildPacket } from "../src/model.js";
import { CONVENTION_PROFILES } from "../src/catalog.js";

// Made-up students in the famat.org roster layout (one line per division).
const ROSTER = [
  "Roster: Sample High School #9999",
  "Able, Ann Geometry 9999 001 21 9999 001 22 9999 001 20",
  "Able, Ann Algebra II 9999 001 31 9999 001 32 9999 001 30",
  "Dunn, Dee Calculus 9999 004 51 9999 004 52 9999 004 50",
  "Dunn, Dee Statistics 9999 004 61 9999 004 62 9999 004 60",
  "Ezra, Eve Statistics 9999 005 61 9999 005 62 9999 005 60",
].join("\n");

const packet = (key) => {
  const prof = CONVENTION_PROFILES[key];
  const parsed = parseRegistrationInput(ROSTER, { format: "roster", catalog: prof.catalog, divisionScheme: prof.divisionScheme });
  return { parsed, packet: buildPacket({ ...parsed, profile: prof }) };
};

test("full builder prints each famat.org student once, with State rounds from the same rules as the quick page", () => {
  const { parsed, packet: p } = packet("state");
  assert.equal(parsed.records.length, 3);
  assert.ok(parsed.warnings.some((w) => w.code === "MERGED_SAME_STUDENT"));
  assert.equal(p.jobs.length, 9);
  const dee = p.jobs.filter((j) => j.studentName === "Dunn, Dee").map((j) => j.testName);
  assert.deepEqual(dee.sort(), ["Area & Volume (Mu)", "Calculus Applications (Mu)", "Calculus Individual"].sort());
  const eve = p.jobs.filter((j) => j.studentName === "Ezra, Eve").map((j) => j.testName);
  assert.ok(eve.includes("Statistics Individual"));
});

test("full builder Hiller / Nunn / Dostal: one sheet per student, Statistics defaults to Dostal - Calculus", () => {
  const { packet: p } = packet("hnd");
  assert.equal(p.jobs.length, 3);
  assert.equal(p.jobs.find((j) => j.studentName === "Ezra, Eve").testName, "Dostal - Calculus");
});
