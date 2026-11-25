import test from "node:test";
import assert from "node:assert/strict";

import {
  extractPdfText,
  groupTextItemsIntoLines,
} from "../src/pdf-import.js";

function item(str, x, y) {
  return { str, transform: [1, 0, 0, 1, x, y] };
}

test("text items are grouped by nearby baselines and sorted left to right", () => {
  const lines = groupTextItemsIntoLines([
    item("row", 80, 680),
    item("Second", 10, 680.4),
    item("right", 90, 699.2),
    item("First", 10, 700),
  ]);

  assert.deepEqual(lines, ["First right", "Second row"]);
});
test("blank spans and marked-content entries do not create words or lines", () => {
  const lines = groupTextItemsIntoLines([
    item("   ", 5, 720),
    { type: "beginMarkedContent", id: "table" },
    item("  Ada   Lovelace  ", 10, 700),
    item("\t", 50, 700),
    item("123456780", 100, 700),
    item("", 10, 680),
  ]);

  assert.deepEqual(lines, ["Ada Lovelace 123456780"]);
});

test("PDF extraction preserves line and page boundaries and configures the worker", async () => {
  const fixtureSource = `
    export const GlobalWorkerOptions = {};
    export let receivedData;
    export let destroyed = false;
    const pageItems = [
      [
        { str: "ID", transform: [1, 0, 0, 1, 80, 700] },
        { str: "Name", transform: [1, 0, 0, 1, 10, 700] },
        { str: "Ada", transform: [1, 0, 0, 1, 10, 680] },
        { str: "123456780", transform: [1, 0, 0, 1, 80, 680] }
      ],
      [
        { str: "Grace", transform: [1, 0, 0, 1, 10, 700] },
        { str: "234567890", transform: [1, 0, 0, 1, 80, 700] }
      ]
    ];
    export function getDocument({ data }) {
      receivedData = data;
      return {
        promise: Promise.resolve({
          numPages: pageItems.length,
          getPage: async (pageNumber) => ({
            getTextContent: async () => ({ items: pageItems[pageNumber - 1] })
          }),
          destroy: async () => { destroyed = true; }
        })
      };
    }
  `;
  const library = `data:text/javascript,${encodeURIComponent(fixtureSource)}`;
  const worker = "data:text/javascript,export default null";
  const sourceBuffer = Uint8Array.from([37, 80, 68, 70]).buffer;

  const text = await extractPdfText(sourceBuffer, { library, worker });
  const fixture = await import(library);

  assert.equal(text, "Name ID\nAda 123456780\n\nGrace 234567890");
  assert.equal(fixture.GlobalWorkerOptions.workerSrc, worker);
  assert.ok(fixture.receivedData instanceof Uint8Array);
  assert.notEqual(fixture.receivedData.buffer, sourceBuffer);
  assert.equal(fixture.destroyed, true);
});

test("invalid inputs fail before PDF.js is loaded", async () => {
  const paths = {
    library: "data:text/javascript,export default {}",
    worker: "data:text/javascript,export default null",
  };

  assert.throws(() => groupTextItemsIntoLines(null), /must be an array/);
  assert.throws(
    () => groupTextItemsIntoLines([], { yTolerance: -1 }),
    /non-negative finite number/,
  );
  await assert.rejects(extractPdfText("%PDF", paths), /ArrayBuffer/);
  await assert.rejects(extractPdfText(new ArrayBuffer(0), paths), /cannot be empty/);
  await assert.rejects(
    extractPdfText(Uint8Array.from([1]).buffer, undefined),
    /library and worker paths are required/,
  );
});
