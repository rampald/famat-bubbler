import test from "node:test";
import assert from "node:assert/strict";

import {
  PAGE_SIZE,
  expandPageJobs,
  generateScantronPdf,
  getStudentIdGeometry,
  getTestCodeGeometry,
  requireDigitString,
} from "../src/pdf.js";

test("student ID bubble centers retain the established 2018.B calibration", () => {
  const marks = getStudentIdGeometry("012345678");

  assert.equal(marks.length, 9);
  assert.deepEqual(
    {
      textX: marks[0].textX,
      textY: marks[0].textY,
      bubbleX: marks[0].bubbleX,
      bubbleY: marks[0].bubbleY,
      radius: marks[0].radius,
    },
    { textX: 106, textY: 211, bubbleX: 110.8, bubbleY: 230.5, radius: 6.6 },
  );

  assert.equal(marks[8].textX, 242);
  assert.equal(marks[8].bubbleX, 245.7);
  assert.equal(marks[8].bubbleY, 353.22);
});

test("test codes preserve every digit, including leading zeroes", () => {
  for (const code of ["000", "007", "111", "623", "999"]) {
    const marks = getTestCodeGeometry(code);
    assert.equal(marks.map(({ digit }) => digit).join(""), code);
    assert.equal(marks.length, 3);
    assert.deepEqual(
      marks.map(({ textY }) => textY),
      [433, 433, 433],
    );
  }

  const zero = getTestCodeGeometry("000")[0];
  assert.equal(zero.bubbleX, 110.8);
  assert.equal(zero.bubbleY, 452.5);

  const leadingZeroSeven = getTestCodeGeometry("007")[2];
  assert.equal(leadingZeroSeven.bubbleX, 144.1);
  assert.equal(leadingZeroSeven.bubbleY, 559.88);
});

test("fixed-width digit fields reject numeric coercion and malformed strings", () => {
  assert.equal(requireDigitString("007", 3, "Test code"), "007");
  assert.throws(() => requireDigitString(7, 3, "Test code"), /string/);
  assert.throws(() => requireDigitString("07", 3, "Test code"), /exactly 3 digits/);
  assert.throws(() => requireDigitString("0A7", 3, "Test code"), /exactly 3 digits/);
});

test("page-job expansion creates one immutable job per explicit assignment", () => {
  const students = [
    {
      name: "Ada Lovelace",
      stateId: "123456780",
      school: "Example High School",
      tests: [
        { code: "111", name: "Theta Individual" },
        { code: "411", name: "Theta Applications (Theta)" },
        { code: "421", name: "Equations and Inequalities (Theta)" },
      ],
    },
    {
      studentName: "Katherine Johnson",
      studentId: "123456790",
      schoolName: "Example High School",
      assignments: [{ testCode: "222", testName: "Alpha Individual" }],
    },
  ];

  const jobs = expandPageJobs(students);

  assert.equal(jobs.length, 4);
  assert.deepEqual(
    jobs.map(({ studentName, testCode }) => [studentName, testCode]),
    [
      ["Ada Lovelace", "111"],
      ["Ada Lovelace", "411"],
      ["Ada Lovelace", "421"],
      ["Katherine Johnson", "222"],
    ],
  );
  assert.ok(Object.isFrozen(jobs));
  assert.ok(jobs.every(Object.isFrozen));
  assert.equal(students[0].tests.length, 3);
});

test("renderer adds each later page before drawing and never leaves a trailing page", async () => {
  class FakeJsPDF {
    static instance;

    constructor(options) {
      this.options = options;
      this.log = [];
      FakeJsPDF.instance = this;
    }

    setFont(...args) {
      this.log.push(["setFont", ...args]);
    }

    setFontSize(...args) {
      this.log.push(["setFontSize", ...args]);
    }

    getTextWidth(value) {
      return String(value).length * 6;
    }

    addPage(...args) {
      this.log.push(["addPage", ...args]);
    }

    addImage(...args) {
      this.log.push(["addImage", ...args]);
    }

    text(...args) {
      this.log.push(["text", ...args]);
    }

    circle(...args) {
      this.log.push(["circle", ...args]);
    }
  }

  let decodeCount = 0;
  const templateImage = {
    async decode() {
      decodeCount += 1;
    },
  };
  const base = {
    studentName: "Ada Lovelace",
    stateId: "123456780",
    schoolName: "Example High School",
  };
  const jobs = [
    { ...base, testName: "Theta Individual", testCode: "111" },
    { ...base, testName: "Theta Applications (Theta)", testCode: "411" },
    { ...base, testName: "Equations and Inequalities (Theta)", testCode: "421" },
  ];

  const doc = await generateScantronPdf({ jobs, templateImage, jsPDFCtor: FakeJsPDF });

  assert.equal(doc, FakeJsPDF.instance);
  assert.equal(decodeCount, 1);
  assert.deepEqual(doc.options, {
    orientation: "portrait",
    unit: "pt",
    format: [PAGE_SIZE.width, PAGE_SIZE.height],
  });
  assert.deepEqual(
    doc.log.filter(([operation]) => operation === "addImage" || operation === "addPage").map(([operation]) => operation),
    ["addImage", "addPage", "addImage", "addPage", "addImage"],
  );
  assert.equal(doc.log.filter(([operation]) => operation === "addPage").length, jobs.length - 1);
  assert.equal(doc.log.at(-1)[0], "circle");
});

test("long official labels are reduced to fit without truncating their text", async () => {
  class FittingJsPDF {
    constructor() {
      this.log = [];
    }

    setFont() {}
    addImage() {}
    circle() {}

    setFontSize(size) {
      this.log.push(["fontSize", size]);
    }

    getTextWidth(value) {
      return String(value).length * 6;
    }

    text(value, x, y) {
      this.log.push(["text", value, x, y]);
    }
  }

  const schoolName = "Example Preparatory Academy, Lakeview Campus";
  const testName = "History of Math: Trigonometry (Open)";
  const doc = await generateScantronPdf({
    jobs: [
      {
        studentName: "Rivera, Alexandra Catherine",
        stateId: "123401240",
        schoolName,
        testName,
        testCode: "821",
      },
    ],
    templateImage: { decode: async () => {} },
    jsPDFCtor: FittingJsPDF,
  });

  assert.ok(doc.log.some(([operation, size]) => operation === "fontSize" && size < 12));
  assert.ok(doc.log.every(([operation, size]) => operation !== "fontSize" || size >= 7));
  assert.ok(doc.log.some(([operation, value]) => operation === "text" && value === schoolName));
  assert.ok(
    doc.log.some(
      ([operation, value]) => operation === "text" && value === `${testName} (821)`,
    ),
  );
});

test("all jobs are validated before the renderer draws its first page", async () => {
  class ShouldNotConstruct {
    constructor() {
      throw new Error("constructor should not run");
    }
  }

  await assert.rejects(
    generateScantronPdf({
      jobs: [
        {
          studentName: "Ada Lovelace",
          stateId: "12345678",
          schoolName: "Example High School",
          testName: "Theta Individual",
          testCode: "111",
        },
      ],
      templateImage: { decode: async () => {} },
      jsPDFCtor: ShouldNotConstruct,
    }),
    /State ID must contain exactly 9 digits/,
  );
});
