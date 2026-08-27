import type { Metadata } from "next";

import { PageHeader } from "@/components/registry/page-header";
import { Logs } from "@/components/baseline/settings/logs/logs";
import { getCompanyInfo } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";

// The page itself is titled "Logs" (plural, matching the PageHeader below) -
// used here too rather than the singular "Log" so the <title> and the
// on-page heading agree.
export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  return buildPageMetadata({
    companyName: company?.name ?? null,
    pageTitle: "Settings - Logs",
    description: "Review what your connected services recorded the last time they talked to Alaiy OS.",
    keywords: ["activity logs", "audit log", "connectors", "Alaiy OS"],
    route: "/settings/logs",
  });
}

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Logs"
        subtitle="What the connected apps recorded when they last talked to the services behind them."
      />
      <Logs />
    </div>
  );
}
