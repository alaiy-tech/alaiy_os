import type { Metadata } from "next";

import { getCompanyInfo } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";

import { ThemeSettings } from "../../../../components/baseline/settings/theme";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  return buildPageMetadata({
    companyName: company?.name ?? null,
    pageTitle: "Settings - Themes",
    description: "Customize the look and feel of your Alaiy OS workspace.",
    keywords: ["themes", "appearance", "customization", "Alaiy OS"],
    route: "/settings/themes",
  });
}

export default function Page() {
  return <ThemeSettings />;
}
