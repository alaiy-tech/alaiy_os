"use client";

import * as React from "react";

import { useRouter } from "next/navigation";

import { ArrowDown, ArrowUp, CornerDownLeft, Search } from "lucide-react";

import { Button } from "@/components/primitive/button";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/primitive/command";
import { Kbd, KbdGroup } from "@/components/primitive/kbd";
import { resolveNavIcon } from "@/config/nav-icons";
import type { SidebarNavGroupData } from "@/types/navigation";

type SearchItem = {
  id: string;
  group: string;
  label: string;
  url: string;
  icon?: ReturnType<typeof resolveNavIcon>;
  disabled?: boolean;
  newTab?: boolean;
};

function getSubItemGroup(
  groupLabels: Set<string>,
  groupLabel: string | undefined,
  itemTitle: string,
) {
  return groupLabels.has(itemTitle) ? (groupLabel ?? "Other") : itemTitle;
}

/** Flattens the DB-driven sidebar groups (plain-data, string icons) into
 * flat, resolved-icon search entries - the same shape/behavior
 * `search-menu.tsx` computed at module scope from the old static
 * `sidebarItems` constant, now derived from a prop instead (the sidebar is
 * no longer a synchronously-importable constant once it comes from the
 * database - see `ui-runtime/store/sqlite-sidebar-store.ts`). */
function buildSearchItems(
  groups: readonly SidebarNavGroupData[],
): SearchItem[] {
  const groupLabels = new Set(
    groups.flatMap((group) => (group.label ? [group.label] : [])),
  );

  return groups.flatMap((group) =>
    group.items.flatMap((item) => {
      if (!item.subItems) {
        if (!item.url) return [];
        return [
          {
            id: item.id,
            group: group.label ?? "Other",
            label: item.title,
            url: item.url,
            icon: resolveNavIcon(item.icon),
            disabled: item.disabled,
            newTab: item.newTab,
          },
        ];
      }
      return item.subItems
        .filter((sub) => sub.url)
        .map((sub) => ({
          id: sub.id,
          group: getSubItemGroup(groupLabels, group.label, item.title),
          label: sub.title,
          url: sub.url as string,
          icon: resolveNavIcon(item.icon),
          disabled: sub.disabled,
          newTab: sub.newTab,
        }));
    }),
  );
}

function getAvailableItems(items: SearchItem[]) {
  return items.filter(
    (item) => !item.disabled && !item.url.includes("coming-soon"),
  );
}

function groupBy(items: SearchItem[]) {
  const groups = [...new Set(items.map((item) => item.group))];
  return groups.map((group) => ({
    group,
    items: items.filter((item) => item.group === group),
  }));
}

export function SearchDialog({
  items,
}: {
  items: readonly SidebarNavGroupData[];
}) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const router = useRouter();
  const searchItems = React.useMemo(() => buildSearchItems(items), [items]);
  const recommendations = React.useMemo(
    () => getAvailableItems(searchItems),
    [searchItems],
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleOpenChange = (value: boolean) => {
    setOpen(value);
    if (!value) setQuery("");
  };

  const handleSelect = (item: SearchItem) => {
    if (item.disabled) return;
    handleOpenChange(false);
    if (item.newTab) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(item.url);
    }
  };

  const renderGroups = (items: SearchItem[]) =>
    groupBy(items).map(({ group, items: groupItems }, index) => (
      <React.Fragment key={group}>
        {index > 0 && <CommandSeparator />}
        <CommandGroup heading={group}>
          {groupItems.map((item) => (
            <CommandItem
              disabled={item.disabled}
              key={`${group}-${item.id}`}
              value={`${item.group} ${item.label}`}
              onSelect={() => handleSelect(item)}
            >
              <span className="flex min-w-0 items-center gap-2">
                {item.icon && <item.icon />}
                <span className="truncate">{item.label}</span>
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      </React.Fragment>
    ));

  return (
    <>
      <Button
        onClick={() => handleOpenChange(true)}
        variant="link"
        className="px-0! font-normal text-muted-foreground hover:no-underline"
      >
        <Search data-icon="inline-start" />
        Search
        <Kbd>⌘K</Kbd>
      </Button>
      <CommandDialog
        open={open}
        onOpenChange={handleOpenChange}
        className="sm:max-w-2xl"
      >
        <Command>
          <CommandInput
            placeholder="Search dashboards, users, and more…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            {query ? renderGroups(searchItems) : renderGroups(recommendations)}
          </CommandList>
          <CommandSeparator />
          <div className="flex items-center gap-4 px-3 py-2 text-muted-foreground text-xs">
            <KbdGroup>
              <Kbd>
                <ArrowUp />
              </Kbd>
              <Kbd>
                <ArrowDown />
              </Kbd>
              <span>Navigate</span>
            </KbdGroup>
            <KbdGroup>
              <Kbd>
                <CornerDownLeft />
              </Kbd>
              <span>Select</span>
            </KbdGroup>
            <KbdGroup>
              <Kbd>⌘K</Kbd>
              <span>Close</span>
            </KbdGroup>
          </div>
        </Command>
      </CommandDialog>
    </>
  );
}
