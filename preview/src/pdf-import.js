const DEFAULT_Y_TOLERANCE = 2;

function normalizeTextItem(item, index) {
  if (!item || typeof item !== "object") {
    return null;
  }

  const text = String(item.str ?? "").replace(/\s+/g, " ").trim();
  if (!text) {
    return null;
  }

  const transform = item.transform;
  const x = Number(Array.isArray(transform) ? transform[4] : item.x);
  const y = Number(Array.isArray(transform) ? transform[5] : item.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    return null;
  }

  return { text, x, y, index };
}
/**
 * Convert PDF.js text items into visual lines.
 *
 * PDF.js reports positioned spans rather than rows. Nearby y coordinates are
 * treated as the same baseline, then each line is ordered from left to right.
 * Blank spans and non-text marked-content entries are ignored.
 */
export function groupTextItemsIntoLines(
  items,
  { yTolerance = DEFAULT_Y_TOLERANCE } = {},
) {
  if (!Array.isArray(items)) {
    throw new TypeError("PDF text items must be an array");
  }
  if (!Number.isFinite(yTolerance) || yTolerance < 0) {
    throw new RangeError("yTolerance must be a non-negative finite number");
  }

  const positionedItems = items
    .map(normalizeTextItem)
    .filter(Boolean)
    .sort((left, right) => right.y - left.y || left.x - right.x || left.index - right.index);

  const lines = [];
  for (const item of positionedItems) {
    const currentLine = lines.at(-1);
    if (!currentLine || Math.abs(item.y - currentLine.baseline) > yTolerance) {
      lines.push({ baseline: item.y, baselineTotal: item.y, items: [item] });
      continue;
    }

    currentLine.items.push(item);
    currentLine.baselineTotal += item.y;
    currentLine.baseline = currentLine.baselineTotal / currentLine.items.length;
  }

  return lines.map((line) =>
    line.items
      .sort((left, right) => left.x - right.x || left.index - right.index)
      .map(({ text }) => text)
      .join(" "),
  );
}

function configuredUrl(value, label) {
  if (typeof value !== "string" || !value.trim()) {
    throw new TypeError(`${label} must be a non-empty URL string`);
  }

  const baseUrl =
    typeof document !== "undefined" && document.baseURI ? document.baseURI : import.meta.url;

  try {
    return new URL(value, baseUrl).href;
  } catch {
    throw new TypeError(`${label} must be a valid URL`);
  }
}

function validateArrayBuffer(arrayBuffer) {
  if (!(arrayBuffer instanceof ArrayBuffer)) {
    throw new TypeError("PDF data must be provided as an ArrayBuffer");
  }
  if (arrayBuffer.byteLength === 0) {
    throw new RangeError("PDF data cannot be empty");
  }
}

/**
 * Extract readable, line-separated text from every page of a PDF.
 *
 * The configured module and worker paths are resolved relative to the current
 * document so a static deployment can keep PDF.js under ./vendor/.
 */
export async function extractPdfText(
  arrayBuffer,
  paths = globalThis.window?.FAMAT_PDFJS_PATHS,
) {
  validateArrayBuffer(arrayBuffer);
  if (!paths || typeof paths !== "object") {
    throw new TypeError("PDF.js library and worker paths are required");
  }

  const libraryUrl = configuredUrl(paths.library, "PDF.js library path");
  const workerUrl = configuredUrl(paths.worker, "PDF.js worker path");
  const pdfjs = await import(libraryUrl);

  if (typeof pdfjs.getDocument !== "function" || !pdfjs.GlobalWorkerOptions) {
    throw new TypeError("The configured PDF.js module does not expose the expected API");
  }

  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  // PDF.js may transfer its input to a worker. Copy it so callers can safely
  // retain or re-read the File-provided ArrayBuffer after extraction.
  const data = new Uint8Array(arrayBuffer.slice(0));
  const loadingTask = pdfjs.getDocument({ data });
  if (!loadingTask?.promise) {
    throw new TypeError("PDF.js getDocument did not return a loading task");
  }

  const documentProxy = await loadingTask.promise;
  try {
    if (!Number.isInteger(documentProxy?.numPages) || documentProxy.numPages < 0) {
      throw new TypeError("PDF.js returned an invalid document");
    }

    const pages = [];
    for (let pageNumber = 1; pageNumber <= documentProxy.numPages; pageNumber += 1) {
      const page = await documentProxy.getPage(pageNumber);
      const textContent = await page.getTextContent();
      const lines = groupTextItemsIntoLines(textContent?.items ?? []);
      pages.push(lines.join("\n"));
    }

    return pages.join("\n\n");
  } finally {
    await documentProxy?.destroy?.();
  }
}
