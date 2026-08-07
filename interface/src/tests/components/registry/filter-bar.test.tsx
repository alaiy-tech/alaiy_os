import { fireEvent, render, screen } from "@testing-library/react";
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

const { OsFilterBar } = await import("@/components/registry/filter-bar");

describe("OsFilterBar - resetPageParams", () => {
  beforeEach(() => {
    replace.mockReset();
  });

  it("clears every listed param when a filter value changes", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("customers_page=3"));
    render(
      <OsFilterBar
        filters={[{ id: "group", type: "text", label: "Group", searchParam: "customer_group" }]}
        resetPageParams={["customers_page"]}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Group"), { target: { value: "Retail" } });

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("customer_group=Retail");
    expect(url).not.toContain("customers_page");
  });

  it("clears every listed param on Reset, alongside the filter's own", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("customer_group=Retail&customers_page=3"));
    render(
      <OsFilterBar
        filters={[{ id: "group", type: "text", label: "Group", searchParam: "customer_group" }]}
        resetPageParams={["customers_page"]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).not.toContain("customer_group");
    expect(url).not.toContain("customers_page");
  });

  it("behaves exactly as before when resetPageParams is omitted (regression)", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    render(<OsFilterBar filters={[{ id: "group", type: "text", label: "Group", searchParam: "customer_group" }]} />);

    fireEvent.change(screen.getByPlaceholderText("Group"), { target: { value: "Retail" } });

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("customer_group=Retail");
  });
});
