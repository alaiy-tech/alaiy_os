import { format } from "date-fns";

import { getServerUser } from "@/lib/frappe/server";

import { registerDataSource } from "../../registry/data-source-registry";

/** Not a Frappe request at all - genuine domain/presentation logic (the
 * signed-in user's name plus today's date), exactly what the Data Source
 * Registry stays for once every generic Frappe need is a declarative
 * `page.data` entry instead (see docs/UI_RUNTIME.md). Every other dashboard
 * data source that used to live here (`dashboard.overview`, `.salesTrend`,
 * `.topProducts`, `.stockMix`, `.recentOrders`) is gone - the rebuilt `/os`
 * page expresses those through `page.data` `DataDefinition`s instead
 * (`seed.ts`), calling the same underlying whitelisted Frappe methods
 * via a generic `operation: "method"` request. */
registerDataSource({
  id: "dashboard.greeting",
  description: "A personalized page-header greeting and the current date.",
  capabilities: {},
  fields: [
    { name: "greeting", label: "Greeting", type: "string" },
    { name: "formattedDate", label: "Date", type: "string" },
  ],
  async resolve() {
    const user = await getServerUser();
    const firstName = user?.fullName.split(" ")[0] ?? "there";
    return {
      greeting: `Welcome, ${firstName}!`,
      formattedDate: format(new Date(), "EEEE, do MMMM yyyy"),
    };
  },
});
