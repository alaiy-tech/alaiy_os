import type { Metadata } from "next";

import { getCompanyInfo } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";

import { Roles } from "../../../../components/baseline/settings/permissions/roles";
import { roles } from "../../../../components/baseline/settings/permissions/roles-table/data";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  return buildPageMetadata({
    companyName: company?.name ?? null,
    pageTitle: "Settings - Permissions",
    description: "Manage roles and permissions that control what your team can see and do in Alaiy OS.",
    keywords: ["roles", "permissions", "access control", "Alaiy OS"],
    route: "/settings/permissions",
  });
}

export default function Page() {
  return <Roles roles={roles} />;
}
