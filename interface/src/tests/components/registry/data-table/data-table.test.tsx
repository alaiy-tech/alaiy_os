import type { ReactElement } from "react";

import type { ColumnDef } from "@tanstack/react-table";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TooltipProvider } from "@/components/primitive/tooltip";

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

/** `searchable`/`filterable`/`columnVisibility` all default to `true` now, so
 * every render exercises the `FilterPopover`/`ColumnSettingsPopover` triggers
 * (each wrapped in `TooltipWrap`) unless a test opts out - wrap once here
 * rather than in every call site. Uses RTL's `wrapper` option (not a plain
 * `render(<TooltipProvider>{ui}</TooltipProvider>)`) so a test that calls the
 * returned `rerender` stays wrapped too - `rerender` replaces the whole tree
 * at the root, so a wrapper only given at the initial call wouldn't survive
 * a later `rerender(<OsDataTable .../>)`. */
function renderTable(ui: ReactElement) {
  return render(ui, { wrapper: TooltipProvider });
}

type Row = { id: string; name: string };

const columns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  { accessorKey: "name", header: "Name" },
];

// A minimal stand-in for column-spec.tsx's real `SortableHeader` - just
// enough of a clickable header to drive `column.toggleSorting()`, without
// pulling the full declarative column-spec machinery into this test.
const sortableColumns: ColumnDef<Row, unknown>[] = [
  { accessorKey: "id", header: "ID" },
  {
    accessorKey: "name",
    enableSorting: true,
    header: ({ column }) => (
      <button type="button" onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}>
        Name
      </button>
    ),
  },
];

describe("OsDataTable - pagination contract", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("with pagination+pageParam: shows only the given rows (no client re-slicing), no 'of N' text", () => {
    const rows: Row[] = Array.from({ length: 3 }, (_, i) => ({ id: `R${i}`, name: `Row ${i}` }));
    renderTable(
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
    const { rerender } = renderTable(
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
    renderTable(
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
    renderTable(<OsDataTable data={rows} columns={columns} pagination={{ page: 2, pageSize: 10, hasMore: true }} />);

    expect(screen.getByLabelText("Go to next page")).toHaveClass("pointer-events-none");
    expect(screen.getByLabelText("Go to previous page")).toHaveClass("pointer-events-none");
  });

  it("with neither prop set: today's client-paginated behavior is unchanged (regression)", () => {
    const rows: Row[] = Array.from({ length: 15 }, (_, i) => ({ id: `R${i}`, name: `Row ${i}` }));
    renderTable(<OsDataTable data={rows} columns={columns} pageSize={10} />);

    // Client-side slicing: only the first page's worth of rows render.
    expect(screen.getAllByText(/^Row \d+$/)).toHaveLength(10);
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
  });
});

describe("OsDataTable - sort contract", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("with sort+sortParam: the `sort` prop (not a fresh local state) drives the initial direction", () => {
    // Discriminating check: `sortableColumns`' header always toggles to
    // "desc" from an already-"asc" state, but to "asc" from unsorted -
    // starting from `sort="name asc"` and getting "desc" back on click
    // proves the initial state really came from the prop, not a default
    // empty `sorting` array (which would have produced "asc" instead).
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(
      <OsDataTable
        data={rows}
        columns={sortableColumns}
        sort="name asc"
        sortParam="suppliers_sort"
        pagination={{ page: 1, pageSize: 10, hasMore: false }}
        pageParam="suppliers_page"
      />,
    );

    screen.getByRole("button", { name: "Name" }).click();

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("suppliers_sort=name+desc");
  });

  it("with sort+sortParam: clicking a sortable header writes 'field dir' to sortParam and clears pageParam", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(
      <OsDataTable
        data={rows}
        columns={sortableColumns}
        sort="name asc"
        sortParam="suppliers_sort"
        pagination={{ page: 3, pageSize: 10, hasMore: true }}
        pageParam="suppliers_page"
      />,
    );

    screen.getByRole("button", { name: "Name" }).click();

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("suppliers_sort=name");
    expect(url).not.toContain("suppliers_page");
  });

  it("with sort but no sortParam: clicking a sortable header does nothing (no navigation)", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(<OsDataTable data={rows} columns={sortableColumns} sort="name asc" />);

    screen.getByRole("button", { name: "Name" }).click();

    expect(replace).not.toHaveBeenCalled();
  });

  it("with neither prop set: today's local-sort behavior is unchanged (regression)", () => {
    const rows: Row[] = [
      { id: "R0", name: "Charlie" },
      { id: "R1", name: "Alice" },
    ];
    renderTable(<OsDataTable data={rows} columns={sortableColumns} />);

    screen.getByRole("button", { name: "Name" }).click();

    // Purely local TanStack state - no navigation at all.
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("OsDataTable - search contract", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("with searchParam: typing debounces into a URL write, and never locally filters `data`", () => {
    const rows: Row[] = [
      { id: "R0", name: "Alice" },
      { id: "R1", name: "Bob" },
    ];
    renderTable(
      <OsDataTable
        data={rows}
        columns={columns}
        searchable
        searchParam="orders_search"
        pagination={{ page: 1, pageSize: 10, hasMore: false }}
        pageParam="orders_page"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "alice" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("orders_search=alice");
    // Server-driven mode: `data` is assumed already filtered, so both rows
    // given still both render - the box never scans them itself.
    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("with searchParam: writing search also clears pageParam in the same navigation", () => {
    const rows: Row[] = [{ id: "R0", name: "Alice" }];
    renderTable(
      <OsDataTable
        data={rows}
        columns={columns}
        searchable
        searchParam="orders_search"
        pagination={{ page: 3, pageSize: 10, hasMore: true }}
        pageParam="orders_page"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "alice" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("orders_search=alice");
    expect(url).not.toContain("orders_page");
  });

  it("with searchable but no searchParam: today's local in-memory search is unchanged (regression)", () => {
    const rows: Row[] = [
      { id: "R0", name: "Alice" },
      { id: "R1", name: "Bob" },
    ];
    renderTable(<OsDataTable data={rows} columns={columns} searchable />);

    fireEvent.change(screen.getByPlaceholderText("Search..."), { target: { value: "alice" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(screen.getByText("Alice")).toBeInTheDocument();
    expect(screen.queryByText("Bob")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("OsDataTable - toolbar visibility", () => {
  it("with searchable/filterable/columnVisibility all explicitly off: no toolbar row renders", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(
      <OsDataTable data={rows} columns={columns} searchable={false} filterable={false} columnVisibility={false} />,
    );

    expect(screen.queryByRole("button", { name: /Filters/ })).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Search...")).not.toBeInTheDocument();
  });
});

describe("OsDataTable - advanced pagination (external/server mode)", () => {
  beforeEach(() => {
    replace.mockReset();
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
  });

  it("with pageSizeParam: shows the source's current pageSize in the per-page selector", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(
      <OsDataTable
        data={rows}
        columns={columns}
        pagination={{ page: 1, pageSize: 20, hasMore: false }}
        pageParam="orders_page"
        pageSizeParam="orders_page_size"
      />,
    );

    // Not asserting the visible "20" label here: Radix's `SelectValue` only
    // resolves a value's display label once the matching `SelectItem` has
    // mounted at least once (i.e. after the popover has been opened) -
    // asserting it pre-open would test Radix's own internal caching, not
    // this component's props (`value={effectivePageSize}` is correct
    // regardless of what jsdom shows before the first open). The per-page
    // selector has no text label of its own (just the bare Select), so its
    // presence is checked via its `role="combobox"` trigger instead - the
    // only combobox this render produces (no `filterFields`, so no
    // FilterPopover either).
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("without pageSizeParam: no per-page selector renders", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(
      <OsDataTable
        data={rows}
        columns={columns}
        pagination={{ page: 1, pageSize: 20, hasMore: false }}
        pageParam="orders_page"
      />,
    );

    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("with pageParam: typing a page number into 'Go to page' and pressing Enter jumps there", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(
      <OsDataTable
        data={rows}
        columns={columns}
        pagination={{ page: 1, pageSize: 10, hasMore: true }}
        pageParam="orders_page"
      />,
    );

    const input = screen.getByLabelText("Go to page");
    fireEvent.change(input, { target: { value: "5" } });
    fireEvent.keyDown(input, { key: "Enter" });

    const [url] = replace.mock.calls.at(-1) ?? [];
    expect(url).toContain("orders_page=5");
  });

  it("without pageParam: no 'Go to page' input renders", () => {
    const rows: Row[] = [{ id: "R0", name: "Row 0" }];
    renderTable(<OsDataTable data={rows} columns={columns} pagination={{ page: 1, pageSize: 10, hasMore: true }} />);

    expect(screen.queryByLabelText("Go to page")).not.toBeInTheDocument();
  });
});
