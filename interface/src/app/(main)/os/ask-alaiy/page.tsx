import { getServerUser } from "@/lib/frappe/server";

import { AskAlaiyView } from "./_components/ask-alaiy-view";

export default async function Page() {
  const user = await getServerUser();
  const firstName = user?.fullName.split(" ")[0] ?? "there";

  return (
    <div className="h-full">
      <AskAlaiyView userName={firstName} />
    </div>
  );
}
