import test from "node:test";
import assert from "node:assert/strict";

import {
  CATALOG_METADATA,
  CONVENTION_PROFILES,
  TEST_CATALOG,
  TEST_GROUPS,
  catalogWithCodeOverrides,
  inferIndividualTestFromDivision,
  resolveTestReference,
  testsForGroup,
} from "../src/catalog.js";
import {
  parseDelimitedRegistration,
  parseRegistrationInput,
  parseRosterText,
} from "../src/parser.js";
import {
  buildPacket,
  sortJobs,
  validateSchoolName,
  validateStateId,
} from "../src/model.js";

const EXPECTED_CODES = Object.freeze({
  "theta-individual": "231",
  "alpha-individual": "241",
  "mu-individual": "251",
  "statistics-individual": "261",
  "chi-individual": "291",
  "round-1-statistics-unplugged": "301",
  "round-1-gemini": "302",
  "round-1-theta-applications": "331",
  "round-1-theta-functions": "332",
  "round-1-theta-cpav": "333",
  "round-1-alpha-equations-inequalities": "341",
  "round-1-alpha-analytic-geometry": "342",
  "round-1-alpha-trigonometry": "343",
  "round-1-mu-calculus-applications": "351",
  "round-1-mu-integration": "352",
  "round-1-mu-sequences-series": "353",
  "round-2-probability": "401",
  "round-2-history-trigonometry": "402",
  "round-2-theta-equations-inequalities": "431",
  "round-2-theta-logs-exponents": "432",
  "round-2-theta-geometry": "433",
  "round-2-alpha-applications": "441",
  "round-2-alpha-complex-numbers": "442",
  "round-2-alpha-matrices-vectors": "443",
  "round-2-mu-area-volume": "451",
  "round-2-mu-limits-derivatives": "452",
  "round-2-mu-bc-calculus": "453",
});
const EXPECTED_NAMES = Object.freeze({
  "theta-individual": "Theta Individual",
  "alpha-individual": "Alpha Individual",
  "mu-individual": "Calculus Individual",
  "statistics-individual": "Statistics Individual",
  "chi-individual": "Chi Individual",
  "round-1-statistics-unplugged": "Statistics Unplugged (Open)",
  "round-1-gemini": "Gemini (Open)",
  "round-1-theta-applications": "Theta Applications (Theta)",
  "round-1-theta-functions": "Functions (Theta)",
  "round-1-theta-cpav": "CPAV (Theta)",
  "round-1-alpha-equations-inequalities": "Equations & Inequalities (Alpha)",
  "round-1-alpha-analytic-geometry": "Analytic Geometry (Alpha)",
  "round-1-alpha-trigonometry": "Trigonometry (Alpha)",
  "round-1-mu-calculus-applications": "Calculus Applications (Mu)",
  "round-1-mu-integration": "Integration (Mu)",
  "round-1-mu-sequences-series": "Sequences & Series (Mu)",
  "round-2-probability": "Probability (Open)",
  "round-2-history-trigonometry": "History of Math: Trigonometry (Open)",
  "round-2-theta-equations-inequalities": "Equations and Inequalities (Theta)",
  "round-2-theta-logs-exponents": "Logs & Exponents (Theta)",
  "round-2-theta-geometry": "Geometry (Theta)",
  "round-2-alpha-applications": "Alpha Applications (Alpha)",
  "round-2-alpha-complex-numbers": "Complex Numbers (Alpha)",
  "round-2-alpha-matrices-vectors": "Matrices & Vectors (Alpha)",
  "round-2-mu-area-volume": "Area & Volume (Mu)",
  "round-2-mu-limits-derivatives": "Limits & Derivatives (Mu)",
  "round-2-mu-bc-calculus": "BC Calculus (Mu)",
});

function registration(overrides = {}) {
  return {
    studentName: "Rivera, Ana M.",
    stateId: "537702740",
    individualTest: "241",
    round1Test: "342",
    round2Test: "442",
    division: "Alpha",
    source: { format: "test", line: 1 },
    ...overrides,
  };
}

test("catalog contains the confirmed operational mapping including Chi", () => {
  assert.equal(CATALOG_METADATA.conventionYear, 2027);
  assert.match(CATALOG_METADATA.mappingBasis, /operational 2026 scorer mapping/i);
  assert.match(CATALOG_METADATA.status, /operational mapping/i);
  assert.deepEqual(CATALOG_METADATA.pendingItems, []);

  for (const [id, code] of Object.entries(EXPECTED_CODES)) {
    const catalogTest = TEST_CATALOG.find((entry) => entry.id === id);
    assert.ok(catalogTest, `${id} should be in the catalog`);
    assert.equal(catalogTest.code, code);
    assert.equal(catalogTest.name, EXPECTED_NAMES[id]);
    assert.match(catalogTest.code, /^\d{3}$/);
  }

  const chi = TEST_CATALOG.find((entry) => entry.id === "chi-individual");
  assert.equal(chi.code, "291");
  assert.equal(chi.name, EXPECTED_NAMES["chi-individual"]);
  assert.equal(chi.status, "operational");
  assert.equal(chi.blocking, false);
  assert.equal(TEST_CATALOG.length, Object.keys(EXPECTED_CODES).length);
  assert.equal(testsForGroup(TEST_GROUPS.ROUND_1).length, 11);
  assert.equal(testsForGroup(TEST_GROUPS.ROUND_2).length, 11);
});

test("catalog resolution respects round groups and refuses ambiguity", () => {
  assert.equal(resolveTestReference("342", TEST_GROUPS.ROUND_1).test.name, "Analytic Geometry (Alpha)");
  assert.equal(resolveTestReference("Probability", TEST_GROUPS.ROUND_2).test.code, "401");
  assert.equal(resolveTestReference("Trigonometry", TEST_GROUPS.ROUND_1).test.code, "343");
  assert.equal(resolveTestReference("Trigonometry", TEST_GROUPS.ROUND_2).test.code, "402");
  assert.equal(resolveTestReference("applications", TEST_GROUPS.ROUND_1).status, "ambiguous");
  assert.equal(resolveTestReference("401", TEST_GROUPS.ROUND_1).status, "wrong_group");
  assert.equal(resolveTestReference("Chi Individual", TEST_GROUPS.INDIVIDUAL).status, "resolved");
  assert.equal(resolveTestReference("Chi Individual", TEST_GROUPS.INDIVIDUAL).test.code, "291");
});

test("division aliases infer every current individual test including confirmed Chi", () => {
  assert.equal(inferIndividualTestFromDivision("Algebra II").code, "231");
  assert.equal(inferIndividualTestFromDivision("Pre-Calculus").code, "241");
  assert.equal(inferIndividualTestFromDivision("Calculus").code, "251");
  assert.equal(inferIndividualTestFromDivision("Stats").code, "261");
  assert.equal(inferIndividualTestFromDivision("Chi").id, "chi-individual");
  assert.equal(inferIndividualTestFromDivision("Chi").code, "291");
});

test("reviewed code overrides can replace a confirmed code without mutating the base catalog", () => {
  const baseChi = TEST_CATALOG.find((entry) => entry.id === "chi-individual");
  const reviewedCatalog = catalogWithCodeOverrides({ "chi-individual": "271" });
  const reviewedChi = reviewedCatalog.find((entry) => entry.id === "chi-individual");

  assert.notEqual(reviewedCatalog, TEST_CATALOG);
  assert.equal(baseChi.code, "291");
  assert.equal(baseChi.status, "operational");
  assert.equal(baseChi.blocking, false);
  assert.equal(reviewedChi.code, "271");
  assert.equal(reviewedChi.status, "operational");
  assert.equal(reviewedChi.blocking, false);
  assert.equal(
    resolveTestReference("271", TEST_GROUPS.INDIVIDUAL, reviewedCatalog).test.id,
    "chi-individual",
  );
  assert.equal(inferIndividualTestFromDivision("Chi", reviewedCatalog).code, "271");
});

test("catalog overrides reject invalid, duplicate, and unknown codes", () => {
  assert.throws(
    () => catalogWithCodeOverrides({ "chi-individual": "27" }),
    /exactly three digits/i,
  );
  assert.throws(
    () => catalogWithCodeOverrides({ "chi-individual": "231" }),
    /assigned to both/i,
  );
  assert.throws(
    () => catalogWithCodeOverrides({ "not-a-test": "271" }),
    /unknown catalog test id/i,
  );
});

test("CSV parser preserves comma-containing names, spaced IDs, and CRLF input", () => {
  const input = [
    "student_name,state_id,individual_test,round_1_test,round_2_test",
    '"Rivera, Ana M.",5 3 7 7 0 2 7 4 0,Alpha Individual,342,442',
    '"de la Cruz, Mateo J., Jr.",537700150,231,331,433',
  ].join("\r\n");

  const result = parseDelimitedRegistration(input);
  assert.equal(result.format, "csv");
  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 2);
  assert.equal(result.records[0].studentName, "Rivera, Ana M.");
  assert.equal(result.records[0].stateId, "537702740");
  assert.equal(result.records[1].studentName, "de la Cruz, Mateo J., Jr.");
});

test("CSV parser accepts the documented friendly column headings", () => {
  const input = [
    "Student Name,State ID,Individual,Round 1,Round 2",
    '"Rivera, Ana M.",537702740,Alpha Individual,Analytic Geometry,Complex Numbers',
  ].join("\n");

  const result = parseDelimitedRegistration(input);
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(result.records.length, 1);
  assert.deepEqual(
    {
      studentName: result.records[0].studentName,
      stateId: result.records[0].stateId,
      individualTest: result.records[0].individualTest,
      round1Test: result.records[0].round1Test,
      round2Test: result.records[0].round2Test,
    },
    {
      studentName: "Rivera, Ana M.",
      stateId: "537702740",
      individualTest: "Alpha Individual",
      round1Test: "Analytic Geometry",
      round2Test: "Complex Numbers",
    },
  );
});

test("CSV parser accepts the participant packet's exact No Team STATE ID heading", () => {
  const input = [
    "Student Name,No Team STATE ID,Individual,Round 1,Round 2",
    '"Sample, Student",123400190,Chi Individual,331,433',
  ].join("\n");

  const result = parseRegistrationInput(input);

  assert.deepEqual(result.errors, []);
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].studentName, "Sample, Student");
  assert.equal(result.records[0].stateId, "123400190");
  assert.equal(result.records[0].individualTest, "Chi Individual");
});

test("pasted unquoted CSV name commas are recovered and reported", () => {
  const input = [
    "student_name,state_id,individual_test,round_1_test,round_2_test",
    "Rivera, Ana M.,537702740,241,342,442",
  ].join("\n");
  const result = parseRegistrationInput(input);
  assert.equal(result.records[0].studentName, "Rivera, Ana M.");
  assert.ok(result.warnings.some((issue) => issue.code === "UNQUOTED_NAME_COMMA_RECOVERED"));
});

test("TSV parser supports pasted rows with the required headers", () => {
  const input = [
    "student_name\tstate_id\tindividual_test\tround_1_test\tround_2_test",
    "Nguyen, Linh\t537701240\tTheta Individual\tTheta Functions\tTheta Geometry",
  ].join("\n");
  const result = parseRegistrationInput(input);
  assert.equal(result.format, "tsv");
  assert.deepEqual(result.errors, []);
  assert.equal(result.records[0].round1Test, "Theta Functions");
});

test("delimited parser reports missing headers and row field mismatches", () => {
  const missing = parseDelimitedRegistration("student_name,state_id\nAna,537702740");
  assert.equal(missing.records.length, 0);
  assert.ok(missing.errors.filter((issue) => issue.code === "MISSING_HEADER").length >= 3);

  const shortRow = parseDelimitedRegistration(
    "student_name,state_id,individual_test,round_1_test,round_2_test\nAna,537702740,241,342",
  );
  assert.ok(shortRow.errors.some((issue) => issue.code === "FIELD_COUNT_MISMATCH"));
  assert.equal(shortRow.records.length, 1);
});

test("roster parser handles spaced digits, full names, variants, and pseudo rows", () => {
  const roster = [
    "Roster: Doral Academy Preparatory School #5377",
    "Student Name Division Team 1 ID Team 2 ID No Team ID",
    "Rivera, Ana M. (Annie) Alpha 5 3 7 7 0 2 7 4 1  5 3 7 7 0 2 7 4 2  5 3 7 7 0 2 7 4 0",
    "de la Cruz, Mateo J., Jr. (MJ) Mu 537700151 537700152 537700150",
    "1Alg, 1Alg Theta 537799931 537799932 537799930",
    "Nguyen, Linh Statistics",
    "537700661 537700662 537700660",
  ].join("\n");

  const result = parseRosterText(roster);
  assert.equal(result.schoolName, "Doral Academy Preparatory School");
  assert.equal(result.schoolCode, "5377");
  assert.equal(result.records.length, 3);
  assert.equal(result.records[0].studentName, "Rivera, Ana M. (Annie)");
  assert.equal(result.records[0].stateId, "537702740");
  assert.equal(result.records[0].individualTest, "alpha-individual");
  assert.equal(result.records[1].studentName, "de la Cruz, Mateo J., Jr. (MJ)");
  assert.equal(result.records[1].individualTest, "mu-individual");
  assert.equal(result.records[2].studentName, "Nguyen, Linh");
  assert.equal(result.records[2].individualTest, "statistics-individual");
  assert.ok(result.warnings.some((issue) => issue.code === "PSEUDO_ROW_SKIPPED"));
  assert.deepEqual(result.errors, []);
});

test("roster parser retains malformed rows and reports inconsistent team IDs", () => {
  const result = parseRosterText(
    "Roster: Example High School #1234\nDoe, Jamie Theta 123400131 123400242 123400130",
  );
  assert.equal(result.records.length, 1);
  assert.equal(result.records[0].stateId, "123400130");
  assert.ok(result.errors.some((issue) => issue.code === "INCONSISTENT_TEAM_IDS"));
});

test("roster parser reports non-header text instead of silently dropping it", () => {
  const result = parseRosterText(
    "Roster: Example High School #1234\nThis line cannot be interpreted\nDoe, Jamie Theta 123400131 123400132 123400130",
  );
  assert.equal(result.records.length, 1);
  assert.ok(result.errors.some((issue) => issue.code === "UNRECOGNIZED_ROSTER_LINE"));
});

test("school and state-ID validators enforce production invariants", () => {
  assert.equal(validateSchoolName("Doral Academy").valid, true);
  assert.equal(validateSchoolName("Doral").code, "INCOMPLETE_SCHOOL_NAME");
  assert.equal(validateStateId("5 3 7 7 0 2 7 4 0").normalized, "537702740");
  assert.equal(validateStateId("537702740").valid, true);
  assert.equal(validateStateId("53770274").code, "INVALID_STATE_ID");
  assert.equal(validateStateId("537702741").code, "STATE_ID_NOT_NO_TEAM");
  assert.equal(validateStateId("537702741", { profile: { id: "national" } }).valid, true);
  assert.equal(validateStateId("537702749", { profile: { id: "custom" } }).valid, true);
});

test("model creates exactly three deterministic jobs per valid student", () => {
  const result = buildPacket({
    schoolName: "Doral Academy Preparatory School",
    schoolCode: "5377",
    records: [
      registration({ studentName: "Zulu, Zoe", stateId: "537700140", round1Test: "343" }),
      registration({ studentName: "Adams, Ava", stateId: "537700240", round1Test: "341" }),
    ],
    sortBy: "student",
  });

  assert.equal(result.ok, true);
  assert.equal(result.jobs.length, 6);
  assert.equal(result.summary.sheetCount, 6);
  assert.deepEqual(result.jobs.slice(0, 3).map((job) => job.studentName), [
    "Adams, Ava",
    "Adams, Ava",
    "Adams, Ava",
  ]);
  assert.deepEqual(result.jobs.slice(0, 3).map((job) => job.group), [
    "individual",
    "round_1",
    "round_2",
  ]);
  assert.deepEqual(result.jobs.map((job) => job.sheetIndex), [0, 1, 2, 3, 4, 5]);
});

test("model can sort packets by test code and then student", () => {
  const base = buildPacket({
    schoolName: "Doral Academy Preparatory School",
    records: [
      registration({ studentName: "Zulu, Zoe", stateId: "537700140", round1Test: "343" }),
      registration({ studentName: "Adams, Ava", stateId: "537700240", round1Test: "341" }),
    ],
    sortBy: "test",
  });
  assert.equal(base.ok, true);
  assert.deepEqual(base.jobs.map((job) => job.testCode), ["241", "241", "341", "343", "442", "442"]);
  assert.equal(base.jobs[0].studentName, "Adams, Ava");

  const reversed = sortJobs([...base.jobs].reverse(), "test");
  assert.deepEqual(
    reversed.map((job) => job.key),
    base.jobs.map((job) => job.key),
  );
});

test("model infers an individual test from roster division", () => {
  const result = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        stateId: "537700130",
        division: "Algebra II",
        individualTest: "",
        round1Test: "331",
        round2Test: "433",
      }),
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.jobs[0].testCode, "231");
});

test("State IDs set the division; chart-allowed higher divisions print with their own 8th digit", () => {
  // A Geometry/Algebra II ID (digit 3) may enter Alpha at State (Sponsors' Guide chart).
  const higherDivision = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        stateId: "537700130",
        division: "Alpha",
        individualTest: "241",
      }),
    ],
  });
  assert.equal(higherDivision.ok, true);
  assert.ok(higherDivision.warnings.some((issue) => issue.code === "DIVISION_COLUMN_MISMATCH"));
  assert.equal(
    higherDivision.jobs.find((job) => job.testId === "alpha-individual").stateId,
    "537700140",
  );
  assert.ok(
    higherDivision.jobs
      .filter((job) => job.group !== TEST_GROUPS.INDIVIDUAL)
      .every((job) => job.stateId === "537700130"),
  );

  const unsupportedDigit = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        stateId: "537700170",
        division: "",
        individualTest: "241",
      }),
    ],
  });
  assert.equal(unsupportedDigit.ok, false);
  assert.ok(
    unsupportedDigit.errors.some((issue) => issue.code === "ID_DIVISION_DIGIT_UNKNOWN"),
  );

  const testingDown = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        stateId: "537700140",
        division: "Alpha",
        individualTest: "231",
      }),
    ],
  });
  assert.equal(testingDown.ok, false);
  assert.ok(
    testingDown.errors.some(
      (issue) => issue.code === "DIVISION_NOT_ALLOWED" && issue.testId === "theta-individual",
    ),
  );
});

test("confirmed Chi derives from State ID digit 9 and produces code 291", () => {
  const result = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        stateId: "537700190",
        division: "Chi",
        individualTest: "",
        round1Test: "331",
        round2Test: "433",
      }),
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.jobs.length, 3);
  assert.equal(result.jobs[0].testId, "chi-individual");
  assert.equal(result.jobs[0].testCode, "291");
});

test("a reviewed Chi override drives packet validation and generated jobs", () => {
  const reviewedCatalog = catalogWithCodeOverrides({ "chi-individual": "271" });
  const result = buildPacket({
    schoolName: "Example High School",
    catalog: reviewedCatalog,
    records: [
      registration({
        stateId: "537700190",
        division: "Chi",
        individualTest: "",
        round1Test: "331",
        round2Test: "433",
      }),
    ],
  });
  assert.equal(result.ok, true);
  assert.equal(result.jobs.length, 3);
  assert.equal(result.jobs[0].testId, "chi-individual");
  assert.equal(result.jobs[0].testCode, "271");
});

test("topic eligibility allows Open, same-division, and upward ladder assignments", () => {
  const reviewedCatalog = catalogWithCodeOverrides({ "chi-individual": "271" });
  const result = buildPacket({
    schoolName: "Example High School",
    catalog: reviewedCatalog,
    records: [
      registration({
        studentName: "Chi, Casey",
        stateId: "537700190",
        division: "Chi",
        individualTest: "271",
        round1Test: "331",
        round2Test: "453",
      }),
      registration({
        studentName: "Theta, Taylor",
        stateId: "537700120",
        division: "Theta",
        individualTest: "231",
        round1Test: "331",
        round2Test: "442",
      }),
      registration({
        studentName: "Alpha, Avery",
        stateId: "537700140",
        division: "Alpha",
        individualTest: "241",
        round1Test: "341",
        round2Test: "451",
      }),
      registration({
        studentName: "Mu, Morgan",
        stateId: "537700150",
        division: "Mu",
        individualTest: "251",
        round1Test: "301",
        round2Test: "401",
      }),
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.jobs.length, 12);
  assert.equal(result.errors.some((issue) => issue.code === "DOWNWARD_TOPIC_ASSIGNMENT"), false);
});

test("topic eligibility rejects downward ladder assignments, including without a roster division", () => {
  const result = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        studentName: "Mu, Morgan",
        stateId: "537700150",
        division: "Mu",
        individualTest: "251",
        round1Test: "331",
        round2Test: "442",
      }),
      registration({
        studentName: "Inferred, Indy",
        stateId: "537700250",
        division: null,
        individualTest: "251",
        round1Test: "341",
        round2Test: "433",
      }),
    ],
  });

  const downwardIssues = result.errors.filter(
    (issue) => issue.code === "DOWNWARD_TOPIC_ASSIGNMENT",
  );
  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.equal(downwardIssues.length, 4);
  assert.ok(downwardIssues.every((issue) => issue.field === "tests"));
  assert.deepEqual(
    downwardIssues.map((issue) => [issue.studentDivision, issue.testDivision]),
    [
      ["mu", "theta"],
      ["mu", "alpha"],
      ["mu", "alpha"],
      ["mu", "theta"],
    ],
  );
});

test("Statistics State IDs take any topic unless a previous-year ID sets a level", () => {
  const anyTopic = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        stateId: "537702760",
        division: "Statistics",
        individualTest: "261",
        round1Test: "331",
        round2Test: "442",
      }),
    ],
  });
  assert.equal(anyTopic.ok, true);
  assert.equal(anyTopic.jobs.length, 3);

  const previousAlpha = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        stateId: "537702760",
        previousIds: "537702740",
        division: "Statistics",
        individualTest: "261",
        round1Test: "331",
        round2Test: "442",
      }),
    ],
  });
  assert.equal(previousAlpha.ok, false);
  assert.deepEqual(
    previousAlpha.errors
      .filter((issue) => issue.code === "DOWNWARD_TOPIC_ASSIGNMENT")
      .map((issue) => issue.testId),
    ["round-1-theta-applications"],
  );

  const previousStatistics = buildPacket({
    schoolName: "Example High School",
    records: [registration({ previousIds: "537702760", individualTest: "261" })],
  });
  assert.ok(
    previousStatistics.errors.some(
      (issue) => issue.code === "DIVISION_NOT_ALLOWED" && issue.testId === "statistics-individual",
    ),
  );

  // The older course question is retained but switched off; turning it on restores it.
  const courseProfile = { ...CONVENTION_PROFILES.state, courseEligibilityQuestions: true };
  const withCourseLevel = buildPacket({
    schoolName: "Example High School",
    profile: courseProfile,
    records: [
      registration({
        stateId: "537702760",
        division: "Statistics",
        eligibilityBasis: "Alpha",
        individualTest: "261",
        round1Test: "331",
        round2Test: "442",
      }),
    ],
  });
  assert.ok(
    withCourseLevel.errors.some(
      (issue) =>
        issue.code === "DOWNWARD_TOPIC_ASSIGNMENT" && issue.testId === "round-1-theta-applications",
    ),
  );
});

test("catalog eligible-divisions restrictions apply to State Open events", () => {
  const restrictedCatalog = TEST_CATALOG.map((event) =>
    event.id === "round-1-statistics-unplugged"
      ? { ...event, eligibleDivisions: ["alpha"] }
      : event,
  );
  const blocked = buildPacket({
    schoolName: "Example High School",
    catalog: restrictedCatalog,
    records: [
      registration({
        stateId: "537702730",
        division: "Theta",
        eligibilityBasis: "Theta",
        individualTest: "231",
        round1Test: "301",
        round2Test: "433",
      }),
    ],
  });
  assert.equal(blocked.ok, false);
  assert.ok(
    blocked.errors.some(
      (issue) => issue.code === "EVENT_DIVISION_INELIGIBLE" && issue.field === "tests",
    ),
  );

  const allowed = buildPacket({
    schoolName: "Example High School",
    catalog: restrictedCatalog,
    records: [registration({ round1Test: "301" })],
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.jobs.length, 3);
});

test("unknown and ambiguous tests block the packet; misplaced and repeated columns are reported", () => {
  const result = buildPacket({
    schoolName: "Example High School",
    records: [
      registration({
        individualTest: "301",
        round1Test: "applications",
        round2Test: "",
      }),
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.ok(
    result.warnings.some(
      (issue) => issue.code === "WRONG_TEST_GROUP" && issue.testId === "round-1-statistics-unplugged",
    ),
  );
  assert.ok(result.errors.some((issue) => issue.code === "AMBIGUOUS_TEST"));

  const unknown = buildPacket({
    schoolName: "Example High School",
    records: [registration({ round1Test: "Not a real test" })],
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.jobs.length, 0);
  assert.ok(unknown.errors.some((issue) => issue.code === "UNKNOWN_TEST"));

  const nothingChecked = buildPacket({
    schoolName: "Example High School",
    records: [registration({ tests: [] })],
  });
  assert.equal(nothingChecked.ok, false);
  assert.ok(
    nothingChecked.errors.some(
      (issue) => issue.code === "MISSING_EVENT_ASSIGNMENT" && issue.field === "tests",
    ),
  );
});

test("Speed and Mental events remain excluded even if an edited catalog assigns a code", () => {
  const editedCatalog = Object.freeze(
    TEST_CATALOG.map((catalogTest) =>
      catalogTest.id === "round-1-alpha-analytic-geometry"
        ? Object.freeze({ ...catalogTest, name: "Speed Mathematics", aliases: ["speed"] })
        : catalogTest,
    ),
  );
  const result = buildPacket({
    schoolName: "Example High School",
    catalog: editedCatalog,
    records: [registration({ round1Test: "speed" })],
  });

  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.ok(result.errors.some((issue) => issue.code === "NON_SCANTRON_EVENT"));
});

test("duplicates and inconsistent school prefixes block the complete packet", () => {
  const result = buildPacket({
    schoolName: "Example High School",
    schoolCode: "5377",
    records: [
      registration(),
      registration({ studentName: "Copy, Casey" }),
      registration({ studentName: "Other, Olivia", stateId: "999900140" }),
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.ok(result.errors.some((issue) => issue.code === "DUPLICATE_STATE_ID"));
  assert.ok(result.errors.some((issue) => issue.code === "SCHOOL_PREFIX_MISMATCH"));
});

test("parser errors are carried into the model and no output is silently partial", () => {
  const parsed = parseDelimitedRegistration(
    "student_name,state_id,individual_test,round_1_test,round_2_test\nAna,537702740,241,342",
  );
  const result = buildPacket({
    ...parsed,
    schoolName: "Example High School",
  });
  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.ok(result.errors.some((issue) => issue.code === "FIELD_COUNT_MISMATCH"));
});
