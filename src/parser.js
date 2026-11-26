import { assignState, stateSheets, divisionRank, nameKey, STATE_TEST_BY_ID } from "../preview/src/presets.js";
import {
  TEST_CATALOG,
  inferIndividualTestForProfile,
  inferIndividualTestFromDivision,
  normalizeDivision,
  normalizeDivisionForProfile,
} from "./catalog.js";

export const REQUIRED_HEADERS = Object.freeze([
  "student_name",
  "state_id",
  "individual_test",
  "round_1_test",
  "round_2_test",
]);

export const OPTIONAL_HEADERS = Object.freeze([
  "school_name",
  "school_code",
  "eligibility_basis",
  "statistics_eligibility_basis",
  "division",
  "round_3_test",
  "optional_1_test",
  "optional_2_test",
  "optional_3_test",
  "optional_4_test",
  "optional_5_test",
  "optional_6_test",
  "events",
  "previous_ids",
]);

const SUPPORTED_HEADERS = new Set([...REQUIRED_HEADERS, ...OPTIONAL_HEADERS]);

const HEADER_ALIASES = Object.freeze({
  student: "student_name",
  name: "student_name",
  studentname: "student_name",
  full_name: "student_name",
  student_full_name: "student_name",
  stateid: "state_id",
  id: "state_id",
  student_id: "state_id",
  no_team: "state_id",
  no_team_id: "state_id",
  no_team_state_id: "state_id",
  individual: "individual_test",
  round_1: "round_1_test",
  round1: "round_1_test",
  round_2: "round_2_test",
  round2: "round_2_test",
  round_3: "round_3_test",
  round3: "round_3_test",
  round3_test: "round_3_test",
  event_1: "individual_test",
  event1: "individual_test",
  event_2: "round_1_test",
  event2: "round_1_test",
  event_3: "round_2_test",
  event3: "round_2_test",
  event_4: "round_3_test",
  event4: "round_3_test",
  eligibility: "eligibility_basis",
  current_course: "eligibility_basis",
  currentcourse: "eligibility_basis",
  course: "eligibility_basis",
  eligibility_basis: "eligibility_basis",
  topic_eligibility_level: "eligibility_basis",
  topic_level: "eligibility_basis",
  course_presently_enrolled_in: "eligibility_basis",
  statistics_eligibility_basis: "statistics_eligibility_basis",
  statistics_basis: "statistics_eligibility_basis",
  other_course_basis: "statistics_eligibility_basis",
  secondary_eligibility_basis: "statistics_eligibility_basis",
  non_statistics_eligibility_basis: "statistics_eligibility_basis",
  optional_event_1: "optional_1_test",
  optional_event1: "optional_1_test",
  optional1: "optional_1_test",
  additional_event_1: "optional_1_test",
  additional_event1: "optional_1_test",
  optional_event_2: "optional_2_test",
  optional_event2: "optional_2_test",
  optional2: "optional_2_test",
  additional_event_2: "optional_2_test",
  additional_event2: "optional_2_test",
  optional_event_3: "optional_3_test",
  optional_event3: "optional_3_test",
  optional3: "optional_3_test",
  additional_event_3: "optional_3_test",
  additional_event3: "optional_3_test",
  optional_event_4: "optional_4_test",
  optional_event4: "optional_4_test",
  optional4: "optional_4_test",
  additional_event_4: "optional_4_test",
  additional_event4: "optional_4_test",
  optional_event_5: "optional_5_test",
  optional_event5: "optional_5_test",
  optional5: "optional_5_test",
  additional_event_5: "optional_5_test",
  additional_event5: "optional_5_test",
  optional_event_6: "optional_6_test",
  optional_event6: "optional_6_test",
  optional6: "optional_6_test",
  additional_event_6: "optional_6_test",
  additional_event6: "optional_6_test",
  events: "events",
  event_list: "events",
  tests: "events",
  test_list: "events",
  scantrons: "events",
  tests_to_print: "events",
  events_to_print: "events",
  previous_id: "previous_ids",
  previous_ids: "previous_ids",
  previous_year_id: "previous_ids",
  previous_year_ids: "previous_ids",
  previous_famat_id: "previous_ids",
  previous_famat_ids: "previous_ids",
  previous_year_famat_id: "previous_ids",
  previous_year_famat_ids: "previous_ids",
  prior_id: "previous_ids",
  prior_ids: "previous_ids",
  prior_year_id: "previous_ids",
  prior_year_ids: "previous_ids",
  last_year_id: "previous_ids",
  last_year_ids: "previous_ids",
  school: "school_name",
  schoolname: "school_name",
  schoolcode: "school_code",
  registered_division: "division",
  level: "division",
});

function makeIssue(severity, code, message, details = {}) {
  return { severity, code, message, ...details };
}
function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compactSpacedId(value) {
  return String(value ?? "").trim().replace(/\s+/g, "");
}

function normalizeHeader(value) {
  const normalized = String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  return HEADER_ALIASES[normalized] ?? normalized;
}

/**
 * A small RFC-4180-style reader used instead of String.split so quoted names
 * such as "Rivera, Ana M." remain one field.  It also preserves the source
 * line on which each logical row began.
 */
export function parseDelimitedRows(text, delimiter = ",") {
  if (delimiter !== "," && delimiter !== "\t") {
    throw new TypeError("delimiter must be a comma or tab");
  }

  const input = String(text ?? "").replace(/^\uFEFF/, "");
  const rows = [];
  const errors = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;

  const pushRow = () => {
    row.push(field);
    rows.push({ values: row, line: rowStartLine });
    row = [];
    field = "";
  };

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (inQuotes) {
      if (character === '"') {
        if (input[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
        if (character === "\n") line += 1;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === delimiter) {
      row.push(field);
      field = "";
    } else if (character === "\r" || character === "\n") {
      if (character === "\r" && input[index + 1] === "\n") index += 1;
      pushRow();
      line += 1;
      rowStartLine = line;
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    errors.push(
      makeIssue("error", "UNTERMINATED_QUOTED_FIELD", "A quoted field was not closed.", {
        line: rowStartLine,
      }),
    );
  }

  if (field.length > 0 || row.length > 0) pushRow();
  return { rows, errors };
}

function rowIsEmpty(values) {
  return values.every((value) => String(value ?? "").trim() === "");
}

/** Parse CSV, TSV, or pasted delimited registrations with the required header. */
export function parseDelimitedRegistration(
  text,
  { delimiter = null, requiredHeaders = REQUIRED_HEADERS } = {},
) {
  if (!Array.isArray(requiredHeaders)) throw new TypeError("requiredHeaders must be an array");
  const input = String(text ?? "");
  const firstNonblank = input.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const actualDelimiter = delimiter ?? (firstNonblank.includes("\t") ? "\t" : ",");
  const parsed = parseDelimitedRows(input, actualDelimiter);
  const errors = [...parsed.errors];
  const warnings = [];
  const records = [];

  const headerRowIndex = parsed.rows.findIndex((row) => !rowIsEmpty(row.values));
  if (headerRowIndex < 0) {
    errors.push(makeIssue("error", "EMPTY_INPUT", "No registration rows were provided."));
    return {
      format: actualDelimiter === "\t" ? "tsv" : "csv",
      schoolName: null,
      schoolCode: null,
      records,
      errors,
      warnings,
    };
  }

  const headerRow = parsed.rows[headerRowIndex];
  const headers = headerRow.values.map(normalizeHeader);
  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  for (const header of new Set(duplicateHeaders)) {
    errors.push(
      makeIssue("error", "DUPLICATE_HEADER", `Header "${header}" occurs more than once.`, {
        line: headerRow.line,
        field: header,
      }),
    );
  }

  for (const required of requiredHeaders) {
    if (!headers.includes(required)) {
      errors.push(
        makeIssue("error", "MISSING_HEADER", `Required header "${required}" is missing.`, {
          line: headerRow.line,
          field: required,
        }),
      );
    }
  }

  for (const header of headers) {
    if (header && !SUPPORTED_HEADERS.has(header)) {
      warnings.push(
        makeIssue("warning", "UNKNOWN_HEADER", `Unrecognized column "${header}" was ignored.`, {
          line: headerRow.line,
          field: header,
        }),
      );
    }
  }

  if (errors.some((issue) => issue.code === "MISSING_HEADER")) {
    return {
      format: actualDelimiter === "\t" ? "tsv" : "csv",
      schoolName: null,
      schoolCode: null,
      records,
      errors,
      warnings,
    };
  }

  for (const parsedRow of parsed.rows.slice(headerRowIndex + 1)) {
    if (rowIsEmpty(parsedRow.values)) continue;
    let values = [...parsedRow.values];

    // Recover the common pasted-CSV case `Last, First,123...` where the name
    // was not quoted.  The documented header puts student_name first, so all
    // surplus leading fields belong to that name.
    if (
      actualDelimiter === "," &&
      values.length > headers.length &&
      headers[0] === "student_name"
    ) {
      const surplus = values.length - headers.length;
      values = [values.slice(0, surplus + 1).join(",").trim(), ...values.slice(surplus + 1)];
      warnings.push(
        makeIssue(
          "warning",
          "UNQUOTED_NAME_COMMA_RECOVERED",
          "Extra leading CSV fields were joined as the student name; quote comma-containing names when possible.",
          { line: parsedRow.line },
        ),
      );
    }

    if (values.length !== headers.length) {
      errors.push(
        makeIssue(
          "error",
          "FIELD_COUNT_MISMATCH",
          `Expected ${headers.length} fields but found ${values.length}.`,
          { line: parsedRow.line, raw: parsedRow.values.join(actualDelimiter) },
        ),
      );
    }

    while (values.length < headers.length) values.push("");
    const rowObject = Object.fromEntries(
      headers.map((header, index) => [header, String(values[index] ?? "").trim()]),
    );

    records.push({
      studentName: collapseWhitespace(rowObject.student_name),
      stateId: compactSpacedId(rowObject.state_id),
      individualTest: rowObject.individual_test,
      round1Test: rowObject.round_1_test,
      round2Test: rowObject.round_2_test,
      round3Test: rowObject.round_3_test ?? "",
      schoolName: collapseWhitespace(rowObject.school_name),
      schoolCode: compactSpacedId(rowObject.school_code),
      eligibilityBasis: collapseWhitespace(rowObject.eligibility_basis),
      statisticsEligibilityBasis: collapseWhitespace(rowObject.statistics_eligibility_basis),
      division: collapseWhitespace(rowObject.division),
      optional1Test: rowObject.optional_1_test ?? "",
      optional2Test: rowObject.optional_2_test ?? "",
      optional3Test: rowObject.optional_3_test ?? "",
      optional4Test: rowObject.optional_4_test ?? "",
      optional5Test: rowObject.optional_5_test ?? "",
      optional6Test: rowObject.optional_6_test ?? "",
      events: rowObject.events ?? "",
      previousIds: rowObject.previous_ids ?? "",
      team1Id: null,
      team2Id: null,
      source: {
        format: actualDelimiter === "\t" ? "tsv" : "csv",
        line: parsedRow.line,
        raw: parsedRow.values.join(actualDelimiter),
      },
    });
  }

  if (records.length === 0) {
    errors.push(
      makeIssue(
        "error",
        "NO_STUDENTS_IN_SOURCE",
        "The registration source has a header but no student rows.",
      ),
    );
  }

  const uniqueSchoolNames = new Set(records.map((record) => record.schoolName).filter(Boolean));
  const uniqueSchoolCodes = new Set(records.map((record) => record.schoolCode).filter(Boolean));
  const everyRecordHasSchoolName = records.length > 0 && records.every((record) => record.schoolName);
  const everyRecordHasSchoolCode = records.length > 0 && records.every((record) => record.schoolCode);

  return {
    format: actualDelimiter === "\t" ? "tsv" : "csv",
    schoolName:
      everyRecordHasSchoolName && uniqueSchoolNames.size === 1 ? [...uniqueSchoolNames][0] : null,
    schoolCode:
      everyRecordHasSchoolCode && uniqueSchoolCodes.size === 1 ? [...uniqueSchoolCodes][0] : null,
    records,
    errors,
    warnings,
  };
}

const DIVISION_AT_END = new RegExp(
  String.raw`(?:\s+|\()(` +
    String.raw`theta(?:\s+division)?|alpha(?:\s+division)?|mu(?:\s+division)?|` +
    String.raw`chi(?:\s+division)?|statistics(?:\s+division)?|stats|` +
    String.raw`pre[\s-]?calculus|calculus|geometry|` +
    String.raw`algebra\s*(?:ii|2|i|1)` +
    String.raw`)\)?\s*$`,
  "i",
);

const LEVEL_DIGIT_DIVISION = Object.freeze({
  1: "theta",
  2: "theta",
  3: "theta",
  4: "alpha",
  5: "mu",
  6: "statistics",
  9: "chi",
});

const REGIONAL_LEVEL_DIGIT_DIVISION = Object.freeze({
  1: "algebra_1",
  2: "geometry",
  3: "algebra_2",
  4: "precalculus",
  5: "calculus",
  6: "statistics",
});

function eligibilityBasisForRegionalDivision(division) {
  if (division === "algebra_1") return "algebra_1";
  if (division === "geometry" || division === "algebra_2") return "geometry_algebra_2";
  if (division === "precalculus") return "precalculus";
  if (division === "calculus") return "calculus";
  if (division === "statistics") return "statistics_special";
  return "";
}

function withoutTrailingDivision(value) {
  const match = String(value ?? "").match(DIVISION_AT_END);
  return match ? String(value).slice(0, match.index).trim() : collapseWhitespace(value);
}

export function isObviousPseudoStudent(value) {
  const name = withoutTrailingDivision(value);
  const parts = name.split(",").map((part) =>
    part
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim(),
  );
  if (parts.length < 2 || !parts[0] || parts[0] !== parts[1]) return false;
  return /(?:alg|algebra|geo|geometry|precalc|calculus|calc|stat|theta|alpha|mu|chi|test|sample)/i.test(
    parts[0],
  );
}

function isRosterHeading(line) {
  const normalized = collapseWhitespace(line).toLowerCase();
  return (
    /student.*division.*team\s*1.*team\s*2.*no\s*team/.test(normalized) ||
    /^(student|student name|division|team\s*1(?:\s*id)?|team\s*2(?:\s*id)?|no\s*team(?:\s*id)?)$/.test(
      normalized,
    )
  );
}

function isPageNoise(line) {
  const normalized = collapseWhitespace(line).toLowerCase();
  return (
    /^page\s+\d+(?:\s+of\s+\d+)?$/.test(normalized) ||
    /^generated\s+(?:on|at)\b/.test(normalized) ||
    /^famat\b.*(?:roster|registration)/.test(normalized)
  );
}

function extractTrailingIds(line) {
  const text = String(line ?? "").trim();
  // Match the rightmost whitespace-delimited suffix containing exactly one
  // or three nine-digit IDs. This avoids swallowing a division numeral such
  // as the `2` in `Algebra 2`, while still rejecting a tenth ID digit.
  const suffixMatch = text.match(/(?:^|\s)((?:(?:\d\s*){27}|(?:\d\s*){9}))$/);
  if (!suffixMatch) return null;
  const suffix = suffixMatch[1];
  const suffixStart = text.length - suffix.length;
  const digits = suffix.replace(/\s+/g, "");
  const prefix = text.slice(0, suffixStart).trim();

  // Reject a candidate that merely skipped an earlier separated digit. A
  // recognized division label such as Algebra 1 or Algebra 2 is legitimate.
  if (/\d$/.test(prefix) && !DIVISION_AT_END.test(prefix)) return null;

  if (digits.length === 27) {
    return {
      prefix,
      team1Id: digits.slice(0, 9),
      team2Id: digits.slice(9, 18),
      noTeamId: digits.slice(18, 27),
      completeVariants: true,
    };
  }

  return {
    prefix,
    team1Id: null,
    team2Id: null,
    noTeamId: digits,
    completeVariants: false,
  };
}

function rosterHeader(line) {
  if (!/^Roster\s*:/i.test(line)) return null;
  let remainder = line.replace(/^Roster\s*:\s*/i, "").trim();
  const codeMatch = remainder.match(/\s+#\s*(\d{4})\s*$/);
  let schoolCode = null;
  if (codeMatch) {
    schoolCode = codeMatch[1];
    remainder = remainder.slice(0, codeMatch.index).trim();
  }
  return { schoolName: collapseWhitespace(remainder), schoolCode };
}

function parseRosterRecord(
  raw,
  sourceLine,
  errors,
  warnings,
  catalog,
  inferIndividualFromDivision,
  divisionScheme,
) {
  const ids = extractTrailingIds(raw);
  if (!ids) return null;

  const divisionMatch = ids.prefix.match(DIVISION_AT_END);
  const rawDivision = divisionMatch?.[1] ?? null;
  const regionalScheme = divisionScheme === "regional";
  let division = normalizeDivisionForProfile(
    rawDivision,
    regionalScheme ? "regional" : "state",
  );
  const studentName = collapseWhitespace(
    divisionMatch ? ids.prefix.slice(0, divisionMatch.index) : ids.prefix,
  );

  if (isObviousPseudoStudent(studentName)) {
    warnings.push(
      makeIssue(
        "warning",
        "PSEUDO_ROW_SKIPPED",
        `Skipped obvious placeholder row "${studentName}".`,
        { line: sourceLine, raw },
      ),
    );
    return { skipped: true };
  }

  if (!studentName) {
    errors.push(
      makeIssue("error", "MISSING_STUDENT_NAME", "Could not find a student name on roster row.", {
        line: sourceLine,
        raw,
      }),
    );
  }

  if (!division) {
    division = (regionalScheme ? REGIONAL_LEVEL_DIGIT_DIVISION : LEVEL_DIGIT_DIVISION)[
      ids.noTeamId[7]
    ] ?? null;
    if (division) {
      warnings.push(
        makeIssue(
          "warning",
          "DIVISION_INFERRED_FROM_LEVEL_DIGIT",
          `Division was inferred as ${division} from the No Team ID.`,
          { line: sourceLine, raw },
        ),
      );
    } else {
      errors.push(
        makeIssue(
          "error",
          "MISSING_DIVISION",
          "Could not identify the student's division on roster row.",
          { line: sourceLine, raw, studentName },
        ),
      );
    }
  }

  if (!ids.completeVariants) {
    warnings.push(
      makeIssue(
        "warning",
        "ONLY_NO_TEAM_ID_FOUND",
        "The row contained a No Team ID but not all Team 1 / Team 2 variants.",
        { line: sourceLine, raw, studentName },
      ),
    );
  } else {
    const sameBase =
      ids.team1Id.slice(0, 8) === ids.noTeamId.slice(0, 8) &&
      ids.team2Id.slice(0, 8) === ids.noTeamId.slice(0, 8);
    if (!sameBase || !ids.team1Id.endsWith("1") || !ids.team2Id.endsWith("2")) {
      errors.push(
        makeIssue(
          "error",
          "INCONSISTENT_TEAM_IDS",
          "Team 1, Team 2, and No Team IDs do not share the expected first eight digits/endings.",
          { line: sourceLine, raw, studentName },
        ),
      );
    }
  }

  const individual = inferIndividualFromDivision && division
    ? regionalScheme
      ? inferIndividualTestForProfile(division, catalog, "regional")
      : inferIndividualTestFromDivision(division, catalog)
    : null;
  return {
    skipped: false,
    record: {
      studentName,
      stateId: ids.noTeamId,
      individualTest: individual?.id ?? "",
      round1Test: "",
      round2Test: "",
      round3Test: "",
      optional1Test: "",
      optional2Test: "",
      optional3Test: "",
      optional4Test: "",
      optional5Test: "",
      optional6Test: "",
      events: "",
      previousIds: "",
      division,
      eligibilityBasis: regionalScheme ? eligibilityBasisForRegionalDivision(division) : "",
      statisticsEligibilityBasis: "",
      team1Id: ids.team1Id,
      team2Id: ids.team2Id,
      source: { format: "roster", line: sourceLine, raw },
    },
  };
}

/**
 * famat.org lists a student once per division (Geometry and Algebra II, or
 * Calculus and Statistics). Keep one record per student, the same way the quick
 * page does: name plus the school and student digits of the ID. At State the
 * Individual and both topic rounds come from the student's course (shared rules
 * in preview/src/presets.js); elsewhere the higher division's line is kept.
 */
export function mergeSameStudentLines(records, divisionScheme, warnings = [], { assignTests = true } = {}) {
  const groups = new Map();
  for (const record of records) {
    const key = `${nameKey(record.studentName)}|${String(record.stateId).slice(0, 7)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(record);
  }
  let merged = 0;
  const out = [];
  for (const group of groups.values()) {
    merged += group.length - 1;
    // At Regional a student registered in Statistics keeps the Statistics line
    // (Derek, Nov 26, 2026); elsewhere the higher division's line is kept.
    const statsLine = divisionScheme === "regional" && assignTests && group.length > 1
      ? group.find((r) => String(r.stateId)[7] === "6") : null;
    const keep = statsLine ?? group.reduce((best, r) => (divisionRank(String(r.stateId)[7]) > divisionRank(String(best.stateId)[7]) ? r : best));
    const record = { ...keep };
    if (divisionScheme === "state" && assignTests) {
      const also = group.filter((r) => r !== keep).map((r) => String(r.stateId));
      const row = assignState(String(keep.stateId), [], also);
      const ind = row.eligible && row.pile
        ? [...STATE_TEST_BY_ID.values()].find((t) => t.group === "individual" && t.name === row.pile) : null;
      // A single line keeps what the parser read from it; only its rounds are filled.
      if (ind && group.length === 1 && record.individualTest && record.individualTest !== ind.id) {
        // Division words and ID disagree: leave the record as read.
      } else if (ind) {
        const sheets = stateSheets(row);
        const course = group.find((r) => String(r.stateId).slice(0, 8) === row.courseId.slice(0, 8)) ?? keep;
        Object.assign(record, {
          stateId: sheets[0].id,
          team1Id: course.team1Id,
          team2Id: course.team2Id,
          individualTest: ind.id,
          division: ind.division,
          round1Test: STATE_TEST_BY_ID.has(row.topicDefaults.round_1) ? row.topicDefaults.round_1 : "",
          round2Test: STATE_TEST_BY_ID.has(row.topicDefaults.round_2) ? row.topicDefaults.round_2 : "",
        });
      }
    }
    out.push(record);
  }
  if (merged > 0) {
    warnings.push(makeIssue("warning", "MERGED_SAME_STUDENT",
      `${merged} roster line${merged === 1 ? " was" : "s were"} the same student in another division and ${merged === 1 ? "was" : "were"} merged, so each student prints once.`));
  }
  return out;
}

/**
 * Parse text copied from the State roster PDF.  Every nonblank, non-header
 * line is either represented as a record or reported as a warning/error.
 */
export function parseRosterText(
  text,
  {
    catalog = TEST_CATALOG,
    inferIndividualFromDivision = true,
    divisionScheme = "state",
  } = {},
) {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  let records = [];
  const errors = [];
  const warnings = [];
  let schoolName = null;
  let schoolCode = null;
  let pendingPrefix = null;

  const flushPendingAsError = () => {
    if (!pendingPrefix) return;
    errors.push(
      makeIssue(
        "error",
        "UNRECOGNIZED_ROSTER_LINE",
        "Roster text was not a header and did not contain a complete No Team ID.",
        { line: pendingPrefix.line, raw: pendingPrefix.raw },
      ),
    );
    pendingPrefix = null;
  };

  for (let index = 0; index < lines.length; index += 1) {
    const lineNumber = index + 1;
    const rawLine = lines[index];
    const line = rawLine.trim();
    if (!line) continue;

    const header = rosterHeader(line);
    if (header) {
      flushPendingAsError();
      if (schoolName && header.schoolName && schoolName !== header.schoolName) {
        errors.push(
          makeIssue("error", "CONFLICTING_ROSTER_SCHOOL", "Roster headers name different schools.", {
            line: lineNumber,
            raw: line,
          }),
        );
      }
      if (schoolCode && header.schoolCode && schoolCode !== header.schoolCode) {
        errors.push(
          makeIssue(
            "error",
            "CONFLICTING_ROSTER_SCHOOL_CODE",
            "Roster headers contain different school codes.",
            { line: lineNumber, raw: line },
          ),
        );
      }
      schoolName = schoolName ?? header.schoolName ?? null;
      schoolCode = schoolCode ?? header.schoolCode ?? null;
      continue;
    }

    if (isRosterHeading(line) || isPageNoise(line)) {
      flushPendingAsError();
      continue;
    }

    const pseudoCandidate = withoutTrailingDivision(line);
    if (!extractTrailingIds(line) && isObviousPseudoStudent(pseudoCandidate)) {
      warnings.push(
        makeIssue(
          "warning",
          "PSEUDO_ROW_SKIPPED",
          `Skipped obvious placeholder row "${pseudoCandidate}".`,
          { line: lineNumber, raw: line },
        ),
      );
      continue;
    }

    if (!extractTrailingIds(line)) {
      if (pendingPrefix) flushPendingAsError();
      if (line.includes(",") || DIVISION_AT_END.test(line)) {
        pendingPrefix = { raw: line, line: lineNumber };
      } else {
        errors.push(
          makeIssue(
            "error",
            "UNRECOGNIZED_ROSTER_LINE",
            "Roster text was not a header and did not contain a complete No Team ID.",
            { line: lineNumber, raw: line },
          ),
        );
      }
      continue;
    }

    const sourceLine = pendingPrefix?.line ?? lineNumber;
    const combined = pendingPrefix ? `${pendingPrefix.raw} ${line}` : line;
    pendingPrefix = null;
    const parsed = parseRosterRecord(
      combined,
      sourceLine,
      errors,
      warnings,
      catalog,
      inferIndividualFromDivision,
      divisionScheme,
    );
    if (parsed?.record) records.push(parsed.record);
  }

  flushPendingAsError();
  records = mergeSameStudentLines(records, divisionScheme, warnings, { assignTests: inferIndividualFromDivision });

  if (!schoolName) {
    warnings.push(
      makeIssue(
        "warning",
        "MISSING_ROSTER_HEADER",
        "No `Roster:` school header was found; enter the full school name separately.",
      ),
    );
  }

  if (records.length === 0) {
    const hasExtractedText = String(text ?? "").trim().length > 0;
    errors.push(
      makeIssue(
        "error",
        hasExtractedText ? "NO_STUDENTS_IN_SOURCE" : "NO_EXTRACTABLE_TEXT",
        hasExtractedText
          ? "The roster source did not contain any recognizable student rows. Review the PDF or use a CSV export."
          : "No extractable text was found. The PDF may be image-only; use an OCR-enabled PDF or a CSV export.",
      ),
    );
  }

  return {
    format: "roster",
    schoolName,
    schoolCode,
    records,
    errors,
    warnings,
  };
}

export function parseRegistrationInput(
  text,
  {
    format = "auto",
    delimiter = null,
    catalog = TEST_CATALOG,
    requiredHeaders = REQUIRED_HEADERS,
    inferIndividualFromDivision = true,
    divisionScheme = "state",
  } = {},
) {
  const input = String(text ?? "");
  if (format === "roster") {
    return parseRosterText(input, { catalog, inferIndividualFromDivision, divisionScheme });
  }
  if (format === "csv") return parseDelimitedRegistration(input, { delimiter: ",", requiredHeaders });
  if (format === "tsv") return parseDelimitedRegistration(input, { delimiter: "\t", requiredHeaders });
  if (format !== "auto") throw new TypeError(`Unsupported input format "${format}".`);

  if (/^\s*Roster\s*:/im.test(input)) {
    return parseRosterText(input, { catalog, inferIndividualFromDivision, divisionScheme });
  }
  const firstNonblank = input.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const inferredDelimiter = delimiter ?? (firstNonblank.includes("\t") ? "\t" : ",");
  return parseDelimitedRegistration(input, { delimiter: inferredDelimiter, requiredHeaders });
}
