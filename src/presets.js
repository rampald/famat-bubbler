/**
 * One-step competition presets for Quick print (Bubbler 2.4.0).
 *
 * A preset knows which test each division takes, so the user only pastes a
 * roster and prints. Rules for Hiller / Nunn / Dostal come from the FAMAT
 * Sponsors' Guide (Hiller/Nunn/Dostal pages) and Rob Snow's Nov 14, 2026 post:
 *   Hiller = Algebra I, Nunn = Geometry and Algebra II,
 *   Dostal = everyone above Algebra II, mailed in two piles (Precalculus, Calculus).
 *   Use No Team IDs (team digit 0). The guide gives no test code: leave it blank.
 * Derek (Nov 25, 2026): leave the Test Code blank; a Statistics student goes in
 * the Calculus pile if they have taken Precalculus before, otherwise Precalculus;
 * a student enrolled in Calculus takes the Calculus pile.
 */

import { STATE_TEST_CATALOG } from "./catalog.js";
import { evaluateDivisionEligibility, testAvailability, idForTest } from "./eligibility.js";
import { defaultIndividualForEligibility } from "./model.js";

export const DIVISION_BY_DIGIT = Object.freeze({
  1: "Algebra I",
  2: "Geometry",
  3: "Algebra II",
  4: "Precalculus",
  5: "Calculus",
  6: "Statistics",
  9: "Chi",
});

export const NDH_PILES = Object.freeze({
  HILLER: "Hiller",
  NUNN: "Nunn",
  DOSTAL_PRECALC: "Dostal - Precalculus",
  DOSTAL_CALC: "Dostal - Calculus",
});

/** Pile order used to sort the printed packet, so sheets come out grouped. */
export const NDH_PILE_ORDER = Object.freeze([
  NDH_PILES.HILLER,
  NDH_PILES.NUNN,
  NDH_PILES.DOSTAL_PRECALC,
  NDH_PILES.DOSTAL_CALC,
]);

/**
 * Decide the Hiller/Nunn/Dostal test for one student.
 * @param {string} id nine-digit FAMAT ID (current year)
 * @param {string[]} previousDigits 8th digits of last year's IDs, if known
 * @returns {{pile: string|null, choices: string[], allowedPiles: string[], reason: string, eligible: boolean}}
 * allowedPiles lists the only tests this student may be moved to (bulk "Set test"),
 * so an Algebra I student can never be put in a Dostal pile.
 */
export function assignHillerNunnDostal(id, previousDigits = []) {
  const result = assignHndBase(id, previousDigits);
  const allowedPiles = !result.eligible ? []
    : result.choices.length ? [...result.choices]
    : result.pile ? [result.pile] : [];
  return { ...result, allowedPiles };
}

function assignHndBase(id, previousDigits) {
  const digit = String(id ?? "")[7];
  const division = DIVISION_BY_DIGIT[digit] ?? null;
  const base = { division, choices: [], eligible: true };
  switch (digit) {
    case "1":
      return { ...base, pile: NDH_PILES.HILLER, reason: "Algebra I takes Hiller" };
    case "2":
    case "3":
      return { ...base, pile: NDH_PILES.NUNN, reason: `${division} takes Nunn` };
    case "4":
      return { ...base, pile: NDH_PILES.DOSTAL_PRECALC, reason: "Precalculus takes Dostal" };
    case "5":
      return { ...base, pile: NDH_PILES.DOSTAL_CALC, reason: "Calculus takes Dostal" };
    case "6": {
      const choices = [NDH_PILES.DOSTAL_PRECALC, NDH_PILES.DOSTAL_CALC];
      const prev = previousDigits.map(String);
      if (prev.some((d) => d === "4" || d === "5")) {
        return { ...base, choices, pile: NDH_PILES.DOSTAL_CALC,
          reason: "Statistics, took Precalculus before (last year's ID)" };
      }
      if (prev.length > 0 && prev.every((d) => d === "1" || d === "2" || d === "3")) {
        return { ...base, choices, pile: NDH_PILES.DOSTAL_PRECALC,
          reason: "Statistics, no Precalculus last year (last year's ID)" };
      }
      return { ...base, choices, pile: null,
        reason: "Statistics: choose Calculus if they took Precalculus before, otherwise Precalculus" };
    }
    default:
      return { ...base, eligible: false, pile: null,
        reason: division ? `${division} students do not take these tests` : "ID's 8th digit is not a FAMAT division" };
  }
}

/* ---------------------------------------------------------------------------
 * State Convention. The Individual comes from the ID's division through the
 * existing State eligibility engine (Sponsors' Guide chart and previous-year
 * rules). Topic rounds are chosen once per division in Quick print; the
 * default prints a name-and-ID sheet with a blank test code for each round.
 * ------------------------------------------------------------------------- */

const STATE_ORDER = ["theta", "alpha", "mu", "statistics", "chi"];
export const STATE_ROUNDS = Object.freeze([
  Object.freeze({ group: "round_1", label: "Round 1 topic test" }),
  Object.freeze({ group: "round_2", label: "Round 2 topic test" }),
]);
/** Topic choice values besides a test id. */
export const TOPIC_BLANK = "blank";
export const TOPIC_NONE = "none";

const stateIndividual = (division) =>
  STATE_TEST_CATALOG.find((t) => t.group === "individual" && t.division === division && t.active !== false);
export const STATE_TEST_BY_ID = new Map(STATE_TEST_CATALOG.map((t) => [t.id, t]));

export function assignState(id, previousDigits = []) {
  const digit = String(id ?? "")[7];
  const previousIds = [...new Set(previousDigits.map(String))].map((d) => `${id.slice(0, 7)}${d}0`);
  const ev = evaluateDivisionEligibility({ profile: "state", currentId: id, previousIds });
  const individual = defaultIndividualForEligibility(ev, STATE_TEST_CATALOG);
  const allowed = ev.allowedDivisions.map(stateIndividual).filter(Boolean);
  const division = DIVISION_BY_DIGIT[digit] ?? null;
  const topicsFor = (ind) => {
    const e = ind ? evaluateDivisionEligibility({ profile: "state", currentId: idForTest(id, ind, "state"), previousIds }) : ev;
    return Object.fromEntries(STATE_ROUNDS.map(({ group }) => [group,
      STATE_TEST_CATALOG.filter((t) => t.group === group && t.active !== false && testAvailability(t, e).allowed).map((t) => t.id)]));
  };
  if (allowed.length === 0) {
    return { division, eligible: false, pile: null, choices: [], reason: ev.issues.map((i) => i.message).join(" ") || "No State Individual for this ID" };
  }
  return {
    division,
    eligible: true,
    pile: individual?.name ?? null,
    choices: individual ? [] : allowed.map((t) => t.name),
    allowedPiles: allowed.map((t) => t.name),
    topicsFor,
    reason: individual
      ? `${division} takes ${individual.name}`
      : `Choose the Individual: ${ev.issues.map((i) => i.message).join(" ")}`,
  };
}

/** Sheets for one State row: its Individual, then one sheet per topic round. */
export function stateSheets(row, topicChoice = {}) {
  const ind = STATE_TEST_CATALOG.find((t) => t.group === "individual" && t.name === row.pile);
  if (!ind) return [];
  const sheets = [{ kind: 0, testName: ind.name, testCode: ind.code, id: idForTest(row.id, ind, "state") }];
  const topics = row.topicsFor ? row.topicsFor(ind) : {};
  STATE_ROUNDS.forEach(({ group, label }, i) => {
    const choice = topicChoice[group]?.[ind.division] ?? TOPIC_BLANK;
    if (choice === TOPIC_NONE) return;
    const test = STATE_TEST_BY_ID.get(choice);
    if (test && (topics[group] ?? []).includes(test.id)) {
      sheets.push({ kind: i + 1, testName: test.name, testCode: test.code, id: row.id });
    } else {
      sheets.push({ kind: i + 1, testName: label, testCode: "", id: row.id, blank: true,
        mismatch: Boolean(test) });
    }
  });
  return sheets;
}

export const PRESETS = Object.freeze({
  "state-convention": Object.freeze({
    id: "state-convention",
    label: "State Convention",
    testDate: "2027",
    teamDigit: "0",
    blankTestCode: false,
    pileOrder: Object.freeze(STATE_ORDER.map((d) => stateIndividual(d)?.name).filter(Boolean)),
    filenamePrefix: "State-Convention-Scantrons",
    assign: assignState,
    topicRounds: STATE_ROUNDS,
    sheets: stateSheets,
    lastYearSummary: "Optional: last year's roster (applies the Sponsors' Guide previous-year rules)",
    lastYearHint: "Students may not test down from last year's level. Paste last year's roster and the app matches names to apply that rule.",
    printNote:
      "The packet prints every Individual sheet first (grouped by division), then the Round 1 sheets, then the Round 2 sheets.",
  }),
  "hiller-nunn-dostal": Object.freeze({
    id: "hiller-nunn-dostal",
    label: "Hiller / Nunn / Dostal (December mail-in)",
    testDate: "2026-12-02",
    teamDigit: "0",
    blankTestCode: true,
    pileOrder: NDH_PILE_ORDER,
    filenamePrefix: "Hiller-Nunn-Dostal-Scantrons",
    assign: assignHillerNunnDostal,
    lastYearSummary: "Optional: last year's roster (sets the Dostal pile for Statistics students)",
    lastYearHint: "A Statistics student who took Precalculus before goes in the Dostal Calculus pile; otherwise Dostal Precalculus. Paste last year's roster and the app matches names to decide. Anyone it can't decide is left for you to pick.",
    printNote:
      "Sort the printed sheets into 4 piles (Hiller, Nunn, Dostal Precalculus, Dostal Calculus); the packet is already in that order.",
  }),
});

const ID_TOKEN = /(?<!\d)(\d{4})\s?(\d{3})\s?(\d{2})(?!\d)/g;
const DIVISION_WORDS =
  /\s*[,\t;]?\s*(Algebra\s*(?:I{1,2}|1|2)|Geometry|Pre-?\s?calculus|Calculus|Statistics|Chi)\s*[,\t;]?\s*$/i;

/** Normalize a name for matching across rosters ("Smith, Ana" == "smith ana"). */
export function nameKey(name) {
  return String(name ?? "").toLowerCase().replace(/\([^)]*\)/g, "").replace(/[^a-z]/g, "");
}

/**
 * Read pasted roster text: famat.org roster lines
 * ("Last, First Division 1234 001 21 1234 001 22 1234 001 20"), CSV/TSV rows
 * ("Name,ID[,Previous ID]") or plain "Name  ID". Lines without an ID are skipped.
 * Team variants of the same ID collapse to one student; an ID with a different
 * 8-digit prefix on the same line is treated as a previous-year ID.
 */
export function parseQuickRoster(text, { teamDigit = null } = {}) {
  const students = [];
  let schoolName = null;
  const seen = new Set();
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^Roster:\s*(.+?)\s*#\s*(\d{4})\s*$/i);
    if (header) {
      schoolName ??= header[1];
      continue;
    }
    const tokens = [...line.matchAll(ID_TOKEN)];
    if (tokens.length === 0) continue;
    const ids = tokens.map((m) => m[1] + m[2] + m[3]);
    const current = ids[0];
    const previous = ids.slice(1).filter((x) => x.slice(0, 8) !== current.slice(0, 8));
    let name = line.slice(0, tokens[0].index).replace(DIVISION_WORDS, "");
    name = name.replace(/^["']|["',;\t\s]+$/g, "").replace(/^"|"$/g, "").trim();
    if (!name) continue;
    const id = teamDigit == null ? current : current.slice(0, 8) + teamDigit;
    const key = nameKey(name) + id;
    if (seen.has(key)) continue;
    seen.add(key);
    students.push({ name, id, sourceId: current, previousIds: [...new Set(previous)] });
  }
  return { schoolName, students };
}

/** Map of nameKey -> list of 8th digits, from last year's roster text. */
export function previousDigitsByName(text) {
  const map = new Map();
  for (const s of parseQuickRoster(text).students) {
    const k = nameKey(s.name);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(s.sourceId[7]);
  }
  return map;
}

/**
 * Build rows for the review table.
 * @returns {Array<{name,id,pile,choices,reason,eligible,division}>}
 */
export function buildRows(preset, students, lastYear = new Map()) {
  return students.map((s) => {
    const prevDigits = [
      ...s.previousIds.map((x) => x[7]),
      ...(lastYear.get(nameKey(s.name)) ?? []),
    ];
    return { name: s.name, id: s.id, prevDigits, ...preset.assign(s.id, prevDigits) };
  });
}

/** Page jobs for pdf.js, sorted by pile then name; ineligible rows dropped. */
export function rowsToJobs(preset, rows, schoolName, topicChoice = {}) {
  const order = (p) => {
    const i = preset.pileOrder.indexOf(p);
    return i < 0 ? 99 : i;
  };
  if (preset.sheets) {
    // Multi-sheet presets (State): all Individuals by division, then each round.
    return rows
      .filter((r) => !r.off && r.eligible && r.pile)
      .flatMap((r) => preset.sheets(r, topicChoice).map((s) => ({ r, s })))
      .sort((a, b) => a.s.kind - b.s.kind || order(a.r.pile) - order(b.r.pile) || a.r.name.localeCompare(b.r.name))
      .map(({ r, s }) => ({
        studentName: r.name,
        stateId: s.id,
        schoolName,
        testName: s.testName,
        testCode: s.testCode,
        blankTestCode: s.testCode === "",
      }));
  }
  return rows
    .filter((r) => !r.off && r.eligible && r.pile)
    .slice()
    .sort((a, b) => order(a.pile) - order(b.pile) || a.name.localeCompare(b.name))
    .map((r) => ({
      studentName: r.name,
      stateId: r.id,
      schoolName,
      testName: r.pile,
      testCode: preset.blankTestCode ? "" : r.testCode,
      blankTestCode: preset.blankTestCode,
    }));
}
