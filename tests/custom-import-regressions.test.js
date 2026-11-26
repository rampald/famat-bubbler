import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { mergeParsedSources } from "../src/batch.js";
import {
  CONVENTION_PROFILES,
  TEST_GROUPS,
  catalogFromEditableEntries,
  resolveTestReference,
  testsForGroup,
} from "../src/catalog.js";
import { buildPacket } from "../src/model.js";
import {
  parseDelimitedRegistration,
  parseRegistrationInput,
  parseRosterText,
  REQUIRED_HEADERS,
} from "../src/parser.js";

function customCatalog() {
  return catalogFromEditableEntries([
    {
      id: "sample-event-a",
      name: "Sample Event A",
      group: TEST_GROUPS.INDIVIDUAL,
      division: "open",
      code: "901",
      active: true,
    },
    {
      id: "sample-event-b",
      name: "Sample Event B",
      group: TEST_GROUPS.ROUND_1,
      division: "open",
      code: "902",
      active: true,
    },
    {
      id: "sample-event-c",
      name: "Sample Event C",
      group: TEST_GROUPS.ROUND_2,
      division: "open",
      code: "903",
      active: true,
    },
    {
      id: "sample-event-d",
      name: "Sample Event D",
      group: TEST_GROUPS.ROUND_3,
      division: "open",
      code: "904",
      active: true,
    },
  ]);
}

function customRegistration(overrides = {}) {
  return {
    studentName: "Sample Student",
    stateId: "123400130",
    schoolName: "Example High School",
    schoolCode: "1234",
    division: "",
    individualTest: "Sample Event A",
    round1Test: "",
    round2Test: "",
    round3Test: "",
    source: { format: "test", line: 1 },
    ...overrides,
  };
}

test("roster parsing rejects extra digits and embedded letters instead of truncating IDs", () => {
  const extraDigit = parseRosterText(
    "Roster: Example High School #1234\nDoe, Jane Theta 0123400130",
  );
  const embeddedLetter = parseRosterText(
    "Roster: Example High School #1234\nDoe, Jane Theta 1234X00130",
  );

  for (const result of [extraDigit, embeddedLetter]) {
    assert.equal(result.records.length, 0);
    assert.ok(result.errors.some((issue) => issue.code === "UNRECOGNIZED_ROSTER_LINE"));
    assert.ok(result.errors.some((issue) => issue.code === "NO_STUDENTS_IN_SOURCE"));
  }

  const separatedExtraDigit = parseRosterText(
    "Roster: Example High School #1234\nDoe, Jane Theta 0 123400130",
  );
  assert.equal(separatedExtraDigit.records.length, 0);
  assert.ok(
    separatedExtraDigit.errors.some((issue) => issue.code === "UNRECOGNIZED_ROSTER_LINE"),
  );
});

test("roster parsing preserves Algebra 1 and Algebra 2 division numerals", () => {
  const parsed = parseRosterText(
    [
      "Roster: Example High School #1234",
      "Doe, Jane Algebra 1 123400130",
      "Smith, Alex Algebra 2 123400240",
    ].join("\n"),
  );

  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.records.length, 2);
  assert.equal(parsed.records[0].division, "theta");
  assert.equal(parsed.records[0].stateId, "123400130");
  assert.equal(parsed.records[1].division, "theta");
  assert.equal(parsed.records[1].stateId, "123400240");
});

test("empty and header-only roster sources fail closed", () => {
  const empty = parseRosterText("");
  assert.equal(empty.records.length, 0);
  assert.ok(empty.errors.some((issue) => issue.code === "NO_EXTRACTABLE_TEXT"));

  const headerOnly = parseRosterText(
    "Roster: Example High School #1234\nStudent Name Division Team 1 ID Team 2 ID No Team ID",
  );
  assert.equal(headerOnly.records.length, 0);
  assert.ok(headerOnly.errors.some((issue) => issue.code === "NO_STUDENTS_IN_SOURCE"));
});

test("a header-only CSV remains a blocking batch source", () => {
  const emptyCsv = parseDelimitedRegistration(
    "Student Name,State ID,Individual,Round 1,Round 2\n",
  );
  const validCsv = parseDelimitedRegistration(
    [
      "Student Name,State ID,Individual,Round 1,Round 2,School",
      "Ana,123400130,231,331,431,Example High School",
    ].join("\n"),
  );
  const merged = mergeParsedSources([
    { filename: "header-only.csv", parsed: emptyCsv },
    { filename: "valid.csv", parsed: validCsv },
  ]);

  assert.equal(emptyCsv.records.length, 0);
  assert.ok(emptyCsv.errors.some((issue) => issue.code === "NO_STUDENTS_IN_SOURCE"));
  assert.equal(merged.ok, false);
  assert.ok(
    merged.errors.some(
      (issue) =>
        issue.code === "NO_STUDENTS_IN_SOURCE" && issue.filename === "header-only.csv",
    ),
  );
});

test("partial row-level school metadata is not promoted into a file-wide default", () => {
  const parsed = parseDelimitedRegistration(
    [
      "Student Name,State ID,Individual,Round 1,Round 2,School",
      "Ana,123400130,231,331,431,Example High School",
      "Bill,567800130,231,331,431,",
    ].join("\n"),
  );

  assert.equal(parsed.schoolName, null);
  assert.equal(parsed.records[0].schoolName, "Example High School");
  assert.equal(parsed.records[1].schoolName, "");

  const merged = mergeParsedSources([{ filename: "partial-school.csv", parsed }]);
  assert.equal(merged.records[1].schoolName, null);
});

test("editable catalogs support additions, renames, and deactivation", () => {
  const baseCatalog = catalogFromEditableEntries([
    {
      id: "algebra-sprint",
      name: "Old Algebra Sprint Name",
      group: TEST_GROUPS.INDIVIDUAL,
      division: "open",
      code: "901",
      active: true,
    },
  ]);

  const edited = catalogFromEditableEntries(
    [
      {
        id: "algebra-sprint",
        name: "Renamed Algebra Sprint",
        group: TEST_GROUPS.INDIVIDUAL,
        division: "open",
        code: "901",
        active: true,
      },
      {
        id: "geometry-relay",
        name: "Geometry Relay",
        group: TEST_GROUPS.ROUND_1,
        division: "open",
        code: "902",
        active: false,
      },
    ],
    { baseCatalog },
  );

  assert.equal(edited[0].name, "Renamed Algebra Sprint");
  assert.equal(edited[1].name, "Geometry Relay");
  assert.equal(edited[1].active, false);
  assert.deepEqual(testsForGroup(TEST_GROUPS.ROUND_1, edited), []);
  assert.equal(resolveTestReference("Geometry Relay", TEST_GROUPS.ROUND_1, edited).status, "unknown");
  assert.equal(
    resolveTestReference("Renamed Algebra Sprint", TEST_GROUPS.INDIVIDUAL, edited).status,
    "resolved",
  );
});

test("editable catalogs reject duplicate codes among active events", () => {
  assert.throws(
    () =>
      catalogFromEditableEntries([
        {
          id: "event-one",
          name: "Event One",
          group: TEST_GROUPS.INDIVIDUAL,
          division: "open",
          code: "901",
          active: true,
        },
        {
          id: "event-two",
          name: "Event Two",
          group: TEST_GROUPS.ROUND_1,
          division: "open",
          code: "901",
          active: true,
        },
      ]),
    /assigned to both/i,
  );

  assert.doesNotThrow(() =>
    catalogFromEditableEntries([
      {
        id: "event-one",
        name: "Event One",
        group: TEST_GROUPS.INDIVIDUAL,
        division: "open",
        code: "901",
        active: true,
      },
      {
        id: "event-two",
        name: "Inactive Event Two",
        group: TEST_GROUPS.ROUND_1,
        division: "open",
        code: "901",
        active: false,
      },
    ]),
  );
});

test("custom packets accept one through four assignments and reject zero", () => {
  const catalog = customCatalog();
  const cases = [
    [customRegistration(), 1],
    [
      customRegistration({
        round1Test: "Sample Event B",
        round2Test: "Sample Event C",
        round3Test: "Sample Event D",
      }),
      4,
    ],
  ];

  for (const [record, expectedJobs] of cases) {
    const packet = buildPacket({
      schoolName: "",
      records: [record],
      profile: CONVENTION_PROFILES.custom,
      catalog,
    });
    assert.equal(packet.ok, true);
    assert.equal(packet.jobs.length, expectedJobs);
  }

  const empty = buildPacket({
    schoolName: "",
    records: [
      customRegistration({
        individualTest: "",
        round1Test: "",
        round2Test: "",
        round3Test: "",
      }),
    ],
    profile: CONVENTION_PROFILES.custom,
    catalog,
  });
  assert.equal(empty.ok, false);
  assert.equal(empty.jobs.length, 0);
  assert.ok(empty.errors.some((issue) => issue.code === "MISSING_EVENT_ASSIGNMENT"));
});

test("custom roster import does not invent an event assignment from division", () => {
  const catalog = catalogFromEditableEntries([
    {
      id: "geometry-sprint",
      name: "Geometry Sprint",
      group: TEST_GROUPS.INDIVIDUAL,
      division: "theta",
      code: "901",
      active: true,
    },
  ]);
  const parsed = parseRegistrationInput(
    "Roster: Example High School #1234\nDoe, Jane Theta 123400130",
    {
      format: "roster",
      catalog,
      inferIndividualFromDivision: false,
    },
  );

  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].individualTest, "");
  const packet = buildPacket({
    schoolName: parsed.schoolName,
    records: parsed.records,
    profile: CONVENTION_PROFILES.custom,
    catalog,
  });
  assert.equal(packet.ok, false);
  assert.ok(packet.errors.some((issue) => issue.code === "MISSING_EVENT_ASSIGNMENT"));
});

test("custom CSV accepts the minimal headers and Event 1 alias", () => {
  const parsed = parseRegistrationInput(
    [
      "Student Name,Student ID,School,Event 1",
      "Sample Student,123400130,Example High School,Sample Event A",
    ].join("\n"),
    {
      format: "csv",
      requiredHeaders: ["student_name", "state_id"],
    },
  );

  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.warnings, []);
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].studentName, "Sample Student");
  assert.equal(parsed.records[0].stateId, "123400130");
  assert.equal(parsed.records[0].schoolName, "Example High School");
  assert.equal(parsed.records[0].individualTest, "Sample Event A");
  assert.equal(parsed.records[0].round1Test, undefined);
});

test("National imports require a Round 3 column", () => {
  const parsed = parseRegistrationInput(
    [
      "Student Name,Student ID,Individual,Round 1,Round 2",
      "Sample Student,123400130,Theta Individual,Analytic Geometry (Theta),Logs & Exponents (Theta)",
    ].join("\n"),
    {
      format: "csv",
      requiredHeaders: [...REQUIRED_HEADERS, "round_3_test"],
    },
  );

  assert.equal(parsed.records.length, 0);
  assert.ok(
    parsed.errors.some(
      (issue) => issue.code === "MISSING_HEADER" && issue.field === "round_3_test",
    ),
  );
});

test("the downloadable State, National, and custom CSV templates are valid examples", () => {
  const stateText = readFileSync(
    new URL("../samples/state-registration-template.csv", import.meta.url),
    "utf8",
  );
  const stateParsed = parseRegistrationInput(stateText, {
    format: "csv",
    requiredHeaders: ["student_name", "state_id"],
  });
  assert.deepEqual(stateParsed.errors, []);
  const statePacket = buildPacket({
    schoolName: "",
    records: stateParsed.records,
    profile: CONVENTION_PROFILES.state,
    catalog: CONVENTION_PROFILES.state.catalog,
  });
  assert.equal(statePacket.ok, true);
  assert.equal(statePacket.jobs.length, 9);

  const nationalText = readFileSync(
    new URL("../samples/national-registration-template.csv", import.meta.url),
    "utf8",
  );
  const nationalParsed = parseRegistrationInput(nationalText, {
    format: "csv",
    requiredHeaders: ["student_name", "state_id"],
  });
  assert.deepEqual(nationalParsed.errors, []);
  const reviewedNationalCatalog = catalogFromEditableEntries(
    CONVENTION_PROFILES.national.catalog.map((event, index) => ({
      ...event,
      code: String(800 + index),
      status: "operational",
      blocking: false,
    })),
    { baseCatalog: CONVENTION_PROFILES.national.catalog },
  );
  const nationalPacket = buildPacket({
    schoolName: "",
    records: nationalParsed.records,
    profile: CONVENTION_PROFILES.national,
    catalog: reviewedNationalCatalog,
  });
  assert.equal(nationalPacket.ok, true);
  assert.equal(nationalPacket.jobs.length, 8);

  const customText = readFileSync(
    new URL("../samples/custom-famat-event-template.csv", import.meta.url),
    "utf8",
  );
  const customParsed = parseRegistrationInput(customText, {
    format: "csv",
    requiredHeaders: ["student_name", "state_id"],
  });
  assert.deepEqual(customParsed.errors, []);
  const customPacket = buildPacket({
    schoolName: "",
    records: customParsed.records,
    profile: CONVENTION_PROFILES.custom,
    catalog: customCatalog(),
  });
  assert.equal(customPacket.ok, true);
  assert.equal(customPacket.jobs.length, 4);
});
