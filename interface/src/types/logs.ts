/** One log doctype an installed app has registered with core, as returned by
 * alaiy_os.api.logs.get_log_sources. */
export type LogSource = {
  doctype: string;
  label: string;
  /** A lucide icon name, chosen by the app that registered the log. Rendered
   * through a lookup with a fallback — an app can name an icon this build of
   * the frontend has never heard of. */
  icon: string;
};

/** A log row is whatever its doctype's fields happen to be; only `name` is
 * guaranteed, and `creation` is always requested alongside it. */
export type LogRow = Record<string, unknown> & { name: string; creation?: string };

/** `lib/frappe/logs.ts`'s `fetchLogRows()` params. */
export type LogListParams = {
  doctype: string;
  fields: string[];
  filters?: Array<[string, string, unknown]>;
  limitStart?: number;
  limitPageLength?: number;
};
