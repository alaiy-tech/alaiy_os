import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";
import { InvalidPageConfig } from "@/components/layout/invalid-page-config";
import { getCompanyInfo } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";
import { resolvePage } from "@/runtime/resolve-page";
import { getPageStore } from "@/runtime/store/sqlite-page-store";

/**
 * Bare `/os` - a static sibling of `[...page]/`, so it wins over that
 * catch-all the same way `/os/ask-alaiy` already does (a static segment
 * always beats a dynamic one in Next's router). Hardcodes the `"dashboard"`
 * page id, since this route only ever means one page - unlike `[...page]`,
 * which resolves whatever id the URL's segments spell out.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const result = await resolvePage("dashboard", await searchParams);

  if (result.status === "not-found") return <ComingSoon />;
  if (result.status === "invalid") return <InvalidPageConfig errors={result.errors} />;
  return result.node;
}

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [config, company] = await Promise.all([
      getPageStore().getPageById("dashboard"),
      getCompanyInfo(),
    ]);
    if (!config?.metadata) return {};
    return buildPageMetadata({
      companyName: company?.name ?? null,
      pageTitle: config.metadata.title ?? "Dashboard",
      description: config.metadata.description ?? "",
      keywords: config.metadata.keywords,
      route: "/os",
    });
  } catch {
    return {};
  }
}
