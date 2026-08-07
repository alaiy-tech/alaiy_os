import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, usePathnameMock, useSearchParamsMock } = vi.hoisted(() => ({
  replace: vi.fn(),
  usePathnameMock: vi.fn(() => "/os/suppliers"),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: usePathnameMock,
  useSearchParams: useSearchParamsMock,
}));

const { useSortParam } = await import("@/components/registry/data-table/use-sort-param");

describe("useSortParam", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("returns null when the param is absent", () => {
    const { result } = renderHook(() => useSortParam("suppliers_sort"));
    expect(result.current.value).toBeNull();
  });

  it("reads the current value from the named param", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("suppliers_sort=supplier_name+desc"));
    const { result } = renderHook(() => useSortParam("suppliers_sort"));
    expect(result.current.value).toBe("supplier_name desc");
  });

  it("setValue writes the named param and preserves unrelated existing params", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("orders_sort=name+asc&other=keep"));
    const { result } = renderHook(() => useSortParam("suppliers_sort"));

    result.current.setValue("supplier_name asc");

    expect(replace).toHaveBeenCalledTimes(1);
    const [url, opts] = replace.mock.calls[0];
    expect(url).toContain("suppliers_sort=supplier_name+asc");
    expect(url).toContain("orders_sort=name+asc");
    expect(url).toContain("other=keep");
    expect(opts).toEqual({ scroll: false });
  });

  it("setValue(null) deletes the param", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("suppliers_sort=name+asc"));
    const { result } = renderHook(() => useSortParam("suppliers_sort"));

    result.current.setValue(null);

    const [url] = replace.mock.calls[0];
    expect(url).not.toContain("suppliers_sort");
  });

  it("setValue clears every param listed in resetParams in the same navigation", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("suppliers_page=3"));
    const { result } = renderHook(() => useSortParam("suppliers_sort", ["suppliers_page"]));

    result.current.setValue("supplier_name asc");

    const [url] = replace.mock.calls[0];
    expect(url).not.toContain("suppliers_page");
    expect(url).toContain("suppliers_sort=supplier_name+asc");
  });

  it("does nothing when paramName is empty (no stable identity to write to)", () => {
    const { result } = renderHook(() => useSortParam(""));
    result.current.setValue("supplier_name asc");
    expect(replace).not.toHaveBeenCalled();
  });
});
