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

import { STATE_TEST_CATALOG, REGIONAL_TEST_CATALOG, REGIONAL_DIVISION_BY_ID_DIGIT } from "./catalog.js";
import { evaluateDivisionEligibility, testAvailability, idForTest, sameRoundIndividualPairs } from "./eligibility.js";
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
      // No history that settles it: default to Dostal Calculus (Derek's rule).
      // Not flagged; a sponsor can switch the student with the menu.
      return { ...base, choices, pile: NDH_PILES.DOSTAL_CALC,
        reason: "Statistics: set to Dostal Calculus. Switch to Dostal Precalculus if needed" };
    }
    default:
      return { ...base, eligible: false, pile: null,
        reason: division ? `${division} students do not take these tests` : "ID's 8th digit is not a FAMAT division" };
  }
}

/* ---------------------------------------------------------------------------
 * State Convention. Everything comes from the student's famat.org IDs.
 * The course is the highest course among the IDs, leaving out Statistics
 * (Geometry/Algebra II = Theta, Precalculus = Alpha, Calculus = Mu, middle
 * school = Chi); a student listed only for Statistics is Statistics.
 * The Individual defaults to the course's Individual; the menu offers the
 * others the Sponsors' Guide chart allows (Statistics for anyone in Theta and up).
 * Anyone registered in Statistics starts on the Statistics Individual and the
 * Open statistics topic tests, with their Statistics ID (Derek, Nov 26, 2026).
 * Topic tests: "restricted to the levels indicated on the test. A student may
 * move up, but not down" (2027 letter), judged from the course, not from the
 * Individual picked. Each student has a Round 1 and a Round 2 menu, easiest
 * division first, hardest last, then Open. Round 1 and 2 start on the first
 * test of the student's own division (Open statistics tests for a Statistics-
 * only student); the sponsor changes them in the menu.
 * ------------------------------------------------------------------------- */

const STATE_ORDER = ["chi", "theta", "alpha", "mu", "statistics"];
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

const STATE_DIVISION_BY_DIGIT = Object.freeze({ 9: "chi", 2: "theta", 3: "theta", 4: "alpha", 5: "mu", 6: "statistics" });
const COURSE_RANK = Object.freeze({ 9: 0, 2: 1, 3: 1, 4: 2, 5: 3 });
const TOPIC_SORT = Object.freeze({ chi: 0, theta: 1, alpha: 2, mu: 3, open: 9 });
/** Menu order: easiest division first, hardest last, then Open; by code within a division. */
export const topicSort = (a, b) => (TOPIC_SORT[a.division] ?? 5) - (TOPIC_SORT[b.division] ?? 5) || a.code.localeCompare(b.code);
/** Group label for a topic test in the menu. */
export const topicGroupLabel = (division) => ({ chi: "Chi", theta: "Theta", alpha: "Alpha", mu: "Mu", open: "Open" })[division] ?? division;

/** The course ID among a student's famat.org IDs: highest course, Statistics only if nothing else. */
export function stateCourseId(id, also = []) {
  const ids = [String(id ?? ""), ...also.map(String)].filter((x) => /^\d{9}$/.test(x));
  const courses = ids.filter((x) => COURSE_RANK[x[7]] !== undefined);
  if (!courses.length) return ids[0] ?? String(id ?? "");
  return courses.reduce((best, x) => (COURSE_RANK[x[7]] > COURSE_RANK[best[7]] ? x : best));
}

export function assignState(id, previousDigits = [], also = []) {
  const courseSource = stateCourseId(id, also);
  const courseId = courseSource.slice(0, 8) + String(id)[8];
  const digit = courseId[7];
  const previousIds = [...new Set(previousDigits.map(String))].map((d) => `${courseId.slice(0, 7)}${d}0`);
  const ev = evaluateDivisionEligibility({ profile: "state", currentId: courseId, previousIds });
  const allowed = ev.allowedDivisions.map(stateIndividual).filter(Boolean)
    .sort((a, b) => STATE_ORDER.indexOf(a.division) - STATE_ORDER.indexOf(b.division));
  const division = DIVISION_BY_DIGIT[digit] ?? null;
  // Anyone registered in Statistics starts in Statistics (Derek, Nov 26, 2026),
  // with the Open statistics topic tests; they can switch.
  const statsFirst = [String(id ?? ""), ...also.map(String)].some((x) => x[7] === "6");
  const statistics = stateIndividual("statistics");
  const own = statsFirst && allowed.includes(statistics) ? statistics : stateIndividual(STATE_DIVISION_BY_DIGIT[digit]);
  const individual = own && allowed.includes(own) ? own : defaultIndividualForEligibility(ev, STATE_TEST_CATALOG);
  // Topic tests the course allows (move up, never down), in menu order.
  const topicOptions = Object.fromEntries(STATE_ROUNDS.map(({ group }) => [group,
    STATE_TEST_CATALOG.filter((t) => t.group === group && t.active !== false && testAvailability(t, ev).allowed)
      .sort(topicSort).map((t) => t.id)]));
  const ownTopic = own === statistics || STATE_DIVISION_BY_DIGIT[digit] === "statistics" ? "open" : STATE_DIVISION_BY_DIGIT[digit];
  const topicDefaults = Object.fromEntries(STATE_ROUNDS.map(({ group }) => {
    const opts = topicOptions[group].map((x) => STATE_TEST_BY_ID.get(x));
    const first = opts.find((t) => t.division === ownTopic) ?? opts.find((t) => t.division !== "open") ?? opts[0];
    return [group, first?.id ?? TOPIC_BLANK];
  }));
  if (allowed.length === 0) {
    return { division, eligible: false, pile: null, choices: [], reason: ev.issues.map((i) => i.message).join(" ") || "No State Individual for this ID" };
  }
  return {
    division,
    eligible: true,
    courseId,
    pile: individual?.name ?? null,
    choices: individual ? [] : allowed.map((t) => t.name),
    allowedPiles: allowed.map((t) => t.name),
    topicOptions,
    topicDefaults,
    topicsFor: () => topicOptions,
    reason: individual
      ? `${division}: ${individual.name}. Topic tests: ${digit === "6" ? "any level" : `${STATE_DIVISION_BY_DIGIT[digit] ? topicGroupLabel(STATE_DIVISION_BY_DIGIT[digit]) : "any"} or harder, or Open`}`
      : `Choose the Individual: ${ev.issues.map((i) => i.message).join(" ")}`,
  };
}

/** The topic test chosen for one round of a State row (its own pick, else the default). */
export function stateTopic(row, group) {
  return row.topics?.[group] ?? row.topicDefaults?.[group] ?? TOPIC_BLANK;
}

/** Sheets for one State row: its Individual, then one sheet per topic round. */
export function stateSheets(row) {
  const ind = STATE_TEST_CATALOG.find((t) => t.group === "individual" && t.name === row.pile);
  if (!ind) return [];
  const id = idForTest(row.courseId ?? row.id, ind, "state");
  const sheets = [{ kind: 0, testName: ind.name, testCode: ind.code, id }];
  STATE_ROUNDS.forEach(({ group, label }, i) => {
    const choice = stateTopic(row, group);
    if (choice === TOPIC_NONE) return;
    const test = STATE_TEST_BY_ID.get(choice);
    if (test && (row.topicOptions?.[group] ?? []).includes(test.id)) {
      sheets.push({ kind: i + 1, testName: test.name, testCode: test.code, id });
    } else {
      sheets.push({ kind: i + 1, testName: label, testCode: "", id, blank: true, mismatch: Boolean(test) });
    }
  });
  return sheets;
}

/* ---------------------------------------------------------------------------
 * Regional / Invitational / Statewide (regular season). One Individual sheet per
 * student, picked from the ID's division through the Sponsors' Guide Regional
 * and Statewide chart and the previous-year rules. The sheet's ID uses the
 * test's division digit and keeps the student's team digit (0, 1 or 2).
 * Test codes differ by competition, so they print blank unless the sponsor
 * types the host's code for a test.
 * ------------------------------------------------------------------------- */

const REGIONAL_INDIVIDUALS = REGIONAL_TEST_CATALOG.filter((t) => t.group === "individual" && t.active !== false);
const regionalIndividual = (division) => REGIONAL_INDIVIDUALS.find((t) => t.division === division);
export const REGIONAL_TEST_BY_NAME = new Map(REGIONAL_INDIVIDUALS.map((t) => [t.name, t]));
export const REGIONAL_TEAM_DIGITS = Object.freeze(["0", "1", "2"]);

export function assignRegional(id, previousDigits = [], also = []) {
  const digit = String(id ?? "")[7];
  const division = DIVISION_BY_DIGIT[digit] ?? null;
  if (!REGIONAL_TEAM_DIGITS.includes(String(id ?? "")[8])) {
    return { division, eligible: false, pile: null, choices: [], allowedPiles: [],
      reason: "The last digit (team) must be 0, 1 or 2" };
  }
  const previousIds = [...new Set(previousDigits.map(String))].map((d) => `${id.slice(0, 7)}${d}0`);
  const ev = evaluateDivisionEligibility({ profile: "regional", currentId: id, previousIds });
  const allowed = ev.allowedDivisions.map(regionalIndividual).filter(Boolean);
  // Anyone registered in Statistics starts in Statistics (Derek, Nov 26, 2026); they can switch.
  const statistics = regionalIndividual("statistics");
  const statsFirst = [String(id ?? ""), ...also.map(String)].some((x) => x[7] === "6");
  const individual = statsFirst && statistics && allowed.includes(statistics)
    ? statistics : defaultIndividualForEligibility(ev, REGIONAL_TEST_CATALOG);
  if (allowed.length === 0) {
    return { division, eligible: false, pile: null, choices: [], allowedPiles: [],
      reason: division === "Chi" ? "Chi students have no Regional Individual test"
        : ev.issues.map((i) => i.message).join(" ") || "No Regional Individual for this ID" };
  }
  // The Individuals of every division famat.org registered this student in
  // (a second Individual is offered only among these; Derek, Nov 26, 2026).
  const registeredPiles = [...new Set([String(id ?? ""), ...also.map(String)]
    .map((x) => regionalIndividual(REGIONAL_DIVISION_BY_ID_DIGIT[x[7]]))
    .filter((t) => t && allowed.includes(t)).map((t) => t.name))];
  return {
    division,
    eligible: true,
    pile: individual?.name ?? null,
    registeredPiles,
    choices: individual ? [] : allowed.map((t) => t.name),
    allowedPiles: allowed.map((t) => t.name),
    reason: individual
      ? `${division} takes ${individual.name}`
      : `Choose the Individual: ${ev.issues.map((i) => i.message).join(" ")}`,
  };
}

/** The one sheet for a Regional row: its ID uses the test's division digit. */
export function regionalSheet(row, codes = {}) {
  const test = REGIONAL_TEST_BY_NAME.get(row.pile);
  if (!test) return null;
  const code = String(codes[test.name] ?? "").trim();
  return { testName: test.name, testCode: /^\d{3}$/.test(code) ? code : "", id: idForTest(row.id, test, "regional") };
}

// Sponsors' Guide: two Individuals only when one is Statistics, Precalculus or Calculus.
const UPPER_FOR_TWO = Object.freeze(["statistics", "precalculus", "calculus"]);

/**
 * Regional: the second Individual this row may take, or null. Only a division
 * famat.org registered the student in, other than the first test, and only a
 * pair the Sponsors' Guide allows.
 */
export function regionalSecond(row) {
  const first = REGIONAL_TEST_BY_NAME.get(row.pile);
  if (!first) return null;
  const other = (row.registeredPiles ?? []).map((n) => REGIONAL_TEST_BY_NAME.get(n)).find((t) => t && t !== first);
  if (!other) return null;
  return UPPER_FOR_TWO.includes(first.division) || UPPER_FOR_TWO.includes(other.division) ? other : null;
}

/** Regional: the two Individuals share a scheduled round (a warning, not a block). */
export function regionalSecondClash(row) {
  const first = REGIONAL_TEST_BY_NAME.get(row.pile);
  const second = regionalSecond(row);
  return Boolean(first && second && sameRoundIndividualPairs([first.division, second.division]).length);
}

/**
 * Every Regional sheet for a row: the first Individual, the second one when the
 * student is registered in both divisions (unless the sponsor turned it off),
 * then one sheet per Open test the sponsor gave them. Each Individual uses its
 * division's registered ID; an Open sheet uses the first Individual's ID.
 * `opens` is [{ key, name, code }], typed by the sponsor for this competition.
 */
export function regionalSheets(row, codes = {}, opens = []) {
  const first = regionalSheet(row, codes);
  if (!first) return [];
  const sheets = [{ ...first, kind: "individual" }];
  const second = regionalSecond(row);
  if (second && !row.noSecond) {
    const code = String(codes[second.name] ?? "").trim();
    sheets.push({ kind: "individual", testName: second.name, testCode: /^\d{3}$/.test(code) ? code : "", id: idForTest(row.id, second, "regional") });
  }
  opens.forEach((o, i) => {
    if (!(row.opens ?? []).includes(o.key)) return;
    const code = String(o.code ?? "").trim();
    sheets.push({ kind: "open", openIndex: i, testName: String(o.name ?? "").trim() || `Open test ${i + 1}`,
      testCode: /^\d{3}$/.test(code) ? code : "", id: first.id });
  });
  return sheets;
}

export const PRESETS = Object.freeze({
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
    lastYearHint: "A Statistics student who took Precalculus before goes in the Dostal Calculus pile; otherwise Dostal Precalculus. Paste last year's roster and the app matches names to decide. Anyone it can't decide starts in Dostal Calculus; switch them with the menu if needed.",
    printNote:
      "Sort the printed sheets into 4 piles (Hiller, Nunn, Dostal Precalculus, Dostal Calculus); the packet is already in that order.",
  }),
  "regional-invitational": Object.freeze({
    id: "regional-invitational",
    label: "Regional / Invitational (regular season)",
    testDate: null,
    teamDigit: "0",
    teams: REGIONAL_TEAM_DIGITS,
    blankTestCode: true,
    testCodes: true,
    pileOrder: Object.freeze(REGIONAL_INDIVIDUALS.map((t) => t.name)),
    filenamePrefix: "Regional-Invitational-Scantrons",
    assign: assignRegional,
    sheet: regionalSheet,
    regionalSheets,
    chooseWhat: "the Individual",
    lastYearSummary: "Optional: last year's roster (applies the Sponsors' Guide previous-year rules)",
    lastYearHint: "Students may not test down from last year's level or repeat a one-year division. Paste last year's roster and the app matches names to apply those rules. Works for regionals, invitationals and statewides.",
    printNote:
      "The packet is grouped by test (Algebra I first, Statistics last, then each Open test). Each Individual sheet's ID uses that test's division digit and keeps the student's team digit; an Open sheet uses the ID on the student's first Individual.",
  }),
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
      "The packet prints every Individual sheet first (grouped by division), then the Round 1 sheets, then the Round 2 sheets. Each round is grouped by test, with the no-code sheets last.",
  }),
});

// "1234 001 20" (roster PDF), "1234-001-20" (famat.org Students page) or "123400120".
const ID_TOKEN = /(?<!\d)(\d{4})[\s-]?(\d{3})[\s-]?(\d{2})(?!\d)/g;
const DIVISION_WORDS =
  /\s*[,\t;]?\s*(Algebra\s*(?:I{1,2}|1|2)|Geometry|Pre-?\s?calculus|Calculus|Statistics|Chi)\s*[,\t;]?\s*$/i;

/** Which division counts as higher when one student is listed for two:
 * Calculus over Statistics, Algebra II over Geometry, Statistics over Algebra II. */
const DIVISION_RANK = Object.freeze({ 9: 0, 1: 1, 2: 2, 3: 3, 6: 3.5, 4: 4, 5: 5 });
export const divisionRank = (digit) => DIVISION_RANK[String(digit)] ?? -1;

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
 * famat.org lists a student once per division they are enrolled in (Geometry and
 * Algebra II, or Calculus and Statistics). Lines with the same name and the same
 * school + student number (first 7 digits) are one student: the row keeps the
 * highest division's ID and remembers the others in `also`.
 */
export function parseQuickRoster(text, { teamDigit = null } = {}) {
  const students = [];
  let schoolName = null;
  let skipped = 0;
  const byStudent = new Map();
  for (const rawLine of String(text ?? "").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const header = line.match(/^Roster:\s*(.+?)\s*#\s*(\d{4})\s*$/i);
    if (header) {
      schoolName ??= header[1];
      continue;
    }
    const tokens = [...line.matchAll(ID_TOKEN)];
    if (tokens.length === 0) { skipped += 1; continue; }
    const ids = tokens.map((m) => m[1] + m[2] + m[3]);
    const current = ids[0];
    const previous = ids.slice(1).filter((x) => x.slice(0, 8) !== current.slice(0, 8));
    let name = line.slice(0, tokens[0].index).replace(DIVISION_WORDS, "");
    name = name.replace(/^["']|["',;\t\s]+$/g, "").replace(/^"|"$/g, "").trim();
    if (!name) { skipped += 1; continue; }
    const id = teamDigit == null ? current : current.slice(0, 8) + teamDigit;
    const key = nameKey(name) + current.slice(0, 7);
    const same = byStudent.get(key);
    if (same) {
      // Same student on another division line: keep the higher division's ID.
      if (same.sourceId.slice(0, 8) === current.slice(0, 8)) continue;
      const also = [...same.also, same.sourceId];
      if (divisionRank(current[7]) > divisionRank(same.sourceId[7])) {
        Object.assign(same, { id, sourceId: current });
      } else {
        also.splice(also.length - 1, 1, current);
      }
      same.also = [...new Set(also)].filter((x) => x.slice(0, 8) !== same.sourceId.slice(0, 8));
      same.previousIds = [...new Set([...same.previousIds, ...previous])];
      continue;
    }
    const student = { name, id, sourceId: current, srcKey: key, previousIds: [...new Set(previous)], also: [] };
    byStudent.set(key, student);
    students.push(student);
  }
  return { schoolName, students, skipped };
}

/**
 * Last year's roster: nameKey -> one entry per student with that name, each the
 * list of division digits (last year's ID plus any older IDs on the line).
 */
export function previousDigitsByName(text) {
  const map = new Map();
  for (const s of parseQuickRoster(text).students) {
    const k = nameKey(s.name);
    if (!k) continue;
    if (!map.has(k)) map.set(k, []);
    map.get(k).push([s.sourceId[7], ...s.also.map((x) => x[7]), ...s.previousIds.map((x) => x[7])]);
  }
  return map;
}

const NEEDS_ID = "Type a name and 9-digit ID";
const DUP_NOTE = "Another student has the same name, so last year's roster was not used. Check this student";

/**
 * Work out one row from the sponsor's data, keeping their edits.
 * An explicit previous ID on the roster line wins; otherwise last year's roster
 * is matched by name only when the name is unique in both rosters.
 */
export function assignRow(preset, s, lastYear = new Map(), nameCounts = new Map()) {
  const keep = { srcKey: s.srcKey, typed: s.typed, off: s.off, sel: s.sel, also: [...(s.also ?? [])],
    noSecond: s.noSecond, opens: s.opens ? [...s.opens] : undefined,
    topics: s.topics ? { ...s.topics } : undefined };
  const previousIds = [...(s.previousIds ?? [])];
  const plain = { ...keep, name: s.name ?? "", id: s.id ?? "", previousIds, prevDigits: [],
    choices: [], allowedPiles: [], topicsFor: undefined, check: false, dupName: false, manualPile: undefined };
  if (!/^\d{9}$/.test(plain.id)) return { ...plain, eligible: false, pile: null, reason: NEEDS_ID };
  const k = nameKey(plain.name);
  const explicit = previousIds.map((x) => String(x)[7]).filter(Boolean);
  const matches = (!explicit.length && k && lastYear.get(k)) || [];
  const dupName = matches.length > 1 || (matches.length === 1 && (nameCounts.get(k) ?? 1) > 1);
  const prevDigits = explicit.length ? explicit : matches.length === 1 && !dupName ? matches[0] : [];
  const row = { ...plain, prevDigits, ...preset.assign(plain.id, prevDigits, plain.also) };
  // Keep a topic pick only while it is still one of this student's options.
  if (row.topics && row.topicOptions) {
    row.topics = Object.fromEntries(Object.entries(row.topics)
      .filter(([g, v]) => v === TOPIC_BLANK || v === TOPIC_NONE || (row.topicOptions[g] ?? []).includes(v)));
  }
  row.allowedPiles ??= [];
  row.check = Boolean(row.check) || dupName;
  row.dupName = dupName;
  if (dupName) row.reason = `${row.reason}. ${DUP_NOTE}`;
  if (row.also.length) {
    const others = [...new Set(row.also.map((x) => DIVISION_BY_DIGIT[x[7]]).filter(Boolean))];
    if (others.length) row.reason = `${row.reason}. Also on the roster for ${others.join(" and ")}`;
  }
  if (s.manualPile && row.eligible && row.allowedPiles.includes(s.manualPile)) {
    Object.assign(row, { pile: s.manualPile, manualPile: s.manualPile, check: false, reason: "Set by you" });
  }
  return row;
}

/**
 * Build (or rebuild) rows for the review table from students or existing rows.
 * Existing rows keep their edits: name, ID, left out, ticked, piles set by hand.
 */
export function buildRows(preset, students, lastYear = new Map()) {
  const nameCounts = new Map();
  for (const s of students) {
    const k = nameKey(s.name);
    if (k) nameCounts.set(k, (nameCounts.get(k) ?? 0) + 1);
  }
  return students.map((s) => assignRow(preset, s, lastYear, nameCounts));
}

/**
 * Read the roster again without losing edits: students already in the list keep
 * their changes, students typed in by hand stay, lines removed from the roster go.
 * @returns {{students: object[], added: number, kept: number}}
 */
export function mergeRoster(oldRows, students) {
  const old = new Map(oldRows.filter((r) => r.srcKey).map((r) => [r.srcKey, r]));
  let kept = 0;
  const merged = students.map((s) => {
    const o = old.get(s.srcKey);
    if (!o) return s;
    kept += 1;
    return { ...s, name: o.name, id: o.id, previousIds: o.previousIds ?? s.previousIds,
      off: o.off, sel: o.sel, manualPile: o.manualPile, topics: o.topics };
  });
  const typed = oldRows.filter((r) => !r.srcKey && r.typed);
  return { students: [...merged, ...typed], added: students.length - kept, kept };
}

/** Set one test for the ticked rows that may take it; others are left alone. */
export function applyBulkTest(rows, test) {
  let changed = 0, skipped = 0;
  for (const r of rows.filter((x) => x.sel)) {
    if (!r.eligible || !(r.allowedPiles ?? []).includes(test)) { skipped += 1; continue; }
    Object.assign(r, { pile: test, manualPile: test, check: false, reason: "Set by you", off: false });
    changed += 1;
  }
  return { changed, skipped };
}

/** Shift-click: tick or untick every row from `from` to `to`, clamped to the list. */
export function tickRange(rows, from, to, checked) {
  if (rows.length === 0) return 0;
  const clamp = (n) => Math.min(rows.length - 1, Math.max(0, n));
  const end = clamp(to);
  const start = Number.isInteger(from) && from >= 0 && from < rows.length ? from : end;
  const [a, b] = [Math.min(start, end), Math.max(start, end)];
  for (let i = a; i <= b; i += 1) rows[i].sel = checked;
  return b - a + 1;
}

/**
 * State: for each topic round, who gets no test code (blank), who can't take the
 * chosen test (mismatch, also blank) and who gets no sheet (none).
 */
export function stateSheetGaps(rows, topicChoice = {}) {
  const gaps = Object.fromEntries(STATE_ROUNDS.map(({ group }) => [group, { blank: [], mismatch: [], none: [] }]));
  for (const r of rows) {
    if (r.off || !r.eligible || !r.pile) continue;
    const sheets = stateSheets(r, topicChoice);
    if (!sheets.length) continue;
    STATE_ROUNDS.forEach(({ group }, i) => {
      const s = sheets.find((x) => x.kind === i + 1);
      if (!s) gaps[group].none.push(r.name);
      else if (s.mismatch) gaps[group].mismatch.push(r.name);
      else if (s.blank) gaps[group].blank.push(r.name);
    });
  }
  return gaps;
}

/** Page jobs for pdf.js, sorted by pile then name; ineligible rows dropped. */
export function rowsToJobs(preset, rows, schoolName, topicChoice = {}, testCodes = {}, opens = []) {
  const order = (p) => {
    const i = preset.pileOrder.indexOf(p);
    return i < 0 ? 99 : i;
  };
  if (preset.regionalSheets) {
    // Regional: Individuals grouped by test (second Individuals in their test's
    // pile), then each Open test in the order the sponsor added them.
    const rank = (s) => (s.kind === "open" ? 100 + s.openIndex : order(s.testName));
    return rows
      .filter((r) => !r.off && r.eligible && r.pile)
      .flatMap((r) => preset.regionalSheets(r, testCodes, opens).map((s) => ({ r, s })))
      .sort((a, b) => rank(a.s) - rank(b.s) || a.r.name.localeCompare(b.r.name))
      .map(({ r, s }) => ({
        studentName: r.name,
        stateId: s.id,
        schoolName,
        testName: s.testName,
        testCode: s.testCode,
        blankTestCode: s.testCode === "",
      }));
  }
  if (preset.sheets) {
    // Multi-sheet presets (State): all Individuals by division, then each round.
    // Within a round, sheets with a test code come first, grouped by the actual
    // test, then the name-and-ID sheets (blank code) together under the round label.
    const within = (a, b) => (a.s.kind === 0
      ? order(a.r.pile) - order(b.r.pile)
      : (a.s.testCode === "") - (b.s.testCode === "") || a.s.testName.localeCompare(b.s.testName));
    return rows
      .filter((r) => !r.off && r.eligible && r.pile)
      .flatMap((r) => preset.sheets(r, topicChoice).map((s) => ({ r, s })))
      .sort((a, b) => a.s.kind - b.s.kind || within(a, b) || a.r.name.localeCompare(b.r.name))
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
    .map((r) => {
      if (!preset.sheet) return r;
      const s = preset.sheet(r, testCodes);
      return { ...r, id: s.id, pile: s.testName, testCode: s.testCode };
    })
    .map((r) => ({
      studentName: r.name,
      stateId: r.id,
      schoolName,
      testName: r.pile,
      testCode: preset.sheet ? r.testCode : preset.blankTestCode ? "" : r.testCode,
      blankTestCode: preset.sheet ? r.testCode === "" : preset.blankTestCode,
    }));
}
