/**
 * Print-accurate FAMAT State Convention answer-sheet rendering.
 *
 * The geometry below is intentionally expressed in PDF points. It is calibrated
 * against the official 2018.B answer sheet and must not be scaled independently
 * from the full-page template image.
 */

export const PAGE_SIZE = Object.freeze({ width: 611.77, height: 791.88 });
export const DEFAULT_TEMPLATE_URL = "assets/answer-sheet.png";

export const STUDENT_ID_LAYOUT = Object.freeze({
  length: 9,
  startX: 106,
  diffX: 17,
  textBaseline: 211,
  offsetX: 4.7,
  offsetY: 19.5,
  diffY: 15.34,
  radius: 6.6,
  corrections: Object.freeze([0.1, 0, -0.6, -0.9, -0.5, -1, -1.8, -1.8, -1]),
});

export const TEST_CODE_LAYOUT = Object.freeze({
  ...STUDENT_ID_LAYOUT,
  length: 3,
  textBaseline: 433,
  corrections: Object.freeze(STUDENT_ID_LAYOUT.corrections.slice(0, 3)),
});

const TEXT_POSITIONS = Object.freeze({
  name: Object.freeze({ x: 168, y: 113, maxWidth: 184 }),
  school: Object.freeze({ x: 168, y: 133, maxWidth: 184 }),
  test: Object.freeze({ x: 168, y: 153, maxWidth: 184 }),
});

const DEFAULT_TEXT_SIZE = 12;
const MINIMUM_TEXT_SIZE = 7;

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value.trim();
}
/**
 * Validate a fixed-width decimal field without ever coercing it to a number.
 * This is important for codes such as 000 and 007.
 */
export function requireDigitString(value, length, label = "value") {
  if (typeof value !== "string") {
    throw new TypeError(`${label} must be supplied as a string so leading zeroes are preserved.`);
  }

  const normalized = value.trim();
  const pattern = new RegExp(`^\\d{${length}}$`);
  if (!pattern.test(normalized)) {
    throw new TypeError(`${label} must contain exactly ${length} digits.`);
  }
  return normalized;
}

function requireColumn(column, layout) {
  if (!Number.isInteger(column) || column < 0 || column >= layout.length) {
    throw new RangeError(`column must be an integer from 0 through ${layout.length - 1}.`);
  }
}

function requireDigit(digit) {
  const normalized = typeof digit === "number" ? String(digit) : digit;
  if (typeof normalized !== "string" || !/^\d$/.test(normalized)) {
    throw new TypeError("digit must be one decimal digit.");
  }
  return Number(normalized);
}

/** Return the calibrated text and filled-bubble geometry for one grid cell. */
export function getDigitGeometry(column, digit, layout = STUDENT_ID_LAYOUT) {
  requireColumn(column, layout);
  const numericDigit = requireDigit(digit);
  const textX = layout.startX + layout.diffX * column;

  return Object.freeze({
    column,
    digit: String(numericDigit),
    textX,
    textY: layout.textBaseline,
    bubbleX: textX + layout.offsetX + layout.corrections[column],
    bubbleY: layout.textBaseline + layout.offsetY + layout.diffY * numericDigit,
    radius: layout.radius,
  });
}

export function getStudentIdGeometry(stateId) {
  const value = requireDigitString(stateId, STUDENT_ID_LAYOUT.length, "State ID");
  return Object.freeze(
    Array.from(value, (digit, column) => getDigitGeometry(column, digit, STUDENT_ID_LAYOUT)),
  );
}

export function getTestCodeGeometry(testCode) {
  const value = requireDigitString(testCode, TEST_CODE_LAYOUT.length, "Test code");
  return Object.freeze(
    Array.from(value, (digit, column) => getDigitGeometry(column, digit, TEST_CODE_LAYOUT)),
  );
}

/**
 * Accept the canonical job keys plus the short aliases used by roster rows.
 * Normalization happens once, before any PDF drawing begins.
 */
export function normalizePageJob(job) {
  if (!job || typeof job !== "object" || Array.isArray(job)) {
    throw new TypeError("Each PDF job must be an object.");
  }

  const nestedTest = job.test && typeof job.test === "object" ? job.test : null;
  const studentName = requireNonEmptyString(job.studentName ?? job.name, "Student name");
  const stateId = requireDigitString(job.stateId ?? job.studentId ?? job.id, 9, "State ID");
  const schoolName = requireNonEmptyString(job.schoolName ?? job.school, "School name");
  const testName = requireNonEmptyString(
    job.testName ?? nestedTest?.name ?? (typeof job.test === "string" ? job.test : undefined),
    "Test name",
  );
  // Hiller / Nunn / Dostal sheets leave the test-code boxes blank.
  const rawCode = job.testCode ?? nestedTest?.code ?? job.code;
  const blankTestCode = job.blankTestCode === true && (rawCode == null || String(rawCode).trim() === "");
  const testCode = blankTestCode ? "" : requireDigitString(rawCode, 3, "Test code");

  return Object.freeze({ studentName, stateId, schoolName, testName, testCode });
}

/**
 * Flatten roster rows into one explicit PDF job per assigned test. Student order
 * and assignment order are preserved, and the source objects are not mutated.
 */
export function expandPageJobs(students) {
  if (!Array.isArray(students)) {
    throw new TypeError("students must be an array.");
  }

  const jobs = [];
  for (const student of students) {
    if (!student || typeof student !== "object" || Array.isArray(student)) {
      throw new TypeError("Each student must be an object.");
    }

    const tests = student.tests ?? student.assignments;
    if (!Array.isArray(tests)) {
      throw new TypeError("Each student must include a tests array.");
    }

    for (const test of tests) {
      if (!test || typeof test !== "object" || Array.isArray(test)) {
        throw new TypeError("Each assigned test must be an object with a name and code.");
      }

      jobs.push(
        normalizePageJob({
          studentName: student.studentName ?? student.name,
          stateId: student.stateId ?? student.studentId ?? student.id,
          schoolName: student.schoolName ?? student.school,
          testName: test.testName ?? test.name,
          testCode: test.testCode ?? test.code,
          blankTestCode: test.blankTestCode ?? test.blankCode,
        }),
      );
    }
  }

  return Object.freeze(jobs);
}

export function formatTestLabel(testName, testCode) {
  return `${requireNonEmptyString(testName, "Test name")} (${requireDigitString(testCode, 3, "Test code")})`;
}

function resolveJsPDFConstructor(injectedConstructor) {
  if (typeof injectedConstructor === "function") return injectedConstructor;

  const browserConstructor = globalThis.window?.jspdf?.jsPDF ?? globalThis.jspdf?.jsPDF;
  if (typeof browserConstructor !== "function") {
    throw new Error("jsPDF is unavailable. Load the local jsPDF bundle or inject jsPDFCtor.");
  }
  return browserConstructor;
}

async function awaitImageDecode(image) {
  if (!image || typeof image !== "object") {
    throw new TypeError("Template image must be an image-like object.");
  }

  if (typeof image.decode === "function") {
    await image.decode();
    return image;
  }

  if (image.complete && Number(image.naturalWidth) > 0) return image;

  await new Promise((resolve, reject) => {
    image.addEventListener?.("load", resolve, { once: true });
    image.addEventListener?.(
      "error",
      () => reject(new Error("The answer-sheet template image could not be decoded.")),
      { once: true },
    );
  });
  return image;
}

export async function loadTemplateImage(
  templateUrl = DEFAULT_TEMPLATE_URL,
  { ImageCtor = globalThis.Image } = {},
) {
  const url = requireNonEmptyString(templateUrl, "Template URL");
  if (typeof ImageCtor !== "function") {
    throw new Error("Image is unavailable. Supply an ImageCtor or a decoded templateImage.");
  }

  const image = new ImageCtor();
  image.decoding = "sync";
  image.src = url;
  return awaitImageDecode(image);
}

function drawDigitGrid(doc, geometry) {
  for (const mark of geometry) {
    doc.text(mark.digit, mark.textX, mark.textY);
    doc.circle(mark.bubbleX, mark.bubbleY, mark.radius, "F");
  }
}

function drawFittedText(doc, value, position, label) {
  doc.setFontSize(DEFAULT_TEXT_SIZE);
  const naturalWidth =
    typeof doc.getTextWidth === "function" ? Number(doc.getTextWidth(value)) : position.maxWidth;
  const fittedSize =
    Number.isFinite(naturalWidth) && naturalWidth > position.maxWidth
      ? (DEFAULT_TEXT_SIZE * position.maxWidth) / naturalWidth
      : DEFAULT_TEXT_SIZE;

  if (fittedSize < MINIMUM_TEXT_SIZE) {
    throw new RangeError(
      `${label} is too long to fit the official answer-sheet field without becoming unreadable.`,
    );
  }

  doc.setFontSize(fittedSize);
  doc.text(value, position.x, position.y);
  doc.setFontSize(DEFAULT_TEXT_SIZE);
}

function drawPage(doc, templateImage, job) {
  doc.addImage(templateImage, "PNG", 0, 0, PAGE_SIZE.width, PAGE_SIZE.height);
  drawFittedText(doc, job.studentName, TEXT_POSITIONS.name, "Student name");
  drawFittedText(doc, job.schoolName, TEXT_POSITIONS.school, "School name");
  drawFittedText(
    doc,
    job.testCode === "" ? job.testName : formatTestLabel(job.testName, job.testCode),
    TEXT_POSITIONS.test,
    "Test name and code",
  );
  drawDigitGrid(doc, getStudentIdGeometry(job.stateId));
  if (job.testCode !== "") drawDigitGrid(doc, getTestCodeGeometry(job.testCode));
}

/**
 * Render a packet and return the jsPDF document. This function does not save or
 * download anything; the caller controls preview and delivery.
 */
export async function generateScantronPdf({
  jobs,
  templateUrl = DEFAULT_TEMPLATE_URL,
  templateImage,
  jsPDFCtor,
  ImageCtor,
} = {}) {
  if (!Array.isArray(jobs) || jobs.length === 0) {
    throw new TypeError("jobs must be a non-empty array of explicit page jobs.");
  }

  // Validate every page before loading the template or drawing the first mark.
  const normalizedJobs = jobs.map(normalizePageJob);
  const JsPDF = resolveJsPDFConstructor(jsPDFCtor);
  const decodedTemplate = templateImage
    ? await awaitImageDecode(templateImage)
    : await loadTemplateImage(templateUrl, { ImageCtor });

  const doc = new JsPDF({
    orientation: "portrait",
    unit: "pt",
    format: [PAGE_SIZE.width, PAGE_SIZE.height],
  });
  doc.setFont("helvetica");
  doc.setFontSize(12);

  normalizedJobs.forEach((job, index) => {
    // jsPDF creates the first page in its constructor. Add subsequent pages
    // immediately before drawing them; never append an unused trailing page.
    if (index > 0) {
      doc.addPage([PAGE_SIZE.width, PAGE_SIZE.height], "portrait");
    }
    drawPage(doc, decodedTemplate, job);
  });

  return doc;
}

export async function downloadScantronPdf(options = {}) {
  const { filename = "FAMAT-State-Scantrons.pdf" } = options;
  const normalizedFilename = requireNonEmptyString(filename, "Filename");
  const doc = await generateScantronPdf(options);
  doc.save(/\.pdf$/i.test(normalizedFilename) ? normalizedFilename : `${normalizedFilename}.pdf`);
  return doc;
}
