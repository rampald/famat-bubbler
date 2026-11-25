import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mergeParsedSources } from "../src/batch.js";
import { parseDelimitedRegistration, parseRosterText } from "../src/parser.js";

function parsedResult(records) {
  return {
    format: "csv",
    schoolName: "Example High School",
    schoolCode: "1234",
    records,
    errors: [],
    warnings: [],
  };
}

test("Regional upload headers capture eligibility plus six optional event slots", () => {
  const parsed = parseDelimitedRegistration(
    [
      "Student Name,Student ID,Current Course,Statistics Eligibility Basis,Division,Additional Event 1,Optional Event 2,Optional Event 3,Additional Event 4,Optional Event 5,Additional Event 6",
      "Jordan Lee,123400240,Precalculus,,Precalculus,Statistics Individual,Open A,,Open B,,Open C",
    ].join("\n"),
    { requiredHeaders: ["student_name", "state_id", "eligibility_basis", "division"] },
  );

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].eligibilityBasis, "Precalculus");
  assert.equal(parsed.records[0].statisticsEligibilityBasis, "");
  assert.equal(parsed.records[0].division, "Precalculus");
  assert.equal(parsed.records[0].optional1Test, "Statistics Individual");
  assert.equal(parsed.records[0].optional2Test, "Open A");
  assert.equal(parsed.records[0].optional3Test, "");
  assert.equal(parsed.records[0].optional4Test, "Open B");
  assert.equal(parsed.records[0].optional5Test, "");
  assert.equal(parsed.records[0].optional6Test, "Open C");
});

test("Statistics secondary eligibility basis accepts friendly upload aliases", () => {
  for (const header of [
    "Statistics Eligibility Basis",
    "Other Course Basis",
    "Secondary Eligibility Basis",
  ]) {
    const parsed = parseDelimitedRegistration(
      [
        `Student Name,Student ID,Eligibility Basis,${header},Division`,
        "Casey Chen,123400660,Statistics,Precalculus,Statistics",
      ].join("\n"),
      { requiredHeaders: ["student_name", "state_id", "eligibility_basis", "division"] },
    );

    assert.deepEqual(parsed.errors, []);
    assert.deepEqual(parsed.warnings, []);
    assert.equal(parsed.records[0].statisticsEligibilityBasis, "Precalculus");
  }
});

test("legacy Event 1 through Event 4 aliases remain mapped for Custom imports", () => {
  const parsed = parseDelimitedRegistration(
    [
      "Student Name,Student ID,Event 1,Event 2,Event 3,Event 4",
      "Jordan Lee,123400240,One,Two,Three,Four",
    ].join("\n"),
    { requiredHeaders: ["student_name", "state_id"] },
  );

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.records[0].individualTest, "One");
  assert.equal(parsed.records[0].round1Test, "Two");
  assert.equal(parsed.records[0].round2Test, "Three");
  assert.equal(parsed.records[0].round3Test, "Four");
  assert.equal(parsed.records[0].optional1Test, "");
});

test("Regional roster parsing preserves six course divisions and inferred eligibility bases", () => {
  const parsed = parseRosterText(
    [
      "Roster: Example High School #1234",
      "Doe, Jane Algebra 1 123400110",
      "Smith, Alex Geometry 123400220",
      "Brown, Sam Algebra 2 123400330",
      "Rivera, Ana Precalculus 123400440",
      "Patel, Mira Calculus 123400550",
      "Chen, Kai Statistics 123400660",
    ].join("\n"),
    { divisionScheme: "regional", inferIndividualFromDivision: false },
  );

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(
    parsed.records.map(({ division }) => division),
    ["algebra_1", "geometry", "algebra_2", "precalculus", "calculus", "statistics"],
  );
  assert.deepEqual(
    parsed.records.map(({ eligibilityBasis }) => eligibilityBasis),
    [
      "algebra_1",
      "geometry_algebra_2",
      "geometry_algebra_2",
      "precalculus",
      "calculus",
      "statistics_special",
    ],
  );
});

test("State roster parsing keeps its State-level aliases and recognizes Chi digit 9", () => {
  const parsed = parseRosterText(
    [
      "Roster: Example High School #1234",
      "Doe, Jane Algebra 1 123400110",
      "Smith, Alex Algebra 2 123400330",
      "Middle, Casey 123400790",
    ].join("\n"),
    { inferIndividualFromDivision: false },
  );

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.records.map(({ division }) => division), ["theta", "theta", "chi"]);
});

test("Regional roster parsing can derive the matching Individual from a course catalog", () => {
  const catalog = [
    {
      id: "geometry-individual",
      name: "Geometry Individual",
      group: "individual",
      division: "geometry",
      code: "221",
      active: true,
    },
  ];
  const parsed = parseRosterText(
    "Roster: Example High School #1234\nSmith, Alex Geometry 123400220",
    { divisionScheme: "regional", catalog, inferIndividualFromDivision: true },
  );

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.records[0].division, "geometry");
  assert.equal(parsed.records[0].individualTest, "geometry-individual");
});

test("batch merge compares and enriches eligibility and dynamic optional assignments", () => {
  const catalog = [
    {
      id: "geometry-open",
      name: "Geometry Open",
      aliases: ["Geo Open"],
      group: "optional",
      division: "open",
      code: "701",
      active: true,
    },
    {
      id: "calculus-open",
      name: "Calculus Open",
      aliases: [],
      group: "optional",
      division: "open",
      code: "702",
      active: true,
    },
  ];
  const base = {
    studentName: "Jordan Lee",
    stateId: "123400220",
    schoolName: "Example High School",
    schoolCode: "1234",
    division: "Geometry",
    eligibilityBasis: "Geometry",
    statisticsEligibilityBasis: "Geometry",
    optional1Test: "Geo Open",
  };
  const merged = mergeParsedSources(
    [
      { filename: "roster.csv", parsed: parsedResult([base]) },
      {
        filename: "opens.csv",
        parsed: parsedResult([
          {
            ...base,
            division: "geometry",
            eligibilityBasis: "Algebra II",
            statisticsEligibilityBasis: "Algebra II",
            optional1Test: "701",
            optional2Test: "Calculus Open",
          },
        ]),
      },
    ],
    { catalog, divisionScheme: "regional" },
  );

  assert.equal(merged.ok, true);
  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].optional2Test, "Calculus Open");
  assert.ok(merged.duplicates[0].mergedFields.includes("optional2Test"));
});

test("batch division comparison remains profile-aware", () => {
  const base = {
    studentName: "Jordan Lee",
    stateId: "123400220",
    schoolName: "Example High School",
    schoolCode: "1234",
  };
  const sources = [
    { filename: "course.csv", parsed: parsedResult([{ ...base, division: "Geometry" }]) },
    { filename: "level.csv", parsed: parsedResult([{ ...base, division: "Theta" }]) },
  ];

  const stateMerge = mergeParsedSources(sources, { divisionScheme: "state" });
  const regionalMerge = mergeParsedSources(sources, { divisionScheme: "regional" });

  assert.equal(stateMerge.ok, true);
  assert.equal(regionalMerge.ok, false);
  assert.ok(regionalMerge.conflicts[0].fields.includes("division"));
});

test("batch merge reports conflicts in eligibility and optional event slots", () => {
  const first = {
    studentName: "Jordan Lee",
    stateId: "123400220",
    schoolName: "Example High School",
    schoolCode: "1234",
    division: "Geometry",
    eligibilityBasis: "Geometry",
    statisticsEligibilityBasis: "Geometry",
    optional1Test: "Geometry Open",
  };
  const second = {
    ...first,
    eligibilityBasis: "Precalculus",
    statisticsEligibilityBasis: "Calculus",
    optional1Test: "Calculus Open",
  };
  const merged = mergeParsedSources([
    { filename: "one.csv", parsed: parsedResult([first]) },
    { filename: "two.csv", parsed: parsedResult([second]) },
  ]);

  assert.equal(merged.ok, false);
  assert.deepEqual(
    new Set(merged.conflicts[0].fields),
    new Set(["eligibilityBasis", "statisticsEligibilityBasis", "optional1Test"]),
  );
});

test("Regional sample template lists Events and Previous Year IDs", () => {
  const text = readFileSync(
    new URL("../samples/regional-invitational-template.csv", import.meta.url),
    "utf8",
  );
  const parsed = parseDelimitedRegistration(text, {
    requiredHeaders: ["student_name", "state_id"],
  });

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.records.length, 3);
  assert.equal(parsed.records[0].previousIds, "123400220");
  assert.equal(parsed.records[0].events, "Algebra II Individual; Geometry Open");
  assert.equal(parsed.records[1].events, "Calculus Individual; Statistics Individual; Calculus Open");
  assert.equal(parsed.records[2].stateId, "123400660");
  assert.equal(parsed.records[2].previousIds, "123400440");
});
