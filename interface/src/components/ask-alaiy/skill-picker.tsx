"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { ChatSkill } from "@/lib/frappe/chat";
import { cn } from "@/lib/utils";

/**
 * The `/` skill catalogue — the picker, and the state behind it.
 *
 * This lived inside `ask-alaiy-panel.tsx` and nowhere else, which meant the
 * floating drawer had slash commands and the dedicated `/os/ask-alaiy` page did
 * not: typing `/` in the full-page composer did nothing at all, with no picker
 * and no hint that skills existed. Both surfaces read the same
 * `AskAlaiyProvider` context and both send through the same `chat.send`, so the
 * asymmetry was accidental rather than intended.
 *
 * Extracted here so there is one implementation. `useSkillPicker` owns the
 * query, the matches, the highlighted index and the dismissal; `SkillPicker`
 * renders them. A composer wires three things: the hook, `handleKeyDown` before
 * its own Enter handling, and the component above the input.
 */

/** The typed query, or null when the composer is not in skill mode.
 *
 * Anchored: the slash has to be the whole input, so `/stock` opens the picker
 * and `ask about /stock` does not. A mid-sentence slash is far more often a date
 * or a path than a command. */
export function skillQueryOf(value: string): string | null {
  const match = /^\/([a-z0-9-]*)$/.exec(value.trimStart());
  return match ? match[1] : null;
}

/** The slug when the input is exactly one real skill, else undefined.
 *
 * Lets someone type `/stock-watch` and press Enter without ever opening the
 * picker — the composer passes this as `send`'s `skill`, so the turn runs the
 * agent instead of asking the model to interpret a line starting with a slash. */
export function exactSkillSlug(value: string, skills: ChatSkill[] | null): string | undefined {
  const match = /^\/([a-z0-9-]+)$/.exec(value.trim());
  if (!match || !skills) return undefined;
  return skills.some((skill) => skill.slug === match[1]) ? match[1] : undefined;
}

export type SkillPickerState = {
  readonly open: boolean;
  readonly matches: ChatSkill[];
  readonly index: number;
  /** False until the catalogue has been fetched once — changes the empty copy. */
  readonly allLoaded: boolean;
  /** Handle a composer keypress. Returns true when it consumed the event. */
  readonly handleKeyDown: (event: React.KeyboardEvent) => boolean;
  readonly pick: (skill: ChatSkill) => void;
};

export function useSkillPicker({
  text,
  skills,
  ensureSkillsLoaded,
  onRun,
}: {
  readonly text: string;
  readonly skills: ChatSkill[] | null;
  readonly ensureSkillsLoaded: (refresh?: boolean) => Promise<ChatSkill[]>;
  readonly onRun: (skill: ChatSkill) => void;
}): SkillPickerState {
  const query = skillQueryOf(text);
  const [matches, setMatches] = useState<ChatSkill[]>([]);
  const [index, setIndex] = useState(0);
  const [dismissedFor, setDismissedFor] = useState<string | null>(null);

  // True only on the keystroke that OPENS the picker, so the catalogue is
  // re-read once per open rather than once per character. Without the re-read
  // an agent installed from the Agent Marketplace never appeared here: the
  // provider lives in the /os layout, so its cache survives navigating between
  // the two pages. See `ensureSkillsLoaded` in use-ask-alaiy.ts.
  const wasClosed = useRef(true);

  const open = query !== null && text !== dismissedFor;

  useEffect(() => {
    if (query === null) {
      wasClosed.current = true;
      setMatches([]);
      // Leaving skill mode clears an Escape dismissal, so the composer needs no
      // `reset()` of its own after sending: emptying the input takes the text
      // out of skill mode, which lands here. Dismissal only ever means "not for
      // THIS query".
      setDismissedFor(null);
      return;
    }
    const justOpened = wasClosed.current;
    wasClosed.current = false;

    const needle = query.toLowerCase();
    const matching = (all: ChatSkill[]) =>
      all.filter(
        (skill) =>
          skill.slug.includes(needle) || (skill.label || "").toLowerCase().includes(needle),
      );

    // Paint from what is already cached before awaiting anything. Matches were
    // cleared when the picker last closed, so without this the re-read on open
    // shows "No matching skill." for the length of a round trip — which reads as
    // "this site has no skills" at exactly the moment someone is looking for the
    // one they just installed.
    if (skills) {
      setMatches(matching(skills));
      setIndex(0);
    }

    let cancelled = false;
    void ensureSkillsLoaded(justOpened).then((all) => {
      if (cancelled || skillQueryOf(text) === null) return;
      setMatches(matching(all));
      setIndex(0);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent): boolean => {
      if (!open) return false;

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        if (!matches.length) return true;
        const step = event.key === "ArrowDown" ? 1 : -1;
        setIndex((current) => (current + step + matches.length) % matches.length);
        return true;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        // Dismiss for THIS text only, so editing the query reopens the picker
        // rather than needing the whole line cleared.
        setDismissedFor(text);
        return true;
      }
      if ((event.key === "Enter" || event.key === "Tab") && matches[index]) {
        event.preventDefault();
        onRun(matches[index]);
        return true;
      }
      return false;
    },
    [open, matches, index, text, onRun],
  );

  return {
    open,
    matches,
    index,
    allLoaded: skills !== null,
    handleKeyDown,
    pick: onRun,
  };
}

export function SkillPicker({
  matches,
  activeIndex,
  allLoaded,
  onPick,
  className,
}: {
  readonly matches: ChatSkill[];
  readonly activeIndex: number;
  readonly allLoaded: boolean;
  readonly onPick: (skill: ChatSkill) => void;
  readonly className?: string;
}) {
  return (
    <div
      role="listbox"
      aria-label="Skills"
      className={cn(
        "absolute inset-x-3 bottom-full z-10 mb-2 max-h-64 overflow-y-auto rounded-lg border border-border bg-popover text-popover-foreground shadow-md",
        className,
      )}
    >
      {matches.length === 0 ? (
        <p className="px-3.5 py-2.5 text-[12.5px] text-muted-foreground">
          {allLoaded ? "No matching skill." : "This site has no skills set up."}
        </p>
      ) : (
        matches.map((skill, i) => (
          <button
            key={skill.slug}
            type="button"
            role="option"
            aria-selected={i === activeIndex}
            onMouseDown={(event) => {
              // mousedown, not click: the textarea would blur first and the
              // picker would unmount before a click ever landed.
              event.preventDefault();
              onPick(skill);
            }}
            className={cn(
              "block w-full border-b border-border px-3.5 py-2 text-left last:border-b-0",
              i === activeIndex ? "bg-accent" : "hover:bg-accent",
            )}
          >
            <span className="font-semibold text-[13px]">/{skill.slug}</span>
            {skill.label && <span className="ml-2 text-[13px] text-muted-foreground">{skill.label}</span>}
            {skill.description && (
              <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground">{skill.description}</span>
            )}
          </button>
        ))
      )}
    </div>
  );
}
