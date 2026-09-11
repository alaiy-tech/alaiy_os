"use client";

import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  ASK_MAX,
  ASK_MIN,
  RAIL_COLLAPSED,
  RAIL_MAX,
  RAIL_MIN,
  SHELL_COOKIE,
  SHELL_COOKIE_MAX_AGE,
  askDocksAt,
  clamp,
  serializeShellPrefs,
  type ShellPrefs,
} from "@/lib/shell/prefs";

/**
 * The signed-in shell's frame: it owns how wide the rail and Ask Alaiy are,
 * and whether either of them is showing.
 *
 * Both widths are published as CSS custom properties on one element rather
 * than passed down as numbers, because a third surface already reads them —
 * the Orders detail panel stops at Ask's left edge, and it is `position:
 * fixed`, so it is not a descendant of anything that could hand it a prop.
 * `--spacing-ask-panel` was already that agreement (see `globals.css`); this
 * makes it live instead of fixed, and `--spacing-rail` is its twin. Closing a
 * panel sets its variable to 0, which is why the Orders panel widens to the
 * viewport edge on its own when Ask is shut.
 *
 * The variables are set inline only once the seller has an opinion. Left
 * alone, the stylesheet's own defaults apply — including Ask's widening at
 * xl, which an unconditional inline value would permanently override.
 */

type ShellContextValue = {
  prefs: ShellPrefs;
  update: (patch: Partial<ShellPrefs>) => void;
};

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell must be used inside <ShellProvider>");
  return value;
}

const RAIL_VAR = "--spacing-rail";
const ASK_VAR = "--spacing-ask-panel";

function writeCookie(prefs: ShellPrefs) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${SHELL_COOKIE}=${serializeShellPrefs(prefs)}; path=/; max-age=${SHELL_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

export function ShellProvider({
  initial,
  children,
}: {
  /** Read from the cookie by the layout, so the first paint is already right. */
  initial: ShellPrefs;
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useState(initial);
  const [dragging, setDragging] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Ask is not on every screen. Where it does not dock, it occupies no width
  // and there is no edge to drag — the handle would otherwise hang in the
  // middle of /home, attached to nothing.
  const askShowing = prefs.askOpen && askDocksAt(pathname);

  const update = useCallback((patch: Partial<ShellPrefs>) => {
    setPrefs((current) => ({ ...current, ...patch }));
  }, []);

  // Persisted here rather than at each call site, so no toggle can be added
  // later that forgets to save. Skipped mid-drag: a width changes every frame
  // while the handle is held, and the commit at the end is the one that counts.
  useEffect(() => {
    if (dragging) return;
    writeCookie(prefs);
  }, [prefs, dragging]);

  const style: Record<string, string> = {};
  if (prefs.railCollapsed) style[RAIL_VAR] = `${RAIL_COLLAPSED}px`;
  else if (prefs.railWidth !== null) style[RAIL_VAR] = `${prefs.railWidth}px`;
  if (!askShowing) style[ASK_VAR] = "0px";
  else if (prefs.askWidth !== null) style[ASK_VAR] = `${prefs.askWidth}px`;

  return (
    <ShellContext.Provider value={{ prefs, update }}>
      {/* `relative` so the two handles can be positioned on the seams. They
          live here rather than inside each panel because a panel that scrolls
          its own content would carry its handle away with it. */}
      <div ref={rootRef} style={style as CSSProperties} className="relative flex h-dvh overflow-hidden">
        {children}

        {/* Below md the rail is a horizontal strip, and below lg Ask is not
            docked at all — neither has an edge to drag there. */}
        {!prefs.railCollapsed ? (
          <ResizeHandle
            rootRef={rootRef}
            cssVar={RAIL_VAR}
            edge="left"
            min={RAIL_MIN}
            max={RAIL_MAX}
            label="Resize the navigation rail"
            className="hidden md:block"
            onDraggingChange={setDragging}
            onCommit={(width) => update({ railWidth: width })}
            onReset={() => update({ railWidth: null })}
          />
        ) : null}

        {askShowing ? (
          <ResizeHandle
            rootRef={rootRef}
            cssVar={ASK_VAR}
            edge="right"
            min={ASK_MIN}
            max={ASK_MAX}
            label="Resize the Ask Alaiy panel"
            className="hidden lg:block"
            onDraggingChange={setDragging}
            onCommit={(width) => update({ askWidth: width })}
            onReset={() => update({ askWidth: null })}
          />
        ) : null}
      </div>
    </ShellContext.Provider>
  );
}

/**
 * The strip on a panel's outer edge.
 *
 * It drags by writing the CSS variable straight onto the shell element and
 * only tells React the final number on release. Putting every frame through
 * state would re-render Ask — and `Chat` under it, transcript and all —
 * sixty times a second to move one edge.
 *
 * A `separator` with a value, not a button: that is what assistive tech
 * announces as a resizable split, and it makes the arrow keys the expected
 * thing to press rather than a bonus. Enter or a double-click puts the panel
 * back to the width the stylesheet chooses.
 */
function ResizeHandle({
  rootRef,
  cssVar,
  edge,
  min,
  max,
  label,
  className,
  onDraggingChange,
  onCommit,
  onReset,
}: {
  rootRef: RefObject<HTMLDivElement | null>;
  cssVar: string;
  /** Which side of the viewport the panel is pinned to. */
  edge: "left" | "right";
  min: number;
  max: number;
  label: string;
  className: string;
  onDraggingChange: (dragging: boolean) => void;
  onCommit: (width: number) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  // Null until mounted: the resolved width is only knowable from the DOM,
  // because the default lives in the stylesheet and one of them is a media
  // query. `aria-valuenow` is simply absent for that first paint.
  const [width, setWidth] = useState<number | null>(null);
  const draggingRef = useRef(false);

  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return min;
    const value = Number.parseFloat(getComputedStyle(root).getPropertyValue(cssVar));
    return Number.isFinite(value) ? value : min;
  }, [cssVar, min, rootRef]);

  useEffect(() => {
    setWidth(measure());
  }, [measure]);

  // Both of these are document-wide and neither belongs to this element, so
  // going away mid-drag would leave the whole app wearing a resize cursor it
  // cannot select text through, and the provider never saving again.
  useEffect(
    () => () => {
      if (!draggingRef.current) return;
      document.body.classList.remove("shell-resizing");
      onDraggingChange(false);
    },
    [onDraggingChange],
  );

  const apply = useCallback(
    (next: number) => {
      const bounded = clamp(next, min, max);
      rootRef.current?.style.setProperty(cssVar, `${bounded}px`);
      setWidth(bounded);
      return bounded;
    },
    [cssVar, max, min, rootRef],
  );

  /** The panel width the pointer is asking for, against the shell's own box
   *  rather than the viewport — they are the same today, and a future banner
   *  or offset above the shell is exactly the kind of thing that would quietly
   *  put every drag out by its height's worth of margin. */
  const widthAt = (clientX: number) => {
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return min;
    return edge === "left" ? clientX - rect.left : rect.right - clientX;
  };

  function setDrag(active: boolean) {
    setDragging(active);
    draggingRef.current = active;
    onDraggingChange(active);
    // The pointer leaves the 8px strip within a frame of the drag starting, so
    // the cursor and the selection lock have to be on the whole document.
    document.body.classList.toggle("shell-resizing", active);
  }

  function reset() {
    rootRef.current?.style.removeProperty(cssVar);
    onReset();
    setWidth(measure());
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    // Capture, so the drag survives the pointer crossing the panel's content —
    // including an iframe or a text selection it would otherwise be stolen by.
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    setDrag(true);
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    apply(widthAt(event.clientX));
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return;
    setDrag(false);
    onCommit(apply(widthAt(event.clientX)));
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 48 : 16;
    const current = width ?? measure();
    // Left and right mean what they look like: on the right-hand panel,
    // pressing left grows it, because its edge is what moves.
    const grow = edge === "left" ? "ArrowRight" : "ArrowLeft";
    const shrink = edge === "left" ? "ArrowLeft" : "ArrowRight";

    let next: number | null = null;
    if (event.key === grow) next = current + step;
    else if (event.key === shrink) next = current - step;
    else if (event.key === "Home") next = edge === "left" ? min : max;
    else if (event.key === "End") next = edge === "left" ? max : min;
    else if (event.key === "Enter") {
      event.preventDefault();
      reset();
      return;
    }

    if (next === null) return;
    event.preventDefault();
    onCommit(apply(next));
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={width ?? undefined}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      title="Drag to resize — double-click to reset"
      // Centred on the seam: 8px of grab area over a 1px border, which is the
      // smallest target that does not need aiming. The visible line only
      // appears on hover, focus or while held, so the shell stays quiet.
      className={`group absolute inset-y-0 z-30 w-2 cursor-col-resize touch-none focus:outline-none ${
        edge === "left" ? "left-rail -ml-1" : "right-ask-panel -mr-1"
      } ${className}`}
    >
      <span
        aria-hidden
        className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors group-hover:bg-highlight-500 group-focus-visible:bg-highlight-500 ${
          dragging ? "bg-highlight-500" : "bg-transparent"
        }`}
      />
    </div>
  );
}
