import Script from "next/script";

/**
 * Resolves `theme_mode` to light/dark before hydration, so `.dark`/
 * `colorScheme` are correct on first paint. `RootLayout` already renders
 * every preference's `data-*` attribute from SQLite (the only source of
 * truth) - this script never reads or writes those. It only handles what
 * SSR genuinely can't know: whether "system" currently means light or dark.
 *
 * Uses `next/script`'s `beforeInteractive` strategy (must live in the root
 * layout - which it does), not a raw `<script>` tag: React 19 warns that a
 * plain `<script>` rendered as component output never re-executes on a
 * client-side re-render, which is exactly wrong for the "must run once,
 * synchronously, before first paint" contract this needs. `beforeInteractive`
 * is Next's own supported mechanism for that contract - it inlines the
 * script into the initial HTML response ahead of hydration.
 */
export function ThemeBootScript() {
  const code = `
    (function () {
      try {
        var root = document.documentElement;
        var mode = root.getAttribute("data-theme-mode");
        var resolvedMode =
          mode === "system" && window.matchMedia
            ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
            : mode === "dark"
              ? "dark"
              : "light";

        root.classList.toggle("dark", resolvedMode === "dark");
        root.style.colorScheme = resolvedMode;
      } catch (e) {
        console.warn("ThemeBootScript error:", e);
      }
    })();
  `;

  return (
    <Script id="theme-boot" strategy="beforeInteractive">
      {code}
    </Script>
  );
}
