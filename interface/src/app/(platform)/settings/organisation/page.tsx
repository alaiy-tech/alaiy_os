import type { Metadata } from "next";

import { getCompanyInfo } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";

import { OrganisationSettings } from "../../../../components/baseline/settings/organisation";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  return buildPageMetadata({
    companyName: company?.name ?? null,
    pageTitle: "Settings - Organisation",
    description: "Manage your organisation's name, branding, and logo across Alaiy OS.",
    keywords: ["organisation settings", "branding", "logo", "Alaiy OS"],
    route: "/settings/organisation",
  });
}

export default function Page() {
  return <OrganisationSettings />;
}
