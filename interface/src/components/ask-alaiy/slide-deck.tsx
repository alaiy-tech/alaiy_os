"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ChevronLeft, ChevronRight, Maximize2, Minimize2, StickyNote } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { Button } from "@/components/ui/button";
import type { Slide, SlideChart } from "@/lib/frappe/chat";
import { cn } from "@/lib/utils";

// The deck's own palette, from chat/presentations.py (_accent / _accent_light /
// _ink). Literal, not themed: these are the colours actually written into the
// .pptx, so a rendered slide matches the file someone downloads.
const ACCENT = "#1F4E79";
const ACCENT_LIGHT = "#EAF1FA";
const INK = "#222222";

/** A spread of the accent, since a deck's chart is drawn in the deck's colours
 * rather than the app's theme. */
const SERIES_COLORS = [ACCENT, "#2E74A8", "#5B9BD5", "#9DC3E6", "#C9E0F5"];

function SlideChartView({ chart }: { readonly chart: SlideChart }) {
  if (!chart.categories.length || !chart.series.length) {
    return (
      <p className="text-[0.7em] italic" style={{ color: INK, opacity: 0.6 }}>
        This slide has a chart.
      </p>
    );
  }

  // recharts wants a row per category with a key per series.
  const data = chart.categories.map((category, i) => {
    const row: Record<string, string | number | null> = { category };
    for (const series of chart.series) {
      row[series.name || "value"] = series.points[i] ?? null;
    }
    return row;
  });

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#D9E4F0" vertical={false} />
        <XAxis dataKey="category" tick={{ fontSize: 11, fill: INK }} stroke="#B9CBDD" />
        <YAxis tick={{ fontSize: 11, fill: INK }} stroke="#B9CBDD" width={48} />
        <Tooltip
          contentStyle={{
            background: "#FFFFFF",
            border: `1px solid ${ACCENT_LIGHT}`,
            borderRadius: 8,
            fontSize: 12,
            color: INK,
          }}
        />
        {chart.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} />}
        {chart.series.map((series, i) => (
          <Bar
            key={series.name || i}
            dataKey={series.name || "value"}
            fill={SERIES_COLORS[i % SERIES_COLORS.length]}
            radius={[3, 3, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Header row filled with the accent and reversed out in white, matching
 * `_add_table_slide`. */
function SlideTable({ rows }: { readonly rows: string[][] }) {
  const [header, ...body] = rows;
  return (
    <div className="overflow-auto">
      <table className="w-full border-collapse text-[0.62em]">
        <thead>
          <tr style={{ background: ACCENT }}>
            {header?.map((cell, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: columns have no identity beyond position
              <th key={i} className="whitespace-nowrap px-[0.7em] py-[0.5em] text-left font-semibold text-white">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((cells, r) => (
            <tr
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are a positional snapshot
              key={r}
              style={{ background: r % 2 ? ACCENT_LIGHT : "transparent", color: INK }}
            >
              {cells.map((cell, c) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: same
                <td key={c} className="px-[0.7em] py-[0.45em] align-top">
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

/**
 * One slide, drawn to fill whatever stage it's given.
 *
 * The palette and geometry are the deck's own, taken from
 * `chat/presentations.py`: a 0.1" accent strip across the top, a 28pt bold
 * heading in accent navy, 20pt ink body copy, and a table header filled with
 * the accent. Deliberately *not* themed off the app's tokens -- a slide is a
 * document, and a document should look like itself in dark mode for the same
 * reason a PDF stays white.
 *
 * Type scale is in `em` against a font-size the stage sets from its own width,
 * so one layout serves both a 400px panel and a full display rather than being
 * laid out twice.
 */
function SlideFace({ slide }: { readonly slide: Slide }) {
  return (
    <div className="relative flex h-full w-full flex-col overflow-hidden bg-white">
      {/* _add_accent_bar: full width, 0.1" of a 7.5" slide. */}
      <div className="h-[1.33%] flex-none" style={{ background: ACCENT }} />

      <div className="flex min-h-0 flex-1 flex-col gap-[0.5em] px-[1.15em] py-[0.8em]">
        {slide.title && (
          <h3 className="font-bold text-[1.4em] leading-tight tracking-tight" style={{ color: ACCENT }}>
            {slide.title}
          </h3>
        )}

        {slide.bullets.length > 0 && (
          <ul className="ml-[0.9em] list-disc space-y-[0.3em] text-[1em] leading-snug" style={{ color: INK }}>
            {slide.bullets.map((line, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: bullet text repeats across slides
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}

        {slide.table && (
          <div className="min-h-0 flex-1 overflow-auto">
            <SlideTable rows={slide.table} />
          </div>
        )}

        {slide.chart && (
          <div className="min-h-0 flex-1">
            <SlideChartView chart={slide.chart} />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * A deck viewer: one slide at a time, arrow-key navigation, and real
 * fullscreen so it can actually be presented from.
 *
 * The slides are rebuilt from the file's content rather than rasterised from
 * the original (that needs LibreOffice on the server -- see
 * ask-alaiy-file-viewer.md §5). Swapping in real slide images later means
 * replacing SlideFace and keeping everything here.
 */
export function SlideDeck({
  slides,
  ratio,
  images,
}: {
  readonly slides: Slide[];
  readonly ratio: number | null;
  /** Rendered slide images, when the server could produce them. */
  readonly images?: string[] | null;
}) {
  const [at, setAt] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  // Slide type scales off the stage's own width, so one layout serves both the
  // panel and a full display.
  const [stageWidth, setStageWidth] = useState(0);

  const total = slides.length;
  const go = useCallback((next: number) => setAt(Math.min(total - 1, Math.max(0, next))), [total]);

  useEffect(() => {
    const el = stageRef.current;
    if (el) {
      const observer = new ResizeObserver(([entry]) => setStageWidth(entry.contentRect.width));
      observer.observe(el);
      return () => observer.disconnect();
    }
  }, []);

  // The browser owns Escape and the F11-style exit, so track its state rather
  // than assuming ours is authoritative.
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void rootRef.current?.requestFullscreen();
    }
  }, []);

  // Keys are bound on the deck itself, not the document: the composer is a
  // textarea a keypress away, and a global ArrowRight must not skip a slide
  // while someone is typing. In fullscreen the deck holds focus anyway.
  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      switch (event.key) {
        case "ArrowRight":
        case "ArrowDown":
        case "PageDown":
        case " ":
          go(at + 1);
          break;
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          go(at - 1);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(total - 1);
          break;
        case "f":
          toggleFullscreen();
          break;
        default:
          return;
      }
      // Only for keys actually handled: Tab, typing and shortcuts must pass.
      event.preventDefault();
    },
    [at, go, total, toggleFullscreen],
  );

  if (!total) return <p className="text-muted-foreground text-sm">This deck has no slides.</p>;

  const slide = slides[at];
  const aspect = ratio && ratio > 0 ? ratio : 16 / 9;
  // Only trust the images if there's one per slide: a partial render must not
  // silently drop the tail of a deck.
  const image = images && images.length === total ? images[at] : null;

  return (
    // role="region" + aria-roledescription is the APG carousel pattern, and a
    // region legitimately takes tabIndex: the deck has to be focusable to
    // receive the arrow keys that move between slides.
    <section
      ref={rootRef}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable on purpose -- this is the keyboard surface for slide navigation
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-roledescription="carousel"
      aria-label="Presentation"
      className={cn(
        "flex flex-col gap-2 outline-none",
        // In fullscreen this element *is* the screen, so it has to paint its
        // own background and centre the stage in the space.
        fullscreen && "h-screen w-screen justify-center bg-background p-6",
      )}
    >
      <div
        ref={stageRef}
        style={{ aspectRatio: aspect, fontSize: stageWidth ? `${Math.max(9, stageWidth / 42)}px` : undefined }}
        className={cn(
          "w-full overflow-hidden rounded-lg border bg-white shadow-sm",
          fullscreen && "mx-auto h-auto max-h-full w-auto max-w-full",
        )}
      >
        {image ? (
          // The real slide, rendered by LibreOffice from the file itself.
          // Eager, and the neighbours are prefetched below, so stepping
          // through a deck doesn't flash white on every slide.
          // biome-ignore lint/performance/noImgElement: a Frappe file URL is not a configured next/image loader source
          <img
            src={image}
            alt={slide?.title ? `Slide ${at + 1}: ${slide.title}` : `Slide ${at + 1}`}
            className="size-full object-contain"
          />
        ) : (
          <SlideFace slide={slide} />
        )}
      </div>

      {/* Warm the slides either side so navigation is instant. */}
      {images && (
        <div aria-hidden className="hidden">
          {[images[at - 1], images[at + 1]].filter(Boolean).map((src) => (
            // biome-ignore lint/performance/noImgElement: prefetch only, never painted
            <img key={src} src={src} alt="" />
          ))}
        </div>
      )}

      <div className="flex flex-none items-center gap-2">
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => go(at - 1)}
          disabled={at === 0}
          aria-label="Previous slide"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="outline"
          onClick={() => go(at + 1)}
          disabled={at === total - 1}
          aria-label="Next slide"
        >
          <ChevronRight className="size-4" />
        </Button>

        <span className="text-muted-foreground text-xs tabular-nums">
          {at + 1} / {total}
        </span>

        <div className="ml-auto flex items-center gap-1">
          {slide.notes && (
            <Button
              size="icon-sm"
              variant={showNotes ? "secondary" : "ghost"}
              onClick={() => setShowNotes((v) => !v)}
              aria-label="Speaker notes"
              title="Speaker notes"
            >
              <StickyNote className="size-4" />
            </Button>
          )}
          <Button
            size="icon-sm"
            variant="ghost"
            onClick={toggleFullscreen}
            aria-label={fullscreen ? "Exit full screen" : "Present full screen"}
            title={fullscreen ? "Exit full screen" : "Present full screen (f)"}
          >
            {fullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
        </div>
      </div>

      {showNotes && slide.notes && (
        <p className="flex-none rounded-md border bg-muted/30 p-2.5 text-muted-foreground text-xs leading-relaxed">
          {slide.notes}
        </p>
      )}

      {/* A strip rather than dots: on a 30-slide deck dots say nothing, and
          the numbers are what someone jumping around actually aims at. */}
      {!fullscreen && total > 1 && (
        <div className="flex flex-none gap-1 overflow-x-auto pb-1">
          {slides.map((s, i) => (
            <button
              key={s.index}
              type="button"
              onClick={() => go(i)}
              title={s.title || `Slide ${i + 1}`}
              className={cn(
                "size-6 flex-none rounded border text-[10px] tabular-nums",
                i === at ? "border-primary bg-primary/10 font-medium" : "text-muted-foreground hover:bg-muted",
              )}
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
