/**
 * Resolves `theme_mode` to light/dark before hydration, so `.dark`/
 * `colorScheme` are correct on first paint. `RootLayout` already renders
 * every preference's `data-*` attribute from SQLite (the only source of
 * truth) - this script never reads or writes those. It only handles what
 * SSR genuinely can't know: whether "system" currently means light or dark.
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

  /* biome-ignore lint/security/noDangerouslySetInnerHtml: required for pre-hydration boot script */
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
