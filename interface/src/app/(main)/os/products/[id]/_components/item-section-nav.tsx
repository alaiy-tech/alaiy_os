"use client";

import { useEffect, useState } from "react";

import { DETAIL_STICKY_TOP, ITEM_DETAIL_SECTIONS } from "@/constants/products";
import { cn } from "@/lib/utils";

/** The band of the viewport a section has to cross to count as "the one being
 * read" - the middle tenth, so the highlight changes as a heading reaches the
 * centre of the screen rather than the moment it appears at the bottom. */
const ACTIVE_BAND = "-45% 0px -45% 0px";

/**
 * Jump links to the long sections further down, with the one on screen
 * highlighted.
 *
 * The links only scroll - they do not gate what is rendered. Every section is in
 * the DOM whether or not its pill is lit, so Ctrl-F still finds a warehouse name
 * in the stock table and a deep link to `#item-pricing` still lands.
 */
export function ItemSectionNav() {
  const [active, setActive] = useState<string>(ITEM_DETAIL_SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: ACTIVE_BAND },
    );

    const sections = ITEM_DETAIL_SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (element): element is HTMLElement => element !== null,
    );
    for (const section of sections) observer.observe(section);

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      aria-label="Item sections"
      className={cn(
        "sticky z-20 -mx-1 flex gap-1 overflow-x-auto bg-background/95 px-1 py-2 backdrop-blur-sm",
        DETAIL_STICKY_TOP,
      )}
    >
      {ITEM_DETAIL_SECTIONS.map((section) => (
        <a
          key={section.id}
          href={`#${section.id}`}
          aria-current={active === section.id}
          className={cn(
            "shrink-0 rounded-4xl px-3 py-1.5 font-medium text-sm transition-colors duration-100",
            active === section.id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {section.label}
        </a>
      ))}
    </nav>
  );
}
