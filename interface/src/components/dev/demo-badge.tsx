import { DEMO_MODE } from "@/lib/dev/demo";

/**
 * Says, on every screen, that none of this is real.
 *
 * The individual `SampleBanner` is for one tab whose endpoint is still stubbed
 * while the rest of the app is live — a genuinely alarming thing that needs the
 * alert hue. Here the whole app is fabricated and the reader already knows,
 * because they started it themselves with a flag. So this is a marker, not a
 * warning: it has to survive a screenshot pasted into a PR, and it must not
 * make the screen it is marking harder to judge.
 *
 * Fixed and `pointer-events-none`, so it takes no space in the layout being
 * looked at and cannot get in the way of anything under it. Renders nothing at
 * all outside demo mode, which in a production build is every time — the
 * constant folds to `false` at build time and this collapses with it.
 */
export function DemoBadge() {
  if (!DEMO_MODE) return null;

  return (
    <p
      role="status"
      className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-warn/40 bg-warn-soft px-3 py-1 text-[11px] font-semibold tracking-wide text-warn-ink shadow-sm"
    >
      Demo data — nothing here is real
    </p>
  );
}
