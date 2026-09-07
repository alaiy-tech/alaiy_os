/** Collapsible walkthrough shown under each connector. */
export function VideoHelper({
  title,
  src,
  poster,
}: {
  title: string;
  src: string;
  poster?: string;
}) {
  return (
    <details className="group rounded-sm border border-line bg-surface">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3.5 py-2.5 text-[12px] font-semibold uppercase tracking-[0.06em] text-primary-600">
        <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden fill="currentColor">
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 5.3l4.2 2.4a.35.35 0 0 1 0 .6L6.5 10.7a.35.35 0 0 1-.5-.3V5.6a.35.35 0 0 1 .5-.3Z" />
        </svg>
        {title}
        <span className="ml-auto text-muted transition-transform group-open:rotate-180">
          ⌄
        </span>
      </summary>
      <div className="px-3.5 pb-3.5">
        <video
          controls
          preload="none"
          poster={poster}
          src={src}
          className="w-full rounded-sm border border-line bg-primary-900"
        />
      </div>
    </details>
  );
}
