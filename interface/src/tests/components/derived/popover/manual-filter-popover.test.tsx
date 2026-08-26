import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { replace, usePathnameMock, useSearchParamsMock } = vi.hoisted(() => ({
  replace: vi.fn(),
  usePathnameMock: vi.fn(() => "/os"),
  useSearchParamsMock: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: usePathnameMock,
  useSearchParams: useSearchParamsMock,
}));

const { ManualFilterPopover } = await import("@/components/derived/popover/manual-filter-popover");
const { TooltipProvider } = await import("@/components/primitive/tooltip");

function renderPopover(props: React.ComponentProps<typeof ManualFilterPopover>) {
  return render(
    <TooltipProvider>
      <ManualFilterPopover {...props} />
    </TooltipProvider>,
  );
}

describe("ManualFilterPopover", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("Apply writes every field's own param in one batched navigation, never two sequential ones", () => {
    renderPopover({
      fields: [
        { field: "status", label: "Status", param: "orders_filter_status" },
        { field: "channel", label: "Channel", param: "orders_filter_channel" },
      ],
      resetParams: ["orders_page"],
    });

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByPlaceholderText("Status"), { target: { value: "Open" } });
    fireEvent.change(screen.getByPlaceholderText("Channel"), { target: { value: "Web" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));

    // The critical regression this guards against: writing each field via
    // its own single-param hook call would read the same stale
    // `searchParams` snapshot per call, so the second write would silently
    // undo the first. One call, both fields present, proves it's batched.
    expect(replace).toHaveBeenCalledTimes(1);
    const [url] = replace.mock.calls[0];
    expect(url).toContain("orders_filter_status=Open");
    expect(url).toContain("orders_filter_channel=Web");
  });

  it("Apply also clears every resetParams entry in the same navigation", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("orders_page=3"));
    renderPopover({
      fields: [{ field: "status", label: "Status", param: "orders_filter_status" }],
      resetParams: ["orders_page"],
    });

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.change(screen.getByPlaceholderText("Status"), { target: { value: "Open" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply Filters" }));

    const [url] = replace.mock.calls[0];
    expect(url).toContain("orders_filter_status=Open");
    expect(url).not.toContain("orders_page");
  });

  it("Clear removes every field's param and resetParams in one navigation", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("orders_filter_status=Open&orders_page=3&other=keep"));
    renderPopover({
      fields: [{ field: "status", label: "Status", param: "orders_filter_status" }],
      resetParams: ["orders_page"],
    });

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: "Clear Filters" }));

    const [url] = replace.mock.calls[0];
    expect(url).not.toContain("orders_filter_status");
    expect(url).not.toContain("orders_page");
    expect(url).toContain("other=keep");
  });

  it("shows the active-filter count badge from the current URL, not pending edits", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("orders_filter_status=Open"));
    renderPopover({
      fields: [
        { field: "status", label: "Status", param: "orders_filter_status" },
        { field: "channel", label: "Channel", param: "orders_filter_channel" },
      ],
    });

    expect(screen.getByRole("button", { name: /Filters/ })).toHaveTextContent("1");
  });

  it("no operator picker ever renders - only a value per field", () => {
    renderPopover({ fields: [{ field: "status", label: "Status", param: "orders_filter_status" }] });

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));

    expect(screen.queryByText("Equals")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /operator/i })).not.toBeInTheDocument();
  });
});
