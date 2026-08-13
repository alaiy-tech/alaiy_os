import type { NavContribution } from "./nav-types";

/**
 * Sidebar entries contributed by the Frappe apps installed alongside the base.
 *
 * GENERATED FILE — the deployment composer overwrites it with the merged `nav`
 * blocks of every contributing app's `interface/interface.config.json`. It ships
 * empty in `alaiy_os`, which is what keeps the base connector- and
 * client-agnostic: the base consumes whatever is in this list without knowing
 * which app (or how many) supplied it.
 *
 * Do not hand-edit in a composed workspace — the next compose overwrites it.
 * Do not add entries here in `alaiy_os` itself; a base-owned screen belongs in
 * `sidebar-config.ts`.
 */
export const contributedNav: NavContribution[] = [];
