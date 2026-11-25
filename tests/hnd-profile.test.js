import test from "node:test";
import assert from "node:assert/strict";

import {
  CONVENTION_PROFILES,
  HND_TEST_CATALOG,
  catalogFromEditableEntries,
  normalizeDivisionForProfile,
  resolveTestReference,
} from "../src/catalog.js";
import { evaluateDivisionEligibility } from "../src/eligibility.js";
import { buildPacket } from "../src/model.js";
import { normalizePageJob } from "../src/pdf.js";

const profile = CONVENTION_PROFILES.hnd;

function packetFor(records, sortBy = "student") {
  return buildPacket({ schoolName: "Sample Academy", records, profile, sortBy });
}

test("Hiller / Nunn / Dostal profile lists its four tests in that order with blank codes", () => {
  assert.equal(profile.label, "Hiller / Nunn / Dostal");
  assert.deepEqual(
    HND_TEST_CATALOG.map((entry) => entry.name),
    ["Hiller", "Nunn", "Dostal - Precalculus", "Dostal - Calculus"],
  );
  for (const entry of HND_TEST_CATALOG) {
    assert.equal(entry.code, null);
    assert.equal(entry.blankCode, true);
    assert.equal(entry.status, "operational");
    assert.equal(resolveTestReference(entry.name, null, HND_TEST_CATALOG).status, "resolved");
  }
});

test("the ID's 8th digit picks the Hiller / Nunn / Dostal test", () => {
  const expected = {
    "123400110": "Hiller",
    "123400220": "Nunn",
    "123400330": "Nunn",
    "123400440": "Dostal - Precalculus",
    "123400550": "Dostal - Calculus",
  };
  const records = Object.keys(expected).map((stateId, index) => ({ studentName: `Student ${index}`, stateId }));
  const packet = packetFor(records);
  assert.equal(packet.ok, true, JSON.stringify(packet.errors));
  for (const job of packet.jobs) {
    assert.equal(job.testName, expected[job.stateId]);
    assert.equal(job.testCode, "");
    assert.equal(job.blankTestCode, true);
  }
});

test("Statistics students get Dostal - Calculus only after Precalculus or Calculus", () => {
  const calc = evaluateDivisionEligibility({ profile: "hnd", currentId: "123400660", previousIds: "123400440" });
  assert.equal(calc.defaultDivision, "dostal_calculus");
  assert.deepEqual(calc.issues, []);
  const precalc = evaluateDivisionEligibility({ profile: "hnd", currentId: "123400660", previousIds: "123400330" });
  assert.equal(precalc.defaultDivision, "dostal_precalculus");
  assert.deepEqual(precalc.issues, []);
  const unknown = evaluateDivisionEligibility({ profile: "hnd", currentId: "123400660" });
  assert.equal(unknown.defaultDivision, "dostal_precalculus");
  assert.equal(unknown.issues[0].code, "HND_STATISTICS_CHECK");
  assert.deepEqual(unknown.allowedDivisions, ["dostal_precalculus", "dostal_calculus"]);
});

test("a Statistics student may be switched to the other Dostal test, but not to Hiller", () => {
  const ok = packetFor([{ studentName: "Riley Park", stateId: "123400660", tests: ["hnd-dostal-calculus"] }]);
  assert.equal(ok.ok, true, JSON.stringify(ok.errors));
  assert.equal(ok.jobs[0].testName, "Dostal - Calculus");
  const bad = packetFor([{ studentName: "Riley Park", stateId: "123400660", tests: ["hnd-hiller"] }]);
  assert.equal(bad.ok, false);
});

test("sorting by test keeps Hiller, Nunn, Dostal order", () => {
  const packet = packetFor(
    [
      { studentName: "Ann", stateId: "123400550" },
      { studentName: "Bea", stateId: "123400220" },
      { studentName: "Cal", stateId: "123400110" },
      { studentName: "Dee", stateId: "123400440" },
    ],
    "test",
  );
  assert.deepEqual(
    packet.jobs.map((job) => job.testName),
    ["Hiller", "Nunn", "Dostal - Precalculus", "Dostal - Calculus"],
  );
});

test("blank-code jobs print without a code; other jobs still need three digits", () => {
  const blank = normalizePageJob({
    studentName: "Ann",
    stateId: "123400110",
    schoolName: "Sample Academy",
    testName: "Hiller",
    testCode: "",
    blankTestCode: true,
  });
  assert.equal(blank.testCode, "");
  assert.throws(() =>
    normalizePageJob({ studentName: "Ann", stateId: "123400110", schoolName: "Sample Academy", testName: "Hiller", testCode: "" }),
  );
});

test("an organizer code entered in the catalog editor prints instead of the blank", () => {
  const entries = HND_TEST_CATALOG.map((entry) => ({ ...entry, code: entry.id === "hnd-hiller" ? "701" : "" }));
  const catalog = catalogFromEditableEntries(entries, { baseCatalog: HND_TEST_CATALOG });
  assert.equal(catalog[0].code, "701");
  assert.equal(catalog[1].blankCode, true);
  assert.equal(catalog[1].status, "operational");
  const packet = buildPacket({
    schoolName: "Sample Academy",
    records: [{ studentName: "Ann", stateId: "123400110" }],
    profile,
    catalog,
  });
  assert.equal(packet.jobs[0].testCode, "701");
  assert.equal(packet.jobs[0].blankTestCode, false);
});

test("Hiller / Nunn / Dostal division names normalize", () => {
  assert.equal(normalizeDivisionForProfile("Dostal - Precalculus", profile), "dostal_precalculus");
  assert.equal(normalizeDivisionForProfile("hiller", profile), "hiller");
});
