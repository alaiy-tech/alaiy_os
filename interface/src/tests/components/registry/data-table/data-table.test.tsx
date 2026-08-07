import type { ColumnDef } from "@tanstack/react-table";
import { render, screen } from "@testing-library/react";
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

const { OsDataTable } = await import("@/components/registry/data-table/data-table");

type Row = { id: string; name: string };

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
];

describe("OsDataTable - pagination contract", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("with pagination+pageParam: shows only the given rows (no client re-slicing), no 'of N' text", () => {
    const rows: Row[] = Array.from({ length: 3 }, (_, i) => ({ id: `R${i}`, name: `Row ${i}` }));
    render(
      <OsDataTable
        data={rows}
        columns={columns}
        pagination={{ page: 1, pageSize: 3, hasMore: false }}
        pageParam="customers_page"
      />,
    );

    expect(screen.getAllByText(/^Row \d$/)).toHaveLength(3);
    expect(screen.getByText("Page 1")).toBeInTheDocument();
    expect(screen.queryByText(/of \d+/)).not.toBeInTheDocument();
  });

  it("with pagination+pageParam: Next is disabled when hasMore is false, enabled when true", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    const { rerender } = render(
      <OsDataTable
        data={rows}
        columns={columns}
        pagination={{ page: 1, pageSize: 10, hasMore: false }}
        pageParam="customers_page"
      />,
    );
    expect(screen.getByLabelText("Go to next page")).toHaveClass("pointer-events-none");

    rerender(
      <OsDataTable
        data={rows}
        columns={columns}
        pagination={{ page: 1, pageSize: 10, hasMore: true }}
        pageParam="customers_page"
      />,
    );
    expect(screen.getByLabelText("Go to next page")).not.toHaveClass("pointer-events-none");
  });

  it("with pagination+pageParam: clicking Next writes page+1 to the named URL param", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    render(
      <OsDataTable
        data={rows}
        columns={columns}
        pagination={{ page: 2, pageSize: 10, hasMore: true }}
        pageParam="customers_page"
      />,
    );

    screen.getByLabelText("Go to next page").click();

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("customers_page=3");
  });

  it("with pagination but no pageParam: both Next and Previous render disabled", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    render(<OsDataTable data={rows} columns={columns} pagination={{ page: 2, pageSize: 10, hasMore: true }} />);

    expect(screen.getByLabelText("Go to next page")).toHaveClass("pointer-events-none");
    expect(screen.getByLabelText("Go to previous page")).toHaveClass("pointer-events-none");
  });

  it("with neither prop set: today's client-paginated behavior is unchanged (regression)", () => {
    const rows: Row[] = Array.from({ length: 15 }, (_, i) => ({ id: `R${i}`, name: `Row ${i}` }));
    render(<OsDataTable data={rows} columns={columns} pageSize={10} />);

    // Client-side slicing: only the first page's worth of rows render.
    expect(screen.getAllByText(/^Row \d+$/)).toHaveLength(10);
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
  });
});
