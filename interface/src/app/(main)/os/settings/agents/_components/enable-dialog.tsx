"use client";

import { useEffect, useState } from "react";

import { Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Agent } from "@/lib/frappe/agent-settings";
import { searchRunAsUsers, type UserOption } from "@/lib/frappe/user-list";
import { cn } from "@/lib/utils";

const SEARCH_DEBOUNCE_MS = 300;

function RunAsUserPicker({
  currentUser,
  disabled,
  onPick,
}: {
  readonly currentUser: string;
  readonly disabled: boolean;
  readonly onPick: (user: string) => void;
}) {
  const [term, setTerm] = useState("");
  const [options, setOptions] = useState<UserOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    const timeout = setTimeout(() => {
      searchRunAsUsers(term)
        .then((results) => {
          if (!cancelled) setOptions(results);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [term]);

  return (
    <Command className="rounded-md border" shouldFilter={false}>
      <CommandInput placeholder="Search users…" value={term} onValueChange={setTerm} disabled={disabled} />
      <CommandList>
        <CommandEmpty>{isLoading ? "Searching…" : "No users found."}</CommandEmpty>
        <CommandGroup>
          <CommandItem value="__administrator__" disabled={disabled} onSelect={() => onPick("")}>
            <Check className={cn("size-3.5", currentUser === "Administrator" ? "opacity-100" : "opacity-0")} />
            <span>Administrator</span>
            <span className="ml-auto text-muted-foreground text-xs">site-wide</span>
          </CommandItem>
          {options.map((option) => (
            <CommandItem key={option.name} value={option.name} disabled={disabled} onSelect={() => onPick(option.name)}>
              <Check className={cn("size-3.5", currentUser === option.name ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{option.full_name || option.name}</span>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

export function EnableDialog({
  agent,
  onOpenChange,
  onEnableAnyway,
  onChangeRunAsUser,
}: {
  /** null closes the dialog. */
  readonly agent: Agent | null;
  readonly onOpenChange: (open: boolean) => void;
  readonly onEnableAnyway: (agent: Agent) => Promise<boolean>;
  readonly onChangeRunAsUser: (agent: Agent, user: string) => Promise<boolean>;
}) {
  const [view, setView] = useState<"confirm" | "pick-user">("confirm");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every fresh gate opens on the confirmation, never mid-picker from a stale run.
  useEffect(() => {
    if (agent) setView("confirm");
  }, [agent]);

  const open = agent !== null;

  async function handleEnableAnyway() {
    if (!agent) return;
    setIsSubmitting(true);
    const success = await onEnableAnyway(agent);
    setIsSubmitting(false);
    if (success) onOpenChange(false);
  }

  async function handlePickUser(user: string) {
    if (!agent) return;
    setIsSubmitting(true);
    const success = await onChangeRunAsUser(agent, user);
    setIsSubmitting(false);
    if (success) onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        {agent && view === "confirm" && (
          <>
            <DialogHeader>
              <DialogTitle>Grant these permissions first</DialogTitle>
            </DialogHeader>

            <div className="space-y-3 text-sm">
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{agent.agent_name}</span> runs as{" "}
                <span className="font-medium text-foreground">{agent.run_as_user}</span>, which is missing:
              </p>

              <ul className="space-y-1 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                {agent.unmet_permissions.map((permission) => (
                  <li key={permission} className="text-foreground">
                    {permission}
                  </li>
                ))}
              </ul>

              <p className="text-muted-foreground">
                Enabled like this it won't fail — it will report zeros, which looks like a quiet day.
              </p>
            </div>

            <DialogFooter>
              <Button variant="outline" autoFocus onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => setView("pick-user")}>
                Change Run As User
              </Button>
              <Button variant="destructive" disabled={isSubmitting} onClick={handleEnableAnyway}>
                Enable anyway
              </Button>
            </DialogFooter>
          </>
        )}

        {agent && view === "pick-user" && (
          <>
            <DialogHeader>
              <DialogTitle>Change Run As User</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <p className="text-muted-foreground text-sm">
                Choose who <span className="font-medium text-foreground">{agent.agent_name}</span> should read as. Its
                permissions are rechecked immediately against the new user.
              </p>

              <RunAsUserPicker currentUser={agent.run_as_user} disabled={isSubmitting} onPick={handlePickUser} />
            </div>

            <DialogFooter>
              <Button variant="outline" disabled={isSubmitting} onClick={() => setView("confirm")}>
                Back
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
