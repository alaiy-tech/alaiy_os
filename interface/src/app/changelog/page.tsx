import type { Metadata } from "next";
import Link from "next/link";
import { inline } from "@/components/ask/markdown";
import { Logo, Pill } from "@/components/ui";
import { formatReleaseDate, readChangelog, type Block, type Release } from "@/lib/changelog";

/**
 * The changelog, at /changelog.
 *
 * Public and outside the `(app)` group: it is a page about the product rather
 * than a view of a seller's data, so it gets neither the rail nor the docked
 * Ask panel, and anyone can read it signed out. `src/proxy.ts` lists it
 * alongside `/` and `/start` for that reason.
 *
 * Prerendered at build. CHANGE_LOG.md only changes when a commit changes it,
 * which means a rebuild anyway, so there is nothing for a revalidate window to
 * catch and no reason to read the file at request time.
 */
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Changelog — Alaiy",
  description: "What shipped in Alaiy, release by release.",
};

export default async function ChangelogPage() {
  const { summary, notes, releases } = await readChangelog();
  const latest = releases[0];

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 sm:px-8 sm:py-16">
      <header className="border-b border-line pb-10">
        <Link href="/" className="inline-flex" aria-label="Alaiy home">
          <Logo />
        </Link>

        <div className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-2">
          <h1 className="text-display-lg">Changelog</h1>
          {latest && <Pill tone="accent">Latest {latest.version}</Pill>}
        </div>

        {summary && <p className="mt-4 max-w-2xl text-[15px] text-muted">{summary}</p>}

        {notes.length > 0 && (
          // Native disclosure, so the page needs no client component to hold a
          // boolean. Closed by default: the releases are what someone came for
          // and this is what they check once. Renders only when the file
          // actually carries a note section.
          <details className="mt-6 max-w-2xl">
            <summary className="cursor-pointer text-[13px] font-medium text-primary-500 underline decoration-line underline-offset-4 hover:text-primary-600">
              About this log
            </summary>
            <div className="mt-4 space-y-3 rounded-sm border border-line bg-surface p-5 text-[13px] leading-relaxed text-muted">
              {notes.map((block, n) => (
                <BlockBody key={n} block={block} />
              ))}
            </div>
          </details>
        )}
      </header>

      <div className="divide-y divide-line">
        {releases.map((release) => (
          <ReleaseSection key={release.version} release={release} />
        ))}
      </div>
    </div>
  );
}

function ReleaseSection({ release }: { release: Release }) {
  return (
    <section
      // Anchored, so a single release can be linked to directly.
      id={`v${release.version}`}
      className="grid gap-4 py-10 sm:grid-cols-[9.5rem_1fr] sm:gap-10"
    >
      <div className="sm:sticky sm:top-10 sm:self-start">
        <h2 className="text-display-md">{release.version}</h2>
        <p className="mt-1 text-[13px] text-muted">{formatReleaseDate(release.date)}</p>
      </div>

      <div className="min-w-0 space-y-5 text-[14px] leading-relaxed text-muted">
        {release.blocks.map((block, n) => (
          <BlockBody key={n} block={block} />
        ))}
      </div>
    </section>
  );
}

function BlockBody({ block }: { block: Block }) {
  if (block.kind === "change") {
    return (
      <h3 className="text-display-sm text-ink first:mt-0">{inline(block.title)}</h3>
    );
  }

  if (block.kind === "list") {
    return (
      <ul className="ml-5 list-disc space-y-2.5">
        {block.items.map((item, n) => (
          <li key={n} className="pl-1">
            {inline(item)}
          </li>
        ))}
      </ul>
    );
  }

  return <p>{inline(block.text)}</p>;
}
