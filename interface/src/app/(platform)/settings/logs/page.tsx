import { PageHeader } from "@/components/registry/page-header";

import { Logs } from "@/components/baseline/settings/logs/logs";

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
