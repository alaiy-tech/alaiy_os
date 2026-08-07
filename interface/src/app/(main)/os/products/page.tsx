import { OverviewKpis } from "./_components/overview-kpis";
import { Products } from "./_components/products";

export default function Page() {
  return (
    <div className="flex flex-col gap-4">
      <OverviewKpis />
      <Products />
    </div>
  );
}
