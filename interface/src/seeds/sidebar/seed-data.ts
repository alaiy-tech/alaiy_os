import { contributedNav } from "@/config/contributed-nav";
import { iconName } from "@/config/nav-icons";
import type { NavContribution, SidebarNavGroupData, SidebarNavItemData } from "@/types/navigation";

/**
 * The code-owned half of the `/os/*` sidebar: the base app's own groups,
 * merged with whatever the deployment composer generated into
 * `contributed-nav.ts` (see that file's doc comment - untouched, still an
 * empty array in this base repo). This module replaces the old
 * `sidebar-config.ts`'s role of exporting a ready-to-render `sidebarItems`
 * array; instead, `runtime/store/sqlite-sidebar-store.ts` calls
 * `buildCodeDefinedSidebar()` on every store construction and writes the
 * result into the `sidebar_groups`/`sidebar_items` tables as `source: 'code'`
 * rows - a redeploy that changes `contributed-nav.ts` (a new connector
 * installed) takes effect on the next app start with no manual reseed step,
 * the same way this file's own edits would.
 *
 * Icons are lower-kebab-case name strings (see `nav-icons.ts`'s doc comment
 * for why), not `LucideIcon` components - the one exception is folding in
 * `contributedNav`, whose items still carry real components per the
 * composer's unchanged contract; `iconName()` converts those to strings at
 * merge time.
 *
 * The "Settings" entry point that used to live here has moved out entirely -
 * it's now a standalone button in `AppSidebar`'s own footer, above `NavUser`
 * (baseline UI chrome, not sidebar-store data - see that file), the same way
 * `components/layout/sidebar/settings-sidebar.tsx` is a *separate*, also
 * code-owned, fixed Settings sidebar. What's left here is deliberately minimal - a
 * baseline reset - since the previous Catalog/Sales/Procurement/Inventory
 * groups described pages that don't exist yet. Real pages get a sidebar
 * entry dynamically, via `runtime/store/create-page.ts`'s
 * `createPageWithSidebarEntry` (see the "Uncategorised" group it creates,
 * `docs/UI_RUNTIME.md`'s Sidebar Store section), not by hand-editing this
 * file.
 */
export const CONNECTORS_GROUP_LABEL = "Connectors";

const baseSidebarGroups: SidebarNavGroupData[] = [
  {
    id: "os",
    label: "OS",
    items: [{ id: "ask-alaiy", title: "Ask Alaiy", url: "/os/ask-alaiy", icon: "sparkles" }],
  },
];

function contributionToItemData(item: NavContribution["items"][number]): SidebarNavItemData {
  // `"url" in item`, not `if (item.subItems)`: NavMainItem is a union of a
  // link and a parent, and a parent's `subItems` is a required array — an
  // empty one is still truthy, so a falsy check cannot rule the parent out.
  // Testing for `url` (present only on the link variant) narrows the union
  // properly in both directions — the same idiom `search-menu.tsx` already
  // used for this exact union before this file existed.
  if ("url" in item) {
    return {
      id: item.id,
      title: item.title,
      url: item.url,
      icon: iconName(item.icon),
      badge: item.badge,
      disabled: item.disabled,
      newTab: item.newTab,
    };
  }
  return {
    id: item.id,
    title: item.title,
    url: null,
    icon: iconName(item.icon),
    badge: item.badge,
    disabled: item.disabled,
    newTab: item.newTab,
    subItems: item.subItems.map((sub) => ({
      id: sub.id,
      title: sub.title,
      url: sub.url,
      icon: iconName(sub.icon),
      badge: sub.badge,
      disabled: sub.disabled,
      newTab: sub.newTab,
    })),
  };
}

/**
 * Folds `contributedNav` into the base groups - the exact same semantics
 * `sidebar-config.ts`'s old `withContributions()` implemented (matched by
 * group `label`, an unrecognised label opens a new group, a contributed
 * item whose `id` already exists in the target group replaces it), just
 * producing plain-data groups instead of a render-ready array.
 *
 * A connector is expected to declare exactly one top-level item for
 * itself (a `NavMainParentItem`, its pages as `subItems`) under
 * `group: "Connectors"` - see `docs/CONNECTOR_TO_BASE_UI_COMPOSITION.md`
 * §16. An item landing in that specific group with no icon of its own
 * falls back to `"plug"`, the same fallback
 * `components/baseline/settings/connectors.tsx` already uses for a
 * connector card with no icon - the two surfaces agree visually.
 */
export function buildCodeDefinedSidebar(): SidebarNavGroupData[] {
  if (contributedNav.length === 0) return baseSidebarGroups;

  const merged = baseSidebarGroups.map((group) => ({ ...group, items: [...group.items] }));

  for (const contribution of contributedNav) {
    let target = merged.find((group) => group.label === contribution.group);
    if (!target) {
      target = {
        id: `contributed-${contribution.group.toLowerCase().replace(/\s+/g, "-")}`,
        label: contribution.group,
        items: [],
      };
      merged.push(target);
    }
    const isConnectorsGroup = target.label === CONNECTORS_GROUP_LABEL;
    for (const rawItem of contribution.items) {
      const item = contributionToItemData(rawItem);
      if (isConnectorsGroup && !item.icon) item.icon = "plug";
      const existing = target.items.findIndex((candidate) => candidate.id === item.id);
      if (existing === -1) target.items.push(item);
      else target.items[existing] = item;
    }
  }

  return merged;
}
