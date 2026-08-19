// Server-only: reads interface/public/ui-config/**.json from disk via Node's
// `fs`/`path` modules. Never import this from a "use client" module - same
// convention as src/lib/frappe/server.ts (documented in a comment, not
// enforced by the "server-only" package, which isn't a dependency here;
// Node builtins simply don't exist in a browser bundle, so Next's own
// bundler already refuses to ship this into client code).

import { validatePageConfig } from "../schema/validate";
import { InvalidPageConfigError, type PageConfigFile, type UIPageStore } from "./page-store";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const CONFIG_ROOT = path.join(process.cwd(), "public", "ui-config");
const SEGMENT_PATTERN = /^[a-z0-9-]+$/;

/** Turns route segments into a safe path under `CONFIG_ROOT`. Rejects `..`,
 * absolute paths, and anything outside the allowlisted lowercase
 * alphanumeric-plus-hyphen character set outright - a segment that doesn't
 * match never reaches the filesystem at all. The resolved path is then
 * re-checked to still be inside `CONFIG_ROOT` as defense in depth. */
function resolveConfigPath(segments: string[]): string | null {
  if (segments.length === 0 || segments.some((segment) => !SEGMENT_PATTERN.test(segment))) return null;

  const resolved = `${path.join(CONFIG_ROOT, ...segments)}.json`;
  const normalizedRoot = path.normalize(CONFIG_ROOT + path.sep);
  if (!path.normalize(resolved).startsWith(normalizedRoot)) return null;

  return resolved;
}

/** `/os/<id>` is this app's whole dynamic-page namespace - deriving the id
 * from the route this way keeps the store from having to scan every config
 * file just to answer "what's at this route." */
function routeToId(route: string): string | null {
  const match = /^\/os\/(.+)$/.exec(route);
  return match ? match[1] : null;
}

async function readAndValidate(filePath: string): Promise<PageConfigFile | null> {
  let raw: string;
  try {
    raw = await readFile(filePath, "utf-8");
  } catch {
    return null; // no file here - an ordinary "nothing configured yet", not an error
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (error) {
    throw new InvalidPageConfigError([`${filePath}: not valid JSON (${(error as Error).message})`]);
  }

  const result = validatePageConfig(json);
  // `=== false`, not `!result.ok`: TypeScript's control-flow narrowing on a
  // boolean-literal discriminant (`ok: true | false`) only reliably applies
  // to explicit equality checks, not plain truthiness/negation - confirmed
  // against a minimal repro against this exact TS version (5.9.3) before
  // "fixing" what looked like a real bug in `ValidationResult` itself.
  if (result.ok === false) throw new InvalidPageConfigError(result.errors);

  return result.page;
}

async function walkJsonFiles(dir: string): Promise<string[]> {
  // Reading the call's result directly (rather than pre-declaring a variable
  // typed via `ReturnType<typeof readdir>`) lets TS resolve the right
  // overload from the actual arguments - `readdir`'s overloads differ by
  // encoding, and `ReturnType<typeof fn>` on an overloaded function only
  // ever sees the last signature, which returns `Dirent<Buffer>[]` here.
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);

  const files: string[] = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...(await walkJsonFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".json")) files.push(entryPath);
  }
  return files;
}

/** Reads page definitions from `interface/public/ui-config/<id>.json` (`id`
 * may contain `/` for nested pages, e.g. `"headless/customers"` ->
 * `public/ui-config/headless/customers.json`). The current, developer-time
 * representation of runtime page definitions - a future `FrappePageStore`
 * implements `UIPageStore` against a database table instead. */
export class JsonFilePageStore implements UIPageStore {
  async getPageById(id: string): Promise<PageConfigFile | null> {
    const filePath = resolveConfigPath(id.split("/"));
    if (!filePath) return null;
    return readAndValidate(filePath);
  }

  async getPageByRoute(route: string): Promise<PageConfigFile | null> {
    const id = routeToId(route);
    if (!id) return null;
    return this.getPageById(id);
  }

  async listPages(): Promise<PageConfigFile[]> {
    const files = await walkJsonFiles(CONFIG_ROOT);
    const pages: PageConfigFile[] = [];
    for (const file of files) {
      try {
        const page = await readAndValidate(file);
        if (page) pages.push(page);
      } catch {
        // an individually invalid file shouldn't fail the whole listing
      }
    }
    return pages;
  }
}

let store: UIPageStore | null = null;

/** The single place the rest of the app asks for "the current page store" -
 * swapping `JsonFilePageStore` for a future `FrappePageStore` is a one-line
 * change here. */
export function getPageStore(): UIPageStore {
  if (!store) store = new JsonFilePageStore();
  return store;
}
