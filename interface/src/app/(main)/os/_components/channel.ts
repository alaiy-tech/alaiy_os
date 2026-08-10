// Channel counterpart to components/list/period.ts: the parsing logic for the
// dashboard's `?channel=` param, kept out of the "use client" filters module so
// the Server Component page can call it directly.

/** The channel select's default option, and the value the API reads as
 * "unfiltered" (see _normalise_channel in alaiy_os.api.dashboard_stats). */
export const ALL_CHANNELS = "all";

/** Reads the channel out of an (already awaited) `searchParams`, falling back to
 * every channel for anything this site has no orders for - a stale or
 * hand-edited URL should never silently empty the dashboard. */
export function readChannel(searchParams: Record<string, string | string[] | undefined>, channels: string[]): string {
  const raw = searchParams.channel;
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value && channels.includes(value) ? value : ALL_CHANNELS;
}

/** The value to hand the API: `undefined` for "all channels", so the query
 * string omits the param entirely. */
export function toChannelParam(channel: string): string | undefined {
  return channel === ALL_CHANNELS ? undefined : channel;
}
