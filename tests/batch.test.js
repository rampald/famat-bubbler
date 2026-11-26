import assert from "node:assert/strict";
import test from "node:test";

import { mergeParsedSources } from "../src/batch.js";
import { parseDelimitedRegistration } from "../src/parser.js";

function parsedResult(records, overrides = {}) {
  return {
    format: "csv",
    schoolName: null,
    schoolCode: null,
    records,
    errors: [],
    warnings: [],
    ...overrides,
  };
}

test("CSV parser accepts optional school metadata and Round 3 aliases", () => {
  const friendly = parseDelimitedRegistration([
    "School,School Code,Student Name,State ID,Individual,Round 1,Round 2,Round 3",
    "  Example   High School  ,0 1 2 3,Jamie Doe,012300130,Alpha Individual,512,522,Team Event A",
  ].join("\n"));

  assert.deepEqual(friendly.errors, []);
  assert.deepEqual(friendly.warnings, []);
  assert.equal(friendly.schoolName, "Example High School");
  assert.equal(friendly.schoolCode, "0123");
  assert.equal(friendly.records[0].schoolName, "Example High School");
  assert.equal(friendly.records[0].schoolCode, "0123");
  assert.equal(friendly.records[0].round3Test, "Team Event A");

  const compactAliases = parseDelimitedRegistration([
    "School Name,schoolcode,student_name,state_id,individual_test,round_1_test,round_2_test,round3_test",
    "Second School,9876,Alex Kim,987600240,Alpha Individual,513,523,Team Event B",
  ].join("\n"));
  assert.deepEqual(compactAliases.errors, []);
  assert.deepEqual(compactAliases.warnings, []);
  assert.equal(compactAliases.schoolName, "Second School");
  assert.equal(compactAliases.schoolCode, "9876");
  assert.equal(compactAliases.records[0].round3Test, "Team Event B");
});

test("batch merge removes exact duplicates and retains both source provenances", () => {
  const first = parsedResult(
    [{
      studentName: "Jamie Doe",
      stateId: "123400130",
      individualTest: "Alpha Individual",
      round1Test: "512",
      round2Test: "522",
      round3Test: "Team Event A",
      division: "alpha",
      source: { format: "csv", line: 2 },
    }],
    { schoolName: "Example High School", schoolCode: "1234" },
  );
  const second = structuredClone(first);
  const originalFirst = structuredClone(first);

  const batch = mergeParsedSources([
    { filename: "school-a.csv", parsed: first },
    { filename: "school-a-copy.csv", parsed: second },
  ]);

  assert.equal(batch.ok, true);
  assert.equal(batch.records.length, 1);
  assert.equal(batch.conflicts.length, 0);
  assert.equal(batch.duplicates.length, 1);
  assert.equal(batch.duplicates[0].kind, "exact");
  assert.deepEqual(
    batch.records[0].sources.map((source) => source.filename),
    ["school-a.csv", "school-a-copy.csv"],
  );
  assert.ok(batch.warnings.some((issue) => issue.code === "EXACT_DUPLICATE_STUDENT_DEDUPED"));
  assert.deepEqual(first, originalFirst, "merge must not mutate parser results");
});

test("batch merge combines complementary records and recognizes equivalent test references", () => {
  const roster = parsedResult(
    [{
      studentName: "Doe, Jamie",
      stateId: "123400130",
      individualTest: "alpha-individual",
      round1Test: "",
      round2Test: "",
      round3Test: "",
      division: "Alpha Division",
      source: { format: "roster", line: 3 },
    }],
    { format: "roster", schoolName: "Example High School", schoolCode: "1234" },
  );
  const assignments = parsedResult(
    [{
      studentName: "  DOE,   JAMIE ",
      stateId: "1 2 3 4 0 0 1 3 0",
      individualTest: "Alpha Individual",
      round1Test: "Analytic Geometry",
      round2Test: "522",
      round3Test: "Team Event A",
      division: "alpha",
      source: { format: "csv", line: 2 },
    }],
    { schoolName: "example high school", schoolCode: "1 2 3 4" },
  );

  const batch = mergeParsedSources([
    { filename: "roster.pdf", parsed: roster },
    { filename: "assignments.csv", parsed: assignments },
  ]);

  assert.equal(batch.ok, true);
  assert.equal(batch.records.length, 1);
  assert.equal(batch.conflicts.length, 0);
  assert.equal(batch.records[0].round1Test, "Analytic Geometry");
  assert.equal(batch.records[0].round2Test, "522");
  assert.equal(batch.records[0].round3Test, "Team Event A");
  assert.equal(batch.duplicates[0].kind, "complementary");
  assert.ok(batch.warnings.some((issue) => issue.code === "DUPLICATE_STUDENT_MERGED"));
});

test("batch merge blocks materially conflicting records and retains both snapshots", () => {
  const first = parsedResult(
    [{
      studentName: "Jamie Doe",
      stateId: "123400130",
      individualTest: "Theta Individual",
      round1Test: "411",
      round2Test: "421",
      round3Test: "Team Event A",
      division: "theta",
    }],
    { schoolName: "First School", schoolCode: "1234" },
  );
  const second = parsedResult(
    [{
      studentName: "Janet Doe",
      stateId: "123400130",
      individualTest: "Alpha Individual",
      round1Test: "512",
      round2Test: "522",
      round3Test: "Team Event B",
      division: "alpha",
    }],
    { schoolName: "Second School", schoolCode: "5678" },
  );

  const batch = mergeParsedSources([
    { filename: "first.csv", parsed: first },
    { filename: "second.csv", parsed: second },
  ]);

  assert.equal(batch.ok, false);
  assert.equal(batch.records.length, 1);
  assert.equal(batch.conflicts.length, 1);
  assert.deepEqual(batch.conflicts[0].filenames, ["first.csv", "second.csv"]);
  assert.ok(batch.conflicts[0].fields.includes("studentName"));
  assert.ok(batch.conflicts[0].fields.includes("division"));
  assert.ok(batch.conflicts[0].fields.includes("schoolName"));
  assert.ok(batch.conflicts[0].fields.includes("individualTest"));
  assert.ok(batch.conflicts[0].fields.includes("round3Test"));
  assert.equal(batch.conflicts[0].existing.studentName, "Jamie Doe");
  assert.equal(batch.conflicts[0].incoming.studentName, "Janet Doe");
  const error = batch.errors.find((issue) => issue.code === "DUPLICATE_STUDENT_CONFLICT");
  assert.equal(error.severity, "error");
  assert.match(error.message, /first\.csv.*second\.csv/i);
});

test("batch merge preserves parser issues and adds filename context", () => {
  const sourceError = {
    severity: "error",
    code: "FIELD_COUNT_MISMATCH",
    message: "Expected eight fields but found seven.",
    line: 4,
  };
  const sourceWarning = {
    severity: "warning",
    code: "UNKNOWN_HEADER",
    message: "An extra column was ignored.",
    line: 1,
  };
  const parsed = parsedResult([], { errors: [sourceError], warnings: [sourceWarning] });

  const batch = mergeParsedSources([{ filename: "problem.csv", result: parsed }]);

  assert.equal(batch.ok, false);
  assert.deepEqual(
    batch.errors[0],
    { ...sourceError, filename: "problem.csv", sourceFormat: "csv" },
  );
  assert.deepEqual(
    batch.warnings[0],
    { ...sourceWarning, filename: "problem.csv", sourceFormat: "csv" },
  );
  assert.equal(sourceError.filename, undefined);
  assert.equal(sourceWarning.filename, undefined);
});
