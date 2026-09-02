import { PageHeader } from "@/components/layout/page-header";

import { Connectors } from "./_components/connectors";

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
