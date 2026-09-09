import type { ReactNode } from "react";

/**
 * The subset of Markdown the assistant actually writes, rendered as elements.
 *
 * Hand-written rather than a dependency, for two reasons. The app has four
 * runtime dependencies and none of them are UI, so adding a renderer plus its
 * plugin is a real change to that; and everything here is built as React
 * elements, never an HTML string, so there is no `dangerouslySetInnerHTML` and
 * no sanitiser to keep correct. Model output is untrusted text — it is shaped
 * by whatever is in the seller's own data — and the safest renderer is one
 * that cannot emit markup at all.
 *
 * Covered: paragraphs, `#` headings, `-`/`*`/`1.` lists, `**bold**`, `` `code` ``,
 * and pipe tables. Tables are in because "which SKUs drove the most revenue"
 * is a headline question here and the model answers it with one — a table
 * rendered as a wall of pipes would look broken.
 *
 * Not covered: links (rendered as their text), images, block quotes, nested
 * lists beyond one level, and anything HTML. Each degrades to readable plain
 * text rather than to something wrong.
 */
export function Markdown({ text }: { text: string }) {
  return <div className="space-y-2.5">{blocks(text)}</div>;
}

function blocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    // A table needs its separator row (|---|---|) on the line after the head;
    // without it a line of pipes is just a line of pipes.
    if (isRow(line) && i + 1 < lines.length && isDivider(lines[i + 1])) {
      const head = cells(line);
      const body: string[][] = [];
      i += 2;
      while (i < lines.length && isRow(lines[i])) {
        body.push(cells(lines[i]));
        i += 1;
      }
      out.push(<Table key={out.length} head={head} body={body} />);
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(line);
    if (heading) {
      out.push(
        <p
          key={out.length}
          className="pt-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500"
        >
          {inline(heading[2])}
        </p>,
      );
      i += 1;
      continue;
    }

    if (isBullet(line) || isNumbered(line)) {
      const ordered = isNumbered(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? isNumbered(lines[i]) : isBullet(lines[i]))) {
        items.push(lines[i].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, ""));
        i += 1;
      }
      out.push(
        ordered ? (
          <ol key={out.length} className="ml-4 list-decimal space-y-1">
            {items.map((item, n) => (
              <li key={n}>{inline(item)}</li>
            ))}
          </ol>
        ) : (
          <ul key={out.length} className="ml-4 list-disc space-y-1">
            {items.map((item, n) => (
              <li key={n}>{inline(item)}</li>
            ))}
          </ul>
        ),
      );
      continue;
    }

    // Consecutive non-blank lines are one paragraph, joined with a space —
    // a hard-wrapped sentence should not become three.
    const paragraph: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isBullet(lines[i]) &&
      !isNumbered(lines[i]) &&
      !isRow(lines[i]) &&
      !/^#{1,4}\s/.test(lines[i])
    ) {
      paragraph.push(lines[i].trim());
      i += 1;
    }
    out.push(<p key={out.length}>{inline(paragraph.join(" "))}</p>);
  }

  return out;
}

const isBullet = (line: string) => /^\s*[-*]\s+/.test(line);
const isNumbered = (line: string) => /^\s*\d+\.\s+/.test(line);
const isRow = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isDivider = (line: string) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((cell) => cell.trim());
}

function Table({ head, body }: { head: string[]; body: string[][] }) {
  return (
    // Its own scroller: a wide table must not drag the panel sideways.
    <div className="overflow-x-auto rounded-sm border border-line">
      <table className="w-full border-collapse text-left font-data text-[12px]">
        <thead>
          <tr>
            {head.map((cell, n) => (
              <th
                key={n}
                scope="col"
                className="whitespace-nowrap border-b border-line bg-surface px-2.5 py-1.5 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-500"
              >
                {inline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, n) => (
            <tr key={n}>
              {/* Padded to the header's width: a short row would otherwise
                  shift every cell after it into the wrong column. */}
              {head.map((_, c) => (
                <td
                  key={c}
                  className="border-b border-line/60 px-2.5 py-1.5 align-top text-ink"
                >
                  {inline(row[c] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * `**bold**` and `` `code` `` inside a line of text.
 *
 * One pass over an alternating split, so the two cannot interleave wrongly and
 * an unclosed marker stays visible as itself rather than swallowing the rest
 * of the answer.
 *
 * Exported because the changelog page renders the same two markers and there
 * should be one answer to what a code chip looks like in this product. The
 * block layer above is not shared: it renders every heading as a small caps
 * label, which is right for an answer in a panel and wrong for a page whose
 * headings are its structure.
 */
export function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, n) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={n} className="font-semibold text-ink">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
      return (
        <code
          key={n}
          className="rounded-xs bg-highlight-100 px-1 py-0.5 font-data text-[0.92em] text-primary-600"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
