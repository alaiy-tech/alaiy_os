import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FrappeCountSourceConfig } from "@/types/runtime/frappe-count";

const { frappeFetch } = vi.hoisted(() => ({ frappeFetch: vi.fn() }));
vi.mock("@/lib/frappe/server", () => ({ frappeFetch }));

const { resolveFrappeCount } = await import("@/runtime/data/frappe-count-resolver");

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

function config(overrides: Partial<FrappeCountSourceConfig> = {}): FrappeCountSourceConfig {
  return { type: "frappe-count", doctype: "Customer", ...overrides };
}

describe("resolveFrappeCount", () => {
  beforeEach(() => {
    frappeFetch.mockReset();
  });

  it("builds the doctype query param and hits frappe.client.get_count", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 5 }));
    await resolveFrappeCount(config());

    const path = String(frappeFetch.mock.calls[0][0]);
    expect(path).toContain("/api/method/frappe.client.get_count");
    const query = new URLSearchParams(path.split("?")[1]);
    expect(query.get("doctype")).toBe("Customer");
    expect(query.has("filters")).toBe(false);
  });

  it("serializes filters as [field, operator, value] triples", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 2 }));
    await resolveFrappeCount(config({ filters: [{ field: "disabled", operator: "=", value: 0 }] }));

    const path = String(frappeFetch.mock.calls[0][0]);
    const query = new URLSearchParams(path.split("?")[1]);
    expect(JSON.parse(query.get("filters") ?? "[]")).toEqual([["disabled", "=", 0]]);
  });

  it("returns the parsed message on success", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({ message: 42 }));
    expect(await resolveFrappeCount(config())).toBe(42);
  });

  it("returns 0 when message is absent", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({}));
    expect(await resolveFrappeCount(config())).toBe(0);
  });

  it("returns 0 on a non-ok response, without throwing", async () => {
    frappeFetch.mockResolvedValue(jsonResponse({}, false));
    await expect(resolveFrappeCount(config())).resolves.toBe(0);
  });
});
