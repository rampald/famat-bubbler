/**
 * Division eligibility from FAMAT registration IDs.
 *
 * Source: FAMAT Sponsors' Guide 2026-2027, "FAMAT Eligibility Chart for
 * Competitions" (p. 31) and "Instructions for Creating Student ID #s" (p. 34).
 *
 * The 8th digit of a FAMAT ID is the division number. FAMAT places students in
 * divisions by their current mathematics class: 1 Algebra I, 2 Geometry,
 * 3 Algebra II, 4 Pre-Calculus, 5 Calculus, 6 Statistics. The State Convention
 * also uses 9 for Chi (middle school). The digit therefore selects the row of
 * the eligibility chart, and the chart lists the divisions that row may enter.
 *
 * A previous-year ID shows the division the student competed in before. It is
 * used only when supplied, to remove divisions the Sponsors' Guide no longer
 * allows: eligibility in Algebra I, Geometry, Algebra II, and Statistics lasts
 * one year; students may never test down (across years Geometry counts as
 * lower than Algebra II); students who previously competed in Statistics may
 * not compete in Statistics again. Within the current season the chart still
 * lets a Geometry or Algebra II student enter either division (note ***).
 *
 * Course-based questions are not used here. The older course-basis rules remain
 * in catalog.js behind each profile's `courseEligibilityQuestions` switch.
 */

import {
  REGIONAL_DIVISION_BY_ID_DIGIT,
  REGIONAL_DIVISION_DIGITS,
  STATE_DIVISION_BY_ID_DIGIT,
  STATE_ID_DIGITS_BY_DIVISION,
} from "./catalog.js";

export const ELIGIBILITY_SOURCE =
  "FAMAT Sponsors' Guide 2026-2027: Eligibility Chart for Competitions (p. 31) and Student ID instructions (p. 34)";

export const ID_DIGIT_COURSES = Object.freeze({
  1: "Algebra I",
  2: "Geometry",
  3: "Algebra II",
  4: "Pre-Calculus",
  5: "Calculus",
  6: "Statistics",
  9: "Chi (middle school)",
});

export const DIVISION_LABELS = Object.freeze({
  algebra_1: "Algebra I",
  geometry: "Geometry",
  algebra_2: "Algebra II",
  precalculus: "Precalculus",
  calculus: "Calculus",
  statistics: "Statistics",
  chi: "Chi",
  theta: "Theta",
  alpha: "Alpha",
  mu: "Mu / Calculus",
  open: "Open",
  hiller: "Hiller",
  nunn: "Nunn",
  dostal_precalculus: "Dostal - Precalculus",
  dostal_calculus: "Dostal - Calculus",
});

const REGIONAL_DIVISIONS = Object.freeze([
  "algebra_1",
  "geometry",
  "algebra_2",
  "precalculus",
  "calculus",
  "statistics",
]);
const STATE_DIVISIONS = Object.freeze(["chi", "theta", "alpha", "mu", "statistics"]);
const NATIONAL_DIVISIONS = Object.freeze(["theta", "alpha", "mu"]);
const HND_DIVISIONS = Object.freeze(["hiller", "nunn", "dostal_precalculus", "dostal_calculus"]);

/**
 * Hiller / Nunn / Dostal: the ID's 8th digit picks the test. A Statistics
 * student (6) may take either Dostal test.
 */
export const HND_CHART = Object.freeze({
  1: Object.freeze(["hiller"]),
  2: Object.freeze(["nunn"]),
  3: Object.freeze(["nunn"]),
  4: Object.freeze(["dostal_precalculus"]),
  5: Object.freeze(["dostal_calculus"]),
  6: Object.freeze(["dostal_precalculus", "dostal_calculus"]),
});

/** Regional and Statewide columns of the chart, by the row the ID digit selects. */
export const REGIONAL_ELIGIBILITY_CHART = Object.freeze({
  1: Object.freeze(["algebra_1", "geometry", "algebra_2", "precalculus", "calculus", "statistics"]),
  2: Object.freeze(["geometry", "algebra_2", "precalculus", "calculus", "statistics"]),
  3: Object.freeze(["geometry", "algebra_2", "precalculus", "calculus", "statistics"]),
  4: Object.freeze(["precalculus", "calculus", "statistics"]),
  5: Object.freeze(["calculus", "statistics"]),
  6: Object.freeze(["algebra_1", "geometry", "algebra_2", "precalculus", "calculus", "statistics"]),
});

/** Chart cells marked ** (Statistics row): allowed only under the chart's note **. */
export const REGIONAL_CONDITIONAL_CELLS = Object.freeze({
  6: Object.freeze(["algebra_1", "geometry", "algebra_2"]),
});

/**
 * State Convention divisions. Theta, Alpha, and Mu (the chart's "Calc") come
 * from the chart's State Convention columns. Chi (digit 9) and Statistics are
 * the 2027 State packet's additional divisions; the packet opens Statistics to
 * any student.
 */
export const STATE_ELIGIBILITY_CHART = Object.freeze({
  2: Object.freeze(["theta", "alpha", "mu", "statistics"]),
  3: Object.freeze(["theta", "alpha", "mu", "statistics"]),
  4: Object.freeze(["alpha", "mu", "statistics"]),
  5: Object.freeze(["mu", "statistics"]),
  // Derek, Nov 26, 2026: a Statistics-only student is not held to a level and
  // starts in Calculus.
  6: Object.freeze(["theta", "alpha", "mu", "statistics"]),
  9: Object.freeze(["chi", "statistics"]),
});

/** Divisions removed by a previous-year ID, keyed by that ID's 8th digit. */
export const REGIONAL_PREVIOUS_YEAR_EXCLUSIONS = Object.freeze({
  1: Object.freeze({ algebra_1: "one-year" }),
  2: Object.freeze({ algebra_1: "test-down", geometry: "one-year" }),
  // Geometry counts as lower than Algebra II across years (FAMAT division
  // numbers 2 < 3), so last year's Algebra II also removes Geometry.
  3: Object.freeze({ algebra_1: "test-down", geometry: "test-down", algebra_2: "one-year" }),
  4: Object.freeze({ algebra_1: "test-down", geometry: "test-down", algebra_2: "test-down" }),
  5: Object.freeze({
    algebra_1: "test-down",
    geometry: "test-down",
    algebra_2: "test-down",
    precalculus: "test-down",
  }),
  6: Object.freeze({ statistics: "statistics" }),
  9: Object.freeze({}),
});

export const STATE_PREVIOUS_YEAR_EXCLUSIONS = Object.freeze({
  1: Object.freeze({}),
  2: Object.freeze({ chi: "test-down" }),
  3: Object.freeze({ chi: "test-down" }),
  4: Object.freeze({ chi: "test-down", theta: "test-down" }),
  5: Object.freeze({ chi: "test-down", theta: "test-down", alpha: "test-down" }),
  6: Object.freeze({ statistics: "statistics" }),
  9: Object.freeze({}),
});

/** Chi < Theta < Alpha < Mu. Statistics and Open are not rungs of this ladder. */
export const TOPIC_LADDER_RANK = Object.freeze({ chi: 0, theta: 1, alpha: 2, mu: 3 });

const LADDER_RANK_BY_ID_DIGIT = Object.freeze({ 9: 0, 2: 1, 3: 1, 4: 2, 5: 3 });

function makeIssue(severity, code, message, field) {
  return { severity, code, message, field };
}

function profileScheme(profile) {
  const id = typeof profile === "string" ? profile : profile?.id;
  return ["regional", "state", "national", "custom", "hnd"].includes(id) ? id : "state";
}

function labelFor(division) {
  return DIVISION_LABELS[division] ?? String(division ?? "");
}

function ladderLabel(rank) {
  return labelFor(Object.keys(TOPIC_LADDER_RANK).find((key) => TOPIC_LADDER_RANK[key] === rank));
}

/** Split a cell such as "123400330; 123400430" into IDs. Spaces inside one ID are allowed. */
export function parsePreviousIds(value) {
  const parts = Array.isArray(value)
    ? value.flatMap((item) => String(item ?? "").split(/[;,|\n]+/))
    : String(value ?? "").split(/[;,|\n]+/);
  const ids = [];
  const invalid = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const compact = trimmed.replace(/\s+/g, "");
    if (/^\d{9}$/.test(compact)) {
      if (!ids.includes(compact)) ids.push(compact);
      continue;
    }
    // Several space-separated IDs in one cell.
    const pieces = trimmed.split(/\s+/);
    if (pieces.length > 1 && pieces.every((piece) => /^\d{9}$/.test(piece))) {
      for (const piece of pieces) if (!ids.includes(piece)) ids.push(piece);
      continue;
    }
    invalid.push(trimmed);
  }
  return { ids, invalid };
}

export function divisionsForScheme(profile) {
  const scheme = profileScheme(profile);
  if (scheme === "regional") return REGIONAL_DIVISIONS;
  if (scheme === "state") return STATE_DIVISIONS;
  if (scheme === "national") return NATIONAL_DIVISIONS;
  if (scheme === "hnd") return HND_DIVISIONS;
  return Object.freeze([]);
}

function exclusionReason(kind, division, previousId, previousDigit) {
  const previousCourse = ID_DIGIT_COURSES[previousDigit] ?? `digit ${previousDigit}`;
  if (kind === "one-year") {
    return `Already competed in ${labelFor(division)} (previous-year ID ${previousId}); eligibility in that division lasts one year.`;
  }
  if (kind === "statistics") {
    return `Competed in Statistics before (previous-year ID ${previousId}); students who previously competed in Statistics are no longer eligible for it.`;
  }
  if (kind === "statistics-note") {
    return `A Statistics-course student may enter ${labelFor(division)} only if they never competed in Algebra II/Geometry; previous-year ID ${previousId} shows ${previousCourse}.`;
  }
  return `Would test down from ${previousCourse} (previous-year ID ${previousId}); students may never test down.`;
}

/**
 * Evaluate which divisions a student may enter.
 *
 * @param {object} input
 * @param {object|string} input.profile  convention profile or its id
 * @param {string} input.currentId  the current registration ID
 * @param {string|string[]} [input.previousIds]  previous-year IDs, if supplied
 * @param {string|null} [input.division]  National only: theta, alpha, or mu
 */
export function evaluateDivisionEligibility({
  profile = "state",
  currentId = "",
  previousIds = "",
  division = null,
} = {}) {
  const scheme = profileScheme(profile);
  const issues = [];
  const id = String(currentId ?? "").replace(/\s+/g, "");
  const validId = /^\d{9}$/.test(id);
  const idDigit = validId ? id[7] : null;
  const divisions = divisionsForScheme(scheme);
  const previous = [];
  const excluded = new Map();
  let registeredDivision = null;
  let chartRow = null;
  let conditional = [];
  let minimumTopicRank = null;

  const { ids: previousIdList, invalid: invalidPrevious } = parsePreviousIds(previousIds);
  const usesIds = scheme === "regional" || scheme === "state" || scheme === "hnd";
  if (!usesIds && (previousIdList.length > 0 || invalidPrevious.length > 0)) {
    issues.push(
      makeIssue(
        "warning",
        "PREVIOUS_ID_IGNORED",
        "Previous-year IDs are used only for FAMAT Regional / Invitational and State Convention rules; they were ignored here.",
        "previousIds",
      ),
    );
  }
  if (usesIds) {
    for (const value of invalidPrevious) {
      issues.push(
        makeIssue(
          "error",
          "PREVIOUS_ID_INVALID",
          `Previous-year ID "${value}" must contain exactly nine digits. Separate several IDs with semicolons.`,
          "previousIds",
        ),
      );
    }
    for (const previousId of previousIdList) {
      const digit = previousId[7];
      if (!ID_DIGIT_COURSES[digit]) {
        issues.push(
          makeIssue(
            "error",
            "PREVIOUS_ID_DIVISION_UNKNOWN",
            `Previous-year ID ${previousId} has 8th digit ${digit}, which is not a FAMAT division number (1-6, or 9 for Chi).`,
            "previousIds",
          ),
        );
        continue;
      }
      previous.push({ id: previousId, digit, course: ID_DIGIT_COURSES[digit] });
    }
  }

  if (scheme === "regional") {
    registeredDivision = idDigit ? REGIONAL_DIVISION_BY_ID_DIGIT[idDigit] ?? null : null;
    chartRow = idDigit ? REGIONAL_ELIGIBILITY_CHART[idDigit] ?? null : null;
    conditional = idDigit ? [...(REGIONAL_CONDITIONAL_CELLS[idDigit] ?? [])] : [];
    for (const { id: previousId, digit } of previous) {
      for (const [excludedDivision, kind] of Object.entries(REGIONAL_PREVIOUS_YEAR_EXCLUSIONS[digit] ?? {})) {
        if (!excluded.has(excludedDivision)) {
          excluded.set(excludedDivision, exclusionReason(kind, excludedDivision, previousId, digit));
        }
      }
      // Chart note **: a Statistics-course student may enter Algebra II/Geometry
      // only if they never competed in Algebra II/Geometry.
      if (idDigit === "6" && (digit === "2" || digit === "3")) {
        for (const cell of REGIONAL_CONDITIONAL_CELLS[6]) {
          if (!excluded.has(cell)) {
            excluded.set(cell, exclusionReason("statistics-note", cell, previousId, digit));
          }
        }
      }
    }
  } else if (scheme === "hnd") {
    chartRow = idDigit ? HND_CHART[idDigit] ?? null : null;
    if (idDigit === "6") {
      // Statistics: Dostal - Calculus by default (Derek, Nov 26, 2026: "let stats
      // default to calculus, let other people change it"); Dostal - Precalculus
      // stays allowed.
      registeredDivision = "dostal_calculus";
    } else {
      registeredDivision = chartRow?.length === 1 ? chartRow[0] : null;
    }
  } else if (scheme === "state") {
    registeredDivision = idDigit === "6" ? "mu" : idDigit ? STATE_DIVISION_BY_ID_DIGIT[idDigit] ?? null : null;
    chartRow = idDigit ? STATE_ELIGIBILITY_CHART[idDigit] ?? null : null;
    const ranks = [];
    if (idDigit && LADDER_RANK_BY_ID_DIGIT[idDigit] !== undefined) ranks.push(LADDER_RANK_BY_ID_DIGIT[idDigit]);
    for (const { id: previousId, digit } of previous) {
      for (const [excludedDivision, kind] of Object.entries(STATE_PREVIOUS_YEAR_EXCLUSIONS[digit] ?? {})) {
        if (!excluded.has(excludedDivision)) {
          excluded.set(excludedDivision, exclusionReason(kind, excludedDivision, previousId, digit));
        }
      }
      if (LADDER_RANK_BY_ID_DIGIT[digit] !== undefined) ranks.push(LADDER_RANK_BY_ID_DIGIT[digit]);
    }
    minimumTopicRank = ranks.length > 0 ? Math.max(...ranks) : null;
  } else if (scheme === "national") {
    const normalized = String(division ?? "").trim().toLowerCase();
    registeredDivision = NATIONAL_DIVISIONS.includes(normalized) ? normalized : null;
    if (registeredDivision) {
      minimumTopicRank = TOPIC_LADDER_RANK[registeredDivision];
      chartRow = NATIONAL_DIVISIONS.filter((candidate) => TOPIC_LADDER_RANK[candidate] >= minimumTopicRank);
    } else {
      chartRow = NATIONAL_DIVISIONS;
    }
  }

  const rows = divisions.map((candidate) => {
    const reasons = [];
    let allowed = true;
    if (scheme === "regional" || scheme === "state" || scheme === "hnd") {
      if (!validId) {
        allowed = false;
        reasons.push("Enter the student's nine-digit ID to see the divisions it allows.");
      } else if (!chartRow) {
        allowed = false;
        reasons.push(`The ID's 8th digit (${idDigit}) is not a division number for this competition.`);
      } else if (!chartRow.includes(candidate) && scheme === "hnd") {
        allowed = false;
        reasons.push(`Not the test for an ID whose 8th digit is ${idDigit} (${ID_DIGIT_COURSES[idDigit] ?? "unknown"}).`);
      } else if (!chartRow.includes(candidate)) {
        allowed = false;
        reasons.push(
          `Not allowed for an ID whose 8th digit is ${idDigit} (${ID_DIGIT_COURSES[idDigit] ?? "unknown"}) under the Sponsors' Guide eligibility chart.`,
        );
      }
    } else if (scheme === "national" && chartRow && !chartRow.includes(candidate)) {
      allowed = false;
      reasons.push(`Below the student's ${labelFor(registeredDivision)} division; students may never test down.`);
    }
    if (allowed && excluded.has(candidate)) {
      allowed = false;
      reasons.push(excluded.get(candidate));
    }
    return {
      division: candidate,
      label: labelFor(candidate),
      allowed,
      conditional: allowed && conditional.includes(candidate),
      reasons,
    };
  });

  let defaultDivision = registeredDivision;
  const defaultRow = rows.find((row) => row.division === defaultDivision);
  if (defaultDivision && defaultRow && !defaultRow.allowed) {
    issues.push(
      makeIssue(
        "warning",
        "ID_DIVISION_NOT_ALLOWED",
        `The ID's division (${labelFor(defaultDivision)}) is not allowed: ${defaultRow.reasons.join(" ")} Check an allowed division instead.`,
        "tests",
      ),
    );
    defaultDivision = null;
  }

  return Object.freeze({
    scheme,
    source: ELIGIBILITY_SOURCE,
    currentId: id,
    idDigit,
    registeredDivision,
    defaultDivision,
    divisions: Object.freeze(rows.map((row) => Object.freeze(row))),
    allowedDivisions: Object.freeze(rows.filter((row) => row.allowed).map((row) => row.division)),
    minimumTopicRank,
    previous: Object.freeze(previous.map((entry) => Object.freeze(entry))),
    issues: Object.freeze(issues),
  });
}

export function isIndividualTest(test) {
  return test?.group === "individual" || test?.eventRole === "individual";
}

/**
 * Is this test available to the student?
 * Returns { allowed, code, reason, conditional }; `code` names the rule that
 * blocks the test (null when it is allowed).
 */
export function testAvailability(test, evaluation, { registeredDivision = null } = {}) {
  if (!test) return { allowed: false, code: "UNKNOWN_TEST", reason: "Unknown test.", conditional: false };
  const scheme = evaluation?.scheme ?? "state";
  if (scheme === "custom") return { allowed: true, code: null, reason: "", conditional: false };

  if (isIndividualTest(test)) {
    const row = evaluation.divisions.find((candidate) => candidate.division === test.division);
    if (!row) {
      return {
        allowed: false,
        code: "DIVISION_NOT_ALLOWED",
        reason: `${test.name} does not name a ${scheme === "regional" ? "Regional / Statewide" : "convention"} division.`,
        conditional: false,
      };
    }
    return {
      allowed: row.allowed,
      code: row.allowed ? null : "DIVISION_NOT_ALLOWED",
      reason: row.reasons.join(" "),
      conditional: row.conditional,
    };
  }

  const division = registeredDivision ?? evaluation.registeredDivision;
  const restricted = Array.isArray(test.eligibleDivisions)
    ? test.eligibleDivisions.filter((value) => value && value !== "all")
    : [];
  if (restricted.length > 0 && !test.eligibleDivisions.includes("all")) {
    if (!division || !restricted.includes(division)) {
      return {
        allowed: false,
        code: "EVENT_DIVISION_INELIGIBLE",
        reason: `Offered only to ${restricted.map(labelFor).join(", ")}${division ? `; this student's ID division is ${labelFor(division)}` : ""}.`,
        conditional: false,
      };
    }
  }

  if (
    (scheme === "state" || scheme === "national") &&
    evaluation.minimumTopicRank !== null &&
    TOPIC_LADDER_RANK[test.division] !== undefined &&
    TOPIC_LADDER_RANK[test.division] < evaluation.minimumTopicRank
  ) {
    return {
      allowed: false,
      code: "DOWNWARD_TOPIC_ASSIGNMENT",
      reason: `Below the student's ${ladderLabel(evaluation.minimumTopicRank)} level; students may never test down.`,
      conditional: false,
    };
  }
  return { allowed: true, code: null, reason: "", conditional: false };
}

/**
 * Regional Individual rounds in the 2026-2027 schedule (Sponsors' Guide p. 5):
 * Round 1 Algebra I, Geometry, Calculus; Round 2 Algebra II, Pre-Calculus,
 * Statistics. Hosts may change schedules, so a same-round pair is a warning.
 */
export const REGIONAL_INDIVIDUAL_ROUND_2026_2027 = Object.freeze({
  algebra_1: 1,
  geometry: 1,
  calculus: 1,
  algebra_2: 2,
  precalculus: 2,
  statistics: 2,
});

/** Pairs of Regional Individual divisions that fall in the same scheduled round. */
export function sameRoundIndividualPairs(divisions) {
  const pairs = [];
  const list = [...new Set(divisions)].filter((division) => REGIONAL_INDIVIDUAL_ROUND_2026_2027[division]);
  for (let left = 0; left < list.length; left += 1) {
    for (let right = left + 1; right < list.length; right += 1) {
      const round = REGIONAL_INDIVIDUAL_ROUND_2026_2027[list[left]];
      if (round === REGIONAL_INDIVIDUAL_ROUND_2026_2027[list[right]]) {
        pairs.push({ divisions: [list[left], list[right]], round, labels: [labelFor(list[left]), labelFor(list[right])] });
      }
    }
  }
  return pairs;
}

/**
 * The ID printed on a test's answer sheet. A Regional/Statewide or State
 * Individual uses that division's 8th digit (Sponsors' Guide p. 34: use the
 * appropriate ID number for each test); the team digit is preserved. Other
 * events use the registration ID unchanged.
 */
export function idForTest(baseId, test, profile) {
  const id = String(baseId ?? "");
  if (!/^\d{9}$/.test(id) || !isIndividualTest(test)) return id;
  const scheme = profileScheme(profile);
  let digit = null;
  if (scheme === "regional") {
    digit = test.idDigit ?? REGIONAL_DIVISION_DIGITS[test.division] ?? null;
  } else if (scheme === "state") {
    const digits = STATE_ID_DIGITS_BY_DIVISION[test.division] ?? [];
    digit = digits.includes(id[7]) ? id[7] : digits.length === 1 ? digits[0] : null;
  }
  return digit ? `${id.slice(0, 7)}${digit}${id[8]}` : id;
}
