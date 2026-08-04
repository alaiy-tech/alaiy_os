"use client";

import { useEffect, useMemo, useState } from "react";

import { FileClock, X } from "lucide-react";

import {
  type DateRange,
  DateRangePicker,
} from "@/components/derived/date-range-picker";
import {
  type DocFieldMeta,
  type FilterRow,
  toFrappeFilters,
} from "@/components/derived/list/types";
import { FilterPopover } from "@/components/derived/popover/filter-popover";
import { Button } from "@/components/primitive/button";
import { ButtonGroup } from "@/components/primitive/button-group";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
} from "@/components/primitive/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/primitive/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/primitive/select";
import { Skeleton } from "@/components/primitive/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/primitive/table";
import { TIMESTAMP_FIELD } from "@/constants/logs";
import { useDoctypeMeta } from "@/hooks/use-doctype-meta";
import { toDateParam } from "@/utils/dates";
import { formatDateTime } from "@/utils/format";
import {
  fetchLogCount,
  fetchLogRows,
  fetchLogSources,
} from "@/lib/frappe/logs";
import type { LogRow, LogSource } from "@/types/logs";

import { LogDetailSheet } from "./log-detail-sheet";
import { formatFieldValue, logColumns } from "./log-formatting";

const PAGE_SIZE = 20;

/** The table's three states — loading, empty, and rows — as one component, so
 * each reads as its own case instead of a ternary nested inside the markup. */
function LogTableRows({
  columns,
  rows,
  isLoading,
  onOpen,
}: {
  columns: DocFieldMeta[];
  rows: LogRow[];
  isLoading: boolean;
  onOpen: (name: string) => void;
}) {
  const span = columns.length + 1;

  if (isLoading) {
    return Array.from({ length: 5 }, (_, index) => (
      // biome-ignore lint/suspicious/noArrayIndexKey: placeholder rows have no identity
      <TableRow key={index}>
        <TableCell colSpan={span} className="py-3">
          <Skeleton className="h-4 w-full" />
        </TableCell>
      </TableRow>
    ));
  }

  if (rows.length === 0) {
    return (
      <TableRow>
        <TableCell
          colSpan={span}
          className="h-24 text-center text-muted-foreground"
        >
          Nothing logged in this range.
        </TableCell>
      </TableRow>
    );
  }

  return rows.map((row) => (
    <TableRow
      key={row.name}
      className="cursor-pointer border-border/60"
      onClick={() => onOpen(row.name)}
    >
      <TableCell className="whitespace-nowrap py-3 text-muted-foreground tabular-nums">
        {formatDateTime(row[TIMESTAMP_FIELD] as string | undefined)}
      </TableCell>
      {columns.map((column) => (
        <TableCell key={column.fieldname} className="py-3">
          <span className="line-clamp-2 break-all">
            {formatFieldValue(row[column.fieldname], column.fieldtype)}
          </span>
        </TableCell>
      ))}
    </TableRow>
  ));
}

export function Logs() {
  const [sources, setSources] = useState<LogSource[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const [filterRows, setFilterRows] = useState<FilterRow[]>([]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();
  const [page, setPage] = useState(0);

  const [rows, setRows] = useState<LogRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [openRow, setOpenRow] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetchLogSources()
      .then((result) => {
        if (cancelled) return;
        setSources(result);
        setSelected(result[0]?.doctype ?? null);
      })
      .catch(() => {
        if (!cancelled) setSources([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // useDoctypeMeta needs a doctype before the sources have loaded; an empty
  // string is never a doctype, so its fetch 404s harmlessly and meta stays null.
  const { meta } = useDoctypeMeta(selected ?? "");

  const columns = useMemo(() => (meta ? logColumns(meta.fields) : []), [meta]);

  const filters = useMemo(() => {
    const built = toFrappeFilters(filterRows);
    // `creation` is a Datetime and the picker yields whole days, so the upper
    // bound is compared against the start of the day after the one chosen —
    // "<= 2026-08-19" would otherwise exclude everything logged that day.
    if (dateRange?.from)
      built.push([TIMESTAMP_FIELD, ">=", toDateParam(dateRange.from)]);
    if (dateRange?.to) {
      const dayAfter = new Date(dateRange.to);
      dayAfter.setDate(dayAfter.getDate() + 1);
      built.push([TIMESTAMP_FIELD, "<", toDateParam(dayAfter)]);
    }
    return built;
  }, [filterRows, dateRange]);

  useEffect(() => {
    if (!selected || columns.length === 0) return;

    let cancelled = false;
    setIsLoading(true);

    const fields = Array.from(
      new Set([
        "name",
        TIMESTAMP_FIELD,
        ...columns.map((column) => column.fieldname),
      ]),
    );

    Promise.all([
      fetchLogRows({
        doctype: selected,
        fields,
        filters,
        limitStart: page * PAGE_SIZE,
        limitPageLength: PAGE_SIZE,
      }),
      fetchLogCount(selected, filters),
    ])
      .then(([data, count]) => {
        if (cancelled) return;
        setRows(data);
        setTotalCount(count);
      })
      .catch(() => {
        if (cancelled) return;
        setRows([]);
        setTotalCount(0);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selected, columns, filters, page]);

  /** Anything that changes what the table is looking at invalidates the page
   * number — page 4 of the old result set is rarely page 4 of the new one. */
  function resetPage() {
    setPage(0);
  }

  if (sources === null) {
    return (
      <Card>
        <CardContent className="flex flex-col gap-3 py-6">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    );
  }

  if (sources.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
          <FileClock className="size-6 text-muted-foreground" />
          <p className="font-medium">No logs to show.</p>
          <p className="max-w-md text-muted-foreground text-sm">
            Logs appear here once an app that records them is installed. If one
            already is, you may not have permission to read it.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasNextPage = (page + 1) * PAGE_SIZE < totalCount;
  const firstRow = totalCount === 0 ? 0 : page * PAGE_SIZE + 1;
  const lastRow = Math.min((page + 1) * PAGE_SIZE, totalCount);

  return (
    <>
      <Card className="gap-0">
        <CardHeader className="border-b has-data-[slot=card-action]:grid-cols-1 md:has-data-[slot=card-action]:grid-cols-[1fr_auto]">
          {/* One installed log is the common case, and a picker offering a
              single choice is just furniture. */}
          {sources.length > 1 ? (
            <Select
              value={selected ?? undefined}
              onValueChange={(value) => {
                setSelected(value);
                setFilterRows([]);
                resetPage();
              }}
            >
              <SelectTrigger size="sm" className="w-full md:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sources.map((source) => (
                  <SelectItem key={source.doctype} value={source.doctype}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="font-medium text-sm">{sources[0].label}</span>
          )}

          <CardAction className="col-start-1 row-start-auto flex w-full flex-wrap justify-start gap-2 justify-self-stretch md:col-start-2 md:row-span-2 md:row-start-1 md:w-auto md:flex-nowrap md:justify-end md:justify-self-end">
            <DateRangePicker
              value={dateRange}
              onChange={(range) => {
                setDateRange(range);
                resetPage();
              }}
            />

            <ButtonGroup>
              <FilterPopover
                availableFields={[...(meta?.fields ?? [])]}
                value={filterRows}
                onApply={(applied) => {
                  setFilterRows(applied);
                  resetPage();
                }}
              />
              <Button
                variant="outline"
                size="sm"
                disabled={filterRows.length === 0}
                onClick={() => {
                  setFilterRows([]);
                  resetPage();
                }}
                aria-label="Clear all filters"
              >
                <X />
              </Button>
            </ButtonGroup>
          </CardAction>
        </CardHeader>

        <CardContent className="flex flex-col gap-0 px-0">
          <div className="overflow-x-auto">
            <Table className="w-full **:data-[slot='table-cell']:px-4 **:data-[slot='table-head']:px-4">
              <TableHeader>
                <TableRow>
                  <TableHead className="py-3 font-medium">When</TableHead>
                  {columns.map((column) => (
                    <TableHead
                      key={column.fieldname}
                      className="py-3 font-medium"
                    >
                      {column.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                <LogTableRows
                  columns={columns}
                  rows={rows}
                  isLoading={isLoading}
                  onOpen={(name) => setOpenRow(name)}
                />
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t px-4 py-3">
            <span className="text-muted-foreground text-sm tabular-nums">
              {totalCount === 0
                ? "No entries"
                : `${firstRow}–${lastRow} of ${totalCount}`}
            </span>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    text=""
                    className={
                      page === 0 ? "pointer-events-none opacity-50" : undefined
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 0) setPage(page - 1);
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    text=""
                    className={
                      hasNextPage ? undefined : "pointer-events-none opacity-50"
                    }
                    onClick={(event) => {
                      event.preventDefault();
                      if (hasNextPage) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        </CardContent>
      </Card>

      {selected && (
        <LogDetailSheet
          doctype={selected}
          name={openRow}
          fields={meta?.fields ?? []}
          onClose={() => setOpenRow(null)}
        />
      )}
    </>
  );
}
