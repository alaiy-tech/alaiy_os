/**
 * How the seller has arranged the shell: whether the rail and Ask Alaiy are
 * open, and how wide each of them is.
 *
 * Kept in a cookie rather than `localStorage` because the shell is
 * server-rendered. The rail and the Ask panel are in the first paint, so a
 * preference the server cannot read is a preference the seller watches get
 * applied — the rail arrives full width and then jumps shut. `next/headers`
 * reads this on the way in and the widths are already right in the HTML.
 *
 * Shared by both sides of the wire, so nothing in here may import
 * `server-only` or touch `document`.
 */

export const SHELL_COOKIE = "alaiy_shell";

/** A year. This is a preference, not a session. */
export const SHELL_COOKIE_MAX_AGE = 365 * 24 * 60 * 60;

/* The bounds each panel may be dragged between. The defaults are not here:
   they live in `globals.css` as the `rail` and `ask-panel` spacing tokens,
   because the Ask default widens at xl and a number duplicated in TypeScript
   would be the one that stops agreeing with it. A width below is set only
   once the seller has actually dragged something. */
export const RAIL_MIN = 176;
export const RAIL_MAX = 360;
/** Icon-only. Two icon widths plus the rail's own padding. */
export const RAIL_COLLAPSED = 60;

export const ASK_MIN = 300;
export const ASK_MAX = 680;

export type ShellPrefs = {
  /** Pixels, or null while the seller has never dragged the rail. */
  railWidth: number | null;
  /** Collapsed to icons. The width is remembered separately, for re-opening. */
  railCollapsed: boolean;
  /** Pixels, or null while the seller has never dragged Ask. */
  askWidth: number | null;
  askOpen: boolean;
};

export const DEFAULT_PREFS: ShellPrefs = {
  railWidth: null,
  railCollapsed: false,
  askWidth: null,
  askOpen: true,
};

/**
 * Whether Ask docks on this screen at all.
 *
 * /home *is* the Ask surface, so the panel renders nothing there. Two things
 * need that answer and neither can ask the other for it — the panel, and the
 * shell that draws the drag handle on its edge — so it is written once here
 * rather than as the same pathname check in both.
 */
export function askDocksAt(pathname: string): boolean {
  return pathname !== "/home";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

/**
 * Reads the cookie. Anything unparseable — a hand-edited value, a cookie from
 * an older shape of this type — falls back to the default for that one field
 * rather than throwing the whole preference away.
 */
export function parseShellPrefs(raw: string | undefined): ShellPrefs {
  if (!raw) return DEFAULT_PREFS;

  const params = new URLSearchParams(raw);
  const width = (key: string, min: number, max: number) => {
    const value = Number(params.get(key));
    return Number.isFinite(value) && value > 0 ? clamp(value, min, max) : null;
  };

  return {
    railWidth: width("rw", RAIL_MIN, RAIL_MAX),
    railCollapsed: params.get("rc") === "1",
    askWidth: width("aw", ASK_MIN, ASK_MAX),
    // Open unless it was explicitly shut: a seller who has never touched this
    // should get the panel, and so should one whose cookie is malformed.
    askOpen: params.get("ao") !== "0",
  };
}

/** Only what differs from the default, so the cookie stays short. */
export function serializeShellPrefs(prefs: ShellPrefs): string {
  const params = new URLSearchParams();
  if (prefs.railWidth !== null) params.set("rw", String(prefs.railWidth));
  if (prefs.railCollapsed) params.set("rc", "1");
  if (prefs.askWidth !== null) params.set("aw", String(prefs.askWidth));
  if (!prefs.askOpen) params.set("ao", "0");
  return params.toString();
}
