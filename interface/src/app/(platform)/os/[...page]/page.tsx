import type { Metadata } from "next";

import { ComingSoon } from "@/components/layout/coming-soon";
import { InvalidPageConfig } from "@/components/layout/invalid-page-config";
import { resolvePage } from "@/runtime/resolve-page";
import { getPageStore } from "@/runtime/store/sqlite-page-store";

/**
 * Replaces the old `os/[...not-found]/page.tsx`. Next.js only ever routes a
 * request here when no more specific static segment matched (`ask-alaiy`,
 * `settings/*`, `customers`, `dashboard`, ...) - static siblings always win
 * over a catch-all, so those routes need no special-casing here at all.
 *
 * `params.page` is the raw path segments (e.g. `/os/my-page` ->
 * `["my-page"]`). Segments are joined with `/` to form a page id and handed
 * to `resolvePage`, which resolves it against the local SQLite
 * `UIPageStore` (`runtime/store/sqlite-page-store.ts`) - this file never
 * touches a database or the filesystem itself.
 */
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ page: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { page: segments } = await params;
  const result = await resolvePage(segments.join("/"), await searchParams);

  if (result.status === "not-found") return <ComingSoon />;
  if (result.status === "invalid") return <InvalidPageConfig errors={result.errors} />;
  return result.node;
}

export async function generateMetadata({ params }: { params: Promise<{ page: string[] }> }): Promise<Metadata> {
  try {
    const { page: segments } = await params;
    const config = await getPageStore().getPageById(segments.join("/"));
    return config?.metadata ? { title: config.metadata.title, description: config.metadata.description } : {};
  } catch {
    return {};
  }
}
