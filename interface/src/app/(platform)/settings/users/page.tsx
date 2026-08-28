import type { Metadata } from "next";

import { getCompanyInfo } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";

import { Users } from "../../../../components/baseline/settings/users/users";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  return buildPageMetadata({
    companyName: company?.name ?? null,
    pageTitle: "Settings - Users",
    description: "Manage your organisation's members and their access to Alaiy OS.",
    keywords: ["user management", "team members", "access control", "Alaiy OS"],
    route: "/settings/users",
  });
}

export default function Page() {
  return <Users />;
}
