import {
  CONVENTION_PROFILES,
  DEFAULT_PROFILE_ID,
  TEST_CATALOG,
  TEST_GROUPS,
  catalogFromEditableEntries,
  getConventionProfile,
  normalizeDivisionForProfile,
  resolveTestReference,
} from "./catalog.js";
import {
  buildPacket,
  defaultIndividualForEligibility,
  eligibilityForRecord,
  importedListingWarnings,
  initialTestReferences,
  validateStateId,
} from "./model.js";
import { mergeParsedSources } from "./batch.js";
import { parseRegistrationInput } from "./parser.js";
import { generateScantronPdf } from "./pdf.js";
import { extractPdfText } from "./pdf-import.js";
import {
  DIVISION_LABELS,
  ID_DIGIT_COURSES,
  isIndividualTest,
  testAvailability,
} from "./eligibility.js";

const dom = Object.freeze({
  appAnnouncer: document.querySelector("#app-announcer"),
  conventionProfile: document.querySelector("#convention-profile"),
  customEventNameField: document.querySelector("#custom-event-name-field"),
  customEventName: document.querySelector("#custom-event-name"),
  customEventNameError: document.querySelector("#custom-event-name-error"),
  tournamentNameLabel: document.querySelector("#tournament-name-label"),
  tournamentNameHelp: document.querySelector("#tournament-name-help"),
  conventionProfileHelp: document.querySelector("#convention-profile-help"),
  profileEyebrow: document.querySelector("#profile-eyebrow"),
  catalogStatusTitle: document.querySelector("#catalog-status-title"),
  catalogStatusCopy: document.querySelector("#catalog-status-copy"),
  schoolName: document.querySelector("#school-name"),
  schoolNameError: document.querySelector("#school-name-error"),
  importFile: document.querySelector("#import-file"),
  importText: document.querySelector("#import-text"),
  importButton: document.querySelector("#import-button"),
  sampleButton: document.querySelector("#sample-button"),
  clearButton: document.querySelector("#clear-button"),
  addStudentButton: document.querySelector("#add-student-button"),
  studentsBody: document.querySelector("#students-body"),
  studentCount: document.querySelector("#student-count"),
  pageCount: document.querySelector("#page-count"),
  errorCount: document.querySelector("#error-count"),
  warningCount: document.querySelector("#warning-count"),
  validationSummary: document.querySelector("#validation-summary"),
  bulkDefaults: document.querySelector("#bulk-defaults"),
  bulkTest: document.querySelector("#bulk-test"),
  bulkAddTest: document.querySelector("#bulk-add-test"),
  bulkRemoveTest: document.querySelector("#bulk-remove-test"),
  bulkTestStatus: document.querySelector("#bulk-test-status"),
  selectAllRows: document.querySelector("#select-all-rows"),
  selectedRowCount: document.querySelector("#selected-row-count"),
  deleteSelectedRows: document.querySelector("#delete-selected-rows"),
  clearAllRows: document.querySelector("#clear-all-rows"),
  packetOrder: document.querySelector("#packet-order"),
  manifestBody: document.querySelector("#manifest-body"),
  generationStatus: document.querySelector("#generation-status"),
  generateButton: document.querySelector("#generate-button"),
  catalogSettings: document.querySelector("#catalog-settings"),
  catalogDialog: document.querySelector("#catalog-dialog"),
  catalogBody: document.querySelector("#catalog-body"),
  catalogForm: document.querySelector("#catalog-form"),
  catalogResetButton: document.querySelector("#catalog-reset-button"),
  catalogSaveButton: document.querySelector("#catalog-save-button"),
  catalogAddEvent: document.querySelector("#catalog-add-event"),
  catalogError: document.querySelector("#catalog-error"),
  catalogDialogTitle: document.querySelector("#catalog-dialog-title"),
  catalogDialogWarningCopy: document.querySelector("#catalog-dialog-warning-copy"),
  catalogEditorHelp: document.querySelector("#catalog-editor-help"),
  formatProfileTitle: document.querySelector("#format-profile-title"),
  schemaRequirementsCopy: document.querySelector("#schema-requirements-copy"),
  acceptedColumnsCopy: document.querySelector("#accepted-columns-copy"),
  importCodeSample: document.querySelector("#import-code-sample"),
  schemaProfileNote: document.querySelector("#schema-profile-note"),
  reviewRequirementsCopy: document.querySelector("#review-requirements-copy"),
  studentsCaption: document.querySelector("#students-caption"),
  studentIdHeading: document.querySelector("#student-id-heading"),
  previousIdsHeading: document.querySelector("#previous-ids-heading"),
  eligibilityHeading: document.querySelector("#eligibility-heading"),
  divisionHeading: document.querySelector("#division-heading"),
  testsHeading: document.querySelector("#tests-heading"),
  footerReviewCopy: document.querySelector("#footer-review-copy"),
  reviewSection: document.querySelector("#review-section"),
  idFormatRule: document.querySelector("#id-format-rule"),
  metadataFormatRule: document.querySelector("#metadata-format-rule"),
  assignmentFormatRule: document.querySelector("#assignment-format-rule"),
});

const FIELD_GROUPS = Object.freeze({
  individualTest: TEST_GROUPS.INDIVIDUAL,
  round1Test: TEST_GROUPS.ROUND_1,
  round2Test: TEST_GROUPS.ROUND_2,
  round3Test: TEST_GROUPS.ROUND_3,
  optional1Test: null,
  optional2Test: null,
  optional3Test: null,
  optional4Test: null,
  optional5Test: null,
  optional6Test: null,
});

const GROUP_LABELS = Object.freeze({
  [TEST_GROUPS.INDIVIDUAL]: "Individual",
  [TEST_GROUPS.ROUND_1]: "Round 1",
  [TEST_GROUPS.ROUND_2]: "Round 2",
  [TEST_GROUPS.ROUND_3]: "Round 3",
});

const state = {
  profileId: DEFAULT_PROFILE_ID,
  records: [],
  sourceErrors: [],
  sourceWarnings: [],
  sourceSchoolCode: null,
  catalogSessions: { regional: null, state: null, national: null, custom: null, hnd: null },
  tournamentNameSessions: { regional: "", custom: "" },
  catalog: TEST_CATALOG,
  selectedRowIds: new Set(),
  openPickerRowIds: new Set(),
  packet: null,
  nextRowId: 1,
  generating: false,
  importing: false,
  catalogRowCounter: 1,
  sessionRevision: 0,
};

function activeProfile() {
  return getConventionProfile(state.profileId) ?? CONVENTION_PROFILES.state;
}

/** Profile sessions (Individual, Round 1, ...): used for group labels and the catalog editor. */
function activeAssignments() {
  return activeProfile().assignments;
}

/** The older course-eligibility column; switched off in every shipped profile. */
function usesEligibilityBasis(profile = activeProfile()) {
  return profile.courseEligibilityQuestions === true && (profile.id === "regional" || profile.id === "state");
}

function usesDivisionField(profile = activeProfile()) {
  return profile.id !== "custom";
}

/** Regional and State read the division from the ID's 8th digit. */
function idDerivesDivision(profile = activeProfile()) {
  return profile.id === "regional" || profile.id === "state" || profile.id === "hnd";
}

function usesPreviousIds(profile = activeProfile()) {
  return idDerivesDivision(profile);
}

function usesConfigurableEventSlots(profile = activeProfile()) {
  return profile.configurableEventSlots === true;
}

function requiresTournamentName(profile = activeProfile()) {
  return profile.requiresTournamentName === true;
}

function studentIdLabel(profile = activeProfile()) {
  if (profile.id === "state") return "State ID";
  if (profile.id === "regional" || profile.id === "hnd") return "FAMAT ID";
  return "Student ID";
}

/** The checked tests for a record, as catalog ids where they resolve. */
function recordTests(record) {
  if (!Array.isArray(record.tests)) {
    record.tests = initialTestReferences(record, { profile: activeProfile(), catalog: state.catalog });
  }
  return record.tests;
}

function plannedPageCount() {
  return state.records.reduce(
    (total, record) => total + new Set(recordTests(record).filter(Boolean)).size,
    0,
  );
}

function activeEventName() {
  if (!requiresTournamentName()) return activeProfile().label;
  return dom.customEventName.value.trim() || activeProfile().label;
}

function markSessionChanged() {
  state.sessionRevision += 1;
  return state.sessionRevision;
}

function updateSelectionControls() {
  const busy = state.importing || state.generating;
  const recordIds = new Set(state.records.map(({ _rowId }) => _rowId));
  for (const rowId of state.selectedRowIds) {
    if (!recordIds.has(rowId)) state.selectedRowIds.delete(rowId);
  }

  const selectedCount = state.selectedRowIds.size;
  const rowCount = state.records.length;
  const selectionText = `${selectedCount} ${selectedCount === 1 ? "row" : "rows"} selected`;
  dom.selectedRowCount.value = selectionText;
  dom.selectedRowCount.textContent = selectionText;
  dom.selectAllRows.checked = rowCount > 0 && selectedCount === rowCount;
  dom.selectAllRows.indeterminate = selectedCount > 0 && selectedCount < rowCount;
  dom.selectAllRows.disabled = busy || rowCount === 0;
  dom.selectAllRows.setAttribute(
    "aria-label",
    dom.selectAllRows.checked ? "Deselect all student rows" : "Select all student rows",
  );
  dom.deleteSelectedRows.disabled = busy || selectedCount === 0;
  dom.clearAllRows.disabled = busy || rowCount === 0;

  for (const row of dom.studentsBody.querySelectorAll("tr[data-row-id]")) {
    const rowId = Number(row.dataset.rowId);
    const selected = state.selectedRowIds.has(rowId);
    const recordIndex = state.records.findIndex(({ _rowId }) => _rowId === rowId);
    const record = state.records[recordIndex];
    row.classList.toggle("is-selected", selected);
    row.setAttribute("aria-selected", String(selected));
    const checkbox = row.querySelector("input[data-select-row-id]");
    if (checkbox) {
      checkbox.checked = selected;
      checkbox.disabled = busy;
      checkbox.setAttribute(
        "aria-label",
        `${selected ? "Deselect" : "Select"} ${record?.studentName || `row ${recordIndex + 1}`} for deletion`,
      );
    }
  }
}

function updateBusyControls() {
  const busy = state.importing || state.generating;
  for (const control of [
    dom.conventionProfile,
    dom.customEventName,
    dom.schoolName,
    dom.importFile,
    dom.importText,
    dom.sampleButton,
    dom.clearButton,
    dom.addStudentButton,
    dom.bulkTest,
    dom.bulkAddTest,
    dom.bulkRemoveTest,
    dom.packetOrder,
    dom.catalogSettings,
  ]) {
    control.disabled = busy;
  }
  for (const control of dom.studentsBody.querySelectorAll("input, select, button")) {
    // Tests a student's ID does not allow stay locked.
    control.disabled = busy || control.dataset.locked === "true";
  }
  dom.importButton.disabled = busy;
  updateSelectionControls();
}

function renderProfileChrome() {
  const profile = activeProfile();
  const isNational = profile.id === "national";
  const isRegional = profile.id === "regional";
  const isState = profile.id === "state";
  const isCustom = profile.id === "custom";
  const isHnd = profile.id === "hnd";
  const isConfigurable = usesConfigurableEventSlots(profile);
  const needsTournamentName = requiresTournamentName(profile);

  document.title = `${activeEventName()} Scantron Builder`;
  dom.profileEyebrow.textContent = activeEventName();
  dom.customEventNameField.hidden = !needsTournamentName;
  dom.tournamentNameLabel.replaceChildren(
    document.createTextNode(isRegional ? "Regional / Invitational name " : "Competition name "),
    createElement("span", { text: "*", attributes: { "aria-hidden": "true" } }),
  );
  dom.tournamentNameHelp.textContent = isRegional
    ? "Enter the specific regional, statewide, or invitational name. It is used in the PDF title and filename."
    : "Enter the competition name. It is used in the PDF title and filename.";
  dom.customEventName.placeholder = isRegional
    ? "Example: Broward Regional 2027"
    : "Example: District Math Tournament 2027";
  dom.catalogSettings.textContent = isConfigurable
    ? "Configure event catalog and codes"
    : "Review event catalog and codes";
  dom.conventionProfileHelp.textContent = isRegional
    ? "Regional / Invitational also covers FAMAT statewides. Each student's FAMAT ID sets the divisions allowed by the Sponsors' Guide eligibility chart; check the tests to print for each student."
    : isCustom
      ? "Custom competitions use your own event list; check the events to print for each student."
    : isNational
      ? "National uses each student's division and an editable event list; check the tests to print for each student."
      : "State reads each student's division from the State ID and the Sponsors' Guide eligibility chart; check the Individual and topic tests to print.";
  dom.catalogStatusTitle.textContent = isRegional
    ? "Enter this tournament’s Individual and optional-event codes"
    : isCustom
      ? "Custom competition setup required"
    : isNational
      ? "National event template is editable; scorer codes are still required"
      : "Verified 2027 State numbering loaded";
  dom.catalogStatusCopy.replaceChildren(
    document.createTextNode(
      isRegional
        ? "The six official Regional/Statewide divisions and their ID digits are loaded. Enter the organizer’s current three-digit codes, then add only this tournament’s Open or other written events. "
        : isCustom
          ? "No event or packet assumptions are loaded. Create the event choices and reviewed three-digit codes for this competition. "
        : isNational
          ? "No National answer-sheet packet or current three-digit scorer-code list was found. The 2027 event list is loaded only as an editable starting template. "
          : "The State packet’s five Individual divisions, two topic rounds, ID digits, and 25 scorer mappings are loaded. ",
    ),
    createElement("strong", {
      text: isRegional
        ? "The Individual for the ID's division is checked automatically; team digits 0, 1, and 2 are kept. Speed and Mental are excluded."
        : isCustom
          ? "Each student needs at least one checked event."
        : isNational
          ? "Rename, move, deactivate, or add events as needed; generation stays blocked while a checked event lacks a reviewed code."
          : "Chi uses State-ID digit 9 and Individual code 555. State prepared-sheet IDs end in 0; Speed and Mental receive no prepared scantron.",
    }),
  );

  dom.formatProfileTitle.textContent = `${profile.shortLabel} file format`;
  let sampleHeader;
  let sampleRow;
  if (isHnd) {
    dom.schemaRequirementsCopy.textContent =
      "Required columns are Student Name and Student ID. Previous Year IDs is optional: for a Statistics student, last year's ID decides between Dostal - Precalculus and Dostal - Calculus. Events is optional; leave it blank to print the test for the ID's 8th digit.";
    sampleHeader = "School,School Code,Student Name,Student ID,Previous Year IDs,Events";
    sampleRow = "Sample Academy,1234,Jordan Lee,123400110,,";
  } else if (isRegional) {
    dom.schemaRequirementsCopy.textContent =
      "Required columns are Student Name and Student ID. Previous Year IDs is optional: list last year's FAMAT ID(s) to apply the Sponsors' Guide one-year and no-testing-down rules. Events lists the tests to print, separated by semicolons; leave it blank to print the Individual for the ID's division.";
    sampleHeader = "School,School Code,Student Name,Student ID,Previous Year IDs,Events";
    sampleRow = 'Sample Academy,1234,Jordan Lee,123400440,123400330,"Precalculus Individual; Sample Open"';
  } else if (isState) {
    dom.schemaRequirementsCopy.textContent =
      "Required columns are Student Name and the nine-digit No Team State ID. Previous Year IDs is optional. Events lists the Individual and topic tests to print, separated by semicolons; leave it blank to print only the Individual for the ID's division.";
    sampleHeader = "School,School Code,Student Name,Student ID,Previous Year IDs,Events";
    sampleRow = 'Sample Academy,1234,Jordan Lee,123400130,,"Theta Individual; Theta Applications (Theta); Logs & Exponents (Theta)"';
  } else if (isNational) {
    dom.schemaRequirementsCopy.textContent =
      "Required columns are Student Name and Student ID. Division (Theta, Alpha, or Mu) checks that Individual and sets the lowest topic level. Events lists the tests to print, separated by semicolons.";
    sampleHeader = "School,School Code,Student Name,Student ID,Division,Events";
    sampleRow = 'Sample Academy,1234,Jordan Lee,123400240,Alpha,"Alpha Individual; Complex Numbers (Alpha); Trigonometry (Alpha); Matrices & Vectors (Alpha)"';
  } else {
    dom.schemaRequirementsCopy.textContent =
      "Required columns are Student Name and Student ID. Events lists the events to print, separated by semicolons; every student needs at least one event.";
    sampleHeader = "School,School Code,Student Name,Student ID,Events";
    sampleRow = 'Sample Academy,1234,Jordan Lee,123400240,"Sample Event A; Sample Event B"';
  }
  dom.importCodeSample.replaceChildren(createElement("code", { text: `${sampleHeader}\n${sampleRow}` }));
  dom.importText.placeholder = sampleHeader.replaceAll(",", "\t");
  dom.acceptedColumnsCopy.replaceChildren(
    createElement("strong", { text: "Accepted header row: " }),
    document.createTextNode(sampleHeader.replaceAll(",", ", ")),
  );
  dom.schemaProfileNote.textContent = isRegional
    ? "The 8th ID digit is the division number (1 Algebra I, 2 Geometry, 3 Algebra II, 4 Precalculus, 5 Calculus, 6 Statistics). Only divisions the Sponsors' Guide chart allows for that digit can be checked. Older files with Division or Optional Event columns still import; course columns such as Eligibility Basis are ignored."
    : isState
      ? "The 8th ID digit sets the State division (2 or 3 Theta, 4 Alpha, 5 Mu, 6 Statistics, 9 Chi). Topic tests must be at or above the student's level. Older files with Division, Round 1, and Round 2 columns still import; course columns such as Topic Eligibility Level are ignored."
    : isNational
      ? "The National event list is editable, but its three-digit scorer codes are blank until reviewed. Older files with Individual and Round 1–3 columns still import."
      : "Before importing, open Configure event catalog and codes and create matching names and three-digit codes. Older files with Event 1–4 columns still import.";
  dom.reviewRequirementsCopy.textContent = isRegional
    ? "Check the tests to print for each student. Divisions come from the FAMAT ID (and previous-year IDs, when given) under the Sponsors' Guide eligibility chart. A student may take at most two Individuals, and one must be Statistics, Precalculus, or Calculus. Each checked test prints one scantron."
    : isState
      ? "Check the tests to print for each student: normally one Individual, one Round 1 topic, and one Round 2 topic. Divisions come from the State ID (and previous-year IDs, when given). Each checked test prints one scantron."
    : isNational
      ? "Check the tests to print for each student: one Individual and a topic test for each round. Each checked test prints one scantron."
      : "Check at least one event for each student. Each checked event prints one scantron.";
  dom.studentsCaption.textContent = `Editable students and ${profile.shortLabel} tests to print`;
  dom.studentIdHeading.textContent = studentIdLabel(profile);
  dom.previousIdsHeading.hidden = !usesPreviousIds(profile);
  dom.eligibilityHeading.hidden = !usesEligibilityBasis(profile);
  dom.divisionHeading.hidden = !usesDivisionField(profile);
  dom.eligibilityHeading.textContent = isRegional ? "Current course / eligibility" : "Topic eligibility level";
  dom.divisionHeading.textContent = idDerivesDivision(profile) ? "Division (from ID)" : "Division";
  dom.testsHeading.textContent = isCustom ? "Events to print" : "Tests to print";
  dom.idFormatRule.innerHTML = isRegional
    ? "<strong>Keep each FAMAT ID as exactly nine digits.</strong> Digit 8 is the division (1 Algebra I, 2 Geometry, 3 Algebra II, 4 Precalculus, 5 Calculus, 6 Statistics); digit 9 is 0 for no team, 1 for Team 1, or 2 for Team 2. Format the column as plain text."
    : isState
      ? "<strong>Use the nine-digit No Team State ID ending in 0.</strong> Digit 8 is 2/3 for Theta, 4 for Alpha, 5 for Mu/Calculus, 6 for Statistics, or 9 for Chi. Format the column as plain text."
      : "<strong>Keep every Student ID as exactly nine digits.</strong> Format the ID column as plain text so a leading zero is not removed.";
  dom.metadataFormatRule.innerHTML = isRegional || isState || isHnd
    ? "<strong>School, School Code, and Previous Year IDs are optional.</strong> Use <strong>School</strong> when one file contains more than one school; otherwise the default school name above is used. A supplied four-digit School Code must match the first four Student ID digits. Separate several previous-year IDs with semicolons."
    : "<strong>School and School Code are optional.</strong> Use <strong>School</strong> when one file contains more than one school; otherwise the default school name above is used. A supplied four-digit School Code must match the first four Student ID digits.";
  dom.assignmentFormatRule.innerHTML =
    '<strong>Separate the tests in the Events column with semicolons</strong>, for example <code>"Precalculus Individual; 521"</code>. Use each test\'s full name or three-digit code. Put quotation marks around a name containing a comma, for example <code>"Rivera, Ana"</code>.';
  dom.footerReviewCopy.textContent =
    `Review the ${profile.shortLabel} event catalog and answer-sheet procedure against the organizer's final instructions before production printing.`;
  dom.catalogDialogTitle.textContent = isRegional
    ? "Configure Regional / Invitational events and codes"
    : isCustom
      ? "Configure custom competition events and codes"
    : `Review ${profile.year} ${profile.shortLabel} test codes`;
  dom.catalogDialogWarningCopy.textContent = isRegional
    ? "The six official division rows are preloaded, but no optional events or scorer codes are assumed. Add only events that use this answer sheet and enter three-digit codes supplied by that tournament's scorer."
    : isCustom
      ? "This mode has no preset events. Add only events that use this answer sheet and enter codes supplied by the competition's scorer."
    : isNational
      ? "No authoritative National answer-sheet packet or current scorer-code table was found. Treat this list as a starting template, revise it for the actual convention, and do not copy historical codes."
      : "The current State packet uses Chi digit 9 and code 555, all four State topic levels, Statistics Individual, and the two topic rounds. Recheck if the packet changes.";
  dom.catalogEditorHelp.textContent =
    "Rename events, change their session or division, restrict eligible divisions, mark whether they use this scantron, deactivate outdated rows, or add events. Codes print on generated sheets: enter exactly three unique digits only after review. Pending checked codes block generation.";
  if (isHnd) {
    dom.conventionProfileHelp.textContent =
      "Hiller / Nunn / Dostal picks each student's test from the FAMAT ID's 8th digit: 1 Hiller, 2 or 3 Nunn, 4 Dostal - Precalculus, 5 Dostal - Calculus. A Statistics student (6) gets Dostal - Calculus if a previous-year ID shows Precalculus or Calculus, otherwise Dostal - Precalculus. Test codes print blank.";
    dom.catalogStatusTitle.textContent = "Hiller, Nunn, and Dostal tests loaded";
    dom.catalogStatusCopy.replaceChildren(
      document.createTextNode("The four tests are Hiller, Nunn, Dostal - Precalculus, and Dostal - Calculus. "),
      createElement("strong", { text: "The test-code boxes are left blank on every sheet." }),
    );
    dom.schemaProfileNote.textContent =
      "The 8th ID digit picks the test: 1 Hiller, 2 or 3 Nunn, 4 Dostal - Precalculus, 5 Dostal - Calculus, 6 Statistics (either Dostal test). Chi IDs (digit 9) have no test here.";
    dom.reviewRequirementsCopy.textContent =
      "Each student takes one test, checked from the FAMAT ID. For a Statistics student, check Dostal - Precalculus or Dostal - Calculus. Each checked test prints one scantron.";
    dom.idFormatRule.innerHTML =
      "<strong>Keep each FAMAT ID as exactly nine digits.</strong> Digit 8 picks the test (1 Hiller, 2 or 3 Nunn, 4 Dostal - Precalculus, 5 Dostal - Calculus, 6 Statistics). Format the column as plain text.";
    dom.assignmentFormatRule.innerHTML =
      "<strong>The Events column is optional.</strong> Leave it blank to print the test for the ID's 8th digit, or write the test name, for example <code>Dostal - Calculus</code>.";
    dom.catalogDialogTitle.textContent = "Review Hiller / Nunn / Dostal tests";
    dom.catalogDialogWarningCopy.textContent =
      "These four tests print with blank test-code boxes. Enter a three-digit code only if the organizer gives one.";
  }
  populateBulkTestSelect();
}

function createElement(tagName, options = {}) {
  const element = document.createElement(tagName);
  if (options.className) element.className = options.className;
  if (options.text !== undefined) element.textContent = options.text;
  if (options.attributes) {
    for (const [name, value] of Object.entries(options.attributes)) {
      if (value !== null && value !== undefined) element.setAttribute(name, String(value));
    }
  }
  return element;
}

function appendText(parent, tagName, text, className = "") {
  const child = createElement(tagName, { text, className });
  parent.append(child);
  return child;
}

function groupTests(group, catalog = state.catalog) {
  return catalog.filter((test) => test.active !== false && test.group === group);
}

function assignmentLabelForField(field) {
  return activeAssignments().find((assignment) => assignment.field === field)?.label ??
    GROUP_LABELS[FIELD_GROUPS[field]] ??
    field;
}

function optionLabel(test) {
  const code = test.code ?? (test.blankCode ? "no code" : "pending");
  return `${test.name} — ${code}`;
}

function canonicalTestValue(value, group, catalog = state.catalog) {
  const result = resolveTestReference(value, group, catalog);
  return result.test?.id ?? String(value ?? "").trim();
}

function normalizeEligibilityBasisForProfile(value, profile = activeProfile()) {
  const key = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!key) return "";
  if (profile.id === "regional") {
    if (["algebra 1", "algebra i", "alg 1", "alg i"].includes(key)) return "algebra_1";
    if (
      [
        "geometry",
        "algebra 2",
        "algebra ii",
        "geometry algebra 2",
        "geometry algebra ii",
        "geometry and algebra 2",
        "geometry and or algebra ii",
        "geometry and or algebra 2",
      ].includes(key)
    ) return "geometry_algebra_2";
    if (["precalculus", "pre calculus", "precalc"].includes(key)) return "precalculus";
    if (["calculus", "calc"].includes(key)) return "calculus";
    if (["statistics special", "statistics", "stats"].includes(key)) return "statistics_special";
  }
  return normalizeDivisionForProfile(value, profile) ?? String(value ?? "").trim();
}

function normalizeImportedRecord(record, catalog = state.catalog) {
  const profile = activeProfile();
  const normalized = {
    ...record,
    _rowId: state.nextRowId++,
    studentName: String(record.studentName ?? "").trim(),
    stateId: String(record.stateId ?? "").replace(/\s+/g, ""),
    previousIds: String(record.previousIds ?? "").trim(),
    schoolName: String(record.schoolName ?? "").trim(),
    schoolCode: String(record.schoolCode ?? "").replace(/\s+/g, ""),
    division: normalizeDivisionForProfile(record.division, profile) ?? String(record.division ?? "").trim(),
    eligibilityBasis: normalizeEligibilityBasisForProfile(record.eligibilityBasis, profile),
    statisticsEligibilityBasis: profile.id === "regional"
      ? normalizeEligibilityBasisForProfile(record.statisticsEligibilityBasis, profile)
      : "",
  };
  // A supplied checklist is kept; otherwise the Events cell and any older
  // per-slot columns become the student's checklist.
  normalized.tests = initialTestReferences(normalized, { profile, catalog });
  return normalized;
}

function blankRecord() {
  return {
    _rowId: state.nextRowId++,
    studentName: "",
    stateId: "",
    previousIds: "",
    schoolName: "",
    schoolCode: "",
    division: "",
    eligibilityBasis: "",
    statisticsEligibilityBasis: "",
    tests: [],
    source: { format: "manual" },
  };
}

function buildCurrentPacket() {
  const appErrors = [...state.sourceErrors];
  if (requiresTournamentName() && !dom.customEventName.value.trim()) {
    appErrors.push({
      severity: "error",
      code: "MISSING_EVENT_NAME",
      message: `Enter the ${activeProfile().id === "regional" ? "Regional / Invitational" : "competition"} name.`,
      field: "customEventName",
    });
  }
  state.packet = buildPacket({
    schoolName: dom.schoolName.value,
    schoolCode: state.sourceSchoolCode,
    records: state.records,
    sortBy: dom.packetOrder.value,
    errors: appErrors,
    warnings: state.sourceWarnings,
    catalog: state.catalog,
    profile: activeProfile(),
    assignments: activeAssignments(),
  });
  return state.packet;
}

function issuesForRecord(packet, recordIndex) {
  return {
    errors: packet.errors.filter((issue) => issue.recordIndex === recordIndex),
    warnings: packet.warnings.filter((issue) => issue.recordIndex === recordIndex),
  };
}

function issuesForField(issues, field) {
  return issues.filter((issue) => issue.field === field);
}

function updateIdReference(control, attribute, id, include) {
  const ids = new Set((control.getAttribute(attribute) ?? "").split(/\s+/).filter(Boolean));
  if (include) ids.add(id);
  else ids.delete(id);
  if (ids.size > 0) control.setAttribute(attribute, [...ids].join(" "));
  else control.removeAttribute(attribute);
}

function markInvalid(control, issues, errorId) {
  const invalid = issues.length > 0;
  if (invalid) control.setAttribute("aria-invalid", "true");
  else control.removeAttribute("aria-invalid");
  updateIdReference(control, "aria-describedby", errorId, invalid);
  updateIdReference(control, "aria-errormessage", errorId, invalid);
  if (invalid) control.title = issues.map((issue) => issue.message).join(" ");
  else control.removeAttribute("title");
}

function studentFieldId(record, field) {
  return `student-${record._rowId}-${field}`;
}

function studentFieldErrorId(record, field) {
  return `${studentFieldId(record, field)}-error`;
}

function syncFieldError(cell, control, record, field, issues) {
  const errorId = studentFieldErrorId(record, field);
  let error = cell.querySelector(`[data-field-error="${field}"]`);
  if (!error) {
    error = createElement("p", {
      className: "field-error",
      attributes: { id: errorId, "data-field-error": field, hidden: "" },
    });
    cell.append(error);
  }
  error.id = errorId;
  error.textContent = issues.map((issue) => issue.message).join(" ");
  error.hidden = issues.length === 0;
  markInvalid(control, issues, errorId);
}

function createTextInput(record, recordIndex, field, label, attributes = {}) {
  const input = createElement("input", {
    attributes: {
      type: "text",
      id: studentFieldId(record, field),
      value: record[field] ?? "",
      "data-record-index": recordIndex,
      "data-field": field,
      "aria-label": `${label} for row ${recordIndex + 1}`,
      autocomplete: "off",
      ...attributes,
    },
  });
  return input;
}

const REGIONAL_ELIGIBILITY_OPTIONS = Object.freeze([
  ["algebra_1", "Algebra I"],
  ["geometry_algebra_2", "Geometry and/or Algebra II"],
  ["precalculus", "Precalculus"],
  ["calculus", "Calculus"],
  ["statistics_special", "Statistics (other course also required)"],
]);

const REGIONAL_STATISTICS_BASIS_OPTIONS = Object.freeze(
  REGIONAL_ELIGIBILITY_OPTIONS.filter(([value]) => value !== "statistics_special"),
);

const REGIONAL_DIVISION_OPTIONS = Object.freeze([
  ["algebra_1", "Algebra I"],
  ["geometry", "Geometry"],
  ["algebra_2", "Algebra II"],
  ["precalculus", "Precalculus"],
  ["calculus", "Calculus"],
  ["statistics", "Statistics"],
]);

const STATE_LEVEL_OPTIONS = Object.freeze([
  ["chi", "Chi"],
  ["theta", "Theta"],
  ["alpha", "Alpha"],
  ["mu", "Mu / Calculus"],
]);

const STATE_DIVISION_OPTIONS = Object.freeze([
  ...STATE_LEVEL_OPTIONS,
  ["statistics", "Statistics"],
]);

function divisionOptions(field, profile = activeProfile()) {
  if (profile.id === "regional") {
    if (field === "statisticsEligibilityBasis") return REGIONAL_STATISTICS_BASIS_OPTIONS;
    return field === "eligibilityBasis" ? REGIONAL_ELIGIBILITY_OPTIONS : REGIONAL_DIVISION_OPTIONS;
  }
  if (profile.id === "state") {
    return field === "eligibilityBasis" ? STATE_LEVEL_OPTIONS : STATE_DIVISION_OPTIONS;
  }
  if (profile.id === "national") return STATE_LEVEL_OPTIONS.slice(1);
  return [];
}

function createChoiceSelect(record, recordIndex, field, label, options) {
  const select = createElement("select", {
    attributes: {
      id: studentFieldId(record, field),
      "data-record-index": recordIndex,
      "data-field": field,
      "aria-label": `${label} for ${record.studentName || `row ${recordIndex + 1}`}`,
    },
  });
  select.append(createElement("option", { text: `Select ${label.toLowerCase()}`, attributes: { value: "" } }));
  for (const [value, optionLabelText] of options) {
    const option = createElement("option", { text: optionLabelText, attributes: { value } });
    if (String(record[field] ?? "") === value) option.selected = true;
    select.append(option);
  }
  return select;
}

function isNonScantronName(test) {
  return /\b(?:speed|mental(?:\s+math)?)\b/i.test(test?.name ?? "");
}

const PICKER_GROUP_ORDER = Object.freeze([
  TEST_GROUPS.INDIVIDUAL,
  TEST_GROUPS.OPTIONAL,
  TEST_GROUPS.ROUND_1,
  TEST_GROUPS.ROUND_2,
  TEST_GROUPS.ROUND_3,
]);

/** Active events that use this answer sheet. */
function pickerTests(catalog = state.catalog) {
  return catalog.filter(
    (test) => test.active !== false && test.producesScantron !== false && !isNonScantronName(test),
  );
}

function groupHeading(group, profile = activeProfile()) {
  if (profile.id === "custom") {
    const label = profile.assignments.find((assignment) => assignment.group === group)?.label;
    if (label) return `${label} slot`;
  }
  return {
    [TEST_GROUPS.INDIVIDUAL]: "Individual",
    [TEST_GROUPS.OPTIONAL]: "Additional / Open",
    [TEST_GROUPS.ROUND_1]: "Round 1",
    [TEST_GROUPS.ROUND_2]: "Round 2",
    [TEST_GROUPS.ROUND_3]: "Round 3",
  }[group] ?? group;
}

function recordEligibility(record) {
  return eligibilityForRecord(record, activeProfile());
}

function testFromReference(reference) {
  return resolveTestReference(reference, null, state.catalog).test ?? null;
}

function pickerCountText(count) {
  if (count === 0) return "No tests";
  return `${count} ${count === 1 ? "test" : "tests"}`;
}

function pickerNamesText(record) {
  const tests = recordTests(record);
  if (tests.length === 0) return "Choose the tests to print";
  return tests
    .map((reference) => {
      const test = testFromReference(reference);
      return test ? test.name : `Unrecognized: ${reference}`;
    })
    .join("; ");
}

function divisionSummary(record, eligibility = recordEligibility(record)) {
  const profile = activeProfile();
  if (profile.id === "custom") return "";
  if (profile.id === "national") {
    return eligibility.registeredDivision
      ? `Division: ${DIVISION_LABELS[eligibility.registeredDivision]}. Higher divisions are allowed; lower ones are not.`
      : "Choose the student's division to check its Individual automatically.";
  }
  if (!eligibility.idDigit) return "Enter the nine-digit ID. Its 8th digit sets the allowed divisions.";
  const course = ID_DIGIT_COURSES[eligibility.idDigit] ?? `digit ${eligibility.idDigit}`;
  const allowed = eligibility.allowedDivisions.map((division) => DIVISION_LABELS[division]).join(", ") || "none";
  const previous = eligibility.previous.length > 0
    ? ` Previous year: ${eligibility.previous.map((entry) => `${entry.course} (${entry.id})`).join(", ")}.`
    : "";
  return `8th ID digit ${eligibility.idDigit} = ${course}. Allowed divisions: ${allowed}.${previous}`;
}

function createTestOption(record, test, availability, checked) {
  const optionId = `${studentFieldId(record, "tests")}-${test.id}`;
  const item = createElement("div", {
    className: [
      "test-option",
      availability.allowed ? "" : "is-unavailable",
      availability.conditional ? "is-conditional" : "",
    ].filter(Boolean).join(" "),
  });
  const input = createElement("input", {
    attributes: {
      type: "checkbox",
      id: optionId,
      value: test.id,
      "data-test-toggle": test.id,
      "data-row-id": record._rowId,
    },
  });
  input.checked = checked;
  // A test the ID does not allow cannot be checked; one already checked can still be unchecked.
  if (!availability.allowed && !checked) {
    input.disabled = true;
    input.dataset.locked = "true";
  }
  const label = createElement("label", { attributes: { for: optionId } });
  label.append(
    createElement("span", { className: "test-option-name", text: test.name }),
    createElement("span", { className: "test-option-code", text: test.code ?? "code needed" }),
  );
  item.append(input, label);
  if (!availability.allowed && availability.reason) {
    item.append(createElement("span", { className: "test-option-reason", text: availability.reason }));
  } else if (availability.conditional) {
    item.append(
      createElement("span", {
        className: "test-option-reason",
        text: "Statistics students only under chart note ** (no higher math class; never competed in Algebra II/Geometry).",
      }),
    );
  }
  return item;
}

function createTestPicker(record, recordIndex) {
  const eligibility = recordEligibility(record);
  const selected = new Set(recordTests(record));
  const details = createElement("details", {
    className: "test-picker",
    attributes: { "data-picker-row-id": record._rowId },
  });
  details.open = state.openPickerRowIds.has(record._rowId);
  const summary = createElement("summary", {
    className: "test-picker-summary",
    attributes: {
      id: studentFieldId(record, "tests"),
      "aria-label": `Tests to print for ${record.studentName || `row ${recordIndex + 1}`}: ${pickerNamesText(record)}`,
    },
  });
  summary.append(
    createElement("span", { className: "test-picker-count", text: pickerCountText(selected.size) }),
    createElement("span", { className: "test-picker-names", text: pickerNamesText(record) }),
  );
  details.append(summary);

  const panel = createElement("div", { className: "test-picker-panel" });
  const note = divisionSummary(record, eligibility);
  if (note) panel.append(createElement("p", { className: "test-picker-note", text: note }));

  const tests = pickerTests();
  const known = new Set();
  for (const group of PICKER_GROUP_ORDER) {
    const groupList = tests.filter((test) => test.group === group);
    if (groupList.length === 0) continue;
    const fieldset = createElement("fieldset", { className: "test-picker-group" });
    fieldset.append(createElement("legend", { text: groupHeading(group) }));
    for (const test of groupList) {
      known.add(test.id);
      fieldset.append(
        createTestOption(record, test, testAvailability(test, eligibility), selected.has(test.id)),
      );
    }
    panel.append(fieldset);
  }

  const unknown = [...selected].filter((reference) => !known.has(reference));
  if (unknown.length > 0) {
    const fieldset = createElement("fieldset", { className: "test-picker-group" });
    fieldset.append(createElement("legend", { text: "Not available in the event catalog" }));
    unknown.forEach((reference, index) => {
      const optionId = `${studentFieldId(record, "tests")}-unknown-${index}`;
      const item = createElement("div", { className: "test-option is-unavailable" });
      const input = createElement("input", {
        attributes: {
          type: "checkbox",
          id: optionId,
          "data-test-toggle": reference,
          "data-row-id": record._rowId,
        },
      });
      input.checked = true;
      item.append(
        input,
        createElement("label", { text: reference, attributes: { for: optionId } }),
        createElement("span", {
          className: "test-option-reason",
          text: "Uncheck it, or add or reactivate it in the event catalog.",
        }),
      );
      fieldset.append(item);
    });
    panel.append(fieldset);
  }
  details.append(panel);
  return details;
}

function createDivisionControl(record, recordIndex) {
  if (activeProfile().id === "national") {
    return createChoiceSelect(record, recordIndex, "division", "division", divisionOptions("division"));
  }
  const eligibility = recordEligibility(record);
  const text = eligibility.registeredDivision
    ? `${DIVISION_LABELS[eligibility.registeredDivision]} (digit ${eligibility.idDigit})`
    : "Set by the ID";
  return createElement("output", {
    className: "derived-assignment",
    text,
    attributes: {
      "aria-label": `Division from the ID for ${record.studentName || `row ${recordIndex + 1}`}: ${text}`,
    },
  });
}

/**
 * After an ID, previous-year ID, or division change: uncheck tests the student
 * can no longer take, and check the ID's Individual when no Individual is left.
 * Nothing changes while the ID itself is incomplete or invalid.
 */
function refreshTestsForEligibility(record, { idChanged = false } = {}) {
  const profile = activeProfile();
  if (profile.id !== "national" && !validateStateId(record.stateId, { profile }).valid) return [];
  const eligibility = recordEligibility(record);
  const removed = [];
  const kept = [];
  let removedIndividual = false;
  for (const reference of recordTests(record)) {
    const test = testFromReference(reference);
    if (test && !testAvailability(test, eligibility).allowed) {
      removed.push(test.name);
      removedIndividual ||= isIndividualTest(test);
      continue;
    }
    kept.push(reference);
  }
  record.tests = kept;
  const hasIndividual = kept.some((reference) => isIndividualTest(testFromReference(reference)));
  if (!hasIndividual && (idChanged || removedIndividual)) {
    const individual = defaultIndividualForEligibility(eligibility, state.catalog);
    if (individual) record.tests.unshift(individual.id);
  }
  return removed;
}

function statusForRow(rowIssues) {
  if (rowIssues.errors.length > 0) {
    return { className: "status-pill is-error", symbol: "×", label: "Fix error" };
  }
  if (rowIssues.warnings.length > 0) {
    return { className: "status-pill is-warning", symbol: "!", label: "Check warning" };
  }
  return { className: "status-pill is-ready", symbol: "✓", label: "Ready" };
}

function syncStatusPill(statusPill, rowIssues) {
  const status = statusForRow(rowIssues);
  const messages = [...rowIssues.errors, ...rowIssues.warnings].map((issue) => issue.message);
  statusPill.className = status.className;
  statusPill.replaceChildren(
    createElement("span", { text: status.symbol, attributes: { "aria-hidden": "true" } }),
    document.createTextNode(` ${status.label}`),
  );
  if (messages.length > 0) {
    const details = messages.join(" ");
    statusPill.title = details;
    statusPill.setAttribute("aria-label", `${status.label}. ${details}`);
  } else {
    statusPill.removeAttribute("title");
    statusPill.removeAttribute("aria-label");
  }
}

function controlLabel(record, recordIndex, field) {
  const who = record.studentName || `row ${recordIndex + 1}`;
  if (field === "studentName") return `Student name for row ${recordIndex + 1}`;
  if (field === "schoolName") return `School override for row ${recordIndex + 1}`;
  if (field === "stateId") return `${studentIdLabel()} for row ${recordIndex + 1}`;
  if (field === "previousIds") return `Previous-year ID or IDs for ${who}`;
  if (field === "eligibilityBasis") return `Eligibility basis for ${who}`;
  if (field === "statisticsEligibilityBasis") return `Other qualifying course for ${who}`;
  if (field === "division") return `Division for ${who}`;
  return `${field} for ${who}`;
}

function syncStudentRow(record, recordIndex, packet) {
  const row = [...dom.studentsBody.querySelectorAll("tr[data-row-id]")]
    .find((candidate) => candidate.dataset.rowId === String(record._rowId));
  if (!row) return;

  const rowIssues = issuesForRecord(packet, recordIndex);
  const selected = state.selectedRowIds.has(record._rowId);
  row.classList.toggle("is-selected", selected);
  row.setAttribute("aria-selected", String(selected));
  const selectionCheckbox = row.querySelector("input[data-select-row-id]");
  if (selectionCheckbox) {
    selectionCheckbox.checked = selected;
    selectionCheckbox.setAttribute(
      "aria-label",
      `${selected ? "Deselect" : "Select"} ${record.studentName || `row ${recordIndex + 1}`} for deletion`,
    );
  }
  const statusPill = row.querySelector(".status-pill");
  if (statusPill) syncStatusPill(statusPill, rowIssues);

  for (const control of row.querySelectorAll("[data-record-index][data-field]")) {
    const field = control.dataset.field;
    control.dataset.recordIndex = String(recordIndex);
    control.id = studentFieldId(record, field);
    control.setAttribute("aria-label", controlLabel(record, recordIndex, field));
    const normalizedValue = String(record[field] ?? "");
    if (control.value !== normalizedValue) control.value = normalizedValue;
    syncFieldError(
      control.closest("td"),
      control,
      record,
      field,
      issuesForField(rowIssues.errors, field),
    );
  }

  const picker = row.querySelector("details.test-picker");
  if (picker) {
    const summary = picker.querySelector("summary");
    summary.querySelector(".test-picker-count").textContent = pickerCountText(recordTests(record).length);
    summary.querySelector(".test-picker-names").textContent = pickerNamesText(record);
    summary.setAttribute(
      "aria-label",
      `Tests to print for ${record.studentName || `row ${recordIndex + 1}`}: ${pickerNamesText(record)}`,
    );
    syncFieldError(picker.closest("td"), summary, record, "tests", issuesForField(rowIssues.errors, "tests"));
  }

  const removeButton = row.querySelector("button[data-remove-index]");
  if (removeButton) {
    removeButton.dataset.removeIndex = String(recordIndex);
    removeButton.setAttribute("aria-label", `Remove ${record.studentName || `row ${recordIndex + 1}`}`);
  }
}

function syncStudentRows(packet) {
  state.records.forEach((record, recordIndex) => syncStudentRow(record, recordIndex, packet));
}

function appendTextInputCell(row, record, recordIndex, rowIssues, field, label, attributes) {
  const cell = createElement("td");
  const input = createTextInput(record, recordIndex, field, label, attributes);
  cell.append(input);
  syncFieldError(cell, input, record, field, issuesForField(rowIssues.errors, field));
  row.append(cell);
  return input;
}

function renderStudentTable(packet) {
  dom.studentsBody.replaceChildren();
  if (state.records.length === 0) {
    const row = createElement("tr", { className: "empty-row" });
    const cell = createElement("td", {
      text: "No students yet. Import registration data or choose “Add student.”",
      attributes: {
        colspan:
          7 +
          (usesPreviousIds() ? 1 : 0) +
          (usesEligibilityBasis() ? 1 : 0) +
          (usesDivisionField() ? 1 : 0),
      },
    });
    row.append(cell);
    dom.studentsBody.append(row);
    return;
  }

  state.records.forEach((record, recordIndex) => {
    const rowIssues = issuesForRecord(packet, recordIndex);
    const row = createElement("tr", {
      className: state.selectedRowIds.has(record._rowId) ? "is-selected" : "",
      attributes: {
        "data-row-id": record._rowId,
        "aria-selected": state.selectedRowIds.has(record._rowId),
      },
    });

    const selectionCell = createElement("td", { className: "select-column" });
    const selectionCheckbox = createElement("input", {
      attributes: {
        type: "checkbox",
        "data-select-row-id": record._rowId,
        "aria-label": `${state.selectedRowIds.has(record._rowId) ? "Deselect" : "Select"} ${record.studentName || `row ${recordIndex + 1}`} for deletion`,
      },
    });
    selectionCheckbox.checked = state.selectedRowIds.has(record._rowId);
    selectionCell.append(selectionCheckbox);
    row.append(selectionCell);

    const statusCell = createElement("td");
    const statusPill = createElement("span");
    syncStatusPill(statusPill, rowIssues);
    statusCell.append(statusPill);
    row.append(statusCell);

    appendTextInputCell(row, record, recordIndex, rowIssues, "studentName", "Student name", {
      maxlength: 80,
    });
    appendTextInputCell(row, record, recordIndex, rowIssues, "schoolName", "School override", {
      maxlength: 120,
      placeholder: "Use school above",
    });
    appendTextInputCell(row, record, recordIndex, rowIssues, "stateId", studentIdLabel(), {
      inputmode: "numeric",
      maxlength: 17,
    });
    if (usesPreviousIds()) {
      appendTextInputCell(row, record, recordIndex, rowIssues, "previousIds", "Previous-year ID", {
        inputmode: "numeric",
        maxlength: 80,
        placeholder: "Optional",
      });
    }

    if (usesEligibilityBasis()) {
      // Retained, switched off: the older course-eligibility question.
      const eligibilityCell = createElement("td");
      const eligibilitySelect = createChoiceSelect(
        record,
        recordIndex,
        "eligibilityBasis",
        activeProfile().id === "regional" ? "current course or eligibility basis" : "topic eligibility level",
        divisionOptions("eligibilityBasis"),
      );
      eligibilityCell.append(eligibilitySelect);
      syncFieldError(
        eligibilityCell,
        eligibilitySelect,
        record,
        "eligibilityBasis",
        issuesForField(rowIssues.errors, "eligibilityBasis"),
      );
      row.append(eligibilityCell);
    }

    if (usesDivisionField()) {
      const divisionCell = createElement("td");
      const divisionControl = createDivisionControl(record, recordIndex);
      divisionCell.append(divisionControl);
      if (divisionControl.matches("select")) {
        syncFieldError(
          divisionCell,
          divisionControl,
          record,
          "division",
          issuesForField(rowIssues.errors, "division"),
        );
      }
      row.append(divisionCell);
    }

    const testsCell = createElement("td", { className: "tests-cell" });
    const picker = createTestPicker(record, recordIndex);
    testsCell.append(picker);
    syncFieldError(
      testsCell,
      picker.querySelector("summary"),
      record,
      "tests",
      issuesForField(rowIssues.errors, "tests"),
    );
    row.append(testsCell);

    const actionCell = createElement("td");
    const removeButton = createElement("button", {
      className: "button button-quiet",
      text: "Remove",
      attributes: {
        type: "button",
        "data-remove-index": recordIndex,
        "aria-label": `Remove ${record.studentName || `row ${recordIndex + 1}`}`,
      },
    });
    actionCell.append(removeButton);
    row.append(actionCell);
    dom.studentsBody.append(row);
  });
}

function appendIssueList(container, issues) {
  const list = createElement("ul");
  const shown = issues.slice(0, 10);
  for (const issue of shown) {
    appendText(list, "li", issue.filename ? `${issue.filename}: ${issue.message}` : issue.message);
  }
  container.append(list);
  if (issues.length > shown.length) {
    const remaining = issues.slice(shown.length);
    const details = createElement("details");
    appendText(
      details,
      "summary",
      `Show ${remaining.length} additional ${remaining.length === 1 ? "issue" : "issues"}`,
    );
    const remainingList = createElement("ul");
    for (const issue of remaining) {
      appendText(
        remainingList,
        "li",
        issue.filename ? `${issue.filename}: ${issue.message}` : issue.message,
      );
    }
    details.append(remainingList);
    container.append(details);
  }
}

function isPristine() {
  return (
    state.records.length === 0 &&
    state.sourceErrors.length === 0 &&
    !dom.schoolName.value.trim()
  );
}

function renderSchoolValidity(packet) {
  const issues = isPristine()
    ? []
    : packet.errors.filter(
      (issue) => issue.field === "schoolName" && issue.recordIndex === undefined,
    );
  dom.schoolNameError.textContent = issues.map((issue) => issue.message).join(" ");
  dom.schoolNameError.hidden = issues.length === 0;
  markInvalid(dom.schoolName, issues, dom.schoolNameError.id);
}

function renderCustomEventNameValidity(packet) {
  const issues = requiresTournamentName() && !isPristine()
    ? packet.errors.filter((issue) => issue.field === "customEventName")
    : [];
  dom.customEventNameError.textContent = issues.map((issue) => issue.message).join(" ");
  dom.customEventNameError.hidden = issues.length === 0;
  markInvalid(dom.customEventName, issues, dom.customEventNameError.id);
}

function renderValidationSummary(packet) {
  const container = dom.validationSummary;
  container.replaceChildren();
  container.classList.remove("is-error", "is-warning");

  if (isPristine()) {
    appendText(container, "strong", "Ready for data. ");
    appendText(container, "span", "Import a registration file, paste rows, or add a student manually.");
    return;
  }

  if (packet.errors.length > 0) {
    container.classList.add("is-error");
    appendText(container, "strong", `${packet.errors.length} blocking issue(s). `);
    appendText(container, "span", "Correct every error before generating the packet.");
    appendIssueList(container, packet.errors);
    return;
  }

  if (packet.warnings.length > 0) {
    container.classList.add("is-warning");
    appendText(container, "strong", `Ready with ${packet.warnings.length} warning(s). `);
    appendText(container, "span", "Review the notes before generating the packet.");
    appendIssueList(container, packet.warnings);
    return;
  }

  appendText(container, "strong", "All registrations are valid. ");
  appendText(container, "span", `${packet.jobs.length} scantrons will be generated.`);
}

function renderManifest(packet) {
  dom.manifestBody.replaceChildren();
  const pristine = isPristine();
  if (!packet.ok || packet.jobs.length === 0) {
    const row = createElement("tr", { className: "empty-row" });
    row.append(
      createElement("td", {
        text: packet.errors.length && !pristine
          ? "Resolve blocking errors to calculate the final manifest."
          : "The manifest will appear after valid students are added.",
        attributes: { colspan: 3 },
      }),
    );
    dom.manifestBody.append(row);
    return;
  }

  const counts = new Map();
  for (const job of packet.jobs) {
    const key = `${job.testCode}:${job.testName}`;
    counts.set(key, {
      testName: job.testName,
      testCode: job.testCode,
      testSortKey: job.testSortKey ?? "",
      count: (counts.get(key)?.count ?? 0) + 1,
    });
  }

  const entries = [...counts.values()];
  // Hiller / Nunn / Dostal lists its tests in that order.
  if (activeProfile().id === "hnd") entries.sort((left, right) => left.testSortKey.localeCompare(right.testSortKey));
  for (const entry of entries) {
    const row = createElement("tr");
    appendText(row, "td", entry.testName);
    appendText(row, "td", entry.testCode);
    appendText(row, "td", String(entry.count));
    dom.manifestBody.append(row);
  }
}

function renderCountsAndGeneration(packet) {
  const pristine = isPristine();
  const exactPageCount = plannedPageCount();
  dom.studentCount.value = String(state.records.length);
  dom.studentCount.textContent = String(state.records.length);
  dom.pageCount.value = String(exactPageCount);
  dom.pageCount.textContent = String(exactPageCount);
  const visibleErrorCount = pristine ? 0 : packet.errors.length;
  dom.errorCount.value = String(visibleErrorCount);
  dom.errorCount.textContent = String(visibleErrorCount);
  dom.warningCount.value = String(packet.warnings.length);
  dom.warningCount.textContent = String(packet.warnings.length);

  const ready = packet.ok && packet.jobs.length === exactPageCount && exactPageCount > 0;
  const studentNoun = state.records.length === 1 ? "student" : "students";
  const pageNoun = packet.jobs.length === 1 ? "page" : "pages";
  dom.generateButton.disabled = !ready || state.generating;
  if (state.generating) {
    dom.generationStatus.textContent = "Generating the PDF on this device…";
  } else if (ready) {
    dom.generationStatus.textContent =
      `Ready: ${packet.jobs.length} ${pageNoun} for ${state.records.length} ${studentNoun}, one for each checked test.`;
  } else if (pristine) {
    dom.generationStatus.textContent = "Import and validate registrations to enable PDF generation.";
  } else if (packet.errors.length > 0) {
    dom.generationStatus.textContent = "PDF generation is blocked until every registration and test code is valid.";
  } else {
    dom.generationStatus.textContent = "Import and validate registrations to enable PDF generation.";
  }
}

function populateBulkTestSelect() {
  if (!dom.bulkTest) return;
  const previous = dom.bulkTest.value;
  dom.bulkTest.replaceChildren(createElement("option", { text: "Choose a test", attributes: { value: "" } }));
  for (const group of PICKER_GROUP_ORDER) {
    const tests = pickerTests().filter((test) => test.group === group);
    if (tests.length === 0) continue;
    const optionGroup = createElement("optgroup", { attributes: { label: groupHeading(group) } });
    for (const test of tests) {
      optionGroup.append(createElement("option", { text: optionLabel(test), attributes: { value: test.id } }));
    }
    dom.bulkTest.append(optionGroup);
  }
  if ([...dom.bulkTest.options].some((option) => option.value === previous)) dom.bulkTest.value = previous;
}

function render({ table = true } = {}) {
  let packet;
  try {
    packet = buildCurrentPacket();
  } catch (error) {
    console.error(error);
    dom.validationSummary.textContent = `The reviewed catalog is invalid: ${error.message}`;
    dom.validationSummary.classList.add("is-error");
    dom.generateButton.disabled = true;
    return;
  }
  if (table) renderStudentTable(packet);
  else syncStudentRows(packet);
  renderSchoolValidity(packet);
  renderCustomEventNameValidity(packet);
  renderValidationSummary(packet);
  renderManifest(packet);
  renderCountsAndGeneration(packet);
  updateBusyControls();
}

async function parseSelectedFile(
  file,
  catalog,
  requiredHeaders,
  inferIndividualFromDivision,
  divisionScheme,
) {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    const text = await extractPdfText(await file.arrayBuffer(), window.FAMAT_PDFJS_PATHS);
    return {
      filename: file.name,
      parsed: parseRegistrationInput(text, {
        format: "roster",
        catalog,
        requiredHeaders,
        inferIndividualFromDivision,
        divisionScheme,
      }),
    };
  }

  const format = /\.tsv$/i.test(file.name) ? "tsv" : /\.csv$/i.test(file.name) ? "csv" : "auto";
  return {
    filename: file.name,
    parsed: parseRegistrationInput(await file.text(), {
      format,
      catalog,
      requiredHeaders,
      inferIndividualFromDivision,
      divisionScheme,
    }),
  };
}

async function readSelectedInputs(catalog, requiredHeaders, inferIndividualFromDivision, divisionScheme) {
  const files = [...(dom.importFile.files ?? [])];
  const pasted = dom.importText.value.trim();
  if (files.length === 0 && !pasted) {
    throw new Error("Choose one or more registration files or paste registration rows first.");
  }

  const sources = await Promise.all(
    files.map((file) =>
      parseSelectedFile(file, catalog, requiredHeaders, inferIndividualFromDivision, divisionScheme)),
  );
  if (pasted) {
    sources.push({
      filename: "Pasted registration rows",
      parsed: parseRegistrationInput(pasted, {
        format: "auto",
        catalog,
        requiredHeaders,
        inferIndividualFromDivision,
        divisionScheme,
      }),
    });
  }
  return sources;
}

function addAppWarning(warnings, code, message) {
  warnings.push({ severity: "warning", code, message });
}

function moveFocusToReview() {
  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  dom.validationSummary.focus({ preventScroll: true });
  dom.reviewSection?.scrollIntoView({
    behavior: reduceMotion ? "auto" : "smooth",
    block: "start",
  });
}

function announce(message) {
  dom.appAnnouncer.textContent = "";
  window.requestAnimationFrame(() => {
    dom.appAnnouncer.textContent = message;
  });
}

async function importRegistrations() {
  if (state.importing || state.generating) return;
  const operationRevision = markSessionChanged();
  const operationProfileId = state.profileId;
  const operationProfile = activeProfile();
  const operationCatalog = state.catalog;
  // Only Student Name and Student ID are required; Events and Previous Year IDs are optional.
  const requiredHeaders = ["student_name", "state_id"];
  const divisionScheme = operationProfile.divisionScheme ?? "state";
  state.importing = true;
  const previousText = dom.importButton.textContent;
  dom.importButton.textContent = "Reading registrations…";
  updateBusyControls();
  try {
    const sources = await readSelectedInputs(operationCatalog, requiredHeaders, false, divisionScheme);
    if (state.sessionRevision !== operationRevision || state.profileId !== operationProfileId) {
      announce("Import result ignored because the session changed while files were being read.");
      return;
    }
    const parsed = mergeParsedSources(sources, { catalog: operationCatalog, divisionScheme });
    const warnings = [...parsed.warnings];
    for (const record of parsed.records) {
      for (const issue of importedListingWarnings(record, operationCatalog)) {
        warnings.push({
          ...issue,
          message: `${record.studentName || "A student"}: ${issue.message}`,
          line: record.source?.line,
          filename: record.source?.filename,
        });
      }
    }
    const typedSchool = dom.schoolName.value.trim();
    const schoolNames = [...new Set(parsed.sources.map(({ schoolName }) => schoolName).filter(Boolean))];
    const schoolCodes = [...new Set(parsed.sources.map(({ schoolCode }) => schoolCode).filter(Boolean))];
    if (schoolNames.length === 1 && !typedSchool) {
      dom.schoolName.value = schoolNames[0];
    } else if (
      schoolNames.length === 1 &&
      typedSchool &&
      schoolNames[0].toLocaleLowerCase() !== typedSchool.toLocaleLowerCase()
    ) {
      addAppWarning(
        warnings,
        "SCHOOL_NAME_DIFFERS_FROM_ROSTER",
        `The entered school name differs from the roster header “${schoolNames[0]}”.`,
      );
    }

    state.records = parsed.records.map((record) => normalizeImportedRecord(record, operationCatalog));
    state.selectedRowIds.clear();
    state.openPickerRowIds.clear();
    state.sourceErrors = parsed.errors;
    state.sourceWarnings = warnings;
    state.sourceSchoolCode = schoolCodes.length === 1 ? schoolCodes[0] : null;
    render();
    moveFocusToReview();
  } catch (error) {
    console.error(error);
    if (state.sessionRevision !== operationRevision || state.profileId !== operationProfileId) {
      announce("Import result ignored because the session changed while files were being read.");
      return;
    }
    state.sourceErrors = [
      {
        severity: "error",
        code: "IMPORT_FAILED",
        message: error instanceof Error ? error.message : "The registration file could not be read.",
      },
    ];
    render();
    moveFocusToReview();
  } finally {
    state.importing = false;
    dom.importButton.textContent = previousText;
    updateBusyControls();
  }
}

function loadSample() {
  const profile = activeProfile();
  markSessionChanged();
  dom.schoolName.value = "Example High School";
  state.sourceErrors = [];
  state.sourceWarnings = [];
  state.sourceSchoolCode = "1234";
  const stateSamples = [
    {
      studentName: "Jordan Lee",
      stateId: "123400130",
      tests: ["theta-individual", "round-1-theta-applications", "round-2-theta-logs-exponents"],
      source: { format: "sample" },
    },
    {
      studentName: "Morgan Rivera",
      stateId: "123400240",
      tests: ["alpha-individual", "round-1-alpha-trigonometry", "round-2-alpha-complex-numbers"],
      source: { format: "sample" },
    },
    {
      studentName: "Taylor Chen",
      stateId: "123400350",
      previousIds: "123400340",
      tests: ["mu-individual", "round-1-mu-integration", "round-2-mu-bc-calculus"],
      source: { format: "sample" },
    },
    {
      studentName: "Avery Patel",
      stateId: "123400490",
      tests: ["chi-individual", "round-1-theta-functions", "round-2-theta-geometry"],
      source: { format: "sample" },
    },
  ];
  const nationalSamples = [
    {
      studentName: "Jordan Lee",
      stateId: "123400130",
      division: "theta",
      tests: [
        "national-theta-individual",
        "national-round-1-theta-applications",
        "national-round-2-theta-logs-exponents",
        "national-round-3-theta-sequences-series",
      ],
      source: { format: "sample" },
    },
    {
      studentName: "Morgan Rivera",
      stateId: "123400240",
      division: "alpha",
      tests: [
        "national-alpha-individual",
        "national-round-1-alpha-complex-numbers",
        "national-round-2-alpha-trigonometry",
        "national-round-3-alpha-matrices-vectors",
      ],
      source: { format: "sample" },
    },
    {
      studentName: "Taylor Chen",
      stateId: "123400350",
      division: "mu",
      tests: [
        "national-mu-individual",
        "national-round-1-open-statistics",
        "national-round-2-mu-integration",
        "national-round-3-mu-limits-derivatives",
      ],
      source: { format: "sample" },
    },
  ];
  const configurableEventIds = [
    `custom-${profile.id}-sample-1`,
    `custom-${profile.id}-sample-2`,
  ];
  let samples;
  if (profile.id === "regional") {
    const sampleTournamentName = "Example Regional / Invitational";
    dom.customEventName.value = sampleTournamentName;
    state.tournamentNameSessions.regional = sampleTournamentName;
    const sampleCatalogEntries = [
      ...profile.catalog.map((test, index) => ({
        ...test,
        code: String(911 + index),
        status: "operational",
        blocking: false,
        note: "Fictional sample code; replace it with the tournament scorer's reviewed code.",
      })),
      {
        id: configurableEventIds[0],
        name: "Sample Open — replace before printing",
        group: TEST_GROUPS.OPTIONAL,
        division: "open",
        eligibleDivisions: ["all"],
        eventRole: "optional-open",
        producesScantron: true,
        code: "921",
      },
      {
        id: configurableEventIds[1],
        name: "Sample Geometry/Algebra II Open",
        group: TEST_GROUPS.OPTIONAL,
        division: "open",
        eligibleDivisions: ["geometry", "algebra_2"],
        eventRole: "optional-open",
        producesScantron: true,
        code: "922",
      },
    ];
    state.catalog = catalogFromEditableEntries(sampleCatalogEntries, { baseCatalog: profile.catalog });
    state.catalogSessions.regional = state.catalog;
    samples = [
      {
        studentName: "Jordan Lee",
        stateId: "123400131",
        previousIds: "123400221",
        tests: ["regional-algebra-2-individual", configurableEventIds[1]],
        source: { format: "sample" },
      },
      {
        studentName: "Morgan Rivera",
        stateId: "123400242",
        tests: ["regional-precalculus-individual", "regional-calculus-individual", configurableEventIds[0]],
        source: { format: "sample" },
      },
      {
        studentName: "Casey Chen",
        stateId: "123400360",
        tests: ["regional-statistics-individual", configurableEventIds[0]],
        source: { format: "sample" },
      },
    ];
    renderProfileChrome();
  } else if (usesConfigurableEventSlots(profile)) {
    const sampleTournamentName = "Example Custom Competition";
    dom.customEventName.value = sampleTournamentName;
    state.tournamentNameSessions[profile.id] = sampleTournamentName;
    state.catalog = catalogFromEditableEntries([
      {
        id: configurableEventIds[0],
        name: "Sample Individual Event",
        group: TEST_GROUPS.INDIVIDUAL,
        division: "open",
        code: "901",
      },
      {
        id: configurableEventIds[1],
        name: "Sample Topic Event",
        group: TEST_GROUPS.ROUND_1,
        division: "open",
        code: "902",
      },
    ]);
    state.catalogSessions[profile.id] = state.catalog;
    renderProfileChrome();
    samples = [
      {
        studentName: "Jordan Lee",
        stateId: "123400130",
        tests: [...configurableEventIds],
        source: { format: "sample" },
      },
    ];
  }
  if (!samples && profile.id === "hnd") {
    samples = [
      { studentName: "Jordan Lee", stateId: "123400110", source: { format: "sample" } },
      { studentName: "Morgan Rivera", stateId: "123400230", source: { format: "sample" } },
      { studentName: "Casey Chen", stateId: "123400350", source: { format: "sample" } },
      { studentName: "Riley Park", stateId: "123400460", previousIds: "123400440", source: { format: "sample" } },
    ];
  }
  samples ??= profile.id === "national" ? nationalSamples : stateSamples;
  state.selectedRowIds.clear();
  state.openPickerRowIds.clear();
  state.records = samples.map((record) => normalizeImportedRecord(record));
  render();
  moveFocusToReview();
}

function clearSession() {
  markSessionChanged();
  state.records = [];
  state.selectedRowIds.clear();
  state.openPickerRowIds.clear();
  state.sourceErrors = [];
  state.sourceWarnings = [];
  state.sourceSchoolCode = null;
  dom.schoolName.value = "";
  if (requiresTournamentName()) {
    dom.customEventName.value = "";
    state.tournamentNameSessions[state.profileId] = "";
  }
  dom.importText.value = "";
  dom.importFile.value = "";
  dom.bulkTest.value = "";
  dom.bulkTestStatus.textContent = "";
  renderProfileChrome();
  render();
  dom.schoolName.focus();
}

function deleteSelectedRows() {
  const selectedIds = new Set(
    state.records
      .filter(({ _rowId }) => state.selectedRowIds.has(_rowId))
      .map(({ _rowId }) => _rowId),
  );
  const selectedCount = selectedIds.size;
  if (selectedCount === 0) return;
  const confirmed = window.confirm(
    `Delete ${selectedCount} selected ${selectedCount === 1 ? "row" : "rows"}? This cannot be undone.`,
  );
  if (!confirmed) return;

  markSessionChanged();
  state.records = state.records.filter(({ _rowId }) => !selectedIds.has(_rowId));
  state.selectedRowIds.clear();
  render();
  (state.records.length > 0 ? dom.selectAllRows : dom.addStudentButton).focus();
  announce(
    `${selectedCount} selected ${selectedCount === 1 ? "row was" : "rows were"} deleted. ` +
    `${state.records.length} ${state.records.length === 1 ? "student remains" : "students remain"}.`,
  );
}

function clearAllRows() {
  const rowCount = state.records.length;
  if (rowCount === 0) return;
  const confirmed = window.confirm(
    `Clear all ${rowCount} student ${rowCount === 1 ? "row" : "rows"}? ` +
    "The selected convention profile and event catalog will be kept. This cannot be undone.",
  );
  if (!confirmed) return;

  markSessionChanged();
  state.records = [];
  state.selectedRowIds.clear();
  state.sourceErrors = [];
  state.sourceWarnings = [];
  state.sourceSchoolCode = null;
  render();
  dom.addStudentButton.focus();
  announce(`All ${rowCount} student ${rowCount === 1 ? "row was" : "rows were"} cleared.`);
}

function addStudent() {
  markSessionChanged();
  state.records.push(blankRecord());
  render();
  const input = dom.studentsBody.querySelector('tr:last-child [data-field="studentName"]');
  input?.focus();
}

/** Rows a bulk action applies to: the selected rows, or every row when none are selected. */
function bulkTargetRecords() {
  const selected = state.records.filter(({ _rowId }) => state.selectedRowIds.has(_rowId));
  return selected.length > 0 ? selected : state.records;
}

function showBulkStatus(message) {
  dom.bulkTestStatus.textContent = message;
  announce(message);
}

function bulkAddTest() {
  const test = testFromReference(dom.bulkTest.value);
  if (!test) {
    showBulkStatus("Choose a test to add first.");
    dom.bulkTest.focus();
    return;
  }
  if (state.records.length === 0) {
    showBulkStatus("Add students before adding tests.");
    return;
  }
  markSessionChanged();
  let added = 0;
  let skipped = 0;
  for (const record of bulkTargetRecords()) {
    const tests = recordTests(record);
    if (tests.includes(test.id)) continue;
    if (!testAvailability(test, recordEligibility(record)).allowed) {
      skipped += 1;
      continue;
    }
    tests.push(test.id);
    added += 1;
  }
  render();
  showBulkStatus(
    `${test.name} checked for ${added} ${added === 1 ? "student" : "students"}` +
      (skipped > 0
        ? `; ${skipped} ${skipped === 1 ? "student was" : "students were"} skipped because their ID does not allow it.`
        : "."),
  );
}

function bulkRemoveTest() {
  const test = testFromReference(dom.bulkTest.value);
  if (!test) {
    showBulkStatus("Choose a test to remove first.");
    dom.bulkTest.focus();
    return;
  }
  markSessionChanged();
  let removed = 0;
  for (const record of bulkTargetRecords()) {
    const tests = recordTests(record);
    if (!tests.includes(test.id)) continue;
    record.tests = tests.filter((reference) => reference !== test.id);
    removed += 1;
  }
  render();
  showBulkStatus(`${test.name} unchecked for ${removed} ${removed === 1 ? "student" : "students"}.`);
}

function catalogInputForId(id, field = null) {
  return [...dom.catalogForm.querySelectorAll("[data-catalog-id]")]
    .find(
      (input) =>
        input.dataset.catalogId === id &&
        (!field || input.dataset.catalogField === field),
    ) ?? null;
}

function catalogNameForId(id) {
  const rowName = dom.catalogBody
    .querySelector(`tr[data-catalog-row-id="${CSS.escape(id)}"] input[data-catalog-field="name"]`)
    ?.value.trim();
  return rowName || state.catalog.find((test) => test.id === id)?.name || id;
}

function clearCatalogErrors() {
  dom.catalogError.hidden = true;
  dom.catalogError.replaceChildren();
  for (const input of dom.catalogForm.querySelectorAll("input[data-catalog-id], select[data-catalog-id]")) {
    input.removeAttribute("aria-invalid");
    updateIdReference(input, "aria-describedby", dom.catalogError.id, false);
    updateIdReference(input, "aria-errormessage", dom.catalogError.id, false);
    input.setCustomValidity("");
  }
}

function showCatalogErrors(issues) {
  clearCatalogErrors();
  dom.catalogError.hidden = false;
  appendText(
    dom.catalogError,
    "strong",
    `${issues.length} catalog ${issues.length === 1 ? "issue" : "issues"} must be corrected.`,
  );
  const list = createElement("ul");
  for (const issue of issues) appendText(list, "li", issue.message);
  dom.catalogError.append(list);

  const messagesByControl = new Map();
  for (const issue of issues) {
    for (const id of issue.ids) {
      const key = `${id}\u0000${issue.field ?? ""}`;
      const entry = messagesByControl.get(key) ?? {
        id,
        field: issue.field ?? null,
        messages: [],
      };
      const messages = entry.messages;
      messages.push(issue.message);
      messagesByControl.set(key, entry);
    }
  }

  let firstInvalid = null;
  for (const { id, field, messages } of messagesByControl.values()) {
    const input = catalogInputForId(id, field);
    if (!input) continue;
    firstInvalid ??= input;
    input.setAttribute("aria-invalid", "true");
    updateIdReference(input, "aria-describedby", dom.catalogError.id, true);
    updateIdReference(input, "aria-errormessage", dom.catalogError.id, true);
    input.setCustomValidity(messages.join(" "));
  }
  firstInvalid?.focus();
}

function renderCatalogEditor(catalog = state.catalog) {
  clearCatalogErrors();
  dom.catalogBody.replaceChildren();
  if (catalog.length === 0) {
    const emptyRow = createElement("tr", { className: "empty-row" });
    emptyRow.append(
      createElement("td", {
        text: "No events configured yet. Choose “Add event” to begin.",
        attributes: { colspan: 9 },
      }),
    );
    dom.catalogBody.append(emptyRow);
    return;
  }
  for (const test of catalog) {
    appendCatalogEditorRow(test);
  }
}

function catalogSelect(field, test, options) {
  const select = createElement("select", {
    attributes: {
      "data-catalog-id": test.id,
      "data-catalog-field": field,
      "aria-label": `${field === "group" ? "Round" : "Division"} for ${test.name}`,
    },
  });
  for (const [value, label] of options) {
    const option = createElement("option", { text: label, attributes: { value } });
    if (value === test[field]) option.selected = true;
    select.append(option);
  }
  return select;
}

function appendCatalogEditorRow(test) {
    const row = createElement("tr", { attributes: { "data-catalog-row-id": test.id } });
    const nameCell = createElement("th", { attributes: { scope: "row" } });
    nameCell.append(
      createElement("input", {
        attributes: {
          type: "text",
          value: test.name,
          maxlength: 120,
          "data-catalog-id": test.id,
          "data-catalog-field": "name",
          "aria-label": `Event name for ${test.name || "new event"}`,
          autocomplete: "off",
        },
      }),
    );
    row.append(nameCell);

    const groupCell = createElement("td");
    groupCell.append(
      catalogSelect(
        "group",
        test,
        [...new Map([
          ...activeProfile().assignments.map(({ group, label }) => [group, label]),
          [TEST_GROUPS.OPTIONAL, "Additional / Open"],
          [TEST_GROUPS.ROUND_1, "Round 1"],
          [TEST_GROUPS.ROUND_2, "Round 2"],
          [TEST_GROUPS.ROUND_3, "Round 3"],
        ]).entries()].filter(([group]) => group),
      ),
    );
    row.append(groupCell);

    const divisionOptions = activeProfile().id === "regional"
      ? [...REGIONAL_DIVISION_OPTIONS, ["open", "Open / all"]]
      : activeProfile().id === "hnd"
      ? [
        ["hiller", "Hiller"],
        ["nunn", "Nunn"],
        ["dostal_precalculus", "Dostal - Precalculus"],
        ["dostal_calculus", "Dostal - Calculus"],
        ["open", "Open"],
      ]
      : activeProfile().id === "national"
      ? [["theta", "Theta"], ["alpha", "Alpha"], ["mu", "Mu"], ["open", "Open"]]
      : [
        ["chi", "Chi"],
        ["theta", "Theta"],
        ["alpha", "Alpha"],
        ["mu", "Mu"],
        ["statistics", "Statistics"],
        ["open", "Open"],
      ];
    const divisionCell = createElement("td");
    divisionCell.append(catalogSelect("division", test, divisionOptions));
    row.append(divisionCell);

    const eligibilityCell = createElement("td");
    eligibilityCell.append(
      createElement("input", {
        attributes: {
          type: "text",
          value: (test.eligibleDivisions ?? []).join(", "),
          placeholder: test.division === "open" ? "all" : "Uses division / level",
          "data-catalog-id": test.id,
          "data-catalog-field": "eligibleDivisions",
          "aria-label": `Eligible divisions for ${test.name}; enter all or comma-separated division keys`,
          autocomplete: "off",
        },
      }),
    );
    row.append(eligibilityCell);

    const codeCell = createElement("td");
    codeCell.append(
      createElement("input", {
        attributes: {
          type: "text",
          id: `catalog-code-${test.id}`,
          value: test.code ?? "",
          inputmode: "numeric",
          maxlength: 3,
          pattern: "[0-9]{3}",
          placeholder: test.status === "pending" ? "Pending" : null,
          "data-catalog-id": test.id,
          "data-catalog-field": "code",
          "aria-label": `Printed code for ${test.name}`,
          autocomplete: "off",
        },
      }),
    );
    row.append(codeCell);

    const scantronCell = createElement("td");
    const scantronInput = createElement("input", {
      attributes: {
        type: "checkbox",
        "data-catalog-id": test.id,
        "data-catalog-field": "producesScantron",
        "aria-label": `${test.name} uses this scantron`,
      },
    });
    scantronInput.checked = test.producesScantron !== false;
    scantronCell.append(scantronInput);
    row.append(scantronCell);

    const activeCell = createElement("td");
    const activeInput = createElement("input", {
      attributes: {
        type: "checkbox",
        "data-catalog-id": test.id,
        "data-catalog-field": "active",
        "aria-label": `Use ${test.name}`,
      },
    });
    activeInput.checked = test.active !== false;
    activeCell.append(activeInput);
    row.append(activeCell);

    appendText(
      row,
      "td",
      test.active === false
        ? "Inactive"
        : test.producesScantron === false
          ? "Excluded — no scantron"
        : test.code
          ? "Code present"
        : test.blankCode
          ? "Prints with a blank code"
          : "Pending — assigned pages blocked",
    );

    const actionCell = createElement("td");
    if (test.id.startsWith(`custom-${state.profileId}-`)) {
      actionCell.append(
        createElement("button", {
          className: "button button-quiet",
          text: "Remove",
          attributes: {
            type: "button",
            "data-remove-catalog-id": test.id,
            "aria-label": `Remove custom event ${test.name || "new event"}`,
          },
        }),
      );
    } else {
      appendText(actionCell, "span", "Use checkbox");
    }
    row.append(actionCell);
    dom.catalogBody.append(row);
}

function openCatalogDialog() {
  renderCatalogEditor();
  if (typeof dom.catalogDialog.showModal === "function") dom.catalogDialog.showModal();
  else dom.catalogDialog.setAttribute("open", "");
}

function addCatalogEvent() {
  dom.catalogBody.querySelector(".empty-row")?.remove();
  const topicAssignment = activeAssignments().find(({ topic }) => topic) ?? activeAssignments()[0];
  const usedIds = new Set([
    ...state.catalog.map(({ id }) => id),
    ...[...dom.catalogBody.querySelectorAll("tr[data-catalog-row-id]")]
      .map((row) => row.dataset.catalogRowId),
  ]);
  let id;
  do {
    id = `custom-${state.profileId}-${state.catalogRowCounter++}`;
  } while (usedIds.has(id));
  appendCatalogEditorRow({
    id,
    name: "New event",
    group: activeProfile().id === "regional" ? TEST_GROUPS.OPTIONAL : topicAssignment.group,
    division: "open",
    eligibleDivisions: ["all"],
    eventRole: activeProfile().id === "regional" ? "optional-open" : "topic",
    producesScantron: true,
    code: null,
    active: true,
    status: "pending",
    blocking: true,
    aliases: [],
  });
  dom.catalogBody
    .querySelector(`tr[data-catalog-row-id="${CSS.escape(id)}"] input[data-catalog-field="name"]`)
    ?.focus();
}

function catalogRowsFromEditor() {
  return [...dom.catalogBody.querySelectorAll("tr[data-catalog-row-id]")].map((row) => {
    const id = row.dataset.catalogRowId;
    const base = state.catalog.find((test) => test.id === id) ??
      activeProfile().catalog.find((test) => test.id === id) ?? {};
    const field = (name) => row.querySelector(`[data-catalog-field="${name}"]`);
    return {
      ...base,
      id,
      name: field("name").value,
      group: field("group").value,
      division: field("division").value,
      eligibleDivisions: field("eligibleDivisions").value
        .split(",")
        .map((value) => value.trim())
        .map((value) =>
          value.toLowerCase() === "all"
            ? "all"
            : normalizeDivisionForProfile(value, activeProfile()) ??
              value.toLowerCase().replace(/[\s-]+/g, "_"),
        )
        .filter(Boolean),
      code: field("code").value,
      producesScantron: field("producesScantron").checked,
      active: field("active").checked,
    };
  });
}

function saveCatalog() {
  const entries = catalogRowsFromEditor();
  try {
    const reviewedCatalog = catalogFromEditableEntries(entries, {
      baseCatalog: activeProfile().catalog,
    });
    state.catalogSessions[state.profileId] = reviewedCatalog;
    state.catalog = reviewedCatalog;
    markSessionChanged();
    state.records = state.records.map((record) => ({
      ...record,
      tests: recordTests(record).map(
        (reference) => resolveTestReference(reference, null, reviewedCatalog).test?.id ?? reference,
      ),
    }));
    populateBulkTestSelect();
    render();
    closeCatalogDialog("saved");
  } catch (error) {
    const message = error instanceof Error ? error.message : "The catalog is invalid.";
    const field = /code|three digits|assigned to both/i.test(message)
      ? "code"
      : /round|group/i.test(message)
        ? "group"
        : /division/i.test(message)
          ? "division"
          : "name";
    const referencedIds = entries
      .map(({ id }) => id)
      .filter((id) => message.includes(`"${id}"`));
    showCatalogErrors([
      {
        ids: referencedIds.length > 0 ? referencedIds : entries.map(({ id }) => id),
        field,
        message,
      },
    ]);
  }
}

function closeCatalogDialog(returnValue = "cancel") {
  if (typeof dom.catalogDialog.close === "function" && dom.catalogDialog.open) {
    dom.catalogDialog.close(returnValue);
  } else {
    dom.catalogDialog.removeAttribute("open");
    renderCatalogEditor();
    dom.catalogSettings.focus();
  }
}

async function generatePdf() {
  if (state.generating || state.importing) return;
  const packet = buildCurrentPacket();
  const pageCount = plannedPageCount();
  if (!packet.ok || packet.jobs.length !== pageCount || packet.jobs.length === 0) {
    render();
    dom.validationSummary.focus();
    return;
  }

  const operationRevision = state.sessionRevision;
  const profile = activeProfile();
  const eventName = activeEventName();
  state.generating = true;
  renderCountsAndGeneration(packet);
  updateBusyControls();
  try {
    const doc = await generateScantronPdf({ jobs: packet.jobs });
    if (state.sessionRevision !== operationRevision || state.profileId !== profile.id) {
      dom.generationStatus.textContent = "PDF generation was canceled because the session changed.";
      return;
    }
    doc.setProperties?.({
      title: `${eventName} scantrons — ${packet.school.name}`,
      subject: `${packet.jobs.length} prefilled ${profile.shortLabel} Convention answer sheets`,
      creator: `${eventName} Scantron Builder`,
    });
    const safeSchool = packet.school.name
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const safeEvent = eventName
      .normalize("NFKD")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
    const yearSuffix = profile.year ? `-${profile.year}` : "";
    doc.save(`${profile.filenamePrefix}-${safeEvent || "Event"}-${safeSchool || "School"}${yearSuffix}.pdf`);
    dom.generationStatus.textContent = `Downloaded ${packet.jobs.length} pages. Print single-sided at Actual size (100%).`;
  } catch (error) {
    console.error(error);
    dom.generationStatus.textContent = `PDF generation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
  } finally {
    state.generating = false;
    const plannedPages = plannedPageCount();
    dom.generateButton.disabled = !(
      state.packet?.ok &&
      state.packet.jobs.length === plannedPages &&
      plannedPages > 0
    );
    updateBusyControls();
  }
}

dom.importButton.addEventListener("click", importRegistrations);
dom.sampleButton.addEventListener("click", loadSample);
dom.clearButton.addEventListener("click", clearSession);
dom.addStudentButton.addEventListener("click", addStudent);
dom.bulkAddTest.addEventListener("click", bulkAddTest);
dom.bulkRemoveTest.addEventListener("click", bulkRemoveTest);
dom.catalogSettings.addEventListener("click", openCatalogDialog);
dom.catalogForm.addEventListener("submit", (event) => {
  event.preventDefault();
  saveCatalog();
});
dom.catalogForm.addEventListener("input", (event) => {
  if (event.target.matches("[data-catalog-id]")) clearCatalogErrors();
});
dom.catalogAddEvent.addEventListener("click", addCatalogEvent);
dom.catalogBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove-catalog-id]");
  if (!button) return;
  const row = button.closest("tr[data-catalog-row-id]");
  const nextFocus = row?.nextElementSibling?.querySelector("input[data-catalog-field='name']") ??
    row?.previousElementSibling?.querySelector("input[data-catalog-field='name']") ??
    dom.catalogAddEvent;
  row?.remove();
  nextFocus.focus();
  clearCatalogErrors();
});
dom.catalogDialog.addEventListener("click", (event) => {
  if (event.target.closest("[data-dialog-action='cancel']")) closeCatalogDialog();
});
dom.generateButton.addEventListener("click", generatePdf);
dom.schoolName.addEventListener("input", () => {
  markSessionChanged();
  render({ table: false });
});
dom.customEventName.addEventListener("input", () => {
  markSessionChanged();
  if (requiresTournamentName()) {
    state.tournamentNameSessions[state.profileId] = dom.customEventName.value;
  }
  renderProfileChrome();
  render({ table: false });
});
dom.packetOrder.addEventListener("change", () => render({ table: false }));
dom.selectAllRows.addEventListener("change", () => {
  if (dom.selectAllRows.checked) {
    state.selectedRowIds = new Set(state.records.map(({ _rowId }) => _rowId));
  } else {
    state.selectedRowIds.clear();
  }
  updateSelectionControls();
  announce(
    dom.selectAllRows.checked
      ? `All ${state.records.length} student ${state.records.length === 1 ? "row" : "rows"} selected.`
      : "All student rows deselected.",
  );
});
dom.deleteSelectedRows.addEventListener("click", deleteSelectedRows);
dom.clearAllRows.addEventListener("click", clearAllRows);

// Remember which test checklists are open so a full table refresh keeps them open.
dom.studentsBody.addEventListener(
  "toggle",
  (event) => {
    const picker = event.target;
    if (!(picker instanceof HTMLDetailsElement) || !picker.matches(".test-picker")) return;
    const rowId = Number(picker.dataset.pickerRowId);
    if (picker.open) state.openPickerRowIds.add(rowId);
    else state.openPickerRowIds.delete(rowId);
  },
  true,
);

dom.studentsBody.addEventListener("change", (event) => {
  const selectionCheckbox = event.target.closest("input[data-select-row-id]");
  if (selectionCheckbox) {
    const rowId = Number(selectionCheckbox.dataset.selectRowId);
    if (!Number.isInteger(rowId)) return;
    if (selectionCheckbox.checked) state.selectedRowIds.add(rowId);
    else state.selectedRowIds.delete(rowId);
    updateSelectionControls();
    return;
  }

  const toggle = event.target.closest("input[data-test-toggle]");
  if (toggle) {
    const rowId = Number(toggle.dataset.rowId);
    const record = state.records.find(({ _rowId }) => _rowId === rowId);
    if (!record) return;
    markSessionChanged();
    const reference = toggle.dataset.testToggle;
    const tests = recordTests(record);
    if (toggle.checked) {
      if (!tests.includes(reference)) tests.push(reference);
    } else {
      record.tests = tests.filter((value) => value !== reference);
    }
    render({ table: false });
    return;
  }

  const control = event.target.closest("[data-record-index][data-field]");
  if (!control) return;
  const index = Number(control.dataset.recordIndex);
  const field = control.dataset.field;
  if (!state.records[index] || !Object.hasOwn(state.records[index], field)) return;
  markSessionChanged();
  const record = state.records[index];
  record[field] = field === "stateId" ? control.value.replace(/\s+/g, "") : control.value.trim();

  if (["stateId", "previousIds", "division", "eligibilityBasis", "statisticsEligibilityBasis"].includes(field)) {
    // Regional and State take the division from the ID itself.
    if (field === "stateId" && idDerivesDivision()) record.division = "";
    const removed = refreshTestsForEligibility(record, { idChanged: field === "stateId" || field === "division" });
    render();
    if (removed.length > 0) {
      announce(`Unchecked tests this student's ID no longer allows: ${removed.join(", ")}.`);
    }
  } else {
    render({ table: false });
  }
});

dom.studentsBody.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-remove-index]");
  if (!button) return;
  const index = Number(button.dataset.removeIndex);
  if (!Number.isInteger(index) || index < 0 || index >= state.records.length) return;
  const removedRecord = state.records[index];
  const focusRecord = state.records[index + 1] ?? state.records[index - 1] ?? null;
  markSessionChanged();
  state.records.splice(index, 1);
  state.selectedRowIds.delete(removedRecord._rowId);
  state.openPickerRowIds.delete(removedRecord._rowId);
  render();
  const focusRow = focusRecord
    ? [...dom.studentsBody.querySelectorAll("tr[data-row-id]")]
      .find((row) => row.dataset.rowId === String(focusRecord._rowId))
    : null;
  (focusRow?.querySelector("button[data-remove-index]") ?? dom.addStudentButton).focus();
  announce(
    `${removedRecord.studentName || `Row ${index + 1}`} removed. ` +
    `${state.records.length} ${state.records.length === 1 ? "student remains" : "students remain"}.`,
  );
});

dom.catalogDialog.addEventListener("close", () => renderCatalogEditor());

function switchProfile(profileId) {
  const profile = getConventionProfile(profileId);
  if (!profile) return;
  const previousProfile = activeProfile();
  if (requiresTournamentName(previousProfile)) {
    state.tournamentNameSessions[previousProfile.id] = dom.customEventName.value;
  }
  markSessionChanged();
  state.profileId = profile.id;
  state.catalog = state.catalogSessions[profile.id] ?? profile.catalog;
  dom.customEventName.value = requiresTournamentName(profile)
    ? state.tournamentNameSessions[profile.id] ?? ""
    : "";
  // Checked tests belong to one competition type; rebuild each row's checklist
  // from its imported data under the new profile.
  for (const record of state.records) {
    record.tests = initialTestReferences({ ...record, tests: undefined }, { profile, catalog: state.catalog });
  }
  renderProfileChrome();
  render();
  announce(
    profile.id === "custom"
      ? `${profile.label} selected. Configure events, then check the events to print for each student.`
      : `${profile.label} selected. Check the tests to print for each student; divisions come from the ${profile.id === "national" ? "Division column" : "student IDs"}.`,
  );
}

dom.conventionProfile.addEventListener("change", () => switchProfile(dom.conventionProfile.value));
dom.catalogResetButton.addEventListener("click", () => renderCatalogEditor(activeProfile().catalog));

dom.conventionProfile.value = DEFAULT_PROFILE_ID;
state.catalog = activeProfile().catalog;
renderProfileChrome();
render();

console.info(
  `${activeProfile().catalogMetadata.name}: ${activeProfile().catalogMetadata.mappingBasis}; ${activeProfile().catalogMetadata.status}.`,
);
