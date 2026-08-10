"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { type Period, readPeriod } from "@/components/list/period";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { ALL_CHANNELS, readChannel } from "./channel";

/** Labels for the shared Period values, spelled out as windows rather than as
 * "1D"/"1W" - the dashboard header has room for words, and the windows are
 * trailing (see PERIOD_DAYS in alaiy_os.api.dashboard_stats). */
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "1D", label: "Last 1 Day" },
  { value: "1W", label: "Last 7 Days" },
  { value: "1M", label: "Last 30 Days" },
  { value: "1Y", label: "Last 12 Months" },
];

/** Period + channel selects for the dashboard header. Same mechanism as
 * PeriodToggle: each select owns a query param, so the Server Component page
 * reads the same values back with no state threaded between them. The channel
 * select is omitted entirely when the site's orders carry no channel. */
export function DashboardFilters({ channels }: { channels: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const resolved = Object.fromEntries(searchParams.entries());
  const period = readPeriod(resolved);
  const channel = readChannel(resolved, channels);

  function setParam(name: string, value: string, isDefault: boolean) {
    const params = new URLSearchParams(searchParams);
    if (isDefault) params.delete(name);
    else params.set(name, value);

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  return (
    <>
      <Select value={period} onValueChange={(value) => setParam("period", value, value === "1M")}>
        <SelectTrigger className="w-40" id="dashboard-period" size="sm">
          <SelectValue placeholder="Last 30 Days" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PERIOD_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>

      {channels.length > 0 && (
        <Select value={channel} onValueChange={(value) => setParam("channel", value, value === ALL_CHANNELS)}>
          <SelectTrigger className="w-40" id="dashboard-channel" size="sm">
            <SelectValue placeholder="All Channels" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value={ALL_CHANNELS}>All Channels</SelectItem>
              {channels.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
      )}
    </>
  );
}
