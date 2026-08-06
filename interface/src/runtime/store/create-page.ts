import type { PageConfigFile } from "@/types/runtime/page";

import { getPageStore } from "./sqlite-page-store";
import { getSidebarStore } from "./sqlite-sidebar-store";

/**
 * The foundation a page-creation flow should call - not `UIPageStore.createPage`
 * alone, which only writes `ui_pages` and leaves the page unreachable from
 * the sidebar. Creates the page, then ensures it has a dynamic
 * "Uncategorised" sidebar entry (`SidebarStore.ensureDynamicPageEntry`,
 * idempotent by page id).
 *
 * No Ask Alaiy integration exists yet, but this is the seam it will call
 * once one does - "eventually I should be able to set my sidebar config
 * and layout with Ask Alaiy" only works if page creation and sidebar
 * placement are already one operation, not two things a future caller has
 * to remember to keep in sync by hand.
 */
export async function createPageWithSidebarEntry(page: PageConfigFile, options?: { icon?: string }): Promise<void> {
  await getPageStore().createPage(page);
  await getSidebarStore().ensureDynamicPageEntry({
    pageId: page.id,
    title: page.metadata?.title ?? page.id,
    url: page.route,
    icon: options?.icon,
  });
}
