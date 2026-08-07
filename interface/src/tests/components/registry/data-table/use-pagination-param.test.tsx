import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, usePathnameMock, useSearchParamsMock } = vi.hoisted(() => ({
  replace: vi.fn(),
  usePathnameMock: vi.fn(() => "/os/headless-data-test"),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: usePathnameMock,
  useSearchParams: useSearchParamsMock,
}));

const { usePaginationParam } = await import("@/components/registry/data-table/use-pagination-param");

describe("usePaginationParam", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("falls back to fallbackPage when the param is absent", () => {
    const { result } = renderHook(() => usePaginationParam("customers_page", 1));
    expect(result.current.page).toBe(1);
  });

  it("reads the current page from the named param", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("customers_page=3"));
    const { result } = renderHook(() => usePaginationParam("customers_page", 1));
    expect(result.current.page).toBe(3);
  });

  it("falls back to fallbackPage for an invalid (non-integer, zero, negative) value", () => {
    for (const raw of ["abc", "0", "-2", "1.5"]) {
      useSearchParamsMock.mockReturnValue(new URLSearchParams(`customers_page=${raw}`));
      const { result } = renderHook(() => usePaginationParam("customers_page", 1));
      expect(result.current.page).toBe(1);
    }
  });

  it("setPage writes the named param and preserves unrelated existing params", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("orders_page=5&other=keep"));
    const { result } = renderHook(() => usePaginationParam("customers_page", 1));

    result.current.setPage(2);

    expect(replace).toHaveBeenCalledTimes(1);
    const [url, opts] = replace.mock.calls[0];
    expect(url).toContain("customers_page=2");
    expect(url).toContain("orders_page=5");
    expect(url).toContain("other=keep");
    expect(opts).toEqual({ scroll: false });
  });

  it("setPage back to the fallback page deletes the param instead of writing it explicitly", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("customers_page=2"));
    const { result } = renderHook(() => usePaginationParam("customers_page", 1));

    result.current.setPage(1);

    const [url] = replace.mock.calls[0];
    expect(url).not.toContain("customers_page");
  });
});
