import type { Metadata } from "next";

import { PageHeader } from "@/components/registry/page-header";
import { getCompanyInfo } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";

import { Connectors } from "../../../../components/baseline/settings/connectors";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  return buildPageMetadata({
    companyName: company?.name ?? null,
    pageTitle: "Settings - Connectors",
    description: "Manage every service connected to your Alaiy OS deployment and monitor their connection status.",
    keywords: ["connectors", "integrations", "Alaiy OS"],
    route: "/settings/connectors",
  });
}

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Connectors"
        subtitle="Every service registered against this deployment, whether it is switched on, and how its last connection test went."
      />
      <Connectors />
    </div>
  );
}
