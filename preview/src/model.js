import {
  CATALOG_METADATA,
  CONVENTION_PROFILES,
  REGIONAL_DIVISION_BY_ID_DIGIT,
  REGIONAL_DIVISION_DIGITS,
  STATE_DIVISION_BY_ID_DIGIT,
  STATE_ID_DIGITS_BY_DIVISION,
  TEST_CATALOG,
  TEST_GROUPS,
  divisionDigitForProfile,
  eligibleRegionalDivisionsForBasis,
  inferIndividualTestForProfile,
  isRegionalDivisionEligible,
  normalizeDivision,
  normalizeDivisionForProfile,
  normalizeRegionalDivision,
  resolveTestReference,
} from "./catalog.js";
import {
  evaluateDivisionEligibility,
  idForTest,
  isIndividualTest,
  sameRoundIndividualPairs,
  testAvailability,
} from "./eligibility.js";

function makeIssue(severity, code, message, details = {}) {
  return { severity, code, message, ...details };
}
function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactSpacedId(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

export function validateSchoolName(value) {
  const normalized = collapseWhitespace(value);
  const wordsWithLetters = normalized.split(" ").filter((word) => /\p{L}/u.test(word));
  if (!normalized) {
    return {
      valid: false,
      normalized,
      code: "MISSING_SCHOOL_NAME",
      message: "Enter the school's full name.",
    };
  }
  if (normalized.length > 120) {
    return {
      valid: false,
      normalized,
      code: "SCHOOL_NAME_TOO_LONG",
      message: "School name must be 120 characters or fewer.",
    };
  }
  if (wordsWithLetters.length < 2) {
    return {
      valid: false,
      normalized,
      code: "INCOMPLETE_SCHOOL_NAME",
      message: "Use the full school name rather than a code or abbreviation.",
    };
  }
  return { valid: true, normalized };
}

export function validateStateId(value, { profile = CONVENTION_PROFILES.state } = {}) {
  const normalized = compactSpacedId(value);
  if (!/^\d{9}$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      code: "INVALID_STATE_ID",
      message: "Student ID must contain exactly nine digits.",
    };
  }
  const profileId = typeof profile === "string" ? profile : profile?.id;
  const invalidRegionalTeamDigit = profileId === "regional" && !/^[012]$/.test(normalized[8]);
  const invalidStateTeamDigit = profileId === "state" && normalized[8] !== "0";
  if (invalidRegionalTeamDigit || invalidStateTeamDigit) {
    return {
      valid: false,
      normalized,
      code: profileId === "regional" ? "INVALID_REGIONAL_TEAM_DIGIT" : "STATE_ID_NOT_NO_TEAM",
      message:
        profileId === "regional"
          ? "Regional / Invitational Student IDs must end in 0 (no team), 1 (Team 1), or 2 (Team 2)."
          : "Use the nine-digit No Team Student ID, which must end in 0.",
    };
  }
  // The 8th digit is the division number (Sponsors' Guide p. 34).
  const unknownRegionalDivision = profileId === "regional" && !REGIONAL_DIVISION_BY_ID_DIGIT[normalized[7]];
  const unknownStateDivision = profileId === "state" && !STATE_DIVISION_BY_ID_DIGIT[normalized[7]];
  if (unknownRegionalDivision || unknownStateDivision) {
    return {
      valid: false,
      normalized,
      code: "ID_DIVISION_DIGIT_UNKNOWN",
      message:
        profileId === "regional"
          ? `The 8th digit (${normalized[7]}) must be a division number: 1 Algebra I, 2 Geometry, 3 Algebra II, 4 Precalculus, 5 Calculus, or 6 Statistics.`
          : `The 8th digit (${normalized[7]}) must be a State division number: 2 or 3 Theta, 4 Alpha, 5 Mu, 6 Statistics, or 9 Chi.`,
    };
  }
  return {
    valid: true,
    normalized,
    schoolCode: normalized.slice(0, 4),
    studentCode: normalized.slice(4, 7),
    levelCode: normalized[7],
    teamCode: normalized[8],
  };
}

function stableText(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase();
}

function compareText(left, right) {
  const a = stableText(left);
  const b = stableText(right);
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

const GROUP_ORDER = Object.freeze({
  [TEST_GROUPS.INDIVIDUAL]: 0,
  [TEST_GROUPS.OPTIONAL]: 1,
  [TEST_GROUPS.ROUND_1]: 2,
  [TEST_GROUPS.ROUND_2]: 3,
  [TEST_GROUPS.ROUND_3]: 4,
});

const TOPIC_DIVISION_RANK = Object.freeze({
  chi: 0,
  theta: 1,
  alpha: 2,
  mu: 3,
});

export function sortJobs(jobs, sortBy = "student") {
  if (sortBy !== "student" && sortBy !== "test") {
    throw new TypeError('sortBy must be "student" or "test".');
  }

  return [...jobs].sort((left, right) => {
    if (sortBy === "student") {
      return (
        compareText(left.studentName, right.studentName) ||
        compareText(left.sourceStateId ?? left.stateId, right.sourceStateId ?? right.stateId) ||
        GROUP_ORDER[left.group] - GROUP_ORDER[right.group] ||
        compareText(left.testCode, right.testCode)
      );
    }

    return (
      GROUP_ORDER[left.group] - GROUP_ORDER[right.group] ||
      compareText(left.testCode, right.testCode) ||
      compareText(left.studentName, right.studentName) ||
      compareText(left.sourceStateId ?? left.stateId, right.sourceStateId ?? right.stateId)
    );
  });
}

function testIssueDetails(record, recordIndex, field) {
  return {
    recordIndex,
    line: record.source?.line,
    studentName: collapseWhitespace(record.studentName),
    stateId: compactSpacedId(record.stateId),
    field,
  };
}

function resolveRequiredTest(
  record,
  recordIndex,
  field,
  value,
  expectedGroup,
  errors,
  catalog,
  requiredLabels,
) {
  const result = resolveTestReference(value, expectedGroup, catalog);
  const details = testIssueDetails(record, recordIndex, field);

  if (result.status === "resolved") return result.test;
  if (result.status === "empty") {
    errors.push(
      makeIssue(
        "error",
        "MISSING_TEST_SELECTION",
        `${requiredLabels.get(field) ?? field} is required; every student needs ${[
          ...requiredLabels.values(),
        ].join(", ")} sheets.`,
        details,
      ),
    );
  } else if (result.status === "pending") {
    errors.push(
      makeIssue(
        "error",
        "PENDING_TEST_CODE",
        `${result.test.name} is pending official confirmation and has no usable scorer code.`,
        { ...details, testId: result.test.id },
      ),
    );
  } else if (result.status === "wrong_group") {
    errors.push(
      makeIssue(
        "error",
        "WRONG_TEST_GROUP",
        `"${result.raw}" is not valid for ${String(expectedGroup ?? "this assignment").replace("_", " ")}.`,
        { ...details, matches: result.matches.map((test) => test.id) },
      ),
    );
  } else if (result.status === "ambiguous") {
    errors.push(
      makeIssue(
        "error",
        "AMBIGUOUS_TEST",
        `"${result.raw}" matches more than one test; use the full name or three-digit code.`,
        { ...details, matches: result.matches.map((test) => test.id) },
      ),
    );
  } else {
    errors.push(
      makeIssue("error", "UNKNOWN_TEST", `"${result.raw}" is not in the scorer catalog.`, details),
    );
  }
  return null;
}

/*
 * Retained but no longer called (version 2.3.0): the slot-based validation
 * from versions 2.0-2.2, including course-eligibility questions. Version 2.3.0
 * validates the per-student test checklist in buildPacket below; the course
 * rules can be turned back on through `courseEligibilityQuestions`.
 */
function validateTopicEligibility(
  record,
  recordIndex,
  studentDivision,
  test,
  field,
  errors,
  _warnings,
) {
  if (!studentDivision || !test) return;

  let eligibilityDivision = studentDivision;
  if (studentDivision === "statistics") {
    eligibilityDivision = normalizeDivision(record.eligibilityBasis);
    if (!eligibilityDivision || eligibilityDivision === "statistics") {
      errors.push(
        makeIssue(
          "error",
          "MISSING_STATISTICS_ELIGIBILITY_BASIS",
          "Statistics students need a Chi, Theta, Alpha, or Mu topic eligibility level before State topic tests can be assigned.",
          {
            ...testIssueDetails(record, recordIndex, field),
            testId: test.id,
            studentDivision,
            testDivision: test.division,
            eligibilityBasis: record.eligibilityBasis ?? null,
          },
        ),
      );
      return;
    }
  }

  if (test.division === "open") return;

  const details = {
    ...testIssueDetails(record, recordIndex, field),
    testId: test.id,
    studentDivision,
    eligibilityDivision,
    testDivision: test.division,
  };

  const studentRank = TOPIC_DIVISION_RANK[eligibilityDivision];
  const testRank = TOPIC_DIVISION_RANK[test.division];
  if (studentRank === undefined || testRank === undefined || testRank >= studentRank) return;

  errors.push(
    makeIssue(
      "error",
      "DOWNWARD_TOPIC_ASSIGNMENT",
      `${test.name} is below the student's ${eligibilityDivision} eligibility level. Division-ladder students may take same-division or higher-division topics, but not lower-division topics.`,
      details,
    ),
  );
}

function activeProfileId(profile) {
  return typeof profile === "string" ? profile : profile?.id ?? "state";
}

function divisionFromIdDigit(levelCode, profile) {
  const id = activeProfileId(profile);
  if (id === "regional") return REGIONAL_DIVISION_BY_ID_DIGIT[levelCode] ?? null;
  if (id === "state") return STATE_DIVISION_BY_ID_DIGIT[levelCode] ?? null;
  return null;
}

function defaultRegionalEligibilityBasis(division) {
  if (division === "algebra_1") return "algebra_1";
  if (division === "geometry" || division === "algebra_2") return "geometry_algebra_2";
  if (division === "precalculus") return "precalculus";
  if (division === "calculus") return "calculus";
  if (division === "statistics") return "statistics_special";
  return null;
}

function regionalSeparateEligibilityBasis(record) {
  return (
    record.statisticsEligibilityBasis ??
    record.baseEligibilityBasis ??
    record.secondaryEligibilityBasis ??
    null
  );
}

function looksLikeExcludedNonScantronEvent(test) {
  if (!test) return false;
  if (test.producesScantron === false || test.eventRole === "excluded") return true;
  const name = stableText(test.name).replace(/[^a-z0-9]+/g, " ");
  return /(?:^|\s)(?:speed|mental(?:\s+math)?)(?:\s|$)/u.test(name);
}

function validateRegionalAssignments(
  record,
  recordIndex,
  division,
  assignments,
  resolvedTests,
  errors,
) {
  const basis = record.eligibilityBasis ?? defaultRegionalEligibilityBasis(division);
  const separateBase = regionalSeparateEligibilityBasis(record);
  const eligibleDivisions = eligibleRegionalDivisionsForBasis(basis, separateBase);
  const details = {
    recordIndex,
    line: record.source?.line,
    studentName: collapseWhitespace(record.studentName),
    stateId: compactSpacedId(record.stateId),
    division,
    eligibilityBasis: basis ?? null,
    separateEligibilityBasis: separateBase,
  };

  if (!division) {
    errors.push(
      makeIssue(
        "error",
        "MISSING_REGIONAL_DIVISION",
        "Choose the student's Regional / Invitational competition division.",
        { ...details, field: "division" },
      ),
    );
    return;
  }

  if (!eligibleDivisions.includes(division)) {
    errors.push(
      makeIssue(
        "error",
        basis === "statistics_special"
          ? "MISSING_REGIONAL_STATISTICS_BASE"
          : "REGIONAL_DIVISION_INELIGIBLE",
        basis === "statistics_special"
          ? "Statistics eligibility requires a separate completed-course basis before a competition division can be assigned."
          : `The selected ${division} division is not eligible for the supplied ${basis ?? "unknown"} course basis. Students may test at their level or higher, never lower.`,
        {
          ...details,
          field:
            basis === "statistics_special"
              ? "statisticsEligibilityBasis"
              : "eligibilityBasis",
          eligibleDivisions,
        },
      ),
    );
  }

  const seenTestIds = new Map();
  const individualTests = [];
  for (const assignment of assignments) {
    const test = resolvedTests[assignment.field];
    if (!test) continue;
    const assignmentDetails = {
      ...details,
      field: assignment.field,
      testId: test.id,
      testDivision: test.division,
    };

    const firstField = seenTestIds.get(test.id);
    if (firstField) {
      errors.push(
        makeIssue(
          "error",
          "DUPLICATE_TEST_ASSIGNMENT",
          `${test.name} is selected more than once for this student.`,
          { ...assignmentDetails, duplicateOfField: firstField },
        ),
      );
    } else {
      seenTestIds.set(test.id, assignment.field);
    }

    const isIndividualTest =
      test.group === TEST_GROUPS.INDIVIDUAL || test.eventRole === "individual";
    if (isIndividualTest) {
      const testDivision = normalizeRegionalDivision(test.division);
      if (!testDivision) {
        errors.push(
          makeIssue(
            "error",
            "INVALID_REGIONAL_INDIVIDUAL_DIVISION",
            `${test.name} does not identify one of the six Regional / Statewide divisions.`,
            assignmentDetails,
          ),
        );
      } else {
        individualTests.push({ test, division: testDivision, field: assignment.field });
        if (!isRegionalDivisionEligible(testDivision, basis, separateBase)) {
          errors.push(
            makeIssue(
              "error",
              "REGIONAL_INDIVIDUAL_INELIGIBLE",
              `${test.name} is below the student's course eligibility or is otherwise not permitted.`,
              assignmentDetails,
            ),
          );
        }
      }
    }

    if (!isIndividualTest && test.eligibleDivisions?.length) {
      const normalizedAllowed = test.eligibleDivisions
        .map((eligibleDivision) => normalizeRegionalDivision(eligibleDivision))
        .filter(Boolean);
      if (normalizedAllowed.length > 0 && !normalizedAllowed.includes(division)) {
        errors.push(
          makeIssue(
            "error",
            "REGIONAL_EVENT_INELIGIBLE",
            `${test.name} is not offered to students registered in the ${division} division.`,
            { ...assignmentDetails, eligibleDivisions: normalizedAllowed },
          ),
        );
      }
    }
  }

  if (individualTests.length > 2) {
    errors.push(
      makeIssue(
        "error",
        "TOO_MANY_REGIONAL_INDIVIDUALS",
        "A student may take no more than two Regional / Statewide Individual tests.",
        { ...details, field: "individualTest", testIds: individualTests.map(({ test }) => test.id) },
      ),
    );
  }

  if (
    individualTests.length === 2 &&
    !individualTests.some(({ division: testDivision }) =>
      ["statistics", "precalculus", "calculus"].includes(testDivision),
    )
  ) {
    errors.push(
      makeIssue(
        "error",
        "INVALID_SECOND_REGIONAL_INDIVIDUAL",
        "When a student takes two Individual tests, at least one must be Statistics, Precalculus, or Calculus.",
        { ...details, field: "individualTest", testIds: individualTests.map(({ test }) => test.id) },
      ),
    );
  }
}

function stateIdForRegionalTest(baseStateId, test) {
  if (!/^\d{9}$/.test(baseStateId)) return baseStateId;
  if (test.group !== TEST_GROUPS.INDIVIDUAL && test.eventRole !== "individual") {
    return baseStateId;
  }
  const division = normalizeRegionalDivision(test.division);
  const digit = division ? REGIONAL_DIVISION_DIGITS[division] : null;
  return digit ? `${baseStateId.slice(0, 7)}${digit}${baseStateId[8]}` : baseStateId;
}

/*
 * Version 2.3.0: one checklist of tests per student.
 *
 * Earlier versions filled fixed slots (Individual, Round 1, Optional Event 1,
 * ...) and asked for the student's course. Each record now carries the list of
 * tests to print. Divisions come from the registration ID (8th digit) and any
 * previous-year IDs, using the Sponsors' Guide rules in eligibility.js.
 */

const LEGACY_TEST_FIELDS = Object.freeze([
  ["individualTest", TEST_GROUPS.INDIVIDUAL],
  ["round1Test", TEST_GROUPS.ROUND_1],
  ["round2Test", TEST_GROUPS.ROUND_2],
  ["round3Test", TEST_GROUPS.ROUND_3],
  ["optional1Test", null],
  ["optional2Test", null],
  ["optional3Test", null],
  ["optional4Test", null],
  ["optional5Test", null],
  ["optional6Test", null],
]);

/** Split an Events cell such as "Precalculus Individual; 521; Geometry Open". */
export function splitEventList(value) {
  if (Array.isArray(value)) return value.map((item) => String(item ?? "").trim()).filter(Boolean);
  return String(value ?? "")
    .split(/[;\n|]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function canonicalReference(reference, catalog, group = null) {
  const raw = String(reference ?? "").trim();
  if (!raw) return "";
  const grouped = group ? resolveTestReference(raw, group, catalog) : null;
  if (grouped?.test) return grouped.test.id;
  const result = resolveTestReference(raw, null, catalog);
  return result.test?.id ?? raw;
}

function dedupeReferences(references, catalog) {
  const seen = new Set();
  const unique = [];
  for (const reference of references) {
    const canonical = canonicalReference(reference, catalog);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    unique.push(canonical);
  }
  return unique;
}

/** The single active Individual for the division the ID indicates, if any. */
export function defaultIndividualForEligibility(eligibility, catalog = TEST_CATALOG) {
  const division = eligibility?.defaultDivision;
  if (!division) return null;
  const matches = catalog.filter(
    (test) =>
      test.active !== false &&
      test.producesScantron !== false &&
      isIndividualTest(test) &&
      test.division === division,
  );
  return matches.length === 1 ? matches[0] : null;
}

/** Division eligibility for one record under a profile. */
export function eligibilityForRecord(record, profile = CONVENTION_PROFILES.state) {
  const scheme = activeProfileId(profile);
  const idValidation = validateStateId(record?.stateId, { profile });
  return evaluateDivisionEligibility({
    profile: scheme,
    currentId: idValidation.valid ? idValidation.normalized : "",
    previousIds: record?.previousIds ?? "",
    division: scheme === "national" ? normalizeDivision(record?.division) : null,
  });
}

/**
 * The tests a record asks for, as catalog ids where they resolve. A record
 * edited in the review table has a `tests` array (possibly empty) and it is
 * used as is. Otherwise the Events cell and any older per-slot columns are
 * combined; when the record does not name an Individual (older State and
 * Regional layouts never did), the Individual for the ID's division is added.
 */
export function initialTestReferences(
  record,
  { profile = CONVENTION_PROFILES.state, catalog = profile?.catalog ?? TEST_CATALOG, eligibility = null } = {},
) {
  if (Array.isArray(record?.tests)) return dedupeReferences(record.tests, catalog);
  const listed = splitEventList(record?.events);
  const legacy = LEGACY_TEST_FIELDS
    .map(([field, group]) => canonicalReference(record?.[field], catalog, group))
    .filter(Boolean);
  const references = [...listed, ...legacy];
  const scheme = activeProfileId(profile);
  const namesIndividual = String(record?.individualTest ?? "").trim() !== "";
  if (scheme !== "custom" && listed.length === 0 && !namesIndividual) {
    const individual = defaultIndividualForEligibility(
      eligibility ?? eligibilityForRecord(record, profile),
      catalog,
    );
    if (individual) references.unshift(individual.id);
  }
  return dedupeReferences(references, catalog);
}

/*
 * Retained but switched off: course-based eligibility from earlier versions.
 * It runs only when a profile sets `courseEligibilityQuestions: true`, which
 * no shipped profile does.
 */
function applyCourseEligibility(record, profileIdValue, eligibility, selectedTests, errors, details) {
  if (profileIdValue === "regional") {
    const basis = record.eligibilityBasis ?? defaultRegionalEligibilityBasis(eligibility.registeredDivision);
    const separateBase = regionalSeparateEligibilityBasis(record);
    for (const test of selectedTests.filter(isIndividualTest)) {
      if (!isRegionalDivisionEligible(test.division, basis, separateBase)) {
        errors.push(
          makeIssue(
            "error",
            "REGIONAL_INDIVIDUAL_INELIGIBLE",
            `${test.name} is below the student's course eligibility or is otherwise not permitted.`,
            { ...details, field: "tests", testId: test.id },
          ),
        );
      }
    }
  } else if (profileIdValue === "state" && eligibility.idDigit === "6") {
    const level = normalizeDivision(record.eligibilityBasis);
    const rank = TOPIC_DIVISION_RANK[level];
    if (rank === undefined) return;
    for (const test of selectedTests) {
      const testRank = TOPIC_DIVISION_RANK[test.division];
      if (!isIndividualTest(test) && testRank !== undefined && testRank < rank) {
        errors.push(
          makeIssue(
            "error",
            "DOWNWARD_TOPIC_ASSIGNMENT",
            `${test.name} is below the student's ${level} eligibility level.`,
            { ...details, field: "tests", testId: test.id },
          ),
        );
      }
    }
  }
}

const LEGACY_FIELD_LABELS = Object.freeze({
  events: "Events",
  individualTest: "Individual",
  round1Test: "Round 1",
  round2Test: "Round 2",
  round3Test: "Round 3",
  optional1Test: "Optional Event 1",
  optional2Test: "Optional Event 2",
  optional3Test: "Optional Event 3",
  optional4Test: "Optional Event 4",
  optional5Test: "Optional Event 5",
  optional6Test: "Optional Event 6",
});

const TEST_GROUP_LABELS = Object.freeze({
  [TEST_GROUPS.INDIVIDUAL]: "Individual",
  [TEST_GROUPS.OPTIONAL]: "Additional / Open",
  [TEST_GROUPS.ROUND_1]: "Round 1",
  [TEST_GROUPS.ROUND_2]: "Round 2",
  [TEST_GROUPS.ROUND_3]: "Round 3",
});

/** Notes about an imported row's event columns: wrong-round placements and repeats. */
export function importedListingWarnings(record, catalog) {
  const issues = [];
  const seen = new Map();
  const entries = [
    ...splitEventList(record?.events).map((raw) => ({ raw, field: "events", group: null })),
    ...LEGACY_TEST_FIELDS
      .map(([field, group]) => ({ raw: String(record?.[field] ?? "").trim(), field, group }))
      .filter(({ raw }) => raw),
  ];
  for (const { raw, field, group } of entries) {
    if (group && resolveTestReference(raw, group, catalog).status === "wrong_group") {
      const actual = resolveTestReference(raw, null, catalog);
      if (actual.test) {
        issues.push(
          makeIssue(
            "warning",
            "WRONG_TEST_GROUP",
            `"${raw}" was in the ${LEGACY_FIELD_LABELS[field]} column but is a ${TEST_GROUP_LABELS[actual.test.group] ?? actual.test.group} test; ${actual.test.name} was checked.`,
            { sourceField: field, testId: actual.test.id },
          ),
        );
      }
    }
    const canonical = canonicalReference(raw, catalog, group);
    if (seen.has(canonical)) {
      issues.push(
        makeIssue(
          "warning",
          "DUPLICATE_TEST_ASSIGNMENT",
          `"${raw}" is listed more than once for this student; one scantron is printed for it.`,
          { sourceField: field, duplicateOfField: seen.get(canonical) },
        ),
      );
    } else {
      seen.set(canonical, field);
    }
  }
  return issues;
}

const UPPER_DIVISIONS_FOR_TWO_INDIVIDUALS = Object.freeze(["statistics", "precalculus", "calculus"]);

/**
 * Validate normalized parser records and expand them into one PDF job for each
 * checked test. Any error blocks the final jobs array; valid candidates remain
 * visible in candidateJobs so nothing disappears without explanation.
 */
export function buildPacket(input = {}) {
  const {
    schoolName: suppliedSchoolName,
    schoolCode: suppliedSchoolCode = null,
    records = [],
    sortBy = "student",
    errors: sourceErrors = [],
    warnings: sourceWarnings = [],
    profile = CONVENTION_PROFILES.state,
    catalog = profile?.catalog ?? TEST_CATALOG,
  } = input;

  if (!Array.isArray(records)) throw new TypeError("records must be an array");
  if (!Array.isArray(catalog)) throw new TypeError("catalog must be an array");
  if (sortBy !== "student" && sortBy !== "test") {
    throw new TypeError('sortBy must be "student" or "test".');
  }
  const scheme = activeProfileId(profile);

  const errors = sourceErrors.map((issue) => ({ severity: "error", ...issue }));
  const warnings = sourceWarnings.map((issue) => ({ severity: "warning", ...issue }));

  const schoolValidation = validateSchoolName(suppliedSchoolName);
  const normalizedSchoolName = schoolValidation.normalized;
  const recordsNeedFallbackSchool =
    records.length === 0 || records.some((record) => !collapseWhitespace(record.schoolName));
  if (!schoolValidation.valid && (normalizedSchoolName || recordsNeedFallbackSchool)) {
    errors.push(
      makeIssue("error", schoolValidation.code, schoolValidation.message, { field: "schoolName" }),
    );
  }

  const normalizedSuppliedCode = compactSpacedId(suppliedSchoolCode);
  let fallbackSchoolCode = null;
  if (normalizedSuppliedCode) {
    if (!/^\d{4}$/.test(normalizedSuppliedCode)) {
      errors.push(
        makeIssue(
          "error",
          "INVALID_SCHOOL_CODE",
          "School code from the roster header must contain exactly four digits.",
          { field: "schoolCode" },
        ),
      );
    } else {
      fallbackSchoolCode = normalizedSuppliedCode;
    }
  }

  if (records.length === 0) {
    errors.push(
      makeIssue("error", "NO_STUDENTS", "Add at least one student before creating the packet.", {
        field: "records",
      }),
    );
  }

  const seenIds = new Map();
  const schools = new Map();
  const students = [];
  const candidateJobs = [];

  records.forEach((record, recordIndex) => {
    const recordErrorStart = errors.length;
    const recordWarningStart = warnings.length;
    const recordSchoolName = collapseWhitespace(record.schoolName) || normalizedSchoolName;
    const recordSchoolValidation = validateSchoolName(recordSchoolName);
    if (!recordSchoolValidation.valid) {
      errors.push(
        makeIssue("error", recordSchoolValidation.code, recordSchoolValidation.message, {
          recordIndex,
          line: record.source?.line,
          sourceName: record.source?.name,
          field: "schoolName",
        }),
      );
    }

    const recordCodeText = compactSpacedId(record.schoolCode) || fallbackSchoolCode;
    let recordExpectedSchoolCode = null;
    if (recordCodeText) {
      if (!/^\d{4}$/.test(recordCodeText)) {
        errors.push(
          makeIssue("error", "INVALID_SCHOOL_CODE", "School code must contain exactly four digits.", {
            recordIndex,
            line: record.source?.line,
            sourceName: record.source?.name,
            field: "schoolCode",
          }),
        );
      } else {
        recordExpectedSchoolCode = recordCodeText;
      }
    }

    const studentName = collapseWhitespace(record.studentName);
    if (!studentName || !/\p{L}/u.test(studentName)) {
      errors.push(
        makeIssue("error", "INVALID_STUDENT_NAME", "Student name is required.", {
          recordIndex,
          line: record.source?.line,
          field: "studentName",
        }),
      );
    }

    const idValidation = validateStateId(record.stateId, { profile });
    const stateId = idValidation.normalized;
    const details = { recordIndex, line: record.source?.line, studentName, stateId };
    if (!idValidation.valid) {
      errors.push(makeIssue("error", idValidation.code, idValidation.message, { ...details, field: "stateId" }));
    } else {
      const firstIndex = seenIds.get(stateId);
      if (firstIndex !== undefined) {
        errors.push(
          makeIssue("error", "DUPLICATE_STATE_ID", `Student ID ${stateId} occurs more than once.`, {
            ...details,
            duplicateOfRecordIndex: firstIndex,
            field: "stateId",
          }),
        );
      } else {
        seenIds.set(stateId, recordIndex);
      }

      recordExpectedSchoolCode = recordExpectedSchoolCode ?? idValidation.schoolCode;
      if (recordExpectedSchoolCode !== idValidation.schoolCode) {
        errors.push(
          makeIssue(
            "error",
            "SCHOOL_PREFIX_MISMATCH",
            `Student ID ${stateId} starts with ${idValidation.schoolCode}, not school code ${recordExpectedSchoolCode}.`,
            { ...details, field: "stateId" },
          ),
        );
      }

      if (recordSchoolValidation.valid) {
        const existingSchool = schools.get(idValidation.schoolCode);
        if (
          existingSchool &&
          stableText(existingSchool.name) !== stableText(recordSchoolValidation.normalized)
        ) {
          errors.push(
            makeIssue(
              "error",
              "SCHOOL_NAME_CONFLICT",
              `School code ${idValidation.schoolCode} is paired with both “${existingSchool.name}” and “${recordSchoolValidation.normalized}”.`,
              {
                recordIndex,
                line: record.source?.line,
                sourceName: record.source?.name,
                field: "schoolName",
              },
            ),
          );
        } else if (!existingSchool) {
          schools.set(idValidation.schoolCode, {
            code: idValidation.schoolCode,
            name: recordSchoolValidation.normalized,
          });
        }
      }
    }

    // Division: Regional and State read it from the ID; National uses its column.
    const rawDivision = collapseWhitespace(record.division);
    const columnDivision = rawDivision ? normalizeDivisionForProfile(rawDivision, profile) : null;
    if (rawDivision && !columnDivision && scheme !== "custom") {
      warnings.push(
        makeIssue(
          "warning",
          "INVALID_DIVISION",
          `"${rawDivision}" is not a recognized ${scheme} division; the ID's division is used instead.`,
          { ...details, field: "division" },
        ),
      );
    }
    const eligibility = evaluateDivisionEligibility({
      profile: scheme,
      currentId: idValidation.valid ? stateId : "",
      previousIds: record.previousIds ?? "",
      division: scheme === "national" ? columnDivision : null,
    });
    const division = eligibility.registeredDivision;
    if (
      (scheme === "regional" || scheme === "state") &&
      columnDivision &&
      division &&
      columnDivision !== division
    ) {
      warnings.push(
        makeIssue(
          "warning",
          "DIVISION_COLUMN_MISMATCH",
          `The Division value "${rawDivision}" does not match the ID's 8th digit (${eligibility.idDigit}); the ID's division is used.`,
          { ...details, field: "stateId", division, columnDivision },
        ),
      );
    }
    for (const issue of eligibility.issues) {
      (issue.severity === "error" ? errors : warnings).push({ ...issue, ...details, field: issue.field });
    }

    if (!Array.isArray(record.tests)) {
      for (const issue of importedListingWarnings(record, catalog)) {
        warnings.push({ ...issue, ...details, field: "tests" });
      }
    }
    const references = initialTestReferences(record, { profile, catalog, eligibility });
    const selectedTests = [];
    const seenTests = new Set();
    for (const reference of references) {
      const result = resolveTestReference(reference, null, catalog);
      const testDetails = { ...details, field: "tests", reference: result.raw };
      if (result.status === "empty") continue;
      if (result.status === "unknown") {
        errors.push(makeIssue("error", "UNKNOWN_TEST", `"${result.raw}" is not in the event catalog.`, testDetails));
        continue;
      }
      if (result.status === "ambiguous") {
        errors.push(
          makeIssue(
            "error",
            "AMBIGUOUS_TEST",
            `"${result.raw}" matches more than one test; use the full name or three-digit code.`,
            { ...testDetails, matches: result.matches.map((test) => test.id) },
          ),
        );
        continue;
      }
      const test = result.test;
      if (seenTests.has(test.id)) continue;
      seenTests.add(test.id);
      if (looksLikeExcludedNonScantronEvent(test)) {
        errors.push(
          makeIssue(
            "error",
            "NON_SCANTRON_EVENT",
            `${test.name} does not use this prepared scantron and cannot be included in the packet.`,
            { ...testDetails, testId: test.id },
          ),
        );
        continue;
      }
      if (result.status === "pending") {
        errors.push(
          makeIssue(
            "error",
            "PENDING_TEST_CODE",
            `${test.name} has no reviewed three-digit code yet. Enter it in the event catalog.`,
            { ...testDetails, testId: test.id },
          ),
        );
      }
      const availability = testAvailability(test, eligibility);
      if (!availability.allowed) {
        errors.push(
          makeIssue(
            "error",
            availability.code ?? (isIndividualTest(test) ? "DIVISION_NOT_ALLOWED" : "TEST_NOT_ALLOWED"),
            `${test.name}: ${availability.reason}`,
            { ...testDetails, testId: test.id, studentDivision: division, testDivision: test.division },
          ),
        );
      } else if (availability.conditional) {
        warnings.push(
          makeIssue(
            "warning",
            "CONDITIONAL_DIVISION",
            `${test.name} is allowed for a Statistics-course student only if they have completed Algebra II/Geometry, take no higher math class, and never competed in Algebra II/Geometry (Sponsors' Guide chart note **).`,
            { ...testDetails, testId: test.id },
          ),
        );
      }
      selectedTests.push(test);
    }

    if (references.length === 0) {
      errors.push(
        makeIssue(
          "error",
          "MISSING_EVENT_ASSIGNMENT",
          "Check at least one test to print for this student.",
          { ...details, field: "tests" },
        ),
      );
    }

    const individuals = selectedTests.filter(isIndividualTest);
    if (scheme === "regional") {
      if (individuals.length > 2) {
        errors.push(
          makeIssue(
            "error",
            "TOO_MANY_REGIONAL_INDIVIDUALS",
            "A student may take no more than two Individual tests at a Regional or Statewide competition.",
            { ...details, field: "tests", testIds: individuals.map((test) => test.id) },
          ),
        );
      } else if (
        individuals.length === 2 &&
        !individuals.some((test) => UPPER_DIVISIONS_FOR_TWO_INDIVIDUALS.includes(test.division))
      ) {
        errors.push(
          makeIssue(
            "error",
            "INVALID_SECOND_REGIONAL_INDIVIDUAL",
            "When a student takes two Individual tests, at least one must be Statistics, Precalculus, or Calculus.",
            { ...details, field: "tests", testIds: individuals.map((test) => test.id) },
          ),
        );
      }
      for (const pair of sameRoundIndividualPairs(individuals.map((test) => test.division))) {
        warnings.push(
          makeIssue(
            "warning",
            "SAME_ROUND_INDIVIDUALS",
            `${pair.labels.join(" and ")} Individuals are both in Round ${pair.round} of the 2026-27 regional schedule (Sponsors' Guide p. 5). Check that this competition's schedule allows both.`,
            { ...details, field: "tests", divisions: pair.divisions },
          ),
        );
      }
    } else if (scheme === "state" || scheme === "national") {
      if (individuals.length > 1) {
        errors.push(
          makeIssue(
            "error",
            "ONE_INDIVIDUAL_ONLY",
            `A ${scheme === "state" ? "State Convention" : "National Convention"} student takes one Individual test; ${individuals.length} are checked.`,
            { ...details, field: "tests", testIds: individuals.map((test) => test.id) },
          ),
        );
      }
      for (const group of [TEST_GROUPS.ROUND_1, TEST_GROUPS.ROUND_2, TEST_GROUPS.ROUND_3]) {
        const inGroup = selectedTests.filter((test) => test.group === group);
        if (inGroup.length > 1) {
          warnings.push(
            makeIssue(
              "warning",
              "SESSION_DUPLICATE",
              `${inGroup.map((test) => test.name).join(" and ")} are in the same round; a student can take only one of them.`,
              { ...details, field: "tests", testIds: inGroup.map((test) => test.id) },
            ),
          );
        }
      }
    }

    if (profile?.courseEligibilityQuestions === true) {
      applyCourseEligibility(record, scheme, eligibility, selectedTests, errors, details);
    }

    const recordErrors = errors.slice(recordErrorStart);
    const student = {
      studentName,
      stateId,
      division,
      previousIds: eligibility.previous.map((entry) => entry.id),
      allowedDivisions: eligibility.allowedDivisions,
      schoolName: recordSchoolValidation.normalized,
      schoolCode: idValidation.schoolCode ?? recordExpectedSchoolCode,
      tests: selectedTests,
      source: record.source ?? null,
      valid: recordErrors.length === 0,
      errors: recordErrors,
      warnings: warnings.slice(recordWarningStart),
    };
    students.push(student);

    if (student.valid) {
      for (const test of selectedTests) {
        const jobStateId = idForTest(stateId, test, scheme);
        candidateJobs.push({
          key: `${jobStateId}:${test.id}`,
          schoolName: recordSchoolValidation.normalized,
          schoolCode: idValidation.schoolCode,
          studentName,
          stateId: jobStateId,
          studentId9: jobStateId,
          sourceStateId: stateId,
          division,
          testId: test.id,
          testCode: test.code,
          testName: test.name,
          group: test.group,
        });
      }
    }
  });

  const sortedCandidates = sortJobs(candidateJobs, sortBy);
  const ok = errors.length === 0;
  const jobs = ok ? sortedCandidates.map((job, index) => ({ ...job, sheetIndex: index })) : [];
  const schoolList = [...schools.values()].sort((left, right) => compareText(left.name, right.name));
  const packetSchool = schoolList.length === 1
    ? schoolList[0]
    : {
      name: schoolList.length > 1 ? "Multiple schools" : normalizedSchoolName,
      code: schoolList.length > 1 ? null : fallbackSchoolCode,
    };

  return {
    ok,
    profileId: profile?.id ?? "state",
    catalogMetadata: profile?.catalogMetadata ?? CATALOG_METADATA,
    assignments: profile?.assignments ?? [],
    school: packetSchool,
    schools: schoolList,
    students,
    jobs,
    candidateJobs: sortedCandidates,
    errors,
    warnings,
    summary: {
      studentCount: students.length,
      validStudentCount: students.filter((student) => student.valid).length,
      sheetCount: jobs.length,
      candidateSheetCount: sortedCandidates.length,
      blocked: !ok,
      sortBy,
    },
  };
}
