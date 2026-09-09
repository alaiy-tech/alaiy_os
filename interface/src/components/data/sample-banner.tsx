/**
 * Says out loud that the figures below are fabricated.
 *
 * Rendered from the payload's own `sample` flag rather than from a constant,
 * so it disappears the day the real endpoint answers — nobody has to remember
 * to take it out, which is exactly how placeholder data ends up shipped as
 * though it were real.
 *
 * The alert hue, not the accent. This is not a helpful note about a feature in
 * progress; it is a warning that every number on the screen is invented, and a
 * seller or anyone being shown the screen has to be unable to miss it.
 */
export function SampleBanner({ what }: { what: string }) {
  return (
    <p
      role="status"
      className="rounded-sm border border-alert/40 bg-alert-soft px-3.5 py-2.5 text-[13px] text-alert-ink"
    >
      <span className="font-semibold">Sample data.</span> {what} isn&rsquo;t
      connected to your channels yet, so every figure and product below is made
      up — do not act on any of it. Real numbers appear here once the sync lands.
    </p>
  );
}
