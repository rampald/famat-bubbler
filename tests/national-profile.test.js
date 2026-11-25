import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVENTION_PROFILES,
  NATIONAL_TEST_CATALOG,
  TEST_GROUPS,
  catalogWithCodeOverrides,
  testsForGroup,
} from "../src/catalog.js";
import { buildPacket } from "../src/model.js";

const SCHOOL_NAME = "Example High School";

function nationalRegistration(overrides = {}) {
  return {
    studentName: "Rivera, Ana M.",
    stateId: "537702740",
    division: "Theta",
    individualTest: "national-theta-individual",
    round1Test: "national-round-1-theta-applications",
    round2Test: "national-round-2-theta-triangles",
    round3Test: "national-round-3-theta-sequences-series",
    source: { format: "test", line: 1 },
    ...overrides,
  };
}

function reviewedNationalCatalog(entries) {
  // These 9xx values are deliberately synthetic test fixtures, not claims
  // about official National Convention scorer codes.
  return catalogWithCodeOverrides(entries, NATIONAL_TEST_CATALOG);
}

test("National profile contains three Individuals and 33 topics split 11 per round", () => {
  assert.equal(
    testsForGroup(TEST_GROUPS.INDIVIDUAL, NATIONAL_TEST_CATALOG).length,
    3,
  );
  assert.equal(testsForGroup(TEST_GROUPS.ROUND_1, NATIONAL_TEST_CATALOG).length, 11);
  assert.equal(testsForGroup(TEST_GROUPS.ROUND_2, NATIONAL_TEST_CATALOG).length, 11);
  assert.equal(testsForGroup(TEST_GROUPS.ROUND_3, NATIONAL_TEST_CATALOG).length, 11);
  assert.equal(
    NATIONAL_TEST_CATALOG.filter((entry) => entry.group !== TEST_GROUPS.INDIVIDUAL).length,
    33,
  );
  assert.equal(NATIONAL_TEST_CATALOG.length, 36);
  assert.deepEqual(
    CONVENTION_PROFILES.national.assignments.map(({ field, group }) => [field, group]),
    [
      ["individualTest", TEST_GROUPS.INDIVIDUAL],
      ["round1Test", TEST_GROUPS.ROUND_1],
      ["round2Test", TEST_GROUPS.ROUND_2],
      ["round3Test", TEST_GROUPS.ROUND_3],
    ],
  );
});

test("National base catalog keeps every scorer code pending and blocks generation", () => {
  assert.ok(
    NATIONAL_TEST_CATALOG.every(
      (entry) => entry.code === null && entry.status === "pending" && entry.blocking === true,
    ),
  );

  const result = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.national,
    records: [nationalRegistration()],
  });

  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.equal(
    result.errors.filter((issue) => issue.code === "PENDING_TEST_CODE").length,
    4,
  );
});

test("reviewed synthetic National overrides produce four jobs and allow same, upward, and Open topics", () => {
  const selections = {
    individualTest: "national-theta-individual",
    round1Test: "national-round-1-theta-applications",
    round2Test: "national-round-2-alpha-trigonometry",
    round3Test: "national-round-3-open-number-theory",
  };
  const catalog = reviewedNationalCatalog({
    [selections.individualTest]: "990",
    [selections.round1Test]: "991",
    [selections.round2Test]: "992",
    [selections.round3Test]: "993",
  });
  const result = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.national,
    catalog,
    records: [nationalRegistration(selections)],
  });

  assert.equal(result.ok, true);
  assert.equal(result.profileId, "national");
  assert.equal(result.jobs.length, 4);
  assert.equal(result.summary.sheetCount, 4);
  assert.deepEqual(
    result.jobs.map((job) => job.group),
    [TEST_GROUPS.INDIVIDUAL, TEST_GROUPS.ROUND_1, TEST_GROUPS.ROUND_2, TEST_GROUPS.ROUND_3],
  );
  assert.deepEqual(
    result.jobs.map((job) => job.testCode),
    ["990", "991", "992", "993"],
  );
  assert.equal(
    result.errors.some((issue) => issue.code === "DOWNWARD_TOPIC_ASSIGNMENT"),
    false,
  );
});

test("National profile rejects downward topic assignments", () => {
  const selections = {
    individualTest: "national-mu-individual",
    round1Test: "national-round-1-theta-applications",
    round2Test: "national-round-2-alpha-trigonometry",
    round3Test: "national-round-3-mu-comprehensive",
  };
  const catalog = reviewedNationalCatalog({
    [selections.individualTest]: "990",
    [selections.round1Test]: "991",
    [selections.round2Test]: "992",
    [selections.round3Test]: "993",
  });
  const result = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.national,
    catalog,
    records: [nationalRegistration({ ...selections, division: "Mu" })],
  });
  const downwardIssues = result.errors.filter(
    (issue) => issue.code === "DOWNWARD_TOPIC_ASSIGNMENT",
  );

  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.deepEqual(
    downwardIssues.map((issue) => [issue.field, issue.studentDivision, issue.testDivision]),
    [
      ["tests", "mu", "theta"],
      ["tests", "mu", "alpha"],
    ],
  );
});

test("National students may move up a division but never test down", () => {
  const selections = {
    individualTest: "national-mu-individual",
    round1Test: "national-round-1-alpha-applications",
    round2Test: "national-round-2-mu-integration",
    round3Test: "national-round-3-open-codes-ciphers",
  };
  const catalog = reviewedNationalCatalog({
    [selections.individualTest]: "990",
    [selections.round1Test]: "991",
    [selections.round2Test]: "992",
    [selections.round3Test]: "993",
    "national-alpha-individual": "994",
  });
  const upward = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.national,
    catalog,
    records: [nationalRegistration({ ...selections, division: "Alpha" })],
  });
  assert.equal(upward.ok, true);
  assert.equal(upward.jobs.length, 4);

  const downward = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.national,
    catalog,
    records: [
      nationalRegistration({
        ...selections,
        individualTest: "national-alpha-individual",
        round1Test: "national-round-1-mu-applications",
        division: "Mu",
      }),
    ],
  });
  const notAllowed = downward.errors.find((issue) => issue.code === "DIVISION_NOT_ALLOWED");

  assert.equal(downward.ok, false);
  assert.equal(downward.jobs.length, 0);
  assert.equal(notAllowed?.field, "tests");
  assert.equal(notAllowed?.testId, "national-alpha-individual");
});

test("State remains the default three-job packet profile", () => {
  const result = buildPacket({
    schoolName: SCHOOL_NAME,
    records: [
      {
        studentName: "Rivera, Ana M.",
        stateId: "537702740",
        division: "Alpha",
        individualTest: "241",
        round1Test: "342",
        round2Test: "442",
        source: { format: "test", line: 1 },
      },
    ],
  });

  assert.equal(result.ok, true);
  assert.equal(result.profileId, "state");
  assert.equal(result.jobs.length, 3);
  assert.equal(result.summary.sheetCount, 3);
  assert.deepEqual(
    result.jobs.map((job) => job.group),
    [TEST_GROUPS.INDIVIDUAL, TEST_GROUPS.ROUND_1, TEST_GROUPS.ROUND_2],
  );
});
