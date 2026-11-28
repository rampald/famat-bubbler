import test from "node:test";
import assert from "node:assert/strict";
import { parseRegistrationInput } from "../src/parser.js";
import { combineImportedSources } from "../src/batch.js";
import { CONVENTION_PROFILES } from "../src/catalog.js";
import { generateScantronPdf, describeCutText } from "../src/pdf.js";
import { PRESETS, parseQuickRoster, buildRows, mergeRoster, regionalSheets } from "../preview/src/presets.js";

// Made-up students in the famat.org roster layout, split across two files.
const HEAD = "Roster: Sample High School #9999\nStudent Division Team 1 ID Team 2 ID No Team ID\n";
const FILE_A = HEAD + "Dunn, Dee Calculus 9999 004 51 9999 004 52 9999 004 50\nCole, Cam Precalculus 9999 003 41 9999 003 42 9999 003 40";
const FILE_B = HEAD + "Dunn, Dee Statistics 9999 004 61 9999 004 62 9999 004 60\nEzra, Eve Statistics 9999 005 61 9999 005 62 9999 005 60";

function importBoth(scheme) {
  const profile = CONVENTION_PROFILES[scheme];
  const sources = [FILE_A, FILE_B].map((text, index) => ({
    filename: `roster-${index + 1}.txt`,
    parsed: parseRegistrationInput(text, { format: "roster", catalog: profile.catalog, divisionScheme: scheme, mergeStudents: false }),
  }));
  return combineImportedSources(sources, { catalog: profile.catalog, divisionScheme: scheme, assignTests: true });
}

test("builder: one student's lines merge across two roster files (State)", () => {
  const out = importBoth("state");
  assert.equal(out.records.length, 3);
  const dee = out.records.find((r) => r.studentName === "Dunn, Dee");
  assert.equal(dee.stateId, "999900460", "Statistics students default to Statistics with the Stats ID");
  assert.deepEqual(dee.registeredIds.sort(), ["999900450", "999900460"]);
  assert.equal(dee.individualTest, "statistics-individual");
  const cam = out.records.find((r) => r.studentName === "Cole, Cam");
  assert.ok(cam.round1Test && cam.round2Test, "State topic rounds are filled in");
});

test("builder: Regional second Individual comes only from a registered division", () => {
  const out = importBoth("regional");
  const dee = out.records.find((r) => r.studentName === "Dunn, Dee");
  assert.deepEqual(dee.tests, ["regional-statistics-individual", "regional-calculus-individual"]);
  const eve = out.records.find((r) => r.studentName === "Ezra, Eve");
  assert.equal(eve.tests, undefined, "one registration, one Individual");
});

test("a paste with several roster headers keeps each row's own school", () => {
  const text = HEAD + "Cole, Cam Precalculus 9999 003 41 9999 003 42 9999 003 40\n"
    + "Roster: Other Prep #8888\nStudent Division Team 1 ID Team 2 ID No Team ID\n"
    + "Gale, Gus Geometry 8888 001 21 8888 001 22 8888 001 20";
  const parsed = parseRegistrationInput(text, { format: "roster" });
  assert.deepEqual(parsed.errors, []);
  assert.deepEqual(parsed.records.map((r) => [r.schoolName, r.schoolCode]), [["Sample High School", "9999"], ["Other Prep", "8888"]]);
  assert.ok(parsed.warnings.some((w) => w.code === "SEVERAL_ROSTER_SCHOOLS"));
});

test("a name with no ID is skipped, not glued onto the next student", () => {
  const parsed = parseRegistrationInput(HEAD + "Orphan, Olive\nCole, Cam Precalculus 9999 003 41 9999 003 42 9999 003 40", { format: "roster" });
  assert.deepEqual(parsed.records.map((r) => r.studentName), ["Cole, Cam"]);
  assert.ok(parsed.warnings.some((w) => w.code === "NAME_WITHOUT_ID_SKIPPED"));
  const wrapped = parseRegistrationInput(HEAD + "de la Cruz,\nMateo Calculus 9999 006 51 9999 006 52 9999 006 50", { format: "roster" });
  assert.deepEqual(wrapped.records.map((r) => r.studentName), ["de la Cruz, Mateo"], "a name wrapped after its comma still joins");
});

test("quick print: re-reading the roster keeps the second sheet's choices, and its team digit prints", () => {
  const roster = HEAD + FILE_A.split("\n").slice(2).join("\n") + "\n" + FILE_B.split("\n").slice(2).join("\n");
  const p = PRESETS["regional-invitational"];
  const rows = buildRows(p, parseQuickRoster(roster, { teamDigit: p.teamDigit }).students);
  const dee = rows.find((r) => r.name === "Dunn, Dee");
  assert.equal(regionalSheets(dee)[1].id[8], "0", "No Team unless the sponsor picks one");
  dee.secondTeam = "2";
  dee.opens = ["a"];
  assert.equal(regionalSheets(dee)[1].id[8], "2");
  const { students } = mergeRoster(rows, parseQuickRoster(roster, { teamDigit: p.teamDigit }).students);
  const again = students.find((s) => s.name === "Dunn, Dee");
  assert.equal(again.secondTeam, "2");
  assert.deepEqual(again.opens, ["a"]);
});

test("text too long to fit is cut at 7 point and named, instead of stopping the PDF", async () => {
  class TinyJsPDF {
    constructor() { this.log = []; }
    setFont() {}
    addImage() {}
    circle() {}
    setFontSize(size) { this.log.push(["fontSize", size]); }
    getTextWidth(value) { return String(value).length * 40; }
    text(value) { this.log.push(["text", value]); }
  }
  const doc = await generateScantronPdf({
    jobs: [{ studentName: "Rivera, Alexandra Catherine", stateId: "123401240", schoolName: "Example High School", testName: "Theta Individual", testCode: "231" }],
    templateImage: { decode: async () => {} },
    jsPDFCtor: TinyJsPDF,
  });
  assert.ok(doc.famatCutText.length > 0);
  assert.ok(doc.log.some(([op, value]) => op === "text" && String(value).endsWith("…")));
  const note = describeCutText(doc.famatCutText);
  assert.match(note, /^Too long to fit, so cut short on the sheet: /);
  assert.equal(describeCutText([]), "");
});
