"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { toast } from "sonner";

import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  type Agent,
  AgentSettingsApiError,
  listAgents,
  setAgentEnabled,
  setAgentRunAsUser,
} from "@/lib/frappe/agent-settings";

import { AgentCard } from "./agent-card";
import { EnableDialog } from "./enable-dialog";

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof AgentSettingsApiError ? error.message : fallback;
}

function AgentCardSkeleton() {
  return (
    <Card className="gap-0 p-4">
      <div className="flex items-start gap-3">
        <Skeleton className="mt-1 size-4 shrink-0 rounded-sm" />
        <Skeleton className="mt-0.5 size-4 shrink-0 rounded-sm" />
        <div className="flex-1 space-y-2.5">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-3.5 w-72 max-w-full" />
          <div className="flex gap-1.5 pt-0.5">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-5 w-28" />
          </div>
        </div>
        <Skeleton className="mt-1 h-[18px] w-8 shrink-0 rounded-full" />
      </div>
    </Card>
  );
}

function Header({ count, needingAttention }: { readonly count: number | null; readonly needingAttention: number }) {
  return (
    <PageHeader
      title="Agents"
      subtitle="Agents read your data as a service user. This page shows what each one needs, whether its user has it, and lets you turn it on."
      action={
        count !== null && (
          <span className="text-muted-foreground text-sm">
            {count} registered{needingAttention > 0 ? ` · ${needingAttention} needs attention` : ""}
          </span>
        )
      }
    />
  );
}

export function AgentSettings() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [pendingAgentId, setPendingAgentId] = useState<string | null>(null);
  const [gatedAgent, setGatedAgent] = useState<Agent | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await listAgents();
      setAgents(result);
      setForbidden(false);
      setFetchError(null);
    } catch (error) {
      if (error instanceof AgentSettingsApiError && error.status === 403) {
        setForbidden(true);
        setFetchError(null);
      } else {
        setFetchError(errorMessage(error, "Could not load agents."));
      }
    } finally {
      setHasLoadedOnce(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const needingAttention = useMemo(
    () => (agents ?? []).filter((agent) => !agent.permissions_satisfied).length,
    [agents],
  );

  async function handleToggle(agent: Agent, next: boolean) {
    if (next && !agent.permissions_satisfied) {
      // Missing permissions — don't call, ask.
      setGatedAgent(agent);
      return;
    }

    setPendingAgentId(agent.agent_id);
    try {
      await setAgentEnabled(agent.agent_id, next);
      toast.success(`${agent.agent_name} is ${next ? "on" : "off"}.`);
    } catch (error) {
      // A 417 here means the permission check that gated this call (or the
      // fact that it wasn't gated at all, for a plain disable) is now stale
      // -- a role revoked while the page was open, say. Refetch either way:
      // readiness is computed server-side and never guessed client-side.
      toast.error(errorMessage(error, `Could not ${next ? "enable" : "disable"} the agent.`));
    } finally {
      await load();
      setPendingAgentId(null);
    }
  }

  async function handleEnableAnyway(agent: Agent): Promise<boolean> {
    try {
      await setAgentEnabled(agent.agent_id, true, true);
      toast.success(`${agent.agent_name} is on, with permissions missing.`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Could not enable the agent."));
      return false;
    } finally {
      await load();
    }
  }

  async function handleChangeRunAsUser(agent: Agent, user: string): Promise<boolean> {
    try {
      const updated = await setAgentRunAsUser(agent.agent_id, user);
      toast.success(`${agent.agent_name} now runs as ${updated.run_as_user}.`);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Could not change the run-as user."));
      return false;
    } finally {
      await load();
    }
  }

  if (!hasLoadedOnce) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Header count={null} needingAttention={0} />
        <div className="space-y-3">
          <AgentCardSkeleton />
          <AgentCardSkeleton />
          <AgentCardSkeleton />
        </div>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Header count={null} needingAttention={0} />
        <Alert>
          <AlertTitle>You need the System Manager role to manage agents.</AlertTitle>
        </Alert>
      </div>
    );
  }

  if (fetchError && agents === null) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Header count={null} needingAttention={0} />
        <Alert variant="destructive">
          <AlertTitle>{fetchError}</AlertTitle>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => load()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      </div>
    );
  }

  const list = agents ?? [];

  return (
    <div className="flex h-full flex-col gap-4">
      <Header count={list.length} needingAttention={needingAttention} />

      {fetchError && (
        <Alert variant="destructive">
          <AlertTitle>{fetchError}</AlertTitle>
          <AlertDescription>Showing the last agents loaded successfully.</AlertDescription>
          <AlertAction>
            <Button size="sm" variant="outline" onClick={() => load()}>
              Retry
            </Button>
          </AlertAction>
        </Alert>
      )}

      {list.length === 0 ? (
        <Alert>
          <AlertTitle>No agents are registered.</AlertTitle>
          <AlertDescription>
            Agents register on migrate. Run{" "}
            <code className="rounded bg-muted px-1 py-0.5 font-mono text-foreground text-xs">
              bench --site &lt;site&gt; migrate
            </code>
            , then reload.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {list.map((agent) => (
            <AgentCard
              key={agent.agent_id}
              agent={agent}
              defaultOpen={!agent.permissions_satisfied}
              pending={pendingAgentId === agent.agent_id}
              onToggle={handleToggle}
            />
          ))}
        </div>
      )}

      <EnableDialog
        agent={gatedAgent}
        onOpenChange={(open) => !open && setGatedAgent(null)}
        onEnableAnyway={handleEnableAnyway}
        onChangeRunAsUser={handleChangeRunAsUser}
      />
    </div>
  );
}
