import type { Metadata } from "next";

import { getCompanyInfo, getServerUser } from "@/lib/frappe/server";
import { buildPageMetadata } from "@/lib/metadata";

import { AskAlaiyView } from "../../../../components/baseline/ask-alaiy/ask-alaiy-view";

export async function generateMetadata(): Promise<Metadata> {
  const company = await getCompanyInfo();
  return buildPageMetadata({
    companyName: company?.name ?? null,
    pageTitle: "Ask Alaiy",
    description:
      "Ask Alaiy anything about your business - get instant answers, insights, and actions powered by your live Alaiy OS data.",
    keywords: ["Ask Alaiy", "AI assistant", "business insights", "Alaiy OS"],
    route: "/os/ask-alaiy",
  });
}

export default async function Page() {
  const user = await getServerUser();
  const firstName = user?.fullName.split(" ")[0] ?? "there";

  return (
    <div className="h-full">
      <AskAlaiyView userName={firstName} />
    </div>
  );
}
