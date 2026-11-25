import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVENTION_PROFILES,
  REGIONAL_TEST_CATALOG,
  TEST_GROUPS,
  catalogFromEditableEntries,
} from "../src/catalog.js";
import {
  REGIONAL_ELIGIBILITY_CHART,
  evaluateDivisionEligibility,
  idForTest,
  parsePreviousIds,
  sameRoundIndividualPairs,
} from "../src/eligibility.js";
import { buildPacket, initialTestReferences } from "../src/model.js";
import { parseDelimitedRegistration } from "../src/parser.js";
import { mergeParsedSources } from "../src/batch.js";

const SCHOOL = "Sample Academy";

function regionalCatalog() {
  const codes = { "algebra-1": "111", geometry: "121", "algebra-2": "131", precalculus: "141", calculus: "151", statistics: "161" };
  const entries = REGIONAL_TEST_CATALOG.map((entry) => ({
    ...entry,
    code: codes[entry.id.replace(/^regional-|-individual$/g, "")],
  }));
  entries.push({
    id: "sample-open",
    name: "Sample Open",
    group: TEST_GROUPS.OPTIONAL,
    division: "open",
    code: "901",
    eventRole: "optional-open",
    producesScantron: true,
    eligibleDivisions: ["all"],
  });
  return catalogFromEditableEntries(entries, { baseCatalog: REGIONAL_TEST_CATALOG });
}

function regional(records) {
  return buildPacket({
    schoolName: SCHOOL,
    profile: CONVENTION_PROFILES.regional,
    catalog: regionalCatalog(),
    records,
  });
}

function student(overrides = {}) {
  return { studentName: "Jordan Lee", stateId: "123400140", source: { format: "test", line: 2 }, ...overrides };
}

test("the 8th digit selects the Sponsors' Guide chart row and the pre-checked division", () => {
  const expected = {
    1: ["algebra_1", "geometry", "algebra_2", "precalculus", "calculus", "statistics"],
    2: ["geometry", "algebra_2", "precalculus", "calculus", "statistics"],
    3: ["geometry", "algebra_2", "precalculus", "calculus", "statistics"],
    4: ["precalculus", "calculus", "statistics"],
    5: ["calculus", "statistics"],
    6: ["algebra_1", "geometry", "algebra_2", "precalculus", "calculus", "statistics"],
  };
  const defaults = { 1: "algebra_1", 2: "geometry", 3: "algebra_2", 4: "precalculus", 5: "calculus", 6: "statistics" };
  for (const digit of Object.keys(expected)) {
    const evaluation = evaluateDivisionEligibility({ profile: "regional", currentId: `1234001${digit}0` });
    assert.deepEqual([...evaluation.allowedDivisions], expected[digit], `digit ${digit}`);
    assert.deepEqual([...REGIONAL_ELIGIBILITY_CHART[digit]], expected[digit]);
    assert.equal(evaluation.defaultDivision, defaults[digit]);
  }
  const statistics = evaluateDivisionEligibility({ profile: "regional", currentId: "123400160" });
  assert.deepEqual(
    statistics.divisions.filter((row) => row.conditional).map((row) => row.division),
    ["algebra_1", "geometry", "algebra_2"],
  );
  const noId = evaluateDivisionEligibility({ profile: "regional", currentId: "" });
  assert.deepEqual([...noId.allowedDivisions], []);
});

test("previous-year IDs remove divisions: one-year eligibility, never testing down, Statistics once", () => {
  const cases = [
    ["123400220", "123400110", ["geometry", "algebra_2", "precalculus", "calculus", "statistics"]],
    ["123400330", "123400220", ["algebra_2", "precalculus", "calculus", "statistics"]],
    // Geometry counts as lower than Algebra II across years.
    ["123400220", "123400330", ["precalculus", "calculus", "statistics"]],
    ["123400440", "123400550", ["calculus", "statistics"]],
    ["123400440", "123400440; 123400460", ["precalculus", "calculus"]],
    // Chart note **: a Statistics student who competed in Algebra II/Geometry.
    ["123400660", "123400330", ["precalculus", "calculus", "statistics"]],
  ];
  for (const [currentId, previousIds, allowed] of cases) {
    const evaluation = evaluateDivisionEligibility({ profile: "regional", currentId, previousIds });
    assert.deepEqual([...evaluation.allowedDivisions], allowed, `${currentId} after ${previousIds}`);
  }
  const blockedDefault = evaluateDivisionEligibility({
    profile: "regional",
    currentId: "123400110",
    previousIds: "123400110",
  });
  assert.equal(blockedDefault.defaultDivision, null);
  assert.ok(blockedDefault.issues.some(({ code }) => code === "ID_DIVISION_NOT_ALLOWED"));
});

test("previous-year ID cells accept several IDs and reject malformed ones", () => {
  assert.deepEqual(parsePreviousIds("123 400 330; 123400440, 123400550 123400660"), {
    ids: ["123400330", "123400440", "123400550", "123400660"],
    invalid: [],
  });
  const packet = regional([student({ previousIds: "12345; 123400470" })]);
  assert.equal(packet.ok, false);
  assert.ok(packet.errors.some(({ code, field }) => code === "PREVIOUS_ID_INVALID" && field === "previousIds"));
  assert.ok(packet.errors.some(({ code }) => code === "PREVIOUS_ID_DIVISION_UNKNOWN"));
});

test("an Events list prints exactly the listed tests; a blank list pre-checks the ID's Individual", () => {
  const listed = regional([student({ events: "Sample Open" })]);
  assert.equal(listed.ok, true);
  assert.deepEqual(listed.jobs.map(({ testCode }) => testCode), ["901"]);

  const blank = regional([student({ events: "" })]);
  assert.deepEqual(blank.jobs.map(({ testCode }) => testCode), ["141"]);

  const review = regional([student({ tests: ["regional-calculus-individual", "sample-open"] })]);
  assert.equal(review.ok, true);
  assert.deepEqual(review.jobs.map(({ stateId, testCode }) => [stateId, testCode]), [
    ["123400150", "151"],
    ["123400140", "901"],
  ]);
  assert.deepEqual(
    initialTestReferences(student({ events: "141; Sample Open; 141" }), {
      profile: CONVENTION_PROFILES.regional,
      catalog: regionalCatalog(),
    }),
    ["regional-precalculus-individual", "sample-open"],
  );
});

test("two Regional Individuals follow note ****, keep the team digit, and warn on the same round", () => {
  const pair = regional([student({ stateId: "123400141", events: "Precalculus Individual; Statistics Individual" })]);
  assert.equal(pair.ok, true);
  assert.deepEqual(pair.jobs.map(({ stateId }) => stateId), ["123400141", "123400161"]);
  assert.ok(pair.warnings.some(({ code }) => code === "SAME_ROUND_INDIVIDUALS"));
  assert.deepEqual(sameRoundIndividualPairs(["calculus", "statistics"]), []);

  const lowerPair = regional([student({ stateId: "123400110", events: "Algebra I Individual; Geometry Individual" })]);
  assert.ok(lowerPair.errors.some(({ code }) => code === "INVALID_SECOND_REGIONAL_INDIVIDUAL"));

  const three = regional([
    student({ stateId: "123400110", events: "Algebra I Individual; Precalculus Individual; Statistics Individual" }),
  ]);
  assert.ok(three.errors.some(({ code }) => code === "TOO_MANY_REGIONAL_INDIVIDUALS"));
});

test("State: chart columns, Chi digit 9, Statistics for everyone, one Individual, one test per round", () => {
  const theta = evaluateDivisionEligibility({ profile: "state", currentId: "537700130" });
  assert.deepEqual([...theta.allowedDivisions], ["theta", "alpha", "mu", "statistics"]);
  const chi = evaluateDivisionEligibility({ profile: "state", currentId: "537700190" });
  assert.deepEqual([...chi.allowedDivisions], ["chi", "statistics"]);
  assert.equal(chi.defaultDivision, "chi");
  const previousStats = evaluateDivisionEligibility({
    profile: "state",
    currentId: "537700150",
    previousIds: "537700160",
  });
  assert.deepEqual([...previousStats.allowedDivisions], ["mu"]);

  const twoIndividuals = buildPacket({
    schoolName: SCHOOL,
    records: [student({ stateId: "537700140", tests: ["alpha-individual", "mu-individual"] })],
  });
  assert.ok(twoIndividuals.errors.some(({ code }) => code === "ONE_INDIVIDUAL_ONLY"));

  const twoRoundOne = buildPacket({
    schoolName: SCHOOL,
    records: [
      student({
        stateId: "537700140",
        tests: ["alpha-individual", "round-1-alpha-trigonometry", "round-1-gemini", "round-2-probability"],
      }),
    ],
  });
  assert.equal(twoRoundOne.ok, true);
  assert.ok(twoRoundOne.warnings.some(({ code }) => code === "SESSION_DUPLICATE"));

  const statisticsInstead = buildPacket({
    schoolName: SCHOOL,
    records: [student({ stateId: "537700140", tests: ["statistics-individual", "round-1-gemini"] })],
  });
  assert.equal(statisticsInstead.ok, true);
  assert.equal(statisticsInstead.jobs.find(({ group }) => group === TEST_GROUPS.INDIVIDUAL).stateId, "537700160");
  assert.equal(idForTest("537700130", { group: "individual", division: "alpha" }, "state"), "537700140");
});

test("Events and Previous Year IDs columns import and merge across files", () => {
  const parsed = parseDelimitedRegistration(
    "School,Student Name,Student ID,Previous Year IDs,Events\n" +
      "Sample Academy,Jordan Lee,123400140,123400330,\"Precalculus Individual; Sample Open\"\n",
    { requiredHeaders: ["student_name", "state_id"] },
  );
  assert.deepEqual(parsed.errors, []);
  assert.equal(parsed.records[0].previousIds, "123400330");
  assert.equal(parsed.records[0].events, "Precalculus Individual; Sample Open");
  const packet = regional(parsed.records);
  assert.equal(packet.ok, true);
  assert.deepEqual(packet.jobs.map(({ testCode }) => testCode), ["141", "901"]);

  const catalog = regionalCatalog();
  const merged = mergeParsedSources(
    [
      { filename: "a.csv", parsed: { format: "csv", records: [{ studentName: "Jordan Lee", stateId: "123400140", events: "141; Sample Open" }] } },
      { filename: "b.csv", parsed: { format: "csv", records: [{ studentName: "Jordan Lee", stateId: "123400140", events: "sample open;Precalculus Individual", previousIds: "123400330" }] } },
    ],
    { catalog, divisionScheme: "regional" },
  );
  assert.deepEqual(merged.errors, []);
  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].previousIds, "123400330");

  const conflict = mergeParsedSources(
    [
      { filename: "a.csv", parsed: { format: "csv", records: [{ studentName: "Jordan Lee", stateId: "123400140", events: "141" }] } },
      { filename: "b.csv", parsed: { format: "csv", records: [{ studentName: "Jordan Lee", stateId: "123400140", events: "151" }] } },
    ],
    { catalog, divisionScheme: "regional" },
  );
  assert.ok(conflict.errors.some(({ code }) => code === "DUPLICATE_STUDENT_CONFLICT"));
});

test("National and Custom ignore previous-year IDs; Custom has no division rules", () => {
  const evaluation = evaluateDivisionEligibility({ profile: "national", currentId: "123400240", previousIds: "123400130" });
  assert.ok(evaluation.issues.some(({ code }) => code === "PREVIOUS_ID_IGNORED"));
  const custom = evaluateDivisionEligibility({ profile: "custom", currentId: "123400240" });
  assert.deepEqual(custom.issues, []);
  assert.equal(custom.defaultDivision, null);
});
