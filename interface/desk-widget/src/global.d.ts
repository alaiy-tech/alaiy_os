/**
 * The slice of Frappe Desk's global `frappe` object this widget actually
 * touches. It's real, already on `window` by the time app_include_js runs
 * this bundle -- not a library this app installs.
 */
interface FrappeCallOpts {
  method: string;
  args?: Record<string, unknown>;
  type?: "GET" | "POST";
}

interface FrappeCallResponse<T> {
  message: T;
}

interface FrappeGlobal {
  call: <T = unknown>(opts: FrappeCallOpts) => Promise<FrappeCallResponse<T>>;
  /** Unwraps `.message` itself -- what the desk's own ask_alaiy.js uses for
   * every non-multipart call. */
  xcall: <T = unknown>(method: string, args?: Record<string, unknown>) => Promise<T>;
  csrf_token: string;
  session: { user: string };
  boot: { sysdefaults?: { company?: string } };
  fullname: (user: string) => string;
  get_route_str: () => string;
}

interface Window {
  frappe?: FrappeGlobal;
}

declare const frappe: FrappeGlobal;
