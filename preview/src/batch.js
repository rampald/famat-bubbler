import {
  TEST_CATALOG,
  TEST_GROUPS,
  normalizeDivision,
  normalizeDivisionForProfile,
  resolveTestReference,
} from "./catalog.js";

const ASSIGNMENT_GROUPS = Object.freeze({
  individualTest: TEST_GROUPS.INDIVIDUAL,
  round1Test: TEST_GROUPS.ROUND_1,
  round2Test: TEST_GROUPS.ROUND_2,
  round3Test: TEST_GROUPS.ROUND_3,
});

const OPTIONAL_ASSIGNMENT_FIELDS = new Set([
  "optional1Test",
  "optional2Test",
  "optional3Test",
  "optional4Test",
  "optional5Test",
  "optional6Test",
]);

const MATERIAL_FIELDS = Object.freeze([
  { field: "studentName", label: "student name" },
  { field: "eligibilityBasis", label: "eligibility basis" },
  { field: "statisticsEligibilityBasis", label: "Statistics secondary eligibility basis" },
  { field: "division", label: "division" },
  { field: "schoolName", label: "school name" },
  { field: "schoolCode", label: "school code" },
  { field: "individualTest", label: "Individual assignment" },
  { field: "round1Test", label: "Round 1 assignment" },
  { field: "round2Test", label: "Round 2 assignment" },
  { field: "round3Test", label: "Round 3 assignment" },
  { field: "optional1Test", label: "Optional Event 1 assignment" },
  { field: "optional2Test", label: "Optional Event 2 assignment" },
  { field: "optional3Test", label: "Optional Event 3 assignment" },
  { field: "optional4Test", label: "Optional Event 4 assignment" },
  { field: "optional5Test", label: "Optional Event 5 assignment" },
  { field: "optional6Test", label: "Optional Event 6 assignment" },
  { field: "events", label: "Events list" },
  { field: "previousIds", label: "previous-year IDs" },
  { field: "team1Id", label: "Team 1 ID" },
  { field: "team2Id", label: "Team 2 ID" },
]);

function collapseWhitespace(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function compact(value) {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function isBlank(value) {
  return value === null || value === undefined || collapseWhitespace(value) === "";
}

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, cloneValue(item)]));
  }
  return value;
}

const ELIGIBILITY_BASIS_ALIASES = new Map([
  ["algebra 1", "algebra_1"],
  ["algebra i", "algebra_1"],
  ["algebra_1", "algebra_1"],
  ["geometry", "geometry_algebra_2"],
  ["geometry algebra 2", "geometry_algebra_2"],
  ["geometry algebra ii", "geometry_algebra_2"],
  ["geometry_algebra_2", "geometry_algebra_2"],
  ["algebra 2", "geometry_algebra_2"],
  ["algebra ii", "geometry_algebra_2"],
  ["precalculus", "precalculus"],
  ["pre calculus", "precalculus"],
  ["calculus", "calculus"],
  ["statistics", "statistics_special"],
  ["statistics special", "statistics_special"],
  ["statistics_special", "statistics_special"],
  ["chi", "chi"],
  ["theta", "theta"],
  ["alpha", "alpha"],
  ["mu", "mu"],
]);

function normalizedWords(value) {
  return collapseWhitespace(value)
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizedMaterialValue(field, value, catalog, divisionScheme) {
  if (isBlank(value)) return "";
  if (["schoolCode", "team1Id", "team2Id"].includes(field)) return compact(value);
  if (field === "events") {
    return String(value)
      .split(/[;\n|]+/)
      .map((reference) => reference.trim())
      .filter(Boolean)
      .map((reference) => resolveTestReference(reference, null, catalog).test?.id ??
        collapseWhitespace(reference).toLowerCase())
      .sort()
      .join("|");
  }
  if (field === "previousIds") {
    return String(value)
      .split(/[;,|\n]+/)
      .map((id) => id.replace(/\s+/g, ""))
      .filter(Boolean)
      .sort()
      .join("|");
  }
  if (field === "eligibilityBasis" || field === "statisticsEligibilityBasis") {
    const normalized = normalizedWords(value);
    return ELIGIBILITY_BASIS_ALIASES.get(normalized) ?? normalized;
  }
  if (field === "division") {
    const normalized = normalizedWords(value);
    if (divisionScheme === "regional") {
      return normalizeDivisionForProfile(value, "regional") ?? normalized;
    }
    return normalizeDivision(value) ?? normalized;
  }
  if (OPTIONAL_ASSIGNMENT_FIELDS.has(field)) {
    const resolved = resolveTestReference(value, null, catalog);
    if (resolved.test) return resolved.test.id;
    return collapseWhitespace(value).toLowerCase();
  }
  const group = ASSIGNMENT_GROUPS[field];
  if (group) {
    const resolved = resolveTestReference(value, group, catalog);
    if (resolved.test) return resolved.test.id;
  }
  return collapseWhitespace(value).toLowerCase();
}

function parseSourceEntry(entry, index) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new TypeError(`Batch source ${index + 1} must be an object.`);
  }
  const filename = collapseWhitespace(entry.filename);
  if (!filename) throw new TypeError(`Batch source ${index + 1} requires a filename.`);
  const parsed = entry.parsed ?? entry.result ?? entry;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new TypeError(`Batch source "${filename}" requires a parsed result object.`);
  }
  if (parsed.records !== undefined && !Array.isArray(parsed.records)) {
    throw new TypeError(`Batch source "${filename}" records must be an array.`);
  }
  return { filename, parsed };
}

function contextualizeIssue(issue, filename, format) {
  const contextualized = issue && typeof issue === "object"
    ? cloneValue(issue)
    : { severity: "error", code: "INVALID_SOURCE_ISSUE", message: String(issue ?? "") };
  return {
    ...contextualized,
    filename,
    sourceFormat: format ?? null,
  };
}

function attachMetadata(record, parsed, filename) {
  const copiedRecord = record && typeof record === "object" ? cloneValue(record) : {};
  const originalSource = copiedRecord.source && typeof copiedRecord.source === "object"
    ? copiedRecord.source
    : {};
  const schoolName = collapseWhitespace(copiedRecord.schoolName || parsed.schoolName) || null;
  const schoolCode = compact(copiedRecord.schoolCode || parsed.schoolCode) || null;
  const format = originalSource.format ?? parsed.format ?? null;
  const provenance = {
    filename,
    format,
    line: originalSource.line ?? null,
    raw: originalSource.raw ?? null,
    schoolName,
    schoolCode,
  };

  return {
    ...copiedRecord,
    stateId: compact(copiedRecord.stateId),
    schoolName,
    schoolCode,
    source: {
      ...originalSource,
      filename,
      format,
      schoolName,
      schoolCode,
    },
    sources: [provenance],
  };
}

function compareMaterialFields(existing, incoming, catalog, divisionScheme) {
  const conflicts = [];
  const enrichments = [];
  for (const definition of MATERIAL_FIELDS) {
    const { field, label } = definition;
    const existingValue = existing[field];
    const incomingValue = incoming[field];
    const existingBlank = isBlank(existingValue);
    const incomingBlank = isBlank(incomingValue);
    if (existingBlank && !incomingBlank) {
      enrichments.push({ field, label, value: incomingValue });
      continue;
    }
    if (existingBlank || incomingBlank) continue;
    if (
      normalizedMaterialValue(field, existingValue, catalog, divisionScheme) !==
      normalizedMaterialValue(field, incomingValue, catalog, divisionScheme)
    ) {
      conflicts.push({
        field,
        label,
        existing: existingValue,
        incoming: incomingValue,
      });
    }
  }
  return { conflicts, enrichments };
}

function mergeMissingValues(existing, incoming) {
  const mergedFields = [];
  for (const [field, value] of Object.entries(incoming)) {
    if (field === "source" || field === "sources" || isBlank(value) || !isBlank(existing[field])) {
      continue;
    }
    existing[field] = cloneValue(value);
    mergedFields.push(field);
  }
  existing.sources.push(...incoming.sources.map(cloneValue));
  return mergedFields;
}

function sourceFilenames(record) {
  return [...new Set((record.sources ?? []).map((source) => source.filename).filter(Boolean))];
}

/**
 * Merge parser results without mutating the inputs.
 *
 * Each source may be `{ filename, parsed }`, `{ filename, result }`, or a
 * parsed result with a `filename` property. Records with the same nonblank
 * State ID are combined when their populated material fields agree. Exact
 * duplicates are removed, complementary blank fields are filled, and
 * contradictory populated fields create blocking errors plus conflict detail.
 */
export function mergeParsedSources(
  sources,
  { catalog = TEST_CATALOG, divisionScheme = "state" } = {},
) {
  if (!Array.isArray(sources)) throw new TypeError("sources must be an array");
  if (!Array.isArray(catalog)) throw new TypeError("catalog must be an array");

  const records = [];
  const errors = [];
  const warnings = [];
  const conflicts = [];
  const duplicates = [];
  const sourceSummaries = [];
  const recordByStateId = new Map();

  sources.forEach((entry, sourceIndex) => {
    const { filename, parsed } = parseSourceEntry(entry, sourceIndex);
    const format = parsed.format ?? null;
    const parsedErrors = Array.isArray(parsed.errors) ? parsed.errors : [];
    const parsedWarnings = Array.isArray(parsed.warnings) ? parsed.warnings : [];
    errors.push(...parsedErrors.map((issue) => contextualizeIssue(issue, filename, format)));
    warnings.push(...parsedWarnings.map((issue) => contextualizeIssue(issue, filename, format)));
    sourceSummaries.push({
      filename,
      format,
      schoolName: collapseWhitespace(parsed.schoolName) || null,
      schoolCode: compact(parsed.schoolCode) || null,
      recordCount: parsed.records?.length ?? 0,
      errorCount: parsedErrors.length,
      warningCount: parsedWarnings.length,
    });

    for (const rawRecord of parsed.records ?? []) {
      const incoming = attachMetadata(rawRecord, parsed, filename);
      if (!incoming.stateId) {
        records.push(incoming);
        continue;
      }

      const existing = recordByStateId.get(incoming.stateId);
      if (!existing) {
        recordByStateId.set(incoming.stateId, incoming);
        records.push(incoming);
        continue;
      }

      const comparison = compareMaterialFields(existing, incoming, catalog, divisionScheme);
      const filenames = [...new Set([...sourceFilenames(existing), ...sourceFilenames(incoming)])];
      if (comparison.conflicts.length > 0) {
        const fields = comparison.conflicts.map((difference) => difference.field);
        const conflict = {
          blocking: true,
          stateId: incoming.stateId,
          fields,
          differences: comparison.conflicts.map(cloneValue),
          filenames,
          existing: cloneValue(existing),
          incoming: cloneValue(incoming),
        };
        conflicts.push(conflict);
        errors.push({
          severity: "error",
          code: "DUPLICATE_STUDENT_CONFLICT",
          blocking: true,
          message:
            `Student ID ${incoming.stateId} has conflicting ${comparison.conflicts
              .map((difference) => difference.label)
              .join(", ")} data in ${filenames.map((name) => `"${name}"`).join(" and ")}.`,
          stateId: incoming.stateId,
          fields,
          filenames,
        });
        continue;
      }

      const mergedFields = mergeMissingValues(existing, incoming);
      const kind = comparison.enrichments.length === 0 && mergedFields.length === 0
        ? "exact"
        : "complementary";
      const duplicate = {
        stateId: incoming.stateId,
        kind,
        mergedFields: [...new Set(mergedFields)],
        filenames: sourceFilenames(existing),
      };
      duplicates.push(duplicate);
      warnings.push({
        severity: "warning",
        code: kind === "exact" ? "EXACT_DUPLICATE_STUDENT_DEDUPED" : "DUPLICATE_STUDENT_MERGED",
        message: kind === "exact"
          ? `An exact duplicate for student ID ${incoming.stateId} was removed.`
          : `Complementary records for student ID ${incoming.stateId} were merged.`,
        stateId: incoming.stateId,
        mergedFields: duplicate.mergedFields,
        filenames: duplicate.filenames,
      });
    }
  });

  return {
    ok: errors.length === 0,
    records,
    errors,
    warnings,
    conflicts,
    duplicates,
    sources: sourceSummaries,
  };
}
