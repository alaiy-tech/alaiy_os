"use client";

import type { LucideIcon } from "lucide-react";
import {
  Bot,
  ChevronRight,
  LineChart,
  PackageSearch,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { TooltipWrap } from "@/components/ui/tooltip-wrap";
import type { Agent, AgentTool } from "@/lib/frappe/agent-settings";
import { cn } from "@/lib/utils";

// The registry stores a lucide-ish kebab-case name per agent. Only the names
// actually in use need to resolve — anything else, including a typo in a
// manifest, quietly falls back to a generic icon rather than crashing.
const AGENT_ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  "trending-up": TrendingUp,
  "trending-down": TrendingDown,
  "bar-chart": LineChart,
  package: PackageSearch,
  "shield-alert": ShieldAlert,
};

function resolveAgentIcon(icon: string | null): LucideIcon {
  return (icon && AGENT_ICONS[icon]) || Bot;
}

function ToolStateChip({ tool }: { readonly tool: AgentTool }) {
  if (!tool.declared) {
    return (
      <Badge variant="outline" className="shrink-0 border-dashed font-normal text-muted-foreground">
        Not declared
      </Badge>
    );
  }

  const missing = tool.permissions.filter((permission) => !permission.granted).length;
  if (missing === 0) {
    return (
      <Badge variant="secondary" className="shrink-0 font-normal">
        Permissions met
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="shrink-0 font-normal">
      {missing} permission{missing === 1 ? "" : "s"} missing
    </Badge>
  );
}

function AgentStatusBadge({ agent }: { readonly agent: Agent }) {
  if (agent.is_enabled && !agent.permissions_satisfied) {
    return (
      <Badge variant="destructive" className="font-normal">
        Enabled · permissions missing
      </Badge>
    );
  }

  if (agent.permissions_satisfied) {
    return (
      <Badge variant="secondary" className="font-normal">
        Permissions met
      </Badge>
    );
  }

  return (
    <Badge variant="destructive" className="font-normal">
      {agent.unmet_permissions.length} permission{agent.unmet_permissions.length === 1 ? "" : "s"} missing
    </Badge>
  );
}

function ToolRow({ tool }: { readonly tool: AgentTool }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium text-sm" title={tool.tool_id}>
            {tool.tool_id}
          </span>
          {tool.connector && (
            <span className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
              {tool.connector}
            </span>
          )}
        </div>
        <ToolStateChip tool={tool} />
      </div>

      {tool.declared ? (
        <div className="space-y-0.5">
          {tool.permissions.map((permission, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: rows are a fixed, ordered snapshot from the server — no identity beyond position
              key={index}
              className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-3 py-0.5 text-sm"
            >
              <span className="truncate text-muted-foreground" title={permission.doctype}>
                {permission.doctype}
              </span>
              <span className="text-muted-foreground text-xs">{permission.ptype}</span>
              <span
                className={cn(
                  "text-right text-xs tabular-nums",
                  permission.granted ? "text-muted-foreground" : "font-medium text-foreground",
                )}
              >
                {permission.granted ? "granted" : "missing"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_4.5rem_4.5rem] items-center gap-x-3 py-0.5 text-sm">
          <span className="text-muted-foreground italic">(declares nothing)</span>
          <span />
          <span className="text-right text-muted-foreground text-xs tabular-nums">not declared</span>
        </div>
      )}
    </div>
  );
}

export function AgentCard({
  agent,
  defaultOpen,
  pending,
  onToggle,
}: {
  readonly agent: Agent;
  readonly defaultOpen: boolean;
  readonly pending: boolean;
  readonly onToggle: (agent: Agent, next: boolean) => void;
}) {
  const AgentIcon = resolveAgentIcon(agent.icon);
  const needsAttention = !agent.permissions_satisfied;

  return (
    <Card className={cn("py-0", needsAttention && "bg-destructive/5")}>
      <Collapsible defaultOpen={defaultOpen} className="group/collapsible">
        <div className="flex items-start gap-3 p-4">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-start gap-3 text-left">
            <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
            <AgentIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />

            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="truncate font-medium">{agent.agent_name}</span>
                {agent.model && <span className="shrink-0 font-mono text-muted-foreground text-xs">{agent.model}</span>}
              </div>

              {agent.description && <p className="text-muted-foreground text-sm">{agent.description}</p>}

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <TooltipWrap
                  label={
                    agent.runs_as_administrator
                      ? "Reads the whole site. Scheduled runs produce site-wide figures."
                      : undefined
                  }
                >
                  <Badge variant="outline" className="font-normal">
                    {agent.runs_as_administrator ? "Runs as Administrator" : `Runs as ${agent.run_as_user}`}
                  </Badge>
                </TooltipWrap>

                <Badge variant={agent.writes ? "destructive" : "outline"} className="font-normal">
                  {agent.writes ? "Writes data" : "Reads only"}
                </Badge>

                <AgentStatusBadge agent={agent} />
              </div>
            </div>
          </CollapsibleTrigger>

          <Switch
            className="mt-1"
            size="default"
            checked={agent.is_enabled}
            disabled={pending}
            aria-label={`${agent.is_enabled ? "Disable" : "Enable"} ${agent.agent_name}`}
            onCheckedChange={(checked) => onToggle(agent, checked)}
          />
        </div>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-dashed px-4 py-3 pl-[3.25rem]">
            {agent.tools.map((tool) => (
              <ToolRow key={tool.tool_id} tool={tool} />
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
