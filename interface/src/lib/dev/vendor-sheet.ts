import * as XLSX from "xlsx";

/**
 * Turning an uploaded vendor offer sheet into rows the vendor deal analyzer
 * can evaluate — entirely in the browser, since demo mode has no backend to
 * upload to.
 *
 * Real vendor sheets vary: one supplier's header is row 1, another's sheet
 * (see the Shein example this was built against) has a notes paragraph
 * merged across row 1 and the real header on row 2. Column names vary too
 * ("UPC/EAN" vs "UPC" vs "Supplier Item#"). So this scans the first several
 * rows for the one that reads like a header — contains the words a header
 * would — rather than assuming row 1.
 */

export type VendorRow = {
  query: string;
  title: string;
  cost: number;
  upc: string | null;
};

export type ParsedVendorSheet = {
  fileName: string;
  rows: VendorRow[];
  skippedRows: number;
  headerRow: string[];
};

const NAME_KEYS = ["product name", "title", "item", "description", "name"];
const UPC_KEYS = ["upc/ean", "upc", "ean", "gtin", "barcode"];
const COST_KEYS = ["b2b price", "offer price", "cost", "price", "wholesale", "unit price"];

function scoreHeaderRow(cells: string[]): number {
  const lower = cells.map((c) => c.toLowerCase().trim());
  let score = 0;
  if (lower.some((c) => NAME_KEYS.some((k) => c.includes(k)))) score += 1;
  if (lower.some((c) => UPC_KEYS.some((k) => c.includes(k)))) score += 1;
  if (lower.some((c) => COST_KEYS.some((k) => c.includes(k)))) score += 1;
  return score;
}

function findColumn(header: string[], keys: string[]): number {
  const lower = header.map((c) => c.toLowerCase().trim());
  for (const key of keys) {
    const i = lower.findIndex((c) => c.includes(key));
    if (i !== -1) return i;
  }
  return -1;
}

/**
 * The cost column, chosen among every header cell that *sounds* like one
 * (a sheet can have Price, MSRP and Offer Price all at once — the NYC sheet
 * this was built against does) rather than the first name match. "Offer
 * Price" outranks "Price" by name, but if it's unset for every row ("-",
 * blank) and "Price" holds the real numbers, picking by name alone silently
 * drops every row. Scored by how many of the sample rows actually parse as a
 * number instead.
 */
function findCostColumn(header: string[], sampleRows: string[][], keys: string[]): number {
  const lower = header.map((c) => c.toLowerCase().trim());
  const candidates = lower
    .map((c, i) => (keys.some((k) => c.includes(k)) ? i : -1))
    .filter((i) => i !== -1);
  if (!candidates.length) return -1;

  let best = candidates[0];
  let bestCount = -1;
  for (const col of candidates) {
    const count = sampleRows.reduce((n, row) => (toNumber(row[col]) !== null ? n + 1 : n), 0);
    if (count > bestCount) {
      bestCount = count;
      best = col;
    }
  }
  return best;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,₹\s]/g, "");
  const n = Number.parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** Rows-of-cells, whatever the source format — the shared shape both parsers below produce. */
function fromGrid(fileName: string, grid: unknown[][]): ParsedVendorSheet {
  const asStrings = grid.map((row) => row.map((cell) => (cell == null ? "" : String(cell))));

  // Scan the first few rows for the best-scoring header, not just row 0 — a
  // notes row above it (the Shein sheet's own shape) scores 0 and is skipped.
  let headerIndex = 0;
  let bestScore = -1;
  for (let i = 0; i < Math.min(5, asStrings.length); i += 1) {
    const score = scoreHeaderRow(asStrings[i]);
    if (score > bestScore) {
      bestScore = score;
      headerIndex = i;
    }
  }

  const header = asStrings[headerIndex] ?? [];
  const sampleRows = asStrings.slice(headerIndex + 1, headerIndex + 16);
  const nameCol = findColumn(header, NAME_KEYS);
  const upcCol = findColumn(header, UPC_KEYS);
  const costCol = findCostColumn(header, sampleRows, COST_KEYS);

  const rows: VendorRow[] = [];
  let skipped = headerIndex + 1;
  for (let i = headerIndex + 1; i < asStrings.length; i += 1) {
    const raw = asStrings[i];
    if (raw.every((c) => !c.trim())) continue; // blank row
    const title = nameCol >= 0 ? raw[nameCol]?.trim() : "";
    const upc = upcCol >= 0 ? raw[upcCol]?.trim() : "";
    const cost = costCol >= 0 ? toNumber(raw[costCol]) : null;
    if (!title && !upc) {
      skipped += 1;
      continue;
    }
    if (cost === null) {
      skipped += 1;
      continue;
    }
    rows.push({
      query: upc || title,
      title: title || upc,
      cost,
      upc: upc || null,
    });
  }

  return { fileName, rows, skippedRows: skipped, headerRow: header };
}

function parseCsv(text: string): unknown[][] {
  // Hand-rolled rather than a dependency: quoted fields (commas/newlines
  // inside quotes) are the only real complexity in CSV, and that's a small,
  // well-understood state machine.
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || r[0]);
}

/**
 * How a parsed upload rides inside an ordinary chat message: appended after
 * this marker as JSON, and stripped by the demo backend before the message is
 * ever stored or shown. There is no upload endpoint in demo mode — this is
 * the entire transport.
 */
export const VENDOR_SHEET_MARKER = "\n\n<!--VENDOR_SHEET:";

export function buildVendorSheetMessage(question: string, sheets: ParsedVendorSheet[]): string {
  const fileNames = sheets.map((s) => s.fileName);
  const rows = sheets.flatMap((s) => s.rows);
  return `${question}${VENDOR_SHEET_MARKER}${JSON.stringify({ fileNames, rows })}-->`;
}

export async function parseVendorFile(file: File): Promise<ParsedVendorSheet> {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const text = await file.text();
    return fromGrid(file.name, parseCsv(text));
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const grid = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
  return fromGrid(file.name, grid);
}

// ---------------------------------------------------------------------------
// Deterministic fake market data — demo mode has no Amazon or Keepa behind
// it, so a real uploaded sheet's rows are matched against numbers *derived*
// from the row itself, not looked up. Deterministic (seeded by the row's own
// identity) rather than random, so re-uploading the same file twice — or
// reloading mid-demo — shows the same result instead of a different one.
// ---------------------------------------------------------------------------

function seedFrom(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, deterministic, good enough for demo variety. */
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type EvaluatedRow = VendorRow & {
  asin: string;
  price: number;
  referral: number;
  fulfillment: number;
  netProfit: number;
  margin: number;
  monthlySold: number;
  bucket: "worth_buying" | "not_worth_it" | "unmatched";
  flag: "amazon_on_listing" | "gated" | "lowest_seller_thin" | null;
  flagDetail: string | null;
};

const REFERRAL_FEE_PCT = 0.15;
const FBA_FEE_PCT = 0.1;

export function evaluateVendorRows(rows: VendorRow[]): EvaluatedRow[] {
  return rows.map((row) => {
    const seed = seedFrom(row.upc || row.title);
    const rand = rng(seed);

    // ~4% has no confident catalog match — always finding one for every real
    // row would be its own tell.
    if (rand() < 0.04) {
      return {
        ...row,
        asin: "",
        price: 0,
        referral: 0,
        fulfillment: 0,
        netProfit: 0,
        margin: 0,
        monthlySold: 0,
        bucket: "unmatched",
        flag: null,
        flagDetail: null,
      };
    }

    const asin = `B0${Math.floor(seed % 1e8)
      .toString(36)
      .toUpperCase()
      .padStart(8, "0")}`;

    // Sell price: a markup over cost in a believable range, not a fixed ratio.
    const markup = 2.1 + rand() * 2.4;
    const price = Math.round(row.cost * markup * 100) / 100;

    const gated = rand() < 0.1;
    const amazonOnListing = !gated && rand() < 0.14;
    const lowestSellerThin = !gated && !amazonOnListing && rand() < 0.18;

    const referral = price * REFERRAL_FEE_PCT;
    const fulfillment = price * FBA_FEE_PCT;
    const netProfit = price - referral - fulfillment - row.cost;
    const margin = price > 0 ? netProfit / price : 0;
    const monthlySold = Math.round(20 + rand() * 480);

    let bucket: EvaluatedRow["bucket"] = "worth_buying";
    let flag: EvaluatedRow["flag"] = null;
    let flagDetail: string | null = null;

    if (gated) {
      bucket = "not_worth_it";
      flag = "gated";
      flagDetail = "Not approved to sell this — gated.";
    } else if (netProfit <= 0) {
      bucket = "not_worth_it";
      flagDetail = "Negative or zero margin at the estimated fees.";
    } else if (amazonOnListing) {
      flag = "amazon_on_listing";
      flagDetail = "Amazon itself is on this listing — hard to win the buy box, and a price war leaves no margin.";
    } else if (lowestSellerThin) {
      const left = 1 + Math.floor(rand() * 3);
      flag = "lowest_seller_thin";
      flagDetail = `Lowest seller only has ${left} left at $${(price * 0.9).toFixed(2)} — let them sell through, then price in at $${price.toFixed(2)}.`;
    }

    return {
      ...row,
      asin,
      price,
      referral,
      fulfillment,
      netProfit,
      margin,
      monthlySold,
      bucket,
      flag,
      flagDetail,
    };
  });
}
