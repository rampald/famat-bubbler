/**
 * FAMAT State Convention scorer catalog.
 *
 * Codes are strings on purpose: scanner codes are fixed-width identifiers and
 * must never lose a leading zero.  Codes follow the revised 2027 convention
 * packet's "Topic-test and individual-test codes" table (Derek, Nov 26, 2026:
 * "Use the updated information"): Individuals 111-555, Round 1 411-811,
 * Round 2 421-821.  The packet notes Radleigh and Tucker confirm the mapping.
 */

export const CATALOG_METADATA = Object.freeze({
  name: "FAMAT State Convention test-code catalog",
  conventionYear: 2027,
  mappingBasis: "Revised 2027 convention packet code table",
  status: "2027 packet mapping",
  sourceDescription:
    "Reviewed State Convention packet and organizer scorer mapping, including Chi",
  pendingItems: Object.freeze([]),
});

export const STATE_CATALOG_METADATA = CATALOG_METADATA;

const catalog = [
  {
    id: "theta-individual",
    code: "111",
    name: "Theta Individual",
    group: "individual",
    division: "theta",
    aliases: ["theta", "theta individual", "individual theta"],
  },
  {
    id: "alpha-individual",
    code: "222",
    name: "Alpha Individual",
    group: "individual",
    division: "alpha",
    aliases: ["alpha", "alpha individual", "individual alpha"],
  },
  {
    id: "mu-individual",
    code: "333",
    name: "Calculus Individual",
    group: "individual",
    division: "mu",
    aliases: ["mu", "mu individual", "individual mu", "calculus individual"],
  },
  {
    id: "statistics-individual",
    code: "444",
    name: "Statistics Individual",
    group: "individual",
    division: "statistics",
    aliases: ["statistics", "stats", "statistics individual", "stats individual"],
  },
  {
    id: "chi-individual",
    code: "555",
    name: "Chi Individual",
    group: "individual",
    division: "chi",
    aliases: ["chi", "chi individual", "individual chi"],
  },

  {
    id: "round-1-statistics-unplugged",
    code: "711",
    name: "Statistics Unplugged (Open)",
    group: "round_1",
    division: "open",
    aliases: ["statistics unplugged", "stats unplugged", "open statistics unplugged"],
  },
  {
    id: "round-1-gemini",
    code: "811",
    name: "Gemini (Open)",
    group: "round_1",
    division: "open",
    aliases: ["gemini", "open gemini"],
  },
  {
    id: "round-1-theta-applications",
    code: "411",
    name: "Theta Applications (Theta)",
    group: "round_1",
    division: "theta",
    aliases: ["theta applications", "applications theta", "applications"],
  },
  {
    id: "round-1-theta-functions",
    code: "412",
    name: "Functions (Theta)",
    group: "round_1",
    division: "theta",
    aliases: ["functions", "theta functions", "functions theta"],
  },
  {
    id: "round-1-theta-cpav",
    code: "413",
    name: "CPAV (Theta)",
    group: "round_1",
    division: "theta",
    rotation: Object.freeze({ year: 2027, label: "CPAV" }),
    aliases: [
      "cpav",
      "theta cpav",
      "circumference perimeter area volume",
      "circumference perimeter area and volume",
    ],
  },
  {
    id: "round-1-alpha-equations-inequalities",
    code: "511",
    name: "Equations & Inequalities (Alpha)",
    group: "round_1",
    division: "alpha",
    aliases: [
      "alpha equations and inequalities",
      "alpha equations inequalities",
      "equations and inequalities",
      "equations inequalities",
    ],
  },
  {
    id: "round-1-alpha-analytic-geometry",
    code: "512",
    name: "Analytic Geometry (Alpha)",
    group: "round_1",
    division: "alpha",
    aliases: ["analytic geometry", "alpha analytic geometry"],
  },
  {
    id: "round-1-alpha-trigonometry",
    code: "513",
    name: "Trigonometry (Alpha)",
    group: "round_1",
    division: "alpha",
    aliases: ["trigonometry", "alpha trigonometry", "trig", "alpha trig"],
  },
  {
    id: "round-1-mu-calculus-applications",
    code: "611",
    name: "Calculus Applications (Mu)",
    group: "round_1",
    division: "mu",
    aliases: ["calculus applications", "mu applications", "mu calculus applications", "applications"],
  },
  {
    id: "round-1-mu-integration",
    code: "612",
    name: "Integration (Mu)",
    group: "round_1",
    division: "mu",
    aliases: ["integration", "mu integration"],
  },
  {
    id: "round-1-mu-sequences-series",
    code: "613",
    name: "Sequences & Series (Mu)",
    group: "round_1",
    division: "mu",
    aliases: ["sequences and series", "sequences series", "mu sequences and series"],
  },

  {
    id: "round-2-probability",
    code: "721",
    name: "Probability (Open)",
    group: "round_2",
    division: "open",
    aliases: ["probability", "open probability"],
  },
  {
    id: "round-2-history-trigonometry",
    code: "821",
    name: "History of Math: Trigonometry (Open)",
    group: "round_2",
    division: "open",
    rotation: Object.freeze({ year: 2027, label: "History of Math: Trigonometry" }),
    aliases: [
      "history of math",
      "history of mathematics",
      "history of math trigonometry",
      "history of mathematics trigonometry",
      "open history of math",
      "trigonometry",
    ],
  },
  {
    id: "round-2-theta-equations-inequalities",
    code: "421",
    name: "Equations and Inequalities (Theta)",
    group: "round_2",
    division: "theta",
    aliases: [
      "theta equations and inequalities",
      "theta equations inequalities",
      "equations and inequalities",
      "equations inequalities",
    ],
  },
  {
    id: "round-2-theta-logs-exponents",
    code: "422",
    name: "Logs & Exponents (Theta)",
    group: "round_2",
    division: "theta",
    aliases: ["logs and exponents", "logs exponents", "theta logs and exponents"],
  },
  {
    id: "round-2-theta-geometry",
    code: "423",
    name: "Geometry (Theta)",
    group: "round_2",
    division: "theta",
    aliases: ["geometry", "theta geometry"],
  },
  {
    id: "round-2-alpha-applications",
    code: "521",
    name: "Alpha Applications (Alpha)",
    group: "round_2",
    division: "alpha",
    aliases: ["alpha applications", "applications alpha", "applications"],
  },
  {
    id: "round-2-alpha-complex-numbers",
    code: "522",
    name: "Complex Numbers (Alpha)",
    group: "round_2",
    division: "alpha",
    aliases: ["complex numbers", "alpha complex numbers"],
  },
  {
    id: "round-2-alpha-matrices-vectors",
    code: "523",
    name: "Matrices & Vectors (Alpha)",
    group: "round_2",
    division: "alpha",
    aliases: ["matrices and vectors", "matrices vectors", "alpha matrices and vectors"],
  },
  {
    id: "round-2-mu-area-volume",
    code: "621",
    name: "Area & Volume (Mu)",
    group: "round_2",
    division: "mu",
    aliases: ["area and volume", "area volume", "mu area and volume"],
  },
  {
    id: "round-2-mu-limits-derivatives",
    code: "622",
    name: "Limits & Derivatives (Mu)",
    group: "round_2",
    division: "mu",
    aliases: ["limits and derivatives", "limits derivatives", "mu limits and derivatives"],
  },
  {
    id: "round-2-mu-bc-calculus",
    code: "623",
    name: "BC Calculus (Mu)",
    group: "round_2",
    division: "mu",
    aliases: ["bc calculus", "mu bc calculus"],
  },
];

export const STATE_ID_DIGITS_BY_DIVISION = Object.freeze({
  theta: Object.freeze(["2", "3"]),
  alpha: Object.freeze(["4"]),
  mu: Object.freeze(["5"]),
  statistics: Object.freeze(["6"]),
  chi: Object.freeze(["9"]),
});

export const STATE_DIVISION_BY_ID_DIGIT = Object.freeze({
  2: "theta",
  3: "theta",
  4: "alpha",
  5: "mu",
  6: "statistics",
  9: "chi",
});

export const REGIONAL_DIVISION_DIGITS = Object.freeze({
  algebra_1: "1",
  geometry: "2",
  algebra_2: "3",
  precalculus: "4",
  calculus: "5",
  statistics: "6",
});

export const REGIONAL_DIVISION_BY_ID_DIGIT = Object.freeze(
  Object.fromEntries(
    Object.entries(REGIONAL_DIVISION_DIGITS).map(([division, digit]) => [digit, division]),
  ),
);

function freezeTest(test) {
  const eligibleDivisions = Array.isArray(test.eligibleDivisions)
    ? test.eligibleDivisions
    : [];
  return Object.freeze({
    status: "operational",
    blocking: false,
    active: true,
    eventRole: test.group === "individual" ? "individual" : "written-event",
    producesScantron: true,
    aliases: Object.freeze([]),
    ...test,
    aliases: Object.freeze([...(test.aliases ?? [])]),
    eligibleDivisions: Object.freeze([...eligibleDivisions]),
  });
}
export const TEST_GROUPS = Object.freeze({
  INDIVIDUAL: "individual",
  OPTIONAL: "optional",
  ROUND_1: "round_1",
  ROUND_2: "round_2",
  ROUND_3: "round_3",
});

export const STATE_TEST_CATALOG = Object.freeze(catalog.map(freezeTest));

// Compatibility alias retained for existing integrations and tests. New code
// should select a catalog through a convention profile.
export const TEST_CATALOG = STATE_TEST_CATALOG;

export const NATIONAL_CATALOG_METADATA = Object.freeze({
  name: "Mu Alpha Theta National Convention 2027 test-code catalog",
  conventionYear: 2027,
  mappingBasis: "Official 2027 Sponsor Packet event list",
  status: "Scorer codes pending official confirmation",
  sourceDescription: "Mu Alpha Theta 2027 National Convention Sponsor Packet",
  pendingItems: Object.freeze(["all-national-tests"]),
});

function nationalTest(id, name, group, division, aliases = []) {
  return {
    id: `national-${id}`,
    code: null,
    name,
    group,
    division,
    status: "pending",
    blocking: true,
    note:
      "The official 2027 Sponsor Packet identifies this event but does not publish its three-digit scorer code. Enter only a reviewed official code.",
    aliases,
  };
}

const nationalCatalog = [
  nationalTest("theta-individual", "Theta Individual", "individual", "theta", [
    "theta",
    "theta individual",
    "individual theta",
  ]),
  nationalTest("alpha-individual", "Alpha Individual", "individual", "alpha", [
    "alpha",
    "alpha individual",
    "individual alpha",
  ]),
  nationalTest("mu-individual", "Mu Individual", "individual", "mu", [
    "mu",
    "mu individual",
    "individual mu",
  ]),

  nationalTest("round-1-theta-analytic-geometry", "Analytic Geometry (Theta)", "round_1", "theta", [
    "theta analytic geometry",
    "analytic geometry theta",
  ]),
  nationalTest("round-1-theta-area-volume", "Area & Volume (Theta)", "round_1", "theta", [
    "theta area and volume",
    "area and volume theta",
  ]),
  nationalTest("round-1-theta-applications", "Applications (Theta)", "round_1", "theta", [
    "theta applications",
    "applications theta",
  ]),
  nationalTest("round-1-alpha-analytic-geometry", "Analytic Geometry (Alpha)", "round_1", "alpha", [
    "alpha analytic geometry",
    "analytic geometry alpha",
  ]),
  nationalTest("round-1-alpha-complex-numbers", "Complex Numbers (Alpha)", "round_1", "alpha", [
    "alpha complex numbers",
    "complex numbers alpha",
  ]),
  nationalTest("round-1-alpha-applications", "Applications (Alpha)", "round_1", "alpha", [
    "alpha applications",
    "applications alpha",
  ]),
  nationalTest("round-1-mu-advanced-calculus", "Advanced Calculus (Mu)", "round_1", "mu", [
    "mu advanced calculus",
    "advanced calculus mu",
  ]),
  nationalTest("round-1-mu-area-volume", "Area & Volume (Mu)", "round_1", "mu", [
    "mu area and volume",
    "area and volume mu",
  ]),
  nationalTest("round-1-mu-applications", "Applications (Mu)", "round_1", "mu", [
    "mu applications",
    "applications mu",
  ]),
  nationalTest("round-1-open-statistics", "Statistics (Open)", "round_1", "open", [
    "statistics open",
    "open statistics",
  ]),
  nationalTest("round-1-open-math-of-history", "Math of History (Open)", "round_1", "open", [
    "math of history",
    "math of history open",
    "open math of history",
  ]),

  nationalTest("round-2-theta-logs-exponents", "Logs & Exponents (Theta)", "round_2", "theta", [
    "theta logs and exponents",
    "logs and exponents theta",
  ]),
  nationalTest("round-2-theta-triangles", "Triangles (Theta)", "round_2", "theta", [
    "theta triangles",
    "triangles theta",
  ]),
  nationalTest("round-2-theta-combinatorics-probability", "Combinatorics & Probability (Theta)", "round_2", "theta", [
    "theta combinatorics and probability",
    "combinatorics and probability theta",
  ]),
  nationalTest("round-2-alpha-logs-exponents", "Logs & Exponents (Alpha)", "round_2", "alpha", [
    "alpha logs and exponents",
    "logs and exponents alpha",
  ]),
  nationalTest("round-2-alpha-trigonometry", "Trigonometry (Alpha)", "round_2", "alpha", [
    "alpha trigonometry",
    "trigonometry alpha",
    "alpha trig",
  ]),
  nationalTest("round-2-alpha-combinatorics-probability", "Combinatorics & Probability (Alpha)", "round_2", "alpha", [
    "alpha combinatorics and probability",
    "combinatorics and probability alpha",
  ]),
  nationalTest("round-2-mu-bc-calculus", "BC Calculus (Mu)", "round_2", "mu", [
    "mu bc calculus",
    "bc calculus mu",
  ]),
  nationalTest("round-2-mu-integration", "Integration (Mu)", "round_2", "mu", [
    "mu integration",
    "integration mu",
  ]),
  nationalTest("round-2-mu-combinatorics-probability", "Combinatorics & Probability (Mu)", "round_2", "mu", [
    "mu combinatorics and probability",
    "combinatorics and probability mu",
  ]),
  nationalTest("round-2-open-discrete-math", "Discrete Math (Open)", "round_2", "open", [
    "discrete math",
    "discrete mathematics",
    "open discrete math",
  ]),
  nationalTest("round-2-open-history-of-math", "History of Math (Open)", "round_2", "open", [
    "history of math",
    "history of mathematics",
    "open history of math",
  ]),

  nationalTest("round-3-theta-equations-inequalities", "Equations & Inequalities (Theta)", "round_3", "theta", [
    "theta equations and inequalities",
    "equations and inequalities theta",
  ]),
  nationalTest("round-3-theta-circles-polygons", "Circles & Polygons (Theta)", "round_3", "theta", [
    "theta circles and polygons",
    "circles and polygons theta",
  ]),
  nationalTest("round-3-theta-sequences-series", "Sequences & Series (Theta)", "round_3", "theta", [
    "theta sequences and series",
    "sequences and series theta",
  ]),
  nationalTest("round-3-alpha-equations-inequalities", "Equations & Inequalities (Alpha)", "round_3", "alpha", [
    "alpha equations and inequalities",
    "equations and inequalities alpha",
  ]),
  nationalTest("round-3-alpha-matrices-vectors", "Matrices & Vectors (Alpha)", "round_3", "alpha", [
    "alpha matrices and vectors",
    "matrices and vectors alpha",
  ]),
  nationalTest("round-3-alpha-sequences-series", "Sequences & Series (Alpha)", "round_3", "alpha", [
    "alpha sequences and series",
    "sequences and series alpha",
  ]),
  nationalTest("round-3-mu-comprehensive", "Comprehensive (Mu)", "round_3", "mu", [
    "mu comprehensive",
    "comprehensive mu",
  ]),
  nationalTest("round-3-mu-limits-derivatives", "Limits & Derivatives (Mu)", "round_3", "mu", [
    "mu limits and derivatives",
    "limits and derivatives mu",
  ]),
  nationalTest("round-3-mu-sequences-series", "Sequences & Series (Mu)", "round_3", "mu", [
    "mu sequences and series",
    "sequences and series mu",
  ]),
  nationalTest("round-3-open-number-theory", "Number Theory (Open)", "round_3", "open", [
    "number theory",
    "open number theory",
  ]),
  nationalTest("round-3-open-codes-ciphers", "Codes & Ciphers (Open)", "round_3", "open", [
    "codes and ciphers",
    "codes ciphers",
    "open codes and ciphers",
  ]),
];

export const NATIONAL_TEST_CATALOG = Object.freeze(nationalCatalog.map(freezeTest));

function regionalIndividual(id, name, division, idDigit, aliases = []) {
  return {
    id: `regional-${id}-individual`,
    code: null,
    name: `${name} Individual`,
    group: TEST_GROUPS.INDIVIDUAL,
    division,
    idDigit,
    eventRole: "individual",
    producesScantron: true,
    status: "pending",
    blocking: true,
    note:
      "Enter the organizer-reviewed three-digit scorer code for this competition before generating sheets.",
    eligibleDivisions: [division],
    aliases: [name, `${name} individual`, `individual ${name}`, ...aliases],
  };
}

const regionalCatalog = [
  regionalIndividual("algebra-1", "Algebra I", "algebra_1", "1", [
    "algebra 1",
    "alg 1",
    "alg i",
  ]),
  regionalIndividual("geometry", "Geometry", "geometry", "2", ["geo"]),
  regionalIndividual("algebra-2", "Algebra II", "algebra_2", "3", [
    "algebra 2",
    "alg 2",
    "alg ii",
  ]),
  regionalIndividual("precalculus", "Precalculus", "precalculus", "4", [
    "pre calculus",
    "precalc",
  ]),
  regionalIndividual("calculus", "Calculus", "calculus", "5", ["calc"]),
  regionalIndividual("statistics", "Statistics", "statistics", "6", ["stats"]),
];

export const REGIONAL_TEST_CATALOG = Object.freeze(regionalCatalog.map(freezeTest));
export const CUSTOM_TEST_CATALOG = Object.freeze([]);

export const REGIONAL_CATALOG_METADATA = Object.freeze({
  name: "FAMAT Regional / Invitational event catalog",
  conventionYear: null,
  mappingBasis: "FAMAT Sponsor Guide division rules plus organizer-reviewed scorer codes",
  status: "Six required Individual events supplied; organizer codes required",
  sourceDescription:
    "Official Regional/Statewide divisions and ID digits; codes remain competition-specific",
  pendingItems: Object.freeze(["regional-individual-codes", "optional-written-events"]),
});

export const CUSTOM_CATALOG_METADATA = Object.freeze({
  name: "Custom FAMAT event catalog",
  conventionYear: null,
  mappingBasis: "User-reviewed tournament configuration",
  status: "Organizer configuration required",
  sourceDescription: "No preset packet assumptions",
  pendingItems: Object.freeze(["custom-events-and-codes"]),
});

function freezeAssignment(assignment) {
  return Object.freeze({ ...assignment });
}

function freezeProfile(profile) {
  return Object.freeze({
    // Version 2.3.0: every profile uses one checklist of tests per student,
    // and divisions come from registration IDs. The older course-eligibility
    // questions stay in the code but are switched off.
    testChecklist: true,
    courseEligibilityQuestions: false,
    ...profile,
    assignments: Object.freeze(profile.assignments.map(freezeAssignment)),
  });
}

export const CONVENTION_PROFILES = Object.freeze({
  regional: freezeProfile({
    id: "regional",
    label: "FAMAT Regional / Invitational",
    shortLabel: "Regional / Invitational",
    year: null,
    catalog: REGIONAL_TEST_CATALOG,
    catalogMetadata: REGIONAL_CATALOG_METADATA,
    assignments: [
      {
        field: "individualTest",
        group: TEST_GROUPS.INDIVIDUAL,
        label: "Individual",
        derived: true,
      },
      ...Array.from({ length: 6 }, (_, index) => ({
        field: `optional${index + 1}Test`,
        group: TEST_GROUPS.OPTIONAL,
        label: `Optional event ${index + 1}`,
        required: false,
        optional: true,
      })),
    ],
    configurableEventSlots: true,
    requiresTournamentName: true,
    workflow: "division-individual-plus-optionals",
    divisionScheme: "regional",
    dynamicOptionalAssignments: true,
    inferIndividualFromDivision: true,
    enforceIndividualDivision: true,
    filenamePrefix: "FAMAT-Regional-Invitational-Scantrons",
  }),
  state: freezeProfile({
    id: "state",
    label: "FAMAT State Convention",
    shortLabel: "State",
    year: 2027,
    catalog: STATE_TEST_CATALOG,
    catalogMetadata: STATE_CATALOG_METADATA,
    assignments: [
      {
        field: "individualTest",
        group: TEST_GROUPS.INDIVIDUAL,
        label: "Individual",
        derived: true,
      },
      { field: "round1Test", group: TEST_GROUPS.ROUND_1, label: "Round 1", topic: true },
      { field: "round2Test", group: TEST_GROUPS.ROUND_2, label: "Round 2", topic: true },
    ],
    workflow: "rounds",
    divisionScheme: "state",
    inferIndividualFromDivision: true,
    enforceIndividualDivision: true,
    filenamePrefix: "FAMAT-State-Scantrons",
  }),
  national: freezeProfile({
    id: "national",
    label: "Mu Alpha Theta National Convention",
    shortLabel: "National",
    year: 2027,
    catalog: NATIONAL_TEST_CATALOG,
    catalogMetadata: NATIONAL_CATALOG_METADATA,
    assignments: [
      { field: "individualTest", group: TEST_GROUPS.INDIVIDUAL, label: "Individual" },
      { field: "round1Test", group: TEST_GROUPS.ROUND_1, label: "Round 1", topic: true },
      { field: "round2Test", group: TEST_GROUPS.ROUND_2, label: "Round 2", topic: true },
      { field: "round3Test", group: TEST_GROUPS.ROUND_3, label: "Round 3", topic: true },
    ],
    filenamePrefix: "MAO-National-Scantrons",
  }),
  custom: freezeProfile({
    id: "custom",
    label: "Custom FAMAT Event",
    shortLabel: "Custom",
    year: null,
    catalog: CUSTOM_TEST_CATALOG,
    catalogMetadata: CUSTOM_CATALOG_METADATA,
    assignments: [
      {
        field: "individualTest",
        group: TEST_GROUPS.INDIVIDUAL,
        label: "Event 1",
        required: false,
      },
      { field: "round1Test", group: TEST_GROUPS.ROUND_1, label: "Event 2", required: false },
      { field: "round2Test", group: TEST_GROUPS.ROUND_2, label: "Event 3", required: false },
      { field: "round3Test", group: TEST_GROUPS.ROUND_3, label: "Event 4", required: false },
    ],
    configurableEventSlots: true,
    requiresTournamentName: true,
    requireAtLeastOneAssignment: true,
    inferIndividualFromDivision: false,
    enforceIndividualDivision: false,
    filenamePrefix: "FAMAT-Custom-Scantrons",
  }),
});

export const DEFAULT_PROFILE_ID = "state";

export function getConventionProfile(id = DEFAULT_PROFILE_ID) {
  return CONVENTION_PROFILES[id] ?? null;
}

const GROUP_VALUES = new Set(Object.values(TEST_GROUPS));
const DIVISION_VALUES = new Set([
  "chi",
  "theta",
  "alpha",
  "mu",
  "statistics",
  "open",
  "all",
  ...Object.keys(REGIONAL_DIVISION_DIGITS),
]);

function normalizeCatalogId(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Build an immutable catalog from user-reviewed event rows. This supports
 * renamed, regrouped, deactivated, and newly added events without mutating the
 * supplied base catalog. A blank code is explicitly pending and fail-closed.
 */
export function catalogFromEditableEntries(entries, { baseCatalog = [] } = {}) {
  if (!Array.isArray(entries)) throw new TypeError("catalog entries must be an array");
  if (!Array.isArray(baseCatalog)) throw new TypeError("baseCatalog must be an array");

  const baseById = new Map(baseCatalog.map((test) => [test.id, test]));
  const ids = new Set();
  const codeOwners = new Map();
  const derived = entries.map((entry, index) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new TypeError(`Catalog row ${index + 1} must be an object.`);
    }
    const id = normalizeCatalogId(entry.id);
    const name = String(entry.name ?? "").replace(/\s+/g, " ").trim();
    const group = String(entry.group ?? "").trim();
    const division = String(entry.division ?? "").trim().toLowerCase();
    const codeText = String(entry.code ?? "").trim();
    const code = codeText || null;
    const active = entry.active !== false;
    const base = baseById.get(id);
    const eventRole = String(entry.eventRole ?? base?.eventRole ?? "written-event")
      .trim()
      .toLowerCase();
    const producesScantron = entry.producesScantron ?? base?.producesScantron ?? true;
    const idDigitText = String(entry.idDigit ?? base?.idDigit ?? "").trim();
    const idDigit = idDigitText || null;
    const rawEligibleDivisions = entry.eligibleDivisions ?? base?.eligibleDivisions ?? [];

    if (!id) throw new TypeError(`Catalog row ${index + 1} requires an event id.`);
    if (ids.has(id)) throw new RangeError(`Catalog event id "${id}" occurs more than once.`);
    ids.add(id);
    if (!name) throw new TypeError(`Catalog event "${id}" requires a name.`);
    if (name.length > 120) throw new TypeError(`Catalog event "${id}" name is too long.`);
    if (!GROUP_VALUES.has(group)) {
      throw new RangeError(`Catalog event "${id}" has unsupported round "${group}".`);
    }
    if (!DIVISION_VALUES.has(division)) {
      throw new RangeError(`Catalog event "${id}" has unsupported division "${division}".`);
    }
    if (code !== null && !/^\d{3}$/.test(code)) {
      throw new TypeError(`Catalog code for "${id}" must be blank or exactly three digits.`);
    }
    if (typeof producesScantron !== "boolean") {
      throw new TypeError(`Catalog event "${id}" producesScantron must be true or false.`);
    }
    if (idDigit !== null && !/^\d$/.test(idDigit)) {
      throw new TypeError(`Catalog event "${id}" ID digit must be blank or one digit.`);
    }
    if (!Array.isArray(rawEligibleDivisions)) {
      throw new TypeError(`Catalog event "${id}" eligibleDivisions must be an array.`);
    }
    const eligibleDivisions = [
      ...new Set(
        rawEligibleDivisions.map((value) => String(value ?? "").trim().toLowerCase()),
      ),
    ].filter(Boolean);
    const unsupportedEligibility = eligibleDivisions.find(
      (eligibleDivision) => !DIVISION_VALUES.has(eligibleDivision),
    );
    if (unsupportedEligibility) {
      throw new RangeError(
        `Catalog event "${id}" has unsupported eligible division "${unsupportedEligibility}".`,
      );
    }
    if (active && code !== null) {
      const existing = codeOwners.get(code);
      if (existing) {
        throw new RangeError(`Catalog code ${code} is assigned to both "${existing}" and "${id}".`);
      }
      codeOwners.set(code, id);
    }

    return freezeTest({
      ...base,
      ...entry,
      id,
      name,
      group,
      division,
      code,
      active,
      eventRole,
      producesScantron,
      idDigit,
      eligibleDivisions,
      status: code === null ? "pending" : "operational",
      blocking: code === null,
      aliases: entry.aliases ?? base?.aliases ?? [],
      note:
        entry.note ??
        base?.note ??
        (code === null
          ? "This user-configured event needs a reviewed three-digit scorer code."
          : "User-configured event reviewed for this session."),
    });
  });

  return Object.freeze(derived);
}

export function normalizeTestReference(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

const referenceIndexCache = new WeakMap();

function referenceIndexFor(catalog) {
  if (!Array.isArray(catalog)) throw new TypeError("catalog must be an array");
  const cached = referenceIndexCache.get(catalog);
  if (cached) return cached;

  const index = new Map();
  for (const test of catalog) {
    if (test.active === false) continue;
    const references = [test.id, test.code, test.name, ...(test.aliases ?? [])].filter(Boolean);
    for (const reference of references) {
      const key = normalizeTestReference(reference);
      const matches = index.get(key) ?? [];
      if (!matches.includes(test)) matches.push(test);
      index.set(key, matches);
    }
  }
  referenceIndexCache.set(catalog, index);
  return index;
}

function overrideEntries(overrides) {
  if (overrides instanceof Map) return [...overrides.entries()];
  if (Array.isArray(overrides)) {
    return overrides.map((entry) => {
      if (Array.isArray(entry) && entry.length === 2) return entry;
      if (entry && typeof entry === "object" && "id" in entry && "code" in entry) {
        return [entry.id, entry.code];
      }
      throw new TypeError("Array catalog overrides must be [id, code] pairs or {id, code} objects.");
    });
  }
  if (overrides && typeof overrides === "object") return Object.entries(overrides);
  throw new TypeError("catalog overrides must be an object, Map, or array");
}

/**
 * Create a new immutable catalog with reviewed code overrides.  The base
 * catalog is never mutated.  Overrides must be unique three-digit codes.
 */
export function catalogWithCodeOverrides(overrides = {}, baseCatalog = TEST_CATALOG) {
  if (!Array.isArray(baseCatalog)) throw new TypeError("baseCatalog must be an array");
  const overrideMap = new Map();
  const knownIds = new Set(baseCatalog.map((test) => test.id));

  for (const [rawId, rawCode] of overrideEntries(overrides)) {
    const id = String(rawId ?? "").trim();
    const code = String(rawCode ?? "").trim();
    if (!knownIds.has(id)) throw new RangeError(`Unknown catalog test id "${id}".`);
    if (!/^\d{3}$/.test(code)) {
      throw new TypeError(`Override for "${id}" must be exactly three digits.`);
    }
    overrideMap.set(id, code);
  }

  const derived = baseCatalog.map((test) => {
    if (!overrideMap.has(test.id)) return test;
    return freezeTest({
      ...test,
      code: overrideMap.get(test.id),
      status: "operational",
      blocking: false,
      note:
        test.status === "pending"
          ? "Resolved by a reviewed code override; retain the approval record with the convention packet."
          : test.note,
    });
  });

  const codeOwners = new Map();
  for (const test of derived) {
    if (test.active === false) continue;
    if (test.code === null) continue;
    if (!/^\d{3}$/.test(test.code)) {
      throw new TypeError(`Catalog code for "${test.id}" must be exactly three digits.`);
    }
    const existing = codeOwners.get(test.code);
    if (existing) {
      throw new RangeError(`Catalog code ${test.code} is assigned to both "${existing}" and "${test.id}".`);
    }
    codeOwners.set(test.code, test.id);
  }

  return Object.freeze(derived);
}

export function testsForGroup(group, catalog = TEST_CATALOG) {
  if (!GROUP_VALUES.has(group)) return [];
  return catalog.filter((test) => test.active !== false && test.group === group);
}

export function testById(id, catalog = TEST_CATALOG) {
  return catalog.find((test) => test.id === id) ?? null;
}

/**
 * Resolve a user-facing code/name/id without guessing when a reference is
 * ambiguous.  The returned status is one of: empty, unknown, wrong_group,
 * ambiguous, pending, or resolved.
 */
export function resolveTestReference(value, expectedGroup = null, catalog = TEST_CATALOG) {
  const raw = String(value ?? "").trim();
  if (!raw) return { status: "empty", raw, matches: [] };

  const referenceIndex = referenceIndexFor(catalog);
  const allMatches = [...(referenceIndex.get(normalizeTestReference(raw)) ?? [])];
  if (allMatches.length === 0) return { status: "unknown", raw, matches: [] };

  let matches = allMatches;
  if (expectedGroup) {
    matches = allMatches.filter((test) => test.group === expectedGroup);
    if (matches.length === 0) {
      return { status: "wrong_group", raw, matches: allMatches };
    }
  }

  if (matches.length > 1) return { status: "ambiguous", raw, matches };

  const test = matches[0];
  if (test.status === "pending" || test.code === null || test.blocking) {
    return { status: "pending", raw, test, matches };
  }
  return { status: "resolved", raw, test, matches };
}

const DIVISION_ALIASES = new Map([
  ["theta", "theta"],
  ["theta division", "theta"],
  ["algebra 1", "theta"],
  ["algebra i", "theta"],
  ["geometry", "theta"],
  ["algebra 2", "theta"],
  ["algebra ii", "theta"],
  ["alpha", "alpha"],
  ["alpha division", "alpha"],
  ["precalculus", "alpha"],
  ["pre calculus", "alpha"],
  ["mu", "mu"],
  ["mu division", "mu"],
  ["calculus", "mu"],
  ["statistics", "statistics"],
  ["stats", "statistics"],
  ["statistics division", "statistics"],
  ["chi", "chi"],
  ["chi division", "chi"],
]);

export function normalizeDivision(value) {
  return DIVISION_ALIASES.get(normalizeTestReference(value)) ?? null;
}

export function inferIndividualTestFromDivision(value, catalog = TEST_CATALOG) {
  const division = normalizeDivision(value);
  if (!division) return null;
  const matches = catalog.filter(
    (test) =>
      test.active !== false &&
      test.group === TEST_GROUPS.INDIVIDUAL &&
      test.division === division,
  );
  return matches.length === 1 ? matches[0] : null;
}

const REGIONAL_DIVISION_ALIASES = new Map([
  ["algebra 1", "algebra_1"],
  ["algebra i", "algebra_1"],
  ["alg 1", "algebra_1"],
  ["alg i", "algebra_1"],
  ["algebra 1 division", "algebra_1"],
  ["geometry", "geometry"],
  ["geo", "geometry"],
  ["geometry division", "geometry"],
  ["algebra 2", "algebra_2"],
  ["algebra ii", "algebra_2"],
  ["alg 2", "algebra_2"],
  ["alg ii", "algebra_2"],
  ["algebra 2 division", "algebra_2"],
  ["precalculus", "precalculus"],
  ["pre calculus", "precalculus"],
  ["pre calc", "precalculus"],
  ["precalc", "precalculus"],
  ["precalculus division", "precalculus"],
  ["calculus", "calculus"],
  ["calc", "calculus"],
  ["calculus division", "calculus"],
  ["statistics", "statistics"],
  ["stats", "statistics"],
  ["statistics division", "statistics"],
]);

export function normalizeRegionalDivision(value) {
  const normalizedReference = normalizeTestReference(value).replace(/_/g, " ");
  return REGIONAL_DIVISION_ALIASES.get(normalizedReference) ?? null;
}

function profileId(profile) {
  if (typeof profile === "string") return profile;
  return profile?.id ?? DEFAULT_PROFILE_ID;
}

export function normalizeDivisionForProfile(value, profile = CONVENTION_PROFILES.state) {
  return profileId(profile) === "regional"
    ? normalizeRegionalDivision(value)
    : normalizeDivision(value);
}

/**
 * Return the ID digit for a profile division. State Theta legitimately maps
 * to either 2 (Geometry) or 3 (Algebra II), so callers may supply the current
 * digit to preserve it. Without that evidence the helper returns null rather
 * than inventing one. Regional divisions always have a single exact digit.
 */
export function divisionDigitForProfile(
  value,
  profile = CONVENTION_PROFILES.state,
  currentDigit = null,
) {
  const id = profileId(profile);
  const division = normalizeDivisionForProfile(value, profile);
  if (!division) return null;
  if (id === "regional") return REGIONAL_DIVISION_DIGITS[division] ?? null;
  if (id !== "state") return null;
  const digits = STATE_ID_DIGITS_BY_DIVISION[division] ?? [];
  const current = String(currentDigit ?? "").trim();
  if (current && digits.includes(current)) return current;
  return digits.length === 1 ? digits[0] : null;
}

export function inferIndividualTestForProfile(
  value,
  catalog = TEST_CATALOG,
  profile = CONVENTION_PROFILES.state,
) {
  const division = normalizeDivisionForProfile(value, profile);
  if (!division) return null;
  const matches = catalog.filter(
    (test) =>
      test.active !== false &&
      test.group === TEST_GROUPS.INDIVIDUAL &&
      test.division === division,
  );
  return matches.length === 1 ? matches[0] : null;
}

export const REGIONAL_ELIGIBILITY_BY_BASIS = Object.freeze({
  algebra_1: Object.freeze([
    "algebra_1",
    "geometry",
    "algebra_2",
    "precalculus",
    "calculus",
    "statistics",
  ]),
  geometry_algebra_2: Object.freeze([
    "geometry",
    "algebra_2",
    "precalculus",
    "calculus",
    "statistics",
  ]),
  precalculus: Object.freeze(["precalculus", "calculus", "statistics"]),
  calculus: Object.freeze(["calculus", "statistics"]),
  statistics_special: Object.freeze([]),
});

const REGIONAL_ELIGIBILITY_BASIS_ALIASES = new Map([
  ["algebra 1", "algebra_1"],
  ["algebra i", "algebra_1"],
  ["algebra_1", "algebra_1"],
  ["geometry", "geometry_algebra_2"],
  ["algebra 2", "geometry_algebra_2"],
  ["algebra ii", "geometry_algebra_2"],
  ["geometry algebra 2", "geometry_algebra_2"],
  ["geometry algebra ii", "geometry_algebra_2"],
  ["geometry and or algebra 2", "geometry_algebra_2"],
  ["geometry_algebra_2", "geometry_algebra_2"],
  ["precalculus", "precalculus"],
  ["pre calculus", "precalculus"],
  ["precalc", "precalculus"],
  ["calculus", "calculus"],
  ["calc", "calculus"],
  ["statistics", "statistics_special"],
  ["stats", "statistics_special"],
  ["statistics special", "statistics_special"],
  ["statistics_special", "statistics_special"],
]);

function normalizeRegionalEligibilityBasis(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  const normalizedReference = normalizeTestReference(raw);
  return (
    REGIONAL_ELIGIBILITY_BASIS_ALIASES.get(raw) ??
    REGIONAL_ELIGIBILITY_BASIS_ALIASES.get(normalizedReference) ??
    null
  );
}

export function eligibleRegionalDivisionsForBasis(basis, separateBase = null) {
  const normalized = normalizeRegionalEligibilityBasis(basis);
  if (!normalized) return Object.freeze([]);
  if (normalized === "statistics_special") {
    const separate = normalizeRegionalEligibilityBasis(separateBase);
    if (!separate || separate === "statistics_special") return Object.freeze([]);
    return REGIONAL_ELIGIBILITY_BY_BASIS[separate] ?? Object.freeze([]);
  }
  return REGIONAL_ELIGIBILITY_BY_BASIS[normalized] ?? Object.freeze([]);
}

export function isRegionalDivisionEligible(division, basis, separateBase = null) {
  const normalizedDivision = normalizeRegionalDivision(division);
  if (!normalizedDivision) return false;
  return eligibleRegionalDivisionsForBasis(basis, separateBase).includes(normalizedDivision);
}
