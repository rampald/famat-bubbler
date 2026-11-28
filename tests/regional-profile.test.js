import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVENTION_PROFILES,
  CUSTOM_TEST_CATALOG,
  REGIONAL_TEST_CATALOG,
  TEST_GROUPS,
  catalogFromEditableEntries,
  divisionDigitForProfile,
  eligibleRegionalDivisionsForBasis,
  inferIndividualTestForProfile,
  isRegionalDivisionEligible,
  normalizeDivisionForProfile,
  normalizeRegionalDivision,
} from "../src/catalog.js";
import { buildPacket, validateStateId } from "../src/model.js";

const SCHOOL_NAME = "Sample Academy";

const REGIONAL_CODES = Object.freeze({
  "regional-algebra-1-individual": "111",
  "regional-geometry-individual": "121",
  "regional-algebra-2-individual": "131",
  "regional-precalculus-individual": "141",
  "regional-calculus-individual": "151",
  "regional-statistics-individual": "161",
});

function regionalCatalog({ includeExcluded = false, pendingOpen = false } = {}) {
  const entries = REGIONAL_TEST_CATALOG.map((entry) => ({
    ...entry,
    code: REGIONAL_CODES[entry.id],
  }));
  entries.push(
    {
      id: "sample-open",
      name: "Sample Open",
      group: TEST_GROUPS.OPTIONAL,
      division: "open",
      code: pendingOpen ? "" : "901",
      eventRole: "optional-open",
      producesScantron: true,
      eligibleDivisions: ["all"],
      active: true,
    },
    {
      id: "lower-division-open",
      name: "Lower Division Open",
      group: TEST_GROUPS.OPTIONAL,
      division: "open",
      code: "902",
      eventRole: "optional-open",
      producesScantron: true,
      eligibleDivisions: ["algebra_1", "geometry"],
      active: true,
    },
  );
  if (includeExcluded) {
    entries.push(
      {
        id: "speed",
        name: "Speed Mathematics",
        group: TEST_GROUPS.OPTIONAL,
        division: "open",
        code: "903",
        eventRole: "excluded",
        producesScantron: false,
        eligibleDivisions: ["all"],
        active: true,
      },
      {
        id: "mental",
        name: "Mental Math",
        group: TEST_GROUPS.OPTIONAL,
        division: "open",
        code: "904",
        eventRole: "optional-open",
        producesScantron: true,
        eligibleDivisions: ["all"],
        active: true,
      },
    );
  }
  return catalogFromEditableEntries(entries, { baseCatalog: REGIONAL_TEST_CATALOG });
}

function registration(overrides = {}) {
  return {
    studentName: "Jordan Lee",
    stateId: "123400140",
    schoolName: SCHOOL_NAME,
    schoolCode: "1234",
    eligibilityBasis: "Precalculus",
    division: "Precalculus",
    individualTest: "",
    optional1Test: "",
    optional2Test: "",
    optional3Test: "",
    optional4Test: "",
    optional5Test: "",
    optional6Test: "",
    source: { format: "test", line: 1 },
    ...overrides,
  };
}

test("Regional / Invitational derives one required Individual plus zero-to-six optionals", () => {
  const regional = CONVENTION_PROFILES.regional;

  assert.equal(regional.id, "regional");
  assert.equal(regional.label, "FAMAT Regional / Invitational");
  assert.equal(regional.workflow, "division-individual-plus-optionals");
  assert.equal(regional.divisionScheme, "regional");
  assert.equal(regional.dynamicOptionalAssignments, true);
  assert.equal(regional.configurableEventSlots, true);
  assert.equal(regional.requiresTournamentName, true);
  assert.equal(regional.inferIndividualFromDivision, true);
  assert.equal(regional.enforceIndividualDivision, true);
  assert.equal(regional.assignments.length, 7);
  assert.deepEqual(regional.assignments[0], {
    field: "individualTest",
    group: TEST_GROUPS.INDIVIDUAL,
    label: "Individual",
    derived: true,
  });
  assert.deepEqual(
    regional.assignments.slice(1).map(({ field, group, required }) => [field, group, required]),
    Array.from({ length: 6 }, (_, index) => [
      `optional${index + 1}Test`,
      TEST_GROUPS.OPTIONAL,
      false,
    ]),
  );
  assert.ok(Object.isFrozen(REGIONAL_TEST_CATALOG));
  assert.ok(Object.isFrozen(CUSTOM_TEST_CATALOG));
  assert.equal(REGIONAL_TEST_CATALOG.length, 6);
  assert.deepEqual(
    REGIONAL_TEST_CATALOG.map(({ division, idDigit, code }) => [division, idDigit, code]),
    [
      ["algebra_1", "1", null],
      ["geometry", "2", null],
      ["algebra_2", "3", null],
      ["precalculus", "4", null],
      ["calculus", "5", null],
      ["statistics", "6", null],
    ],
  );
  assert.deepEqual(CUSTOM_TEST_CATALOG, []);
  assert.notEqual(REGIONAL_TEST_CATALOG, CUSTOM_TEST_CATALOG);
});

test("profile-aware division helpers preserve all six Regional divisions and eligibility", () => {
  const profile = CONVENTION_PROFILES.regional;
  assert.equal(normalizeRegionalDivision("Algebra I"), "algebra_1");
  assert.equal(normalizeRegionalDivision("Geometry"), "geometry");
  assert.equal(normalizeRegionalDivision("Algebra II"), "algebra_2");
  assert.equal(normalizeDivisionForProfile("Pre-Calc", profile), "precalculus");
  assert.equal(divisionDigitForProfile("Calculus", profile), "5");
  assert.equal(inferIndividualTestForProfile("Statistics", REGIONAL_TEST_CATALOG, profile).id,
    "regional-statistics-individual");
  assert.deepEqual(eligibleRegionalDivisionsForBasis("Precalculus"), [
    "precalculus",
    "calculus",
    "statistics",
  ]);
  assert.equal(isRegionalDivisionEligible("Algebra II", "Precalculus"), false);
  assert.equal(isRegionalDivisionEligible("Calculus", "Precalculus"), true);
  assert.equal(isRegionalDivisionEligible("Algebra II", "Geometry / Algebra II"), true);
  assert.deepEqual(eligibleRegionalDivisionsForBasis("statistics_special"), []);
  assert.deepEqual(eligibleRegionalDivisionsForBasis("statistics_special", "Algebra II"), [
    "geometry",
    "algebra_2",
    "precalculus",
    "calculus",
    "statistics",
  ]);
});

test("Regional IDs accept no-team, Team 1, and Team 2 digits", () => {
  const profile = CONVENTION_PROFILES.regional;
  for (const suffix of ["0", "1", "2"]) {
    assert.equal(validateStateId(`12340014${suffix}`, { profile }).valid, true);
  }
  const invalid = validateStateId("123400149", { profile });
  assert.equal(invalid.valid, false);
  assert.equal(invalid.code, "INVALID_REGIONAL_TEAM_DIGIT");
});

test("Regional derives the required Individual and assignments override controls visible optionals", () => {
  const profile = CONVENTION_PROFILES.regional;
  const catalog = regionalCatalog();
  const individualOnlyAssignments = [profile.assignments[0]];
  const one = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog,
    assignments: individualOnlyAssignments,
    records: [registration()],
  });
  const withOpen = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog,
    assignments: profile.assignments.slice(0, 2),
    records: [registration({ optional1Test: "Sample Open" })],
  });

  assert.equal(one.ok, true);
  assert.equal(one.profileId, "regional");
  assert.equal(one.jobs.length, 1);
  assert.equal(one.jobs[0].testId, "regional-precalculus-individual");
  assert.equal(one.jobs[0].testCode, "141");
  assert.equal(withOpen.ok, true);
  assert.equal(withOpen.jobs.length, 2);
  assert.deepEqual(withOpen.jobs.map(({ testCode }) => testCode), ["141", "901"]);
});

test("Regional blocks pending organizer codes even when the Individual is derived", () => {
  const result = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.regional,
    catalog: REGIONAL_TEST_CATALOG,
    assignments: [CONVENTION_PROFILES.regional.assignments[0]],
    records: [registration()],
  });

  assert.equal(result.ok, false);
  assert.equal(result.jobs.length, 0);
  assert.ok(result.errors.some((issue) => issue.code === "PENDING_TEST_CODE"));
});

test("Regional reads the division from the ID and blocks testing down from Precalculus", () => {
  const columnMismatch = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.regional,
    catalog: regionalCatalog(),
    records: [registration({ stateId: "123400130" })],
  });
  assert.equal(columnMismatch.ok, true);
  assert.ok(columnMismatch.warnings.some(({ code }) => code === "DIVISION_COLUMN_MISMATCH"));
  assert.deepEqual(columnMismatch.jobs.map(({ testCode }) => testCode), ["131"]);

  const testingDown = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: CONVENTION_PROFILES.regional,
    catalog: regionalCatalog(),
    records: [registration({ optional1Test: "Algebra II Individual" })],
  });
  assert.equal(testingDown.ok, false);
  assert.ok(
    testingDown.errors.some(
      ({ code, testId }) =>
        code === "DIVISION_NOT_ALLOWED" && testId === "regional-algebra-2-individual",
    ),
  );
});

test("a permitted second Individual receives the correct division ID and preserves team digit", () => {
  const profile = CONVENTION_PROFILES.regional;
  const packet = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    assignments: profile.assignments.slice(0, 2),
    records: [
      registration({
        stateId: "123400112",
        registeredIds: ["123400162"],
        eligibilityBasis: "Algebra I",
        division: "Algebra I",
        optional1Test: "Statistics Individual",
      }),
    ],
  });

  assert.equal(packet.ok, true);
  assert.equal(packet.jobs.length, 2);
  assert.deepEqual(packet.jobs.map(({ stateId }) => stateId), ["123400112", "123400162"]);
  assert.ok(packet.jobs.every(({ stateId }) => stateId.endsWith("2")));
});

test("the two-Individual rule requires an upper division and caps the total at two", () => {
  const profile = CONVENTION_PROFILES.regional;
  const invalidPair = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    assignments: profile.assignments.slice(0, 2),
    records: [
      registration({
        stateId: "123400110",
        eligibilityBasis: "Algebra I",
        division: "Algebra I",
        optional1Test: "Geometry Individual",
      }),
    ],
  });
  assert.ok(invalidPair.errors.some(({ code }) => code === "INVALID_SECOND_REGIONAL_INDIVIDUAL"));

  const tooMany = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    assignments: profile.assignments.slice(0, 3),
    records: [
      registration({
        stateId: "123400110",
        eligibilityBasis: "Algebra I",
        division: "Algebra I",
        optional1Test: "Precalculus Individual",
        optional2Test: "Statistics Individual",
      }),
    ],
  });
  assert.ok(tooMany.errors.some(({ code }) => code === "TOO_MANY_REGIONAL_INDIVIDUALS"));
});

test("Regional optional events enforce organizer eligibility and report repeats", () => {
  const profile = CONVENTION_PROFILES.regional;
  const ineligible = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    records: [registration({ optional1Test: "Lower Division Open" })],
  });
  assert.ok(ineligible.errors.some(({ code }) => code === "EVENT_DIVISION_INELIGIBLE"));

  const duplicate = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    records: [
      registration({ optional1Test: "Sample Open", optional2Test: "Sample Open" }),
    ],
  });
  assert.ok(duplicate.warnings.some(({ code }) => code === "DUPLICATE_TEST_ASSIGNMENT"));
  assert.equal(duplicate.ok, true);
  assert.deepEqual(duplicate.jobs.map(({ testCode }) => testCode), ["141", "901"]);
});

test("Speed and Mental are explicitly excluded from generated Regional scantrons", () => {
  const profile = CONVENTION_PROFILES.regional;
  for (const eventName of ["Speed Mathematics", "Mental Math"]) {
    const packet = buildPacket({
      schoolName: SCHOOL_NAME,
      profile,
      catalog: regionalCatalog({ includeExcluded: true }),
      records: [registration({ optional1Test: eventName })],
    });
    assert.equal(packet.ok, false);
    assert.ok(packet.errors.some(({ code }) => code === "NON_SCANTRON_EVENT"));
  }
});

test("Statistics IDs follow chart note ** and the retained course switch stays off", () => {
  const profile = CONVENTION_PROFILES.regional;
  const statistics = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    records: [registration({ stateId: "123400160", eligibilityBasis: "", division: "Statistics" })],
  });
  assert.equal(statistics.ok, true);
  assert.deepEqual(statistics.jobs.map(({ testCode }) => testCode), ["161"]);

  const conditional = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    records: [
      registration({
        stateId: "123400160",
        registeredIds: ["123400120"],
        division: "Statistics",
        events: "Statistics Individual; Geometry Individual",
      }),
    ],
  });
  assert.equal(conditional.ok, true);
  assert.ok(
    conditional.warnings.some(
      ({ code, testId }) => code === "CONDITIONAL_DIVISION" && testId === "regional-geometry-individual",
    ),
  );
  assert.deepEqual(conditional.jobs.map(({ stateId }) => stateId).sort(), ["123400120", "123400160"]);

  const competedInAlgebra2 = buildPacket({
    schoolName: SCHOOL_NAME,
    profile,
    catalog: regionalCatalog(),
    records: [
      registration({
        stateId: "123400160",
        previousIds: "123400330",
        division: "Statistics",
        events: "Statistics Individual; Geometry Individual",
      }),
    ],
  });
  assert.equal(competedInAlgebra2.ok, false);
  assert.ok(
    competedInAlgebra2.errors.some(
      ({ code, testId }) => code === "DIVISION_NOT_ALLOWED" && testId === "regional-geometry-individual",
    ),
  );

  const courseOn = buildPacket({
    schoolName: SCHOOL_NAME,
    profile: { ...profile, courseEligibilityQuestions: true },
    catalog: regionalCatalog(),
    records: [
      registration({
        stateId: "123400160",
        eligibilityBasis: "Precalculus",
        division: "Statistics",
        events: "Statistics Individual; Geometry Individual",
      }),
    ],
  });
  assert.ok(courseOn.errors.some(({ code }) => code === "REGIONAL_INDIVIDUAL_INELIGIBLE"));
});
