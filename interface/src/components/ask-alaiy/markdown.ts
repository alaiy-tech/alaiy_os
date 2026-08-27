/**
 * Just enough markdown for what the assistant actually writes: headings,
 * bold, inline code, fenced code, lists, quotes and tables. Ported from the
 * desk's own ask_alaiy.js so every surface renders replies identically.
 *
 * Model output is untrusted text: every line is escaped before any markup is
 * layered on top, never the other way round.
 */

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
}

export function renderMarkdown(text: string): string {
  const lines = String(text).split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: { tag: "ul" | "ol"; items: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraph.length) out.push(`<p>${inline(paragraph.join(" "))}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (list) {
      out.push(
        `<${list.tag}>${list.items.map((item) => `<li>${inline(item)}</li>`).join("")}</${list.tag}>`,
      );
    }
    list = null;
  };
  const flush = () => {
    flushParagraph();
    flushList();
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (!line.trim()) {
      flush();
      continue;
    }

    if (line.trimStart().startsWith("```")) {
      flush();
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) body.push(lines[i++]);
      out.push(`<pre><code>${escapeHtml(body.join("\n"))}</code></pre>`);
      continue;
    }

    if (line.includes("|") && lines[i + 1] && /^\|?[\s:|-]*-[\s:|-]*$/.test(lines[i + 1])) {
      flush();
      const cells = (row: string) =>
        row
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((cell) => cell.trim());
      const head = cells(line);
      i += 2;
      const body: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) body.push(cells(lines[i++]));
      i--;
      out.push(
        '<div class="ask-alaiy-table-wrap"><table><thead><tr>' +
          head.map((cell) => `<th>${inline(cell)}</th>`).join("") +
          "</tr></thead><tbody>" +
          body
            .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join("")}</tr>`)
            .join("") +
          "</tbody></table></div>",
      );
      continue;
    }

    const heading = /^#{1,4}\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      out.push(`<h4>${inline(heading[1])}</h4>`);
      continue;
    }

    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) {
      flush();
      out.push(`<blockquote>${inline(quote[1])}</blockquote>`);
      continue;
    }

    const bullet = /^\s*[-*+]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (bullet || numbered) {
      flushParagraph();
      const tag: "ul" | "ol" = numbered ? "ol" : "ul";
      if (!list || list.tag !== tag) {
        flushList();
        list = { tag, items: [] };
      }
      list.items.push((bullet || numbered)![1]);
      continue;
    }

    flushList();
    paragraph.push(line.trim());
  }

  flush();
  return out.join("");
}

/** The opening fence of a chart block. `json alaiy-chart` and a bare `chart`
 * are both accepted -- the model writes this from a prompt, not a grammar. */
const CHART_FENCE = /^```[ \t]*(?:json[ \t]+)?(?:alaiy-)?chart[ \t]*$/;

export type AnswerSegment =
  | { kind: "prose"; html: string }
  | { kind: "chart"; raw: string };

/**
 * An assistant reply split into prose and chart blocks, in order. A chart
 * cannot live inside `renderMarkdown`'s output -- that is an HTML string
 * going through `dangerouslySetInnerHTML`, and a chart is a React component.
 *
 * An unterminated fence is treated as prose, so a reply truncated mid-spec
 * shows its raw JSON instead of silently losing everything after the fence.
 */
export function splitAnswer(text: string): AnswerSegment[] {
  const source = String(text ?? "");
  if (!source.includes("```")) return [{ kind: "prose", html: renderMarkdown(source) }];

  const lines = source.split("\n");
  const segments: AnswerSegment[] = [];
  let prose: string[] = [];

  const flushProse = () => {
    if (prose.join("").trim()) segments.push({ kind: "prose", html: renderMarkdown(prose.join("\n")) });
    prose = [];
  };

  for (let i = 0; i < lines.length; i++) {
    if (!CHART_FENCE.test(lines[i].trim())) {
      prose.push(lines[i]);
      continue;
    }

    const body: string[] = [];
    let j = i + 1;
    while (j < lines.length && !lines[j].trimStart().startsWith("```")) body.push(lines[j++]);
    if (j >= lines.length) {
      prose.push(lines[i]);
      continue;
    }

    flushProse();
    segments.push({ kind: "chart", raw: body.join("\n").trim() });
    i = j;
  }

  flushProse();
  return segments;
}
