"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setPermissionAction, type ChannelActionState } from "./actions";
import { Alert, Pill, Select, Spinner } from "@/components/ui";
import type {
  ChannelId,
  ChannelPermission,
  PermissionDecision,
} from "@/lib/backend/types";

/**
 * What the seller granted this channel, and what Alaiy may do with each of it.
 *
 * The list on the channel's consent screen is the last time most sellers see
 * it: they read it once, approve, and from then on "what can Alaiy actually
 * read from my Amazon account?" has no answer inside the product. This is that
 * answer, on the card for the connection it belongs to, with the labels the
 * channel itself used so the two can be read side by side.
 *
 * A disclosure rather than a section, closed by default, for the same reason
 * the order flag rules are: a card whose first screenful is five permission
 * rows has buried the two controls a seller came here for. The summary line
 * carries the part worth seeing without opening it — that something is
 * narrowed, when something is.
 *
 * One `useActionState` for the whole section rather than one per row. The rows
 * share a backend call and a failure mode, and five independent error slots
 * would let two stale messages sit under two different dropdowns.
 */

const DECISION_OPTIONS: { value: PermissionDecision; label: string }[] = [
  { value: "allowed", label: "Always allow" },
  { value: "needs_approval", label: "Needs approval" },
  { value: "blocked", label: "Blocked" },
];

/** The one-liner under the list, per decision. */
const DECISION_HELP: Record<PermissionDecision, string> = {
  allowed: "Used whenever it's needed, including on our own schedule.",
  needs_approval: "Only used when you ask for it here — never on our own.",
  blocked: "Never used, asked for or not.",
};

export function ChannelPermissions({
  channel,
  name,
  connected,
  permissions,
}: {
  channel: ChannelId;
  name: string;
  /** Unconnected channels get the list to read, not to set. */
  connected: boolean;
  /** Null when the read failed — the list is context, so the card survives it. */
  permissions: ChannelPermission[] | null;
}) {
  const [state, formAction] = useActionState<ChannelActionState, FormData>(
    setPermissionAction,
    {},
  );

  if (permissions === null) {
    return (
      <p className="border-t border-line px-5 py-3 text-[12px] text-muted">
        We couldn&apos;t load what {name} is allowed to do. Your syncing is
        unaffected — try again in a moment.
      </p>
    );
  }
  if (permissions.length === 0) return null;

  // A core permission off its default is the one thing on this card that
  // changes what the rest of the app can show, so it is said in full rather
  // than counted. Orders stopping is not a detail inside a disclosure.
  //
  // Split by decision rather than lumped into "narrowed", because the two
  // consequences are different and a seller acting on the wrong one has been
  // misled: blocked stops the data, needs-approval only stops it arriving by
  // itself. Which rows feed which screen is deliberately not claimed here —
  // that is what the row's own summary is for, and a warning that says "your
  // orders and products" above a single narrowed role is wrong about one of
  // them.
  const coreBlocked = permissions.filter((row) => row.core && row.decision === "blocked");
  const coreAsking = permissions.filter(
    (row) => row.core && row.decision === "needs_approval",
  );

  return (
    <details className="group border-t border-line">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-5 py-3 text-[12px] text-muted transition-colors hover:text-primary-600">
        <span
          aria-hidden
          className="text-[10px] transition-transform group-open:rotate-90"
        >
          ▶
        </span>
        Permissions — {summarise(permissions, connected)}
      </summary>

      <div className="space-y-3 border-t border-line px-5 py-4">
        {/* Two readings of the same list, because an unconnected channel has
            granted nothing. Saying "what you approved when you connected
            Shopify" above a channel that is not connected presents access we
            do not have as access we were given, which is the one thing this
            screen exists to be straight about. */}
        <p className="text-[12px] leading-snug text-muted">
          {connected ? (
            <>
              What you approved when you connected {name}, and what we may do
              with each. Changing one here takes effect on the next sync; it
              does not change anything on your {name} account.
            </>
          ) : (
            <>
              What connecting {name} would ask for. Nothing here is granted
              until you connect it, and you can narrow any of it afterwards.
            </>
          )}
        </p>

        {coreBlocked.length || coreAsking.length ? (
          <Alert tone="warn">
            {coreBlocked.length ? (
              <>
                {list(coreBlocked)} {coreBlocked.length === 1 ? "is" : "are"}{" "}
                blocked, so what {name} sends us through{" "}
                {coreBlocked.length === 1 ? "it" : "them"} stops updating
                altogether.{" "}
              </>
            ) : null}
            {coreAsking.length ? (
              <>
                {list(coreAsking)}{" "}
                {coreAsking.length === 1 ? "needs" : "need"} your approval, so{" "}
                {coreAsking.length === 1 ? "it" : "they"} will only refresh when
                you press Sync now.
              </>
            ) : null}
          </Alert>
        ) : null}

        {state.error ? <Alert>{state.error}</Alert> : null}

        <ul className="divide-y divide-line">
          {permissions.map((permission) => (
            <li
              key={permission.id}
              className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-medium text-ink">
                    {permission.label}
                  </p>
                  {permission.core ? <Pill tone="neutral">Core</Pill> : null}
                </div>
                <p className="text-[12px] leading-snug text-muted">
                  {permission.summary}
                </p>
                {/* The channel's own names for it. Monospaced and quiet: it
                    is a string to match against Seller Central or the Shopify
                    admin, not a sentence to read.
                    Dropped when it only repeats the label, which is every
                    Amazon row — an SP-API role's name on the consent screen is
                    the role. Printing "Product Listing" under "Product
                    Listing" reads as a stutter and teaches a seller to skip
                    the line on the rows where it does carry something. */}
                {grantNote(permission) ? (
                  <p className="font-data text-[11px] text-muted-soft">
                    {grantNote(permission)}
                  </p>
                ) : null}
              </div>

              {connected ? (
                <DecisionForm
                  channel={channel}
                  permission={permission}
                  resetKey={String(state.attempt ?? 0)}
                  formAction={formAction}
                />
              ) : (
                <p className="text-[12px] text-muted-soft">
                  Not connected yet
                </p>
              )}
            </li>
          ))}
        </ul>

        {/* The legend, and only where the controls it describes are. The term
            does not wrap — a two-word setting broken across two lines stops
            reading as the name of a setting. */}
        {connected ? (
          <dl className="space-y-0.5 text-[11.5px] text-muted-soft">
            {DECISION_OPTIONS.map((option) => (
              <div key={option.value} className="flex gap-1.5">
                <dt className="shrink-0 font-medium whitespace-nowrap text-muted">
                  {option.label}
                </dt>
                <dd>{DECISION_HELP[option.value]}</dd>
              </div>
            ))}
          </dl>
        ) : null}
      </div>
    </details>
  );
}

/** "A", or "A and B", or "A, B and C". */
function list(permissions: ChannelPermission[]): string {
  const labels = permissions.map((permission) => permission.label);
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

/**
 * The channel's own name for a permission, when it is not the name already
 * shown above it. Empty means there is nothing more to say.
 */
function grantNote(permission: ChannelPermission): string {
  const grants = permission.grants.join(", ");
  return grants === permission.label ? "" : grants;
}

/**
 * "all allowed", or the counts that are not — and on an unconnected channel,
 * neither, because nothing has been granted and nothing is being allowed.
 */
function summarise(permissions: ChannelPermission[], connected: boolean): string {
  if (!connected) return `${permissions.length} we'd ask for`;

  const counts = { allowed: 0, needs_approval: 0, blocked: 0 };
  for (const permission of permissions) counts[permission.decision] += 1;

  if (counts.allowed === permissions.length) {
    return `${permissions.length} granted, all allowed`;
  }
  return [
    counts.allowed ? `${counts.allowed} allowed` : null,
    counts.needs_approval ? `${counts.needs_approval} needs approval` : null,
    counts.blocked ? `${counts.blocked} blocked` : null,
  ]
    .filter(Boolean)
    .join(", ");
}

/**
 * One row's dropdown.
 *
 * Submits on change, so the dropdown is the control rather than something to
 * confirm afterwards — and carries a screen-reader-only submit so it is still
 * operable by keyboard alone and before hydration, which a change handler is
 * not.
 *
 * Uncontrolled, and remounted by `key` whenever the stored value changes. Both
 * halves of that are load-bearing, and each was arrived at by watching the
 * other fail:
 *
 *   * A plain uncontrolled select never picks up the new value at all. The
 *     action ends in `refresh()`, and React does not push a fresh
 *     `defaultValue` into a select someone has already touched — so the row
 *     went on reading "Always allow" under a summary line counting a blocked
 *     permission.
 *   * A *controlled* select loses to React's own restore. Changing a
 *     controlled input queues a synchronous restore of the DOM to the last
 *     value React rendered synchronously; the new value arrives on a
 *     transition, so the restore lands last and puts the old value back — the
 *     same lie, now with React agreeing internally that the element reads
 *     "blocked".
 *
 * Keying on the stored value sidesteps both: the seller's pick stays in an
 * untouched DOM node while the action is in flight, and the answer arrives as
 * a different node. `resetKey` puts the action's settle count in that key as
 * well, so a *failed* change is undone too rather than left on screen having
 * never been saved. The count rather than the error text, which was the first
 * attempt at this: two consecutive failures return the same message — the
 * `OUR_FAULT` fallback is a constant — so the key held still and the node was
 * reused, and the seller's second unsaved choice stayed put.
 */
function DecisionForm({
  channel,
  permission,
  resetKey,
  formAction,
}: {
  channel: ChannelId;
  permission: ChannelPermission;
  resetKey: string;
  formAction: (formData: FormData) => void;
}) {
  return (
    <form action={formAction} className="flex shrink-0 items-center gap-2">
      <input type="hidden" name="channel" value={channel} />
      <input type="hidden" name="permission" value={permission.id} />
      <DecisionSelect
        key={`${permission.decision}|${resetKey}`}
        permission={permission}
      />
    </form>
  );
}

function DecisionSelect({ permission }: { permission: ChannelPermission }) {
  const { pending } = useFormStatus();
  return (
    <>
      {pending ? <Spinner className="text-muted" /> : null}
      <Select
        name="decision"
        size="sm"
        aria-label={`${permission.label} permission`}
        defaultValue={permission.decision}
        disabled={pending}
        options={DECISION_OPTIONS}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      />
      <button type="submit" className="sr-only">
        Apply
      </button>
    </>
  );
}
