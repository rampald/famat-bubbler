import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const indexHtml = readFileSync(new URL("../builder.html", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const stylesSource = readFileSync(new URL("../styles.css", import.meta.url), "utf8");

function elementSourceById(source, tagName, id) {
  const match = source.match(
    new RegExp(`<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>[\\s\\S]*?<\\/${tagName}>`, "i"),
  );
  assert.ok(match, `Expected <${tagName}>#${id} to exist`);
  return match[0];
}

function openingTagById(source, tagName, id) {
  const match = source.match(
    new RegExp(`<${tagName}\\b[^>]*\\bid=["']${id}["'][^>]*>`, "i"),
  );
  assert.ok(match, `Expected <${tagName}>#${id} to exist`);
  return match[0];
}

function functionWindow(source, functionName, length = 2_500) {
  const start = source.indexOf(`function ${functionName}(`);
  assert.notEqual(start, -1, `Expected function ${functionName}() to exist`);
  return source.slice(start, start + length);
}

test("header uses the exact current FAMAT logo with responsive intrinsic sizing", () => {
  const logo = openingTagById(indexHtml, "img", "famat-brand-logo");
  assert.match(logo, /\bsrc=["']assets\/famat-gator-orange-blue\.png["']/i);
  assert.match(logo, /\balt=["']FAMAT["']/i);
  assert.match(logo, /\bwidth=["']2020["']/i);
  assert.match(logo, /\bheight=["']778["']/i);

  const logoBytes = readFileSync(
    new URL("../assets/famat-gator-orange-blue.png", import.meta.url),
  );
  assert.equal(
    createHash("sha256").update(logoBytes).digest("hex"),
    "1968c5cfefc7a8204bd11efbf5d033148949a4ee31c31b4c73a539237c3994d5",
  );
  assert.match(stylesSource, /\.brand-logo\s*\{[\s\S]*?max-width:\s*100%/i);
  assert.match(stylesSource, /\.brand-logo\s*\{[\s\S]*?height:\s*auto/i);
});

test("header copy and controls share a centered single-column layout", () => {
  assert.match(stylesSource, /\.header-inner\s*\{[\s\S]*?display:\s*grid/i);
  assert.match(stylesSource, /\.header-inner\s*\{[\s\S]*?justify-items:\s*center/i);
  assert.match(stylesSource, /\.header-inner\s*\{[\s\S]*?text-align:\s*center/i);
  assert.match(stylesSource, /\.brand-block\s*\{[\s\S]*?justify-items:\s*center/i);
  assert.match(stylesSource, /\.header-summary\s*\{[\s\S]*?margin-inline:\s*auto/i);
  assert.doesNotMatch(stylesSource, /\.header-inner\s*\{[^}]*justify-content:\s*space-between/i);
});

test("State interface presents the current packet's Chi digit and Individual code", () => {
  assert.match(indexHtml, /Chi[^.]*State-ID digit 9[^.]*Individual code 291/i);
  assert.match(indexHtml, /Chi Individual code 291/i);
  assert.match(appSource, /Chi uses State-ID digit 9 and Individual code 291/i);
  assert.match(appSource, /current State packet uses Chi digit 9 and code 291/i);
  assert.doesNotMatch(indexHtml, /Chi Individual[^.]*pending/i);
  assert.doesNotMatch(appSource, /Chi Individual[^.]*pending/i);
});

test("profile selector offers the five explicit workflows in the intended order", () => {
  const profileSelect = elementSourceById(indexHtml, "select", "convention-profile");
  const options = [...profileSelect.matchAll(/<option\b([^>]*)>/gi)].map((match) => ({
    attributes: match[1],
    value: match[1].match(/\bvalue=["']([^"']+)["']/i)?.[1],
  }));

  assert.deepEqual(
    options.map(({ value }) => value),
    ["hnd", "regional", "state", "national", "custom"],
  );
  const stateOption = options.find(({ value }) => value === "state");
  assert.ok(stateOption, "Expected the State profile option");
  assert.match(stateOption.attributes, /\bselected\b/i);

  assert.match(
    indexHtml,
    /<a\b[^>]*\bhref=["']samples\/regional-invitational-template\.csv["'][^>]*\bdownload\b[^>]*>/i,
  );
});

test("National and Custom stay separate from the FAMAT competitions", () => {
  const profileSelect = elementSourceById(indexHtml, "select", "convention-profile");
  const famat = profileSelect.match(/<optgroup label="FAMAT">([\s\S]*?)<\/optgroup>/i)?.[1] ?? "";
  const other = profileSelect.match(/<optgroup label="Other competitions">([\s\S]*?)<\/optgroup>/i)?.[1] ?? "";
  const values = (html) => [...html.matchAll(/value=["']([^"']+)["']/gi)].map((m) => m[1]);
  assert.deepEqual(values(famat), ["hnd", "regional", "state"]);
  assert.deepEqual(values(other), ["national", "custom"]);
  for (const id of ["regional", "state", "national", "custom"]) {
    assert.match(indexHtml, new RegExp(`class="template-link" data-profile="${id}"`));
  }
  assert.match(appSource, /link\.hidden = link\.dataset\.profile !== profile\.id/);
});

test("each student row has one test checklist and a previous-year ID column; course questions stay off", () => {
  assert.ok(openingTagById(indexHtml, "th", "previous-ids-heading"));
  assert.ok(openingTagById(indexHtml, "th", "tests-heading"));
  assert.match(openingTagById(indexHtml, "th", "eligibility-heading"), /\bhidden\b/);
  assert.doesNotMatch(indexHtml, /id=["']additional-event-count["']/);
  assert.doesNotMatch(indexHtml, /data-assignment-field=/);
  assert.ok(openingTagById(indexHtml, "select", "bulk-test"));
  assert.ok(openingTagById(indexHtml, "button", "bulk-add-test"));
  assert.ok(openingTagById(indexHtml, "button", "bulk-remove-test"));

  const picker = functionWindow(appSource, "createTestPicker", 4_000);
  assert.match(picker, /testAvailability\(test, eligibility\)/);
  const option = functionWindow(appSource, "createTestOption", 2_500);
  assert.match(option, /data-test-toggle/);
  assert.match(option, /dataset\.locked = "true"/);
  const courseSwitch = functionWindow(appSource, "usesEligibilityBasis", 300);
  assert.match(courseSwitch, /courseEligibilityQuestions === true/);
  assert.match(stylesSource, /\.test-picker-summary\s*\{/);
});

test("student table exposes accessible bulk-selection controls and the extra column", () => {
  const selectAll = openingTagById(indexHtml, "input", "select-all-rows");
  assert.match(selectAll, /\btype=["']checkbox["']/i);
  assert.match(selectAll, /\baria-label=["']Select all student rows["']/i);

  const countOutput = openingTagById(indexHtml, "output", "selected-row-count");
  assert.match(countOutput, /\baria-live=["']polite["']/i);
  assert.ok(openingTagById(indexHtml, "button", "delete-selected-rows"));
  assert.ok(openingTagById(indexHtml, "button", "clear-all-rows"));

  const emptyRow = indexHtml.match(/<tr\b[^>]*class=["'][^"']*\bempty-row\b[^"']*["'][^>]*>[\s\S]*?<\/tr>/i);
  assert.ok(emptyRow, "Expected the initial empty student row");
  assert.match(emptyRow[0], /<td\b[^>]*\bcolspan=["']9["']/i);
});

test("bulk row actions are stateful, visibly selectable, and confirmation guarded", () => {
  assert.match(appSource, /selectedRowIds:\s*new Set\(\)/);
  assert.match(appSource, /data-select-row-id/);
  assert.match(appSource, /is-selected/);
  const selectionUpdater = functionWindow(appSource, "updateSelectionControls", 4_000);
  assert.match(selectionUpdater, /selected \? ["']Deselect["'] : ["']Select["']/);

  for (const control of ["selectAllRows", "deleteSelectedRows", "clearAllRows"]) {
    assert.match(
      appSource,
      new RegExp(`dom\\.${control}\\.addEventListener\\(["'](?:change|click)["']`),
      `Expected ${control} to have an interaction handler`,
    );
  }

  const deleteAction = functionWindow(appSource, "deleteSelectedRows");
  assert.match(deleteAction, /window\.confirm\s*\(/);
  assert.match(deleteAction, /state\.selectedRowIds/);
  assert.match(deleteAction, /state\.records\.filter\s*\(/);

  const clearAction = functionWindow(appSource, "clearAllRows");
  assert.match(clearAction, /window\.confirm\s*\(/);
  assert.match(clearAction, /state\.records\s*=\s*\[\]/);
  assert.match(clearAction, /state\.selectedRowIds\.clear\s*\(\)/);
});

test("adding a row focuses the student name instead of its new selection checkbox", () => {
  const addAction = functionWindow(appSource, "addStudent", 700);
  assert.match(addAction, /tr:last-child \[data-field=["']studentName["']\]/);
  assert.doesNotMatch(addAction, /tr:last-child input["']/);
});

test("ready-state summaries use singular student wording for one-row packets", () => {
  const renderCounts = functionWindow(appSource, "renderCountsAndGeneration");
  assert.match(renderCounts, /state\.records\.length === 1 \? "student" : "students"/);
  assert.match(renderCounts, /\$\{state\.records\.length\} \$\{studentNoun\}/);
  assert.match(appSource, /state\.records\.length === 1 \? "row" : "rows"/);
});
