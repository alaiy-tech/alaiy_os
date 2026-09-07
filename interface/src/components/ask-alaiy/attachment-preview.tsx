"use client";

import { createContext, type ReactNode, useCallback, useContext, useEffect, useState } from "react";

import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  FileText,
  Image as ImageIcon,
  Loader2,
  Presentation,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { type FilePreview, previewChatFile, type SheetPreview } from "@/lib/frappe/chat";
import { cn } from "@/lib/utils";

import { SlideDeck } from "./slide-deck";

/** The minimum an attachment needs to be viewable. Deliberately its own shape
 * rather than ChatAttachmentMeta or PendingAttachment: a chip renders either of
 * those, and both can reach this. */
export interface PreviewFile {
  file_name: string;
  file_url: string;
  file_size?: number;
  /** Set on generated artifacts ("xlsx" | "csv" | "pdf"); absent on uploads. */
  format?: string;
}

/** Text is fetched whole to render it, so a large file is left to the download
 * button rather than pulled into memory to be shown in a scroll box. */
const TEXT_PREVIEW_MAX_BYTES = 512 * 1024;
/** Rows per request. The panel pages, so this bounds a response, not the file. */
const SHEET_PAGE_ROWS = 200;

type PreviewKind = "image" | "pdf" | "sheet" | "slides" | "doc" | "delimited" | "text";

const IMAGE_EXT = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif", "bmp", "ico"]);
const SHEET_EXT = new Set(["xlsx", "xlsm"]);
const DELIMITED_EXT = new Set(["csv", "tsv"]);

function extensionOf(fileName: string): string {
  const at = fileName.lastIndexOf(".");
  return at === -1 ? "" : fileName.slice(at + 1).toLowerCase();
}

/**
 * Text is the default, not a listed set, so nothing an upload is allowed to be
 * falls through to "no preview". Every extension ATTACHMENT_ACCEPT permits is
 * either handled explicitly above or is text (.ini, .cfg, .toml, .htm and
 * friends), and a stray binary shows as mojibake rather than an empty panel --
 * still enough to tell you it's the wrong file, with Download right there.
 */
export function previewKindOf(file: PreviewFile): PreviewKind {
  const ext = extensionOf(file.file_name) || (file.format ?? "").toLowerCase();
  if (IMAGE_EXT.has(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (SHEET_EXT.has(ext)) return "sheet";
  if (ext === "pptx") return "slides";
  if (ext === "docx") return "doc";
  if (DELIMITED_EXT.has(ext)) return "delimited";
  return "text";
}

function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** RFC 4180 enough for what the assistant emits: quoted fields, embedded
 * delimiters and newlines, and "" as an escaped quote. */
function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      // Swallow the \n of a \r\n pair rather than emitting a blank row.
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell !== ""));
}

function Note({ children }: { readonly children: ReactNode }) {
  return <p className="text-muted-foreground text-sm">{children}</p>;
}

function Failed({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-muted-foreground text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-destructive" />
      <span>{children}</span>
    </div>
  );
}

function Loading({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground text-sm">
      <Loader2 className="size-4 animate-spin" />
      {children}
    </div>
  );
}

function DataTable({ rows }: { readonly rows: string[][] }) {
  if (!rows.length) return <Note>This file is empty.</Note>;

  const [header, ...body] = rows;
  return (
    // The table may be wider than the panel and scrolls on its own; the panel
    // itself must never scroll sideways.
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full border-collapse text-xs">
        <thead className="bg-muted/50">
          <tr>
            {header.map((cell, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns have no identity beyond position
              <th key={i} className="whitespace-nowrap border-b px-2.5 py-1.5 text-left font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((cells, r) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: rows are a positional snapshot
            <tr key={r} className="even:bg-muted/20">
              {cells.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: same
                <td key={c} className="border-b px-2.5 py-1.5 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TextBody({ file }: { readonly file: PreviewFile }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; text: string; message?: string }>({
    status: "loading",
    text: "",
  });

  useEffect(() => {
    if (file.file_size !== undefined && file.file_size > TEXT_PREVIEW_MAX_BYTES) {
      setState({ status: "error", text: "", message: "This file is too large to show here. Download it to open it." });
      return;
    }

    // A file swapped mid-flight (click one chip, then another) must not have
    // the slower response overwrite the newer one.
    let live = true;
    setState({ status: "loading", text: "" });

    // Same-origin: Next proxies /private/files and /files through to Frappe
    // (see app/private/files/[...path]/route.ts), so the session cookie rides
    // along and a read needs no CSRF token.
    fetch(file.file_url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Could not load this file (${res.status}).`);
        return res.text();
      })
      .then((text) => {
        if (live) setState({ status: "ready", text });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({
          status: "error",
          text: "",
          message: error instanceof Error ? error.message : "Could not load this file.",
        });
      });

    return () => {
      live = false;
    };
  }, [file.file_url, file.file_size]);

  if (state.status === "loading") return <Loading>Loading…</Loading>;
  if (state.status === "error") return <Failed>{state.message}</Failed>;

  if (previewKindOf(file) === "delimited") {
    return <DataTable rows={parseDelimited(state.text, extensionOf(file.file_name) === "tsv" ? "\t" : ",")} />;
  }

  return (
    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 font-mono text-xs">
      {state.text}
    </pre>
  );
}

/** xlsx/pptx/docx: parsed by `alaiy_os.api.chat.preview_file`. */
function OfficeBody({ file }: { readonly file: PreviewFile }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; data?: FilePreview; message?: string }>({
    status: "loading",
  });
  // No reset-on-file-change effect needed: the pane keys this component by
  // file_url, so a different file remounts it with fresh state.
  const [sheet, setSheet] = useState<string | undefined>(undefined);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    let live = true;
    setState({ status: "loading" });

    previewChatFile({ fileUrl: file.file_url, sheet, offset, limit: SHEET_PAGE_ROWS })
      .then((data) => {
        if (live) setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (!live) return;
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Could not read this file.",
        });
      });

    return () => {
      live = false;
    };
  }, [file.file_url, sheet, offset]);

  if (state.status === "loading") return <Loading>Reading file…</Loading>;
  if (state.status === "error" || !state.data) return <Failed>{state.message ?? "Could not read this file."}</Failed>;

  const data = state.data;

  if (data.kind === "slides") return <SlideDeck slides={data.slides} ratio={data.ratio} images={data.images} />;

  if (data.kind === "doc") {
    return (
      <div className="space-y-2">
        {data.blocks.map((block, i) => {
          if (block.type === "heading") {
            return (
              // biome-ignore lint/suspicious/noArrayIndexKey: document order is the identity
              <p key={i} className={cn("font-semibold", block.level <= 1 ? "text-base" : "text-sm")}>
                {block.text}
              </p>
            );
          }
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: same
            <p key={i} className={cn("text-sm", block.type === "list" && "ml-4 list-item list-disc")}>
              {block.text}
            </p>
          );
        })}
      </div>
    );
  }

  return <SheetView data={data} offset={offset} onOffset={setOffset} onSheet={setSheet} />;
}

function SheetView({
  data,
  offset,
  onOffset,
  onSheet,
}: {
  readonly data: SheetPreview;
  readonly offset: number;
  readonly onOffset: (next: number) => void;
  readonly onSheet: (next: string) => void;
}) {
  const first = data.total_rows === 0 ? 0 : offset + 1;
  const last = Math.min(offset + data.rows.length, data.total_rows);
  const hasPaging = data.total_rows > data.rows.length;

  return (
    <div className="space-y-2">
      {data.sheets.length > 1 && (
        <div className="flex flex-wrap gap-1">
          {data.sheets.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => {
                onSheet(name);
                onOffset(0); // row 900 of the old sheet means nothing in the new one
              }}
              className={cn(
                "rounded-md border px-2 py-1 text-xs",
                name === data.sheet ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted",
              )}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <DataTable rows={data.rows} />

      {hasPaging && (
        <div className="flex items-center justify-between text-muted-foreground text-xs">
          <span>
            Rows {first}–{last} of {data.total_rows}
          </span>
          <div className="flex gap-1">
            <Button
              size="icon-xs"
              variant="outline"
              disabled={offset === 0}
              onClick={() => onOffset(Math.max(0, offset - SHEET_PAGE_ROWS))}
              aria-label="Previous rows"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
            <Button
              size="icon-xs"
              variant="outline"
              disabled={last >= data.total_rows}
              onClick={() => onOffset(offset + SHEET_PAGE_ROWS)}
              aria-label="Next rows"
            >
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function PreviewBody({ file }: { readonly file: PreviewFile }) {
  const kind = previewKindOf(file);

  if (kind === "image") {
    // biome-ignore lint/performance/noImgElement: next/image needs a configured loader and known dimensions; this is an arbitrary user upload proxied from Frappe, so a plain img is the honest option
    return <img src={file.file_url} alt={file.file_name} className="mx-auto max-w-full rounded-md border" />;
  }

  // The browser's own PDF viewer: scrolling, zoom, print and search for free,
  // and already a complete rendering of the file.
  if (kind === "pdf") {
    return <iframe src={file.file_url} title={file.file_name} className="size-full rounded-md border" />;
  }

  if (kind === "sheet" || kind === "slides" || kind === "doc") return <OfficeBody file={file} />;

  return <TextBody file={file} />;
}

/**
 * The file panel itself, rendered *inline* by whichever surface is showing it
 * rather than as an overlay -- that is the whole point: the conversation stays
 * visible and usable beside it.
 */
const KIND_ICON = {
  sheet: FileSpreadsheet,
  delimited: FileSpreadsheet,
  slides: Presentation,
  doc: FileText,
  pdf: FileText,
  image: ImageIcon,
  text: FileText,
} as const;

export function AttachmentPreviewPane({ className }: { readonly className?: string }) {
  const ctx = useAttachmentPreview();
  if (!ctx?.file) return null;

  const { file, close } = ctx;
  const kind = previewKindOf(file);
  const Icon = KIND_ICON[kind];
  const meta = [(file.format ?? extensionOf(file.file_name)).toUpperCase(), formatBytes(file.file_size)]
    .filter(Boolean)
    .join(" · ");

  return (
    <aside className={cn("flex min-h-0 flex-col overflow-hidden rounded-xl border bg-card shadow-sm", className)}>
      <header className="flex flex-none items-center gap-2.5 border-b bg-muted/30 px-3 py-2">
        <span className="flex size-8 flex-none items-center justify-center rounded-lg bg-background text-muted-foreground ring-1 ring-border">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate font-medium text-sm" title={file.file_name}>
            {file.file_name}
          </p>
          {meta && <p className="text-[11px] text-muted-foreground tabular-nums">{meta}</p>}
        </div>
        <Button asChild size="icon-sm" variant="ghost" title="Download">
          <a href={file.file_url} download={file.file_name} aria-label={`Download ${file.file_name}`}>
            <Download className="size-4" />
          </a>
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={close} aria-label="Close file" title="Close">
          <X className="size-4" />
        </Button>
      </header>

      {/* A PDF fills the panel and scrolls in its own viewer, so the wrapper
          must not add a second scrollbar around it. Everything else scrolls
          here. */}
      <div className={cn("min-h-0 flex-1", kind === "pdf" ? "overflow-hidden p-2" : "overflow-y-auto p-3")}>
        {/* Keyed so switching files tears the old body down rather than
            letting its in-flight fetch settle into the new one's state. */}
        <PreviewBody key={file.file_url} file={file} />
      </div>
    </aside>
  );
}

interface AttachmentPreviewContextValue {
  file: PreviewFile | null;
  /** Open the panel on this file. A file with no URL is a no-op. */
  preview: (file: PreviewFile) => void;
  close: () => void;
}

const AttachmentPreviewContext = createContext<AttachmentPreviewContextValue | null>(null);

/**
 * Holds *which* file is open for the whole /os tree -- and nothing else.
 *
 * It renders no UI on purpose. Both chat surfaces show the same AttachmentChip
 * (the floating drawer and the /os/ask-alaiy page), so the selection has to be
 * shared, but the panel has to be laid out *inside* each surface to sit beside
 * the conversation instead of over it. So: state here, `AttachmentPreviewPane`
 * there. Sharing the state is also what lets a file opened in the drawer still
 * be open after navigating to the full page.
 */
export function AttachmentPreviewProvider({ children }: { readonly children: ReactNode }) {
  const [file, setFile] = useState<PreviewFile | null>(null);

  const preview = useCallback((next: PreviewFile) => {
    if (!next.file_url) return;
    setFile(next);
  }, []);
  const close = useCallback(() => setFile(null), []);

  return (
    <AttachmentPreviewContext.Provider value={{ file, preview, close }}>{children}</AttachmentPreviewContext.Provider>
  );
}

/** Returns null outside the provider so a chip rendered somewhere without one
 * degrades to download-only instead of throwing. */
export function useAttachmentPreview(): AttachmentPreviewContextValue | null {
  return useContext(AttachmentPreviewContext);
}
