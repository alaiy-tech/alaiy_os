import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * CHANGE_LOG.md, read as structured releases.
 *
 * The file stays the source of truth — it is what a developer reads in the
 * repo and what `git log` is reconciled against — so `/changelog` parses it
 * rather than keeping a second copy of the same prose in a TS module. Two
 * copies would drift the first time someone edited only one.
 *
 * The parse is narrow on purpose. It understands exactly the shape the file is
 * written in, and a line it does not recognise becomes a paragraph rather than
 * being dropped: a malformed release should look untidy on the page, never
 * disappear from it.
 */

export type Block =
  /** A bolded change title — the thing that shipped. */
  | { kind: "change"; title: string }
  | { kind: "list"; items: string[] }
  | { kind: "para"; text: string };

export type Release = {
  version: string;
  /** ISO `YYYY-MM-DD`, as the file writes it. */
  date: string;
  blocks: Block[];
};

export type Changelog = {
  /** The opening line, above the first release. */
  summary: string;
  /**
   * Any non-release `##` section — "How to read this" and the like. Collected
   * rather than skipped, so prose added to the file cannot vanish from the
   * page just because it is not a version.
   */
  notes: Block[];
  releases: Release[];
};

const RELEASE = /^##\s+(\S+)\s+—\s+(\d{4}-\d{2}-\d{2})\s*$/;
const CHANGE = /^\*\*(.+?)\*\*\s*$/;
const BULLET = /^-\s+/;

export async function readChangelog(): Promise<Changelog> {
  // Read from the project root rather than bundled as a module: this runs at
  // build time only (the page is force-static), so there is no runtime file
  // access to keep working in a deployed server.
  const source = await readFile(path.join(process.cwd(), "CHANGE_LOG.md"), "utf8");
  return parseChangelog(source);
}

export function parseChangelog(source: string): Changelog {
  const lines = source.replace(/\r\n/g, "\n").split("\n");

  let summary = "";
  const notes: Block[] = [];
  const releases: Release[] = [];

  // Where the lines being read belong. Everything before the first `##` is the
  // summary; a version heading opens a release and every block after it
  // belongs to that release; any other `##` collects into `notes`.
  let target: Block[] | null = null;

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim() || line.trim() === "---" || line.startsWith("# ")) {
      i += 1;
      continue;
    }

    const heading = RELEASE.exec(line);
    if (heading) {
      const release: Release = { version: heading[1], date: heading[2], blocks: [] };
      releases.push(release);
      target = release.blocks;
      i += 1;
      continue;
    }

    if (line.startsWith("## ")) {
      target = notes;
      i += 1;
      continue;
    }

    if (target) {
      const change = CHANGE.exec(line);
      if (change) {
        target.push({ kind: "change", title: change[1] });
        i += 1;
        continue;
      }

      if (BULLET.test(line)) {
        const items: string[] = [];
        while (i < lines.length && (BULLET.test(lines[i]) || isContinuation(lines[i], items))) {
          if (BULLET.test(lines[i])) items.push(lines[i].replace(BULLET, "").trim());
          // A bullet hard-wrapped across lines is one item: the file is wrapped
          // at 90 columns, so nearly every bullet has continuations.
          else items[items.length - 1] += ` ${lines[i].trim()}`;
          i += 1;
        }
        target.push({ kind: "list", items });
        continue;
      }
    }

    const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    const text = paragraph.join(" ");
    if (target) target.push({ kind: "para", text });
    else summary = summary ? `${summary} ${text}` : text;
  }

  return { summary, notes, releases };
}

/** An indented, non-blank line under an open bullet continues it. */
function isContinuation(line: string, items: string[]): boolean {
  return items.length > 0 && /^\s+\S/.test(line);
}

function isBlockStart(line: string): boolean {
  return line.startsWith("#") || line.trim() === "---" || BULLET.test(line) || CHANGE.test(line);
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * `2026-09-08` as `8 September 2026`.
 *
 * Formatted from the string's own parts rather than through `Date`, so the day
 * shown is the day the file names — a `new Date("2026-09-08")` is midnight UTC
 * and renders as the 7th anywhere west of it.
 */
export function formatReleaseDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  const name = MONTHS[Number(month) - 1];
  if (!name) return iso;
  return `${Number(day)} ${name} ${year}`;
}
