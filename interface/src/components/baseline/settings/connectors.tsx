"use client";

import { useCallback, useEffect, useState } from "react";

import Link from "next/link";

import type { LucideIcon } from "lucide-react";
import {
  Cloud,
  CreditCard,
  Database,
  Factory,
  Globe,
  Package,
  Plug,
  Ship,
  ShoppingBag,
  ShoppingCart,
  Store,
  Truck,
  Warehouse,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/primitive/badge";
import { Button } from "@/components/primitive/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/primitive/card";
import {
  Empty,
  EmptyDescription,
  EmptyTitle,
} from "@/components/primitive/empty";
import { Skeleton } from "@/components/primitive/skeleton";
import { STATUS_TONE } from "@/constants/list";
import { formatDateTime, labelOr } from "@/utils/format";
import { fetchConnectors } from "@/lib/frappe/connectors";
import { cn } from "@/utils";
import type { ConnectorRegistryRow } from "@/types/connectors";

/**
 * A registry row's `icon` is a lucide name in lower-kebab-case, the same
 * convention the composer accepts for nav entries — but a nav icon is resolved
 * at compose time into a static import, and these rows only exist at runtime.
 * Looking a name up against lucide's full record would pull all ~1700 icons
 * into this route's bundle to render one, so the base keeps a short list of the
 * shapes a connector plausibly asks for and falls back to `Plug`. An unlisted
 * name costs a connector nothing but its glyph; `icon_url` is the way to ship
 * a real logo.
 */
const CONNECTOR_ICONS: Record<string, LucideIcon> = {
  cloud: Cloud,
  "credit-card": CreditCard,
  database: Database,
  factory: Factory,
  globe: Globe,
  package: Package,
  plug: Plug,
  ship: Ship,
  "shopping-bag": ShoppingBag,
  "shopping-cart": ShoppingCart,
  store: Store,
  truck: Truck,
  warehouse: Warehouse,
  zap: Zap,
};

/** `connection_status` is a Select of untested / connected / failed, and is
 * blank on a row nothing has tested yet — which reads the same as untested. */
const STATUS_TONE_FOR: Record<string, string> = {
  connected: STATUS_TONE.success,
  failed: STATUS_TONE.destructive,
  untested: STATUS_TONE.neutral,
};

function ConnectorGlyph({ connector }: { connector: ConnectorRegistryRow }) {
  const Icon = CONNECTOR_ICONS[connector.icon?.trim() ?? ""] ?? Plug;

  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
      <Icon className="size-4" />
    </span>
  );
}

function ConnectorCard({ connector }: { connector: ConnectorRegistryRow }) {
  const status = labelOr(connector.connection_status, "untested");

  return (
    <Link
      href={`/settings/connectors/${connector.connector_id}`}
      className="rounded-xl focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
    >
      <Card className="h-full transition-colors hover:border-border hover:bg-muted/40">
        {/* Title, description and action as direct children: CardHeader is a
            grid and CardAction places itself in column two across both rows, so
            wrapping them in a div would collapse that layout. */}
        <CardHeader>
          <CardTitle className="flex min-w-0 items-center gap-2">
            <ConnectorGlyph connector={connector} />
            <span className="min-w-0 break-words">
              {connector.connector_name}
            </span>
          </CardTitle>
          <CardDescription className="line-clamp-2">
            {labelOr(connector.description, connector.connector_app)}
          </CardDescription>
          <CardAction>
            <Badge
              variant="outline"
              className={cn(
                "border-0 font-medium capitalize",
                STATUS_TONE_FOR[status] ?? STATUS_TONE.neutral,
              )}
            >
              {status}
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-sm">
          {connector.connector_type && (
            <Badge
              variant="outline"
              className="border-0 bg-muted font-normal text-xs capitalize"
            >
              {connector.connector_type}
            </Badge>
          )}
          <span>{connector.is_enabled ? "Enabled" : "Disabled"}</span>
          <span aria-hidden="true">·</span>
          <span>Last tested {formatDateTime(connector.last_tested_at)}</span>
        </CardContent>
      </Card>
    </Link>
  );
}

/**
 * Every row in `OS Connector Registry`, each linking to that connector's own
 * settings screen at `/settings/connectors/<connector_id>`.
 *
 * The base renders the index but none of the screens behind it: a connector's
 * settings are the one place its own vocabulary matters, so the screen ships
 * with the app whose fields it explains and lands on that route when the
 * workspace is composed (see CONNECTOR_TO_BASE_UI_COMPOSITION.md). A connector
 * registered without one is a packaging gap, and shows up here as a card whose
 * link has nowhere to go — which is the point of having an index at all.
 */
export function Connectors() {
  const [connectors, setConnectors] = useState<ConnectorRegistryRow[] | null>(
    null,
  );
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(async () => {
    setLoadFailed(false);
    setConnectors(null);
    try {
      setConnectors(await fetchConnectors());
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loadFailed) {
    return (
      <Empty className="py-10">
        <EmptyTitle>Could not load connectors</EmptyTitle>
        <EmptyDescription>
          Make sure you&apos;re signed in, then try again.
        </EmptyDescription>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Retry
        </Button>
      </Empty>
    );
  }

  if (connectors === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder cards have no identity
          <Skeleton key={index} className="h-32 rounded-xl" />
        ))}
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <Empty className="py-10">
        <EmptyTitle>No connectors registered</EmptyTitle>
        <EmptyDescription>
          Installing a connector app registers it here on the next migration.
          Nothing is installed yet.
        </EmptyDescription>
      </Empty>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {connectors.map((connector) => (
        <ConnectorCard key={connector.connector_id} connector={connector} />
      ))}
    </div>
  );
}
