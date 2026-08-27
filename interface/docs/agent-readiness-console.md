# Build spec · Alaiy OS interface

## Agent Readiness Console

The sidebar has linked to `/os/settings/agents` for a while and the route does not exist. Build it: one page that shows what each agent needs to read, whether its service user actually has it, and lets an operator turn the agent on.

| | |
|---|---|
| **Route** | `/os/settings/agents` |
| **Backend** | `alaiy_os.api.agent_settings` (exists, one addition pending) |
| **Audience** | System Manager only |
| **New deps** | none — shadcn + sonner |

---

## Context

### Why this page has to exist

Every agent runs as a service user and reads through Frappe's permission layer. If that user is missing a permission the agent needs, nothing breaks: `frappe.get_list` returns an empty set, the agent totals it up, and the report says zero.

> An under-permissioned agent doesn't fail loudly. It reports zeros, which looks exactly like a quiet business day.

The backend already works this out — it knows what each tool needs, checks it against the agent's user, and refuses to enable an agent that would answer with silence. None of that is visible anywhere. That is what you're building: the surface for a check that already runs.

---

## Scope

### Files

| File | Action | What it is |
|---|---|---|
| `src/navigation/sidebar/sidebar-items.ts:251` | No change | Already points at the route. It starts working the moment the page exists. |
| `src/app/(main)/os/settings/agents/page.tsx` | New | Thin shell, exactly like `settings/themes/page.tsx` — renders the client component and nothing else. |
| `…/agents/_components/agent-settings.tsx` | New | `"use client"`. Owns fetch, list state, and the four page states. |
| `…/agents/_components/agent-card.tsx` | New | One agent: header row, chips, switch, collapsible permission matrix. |
| `…/agents/_components/enable-dialog.tsx` | New | The confirmation that stands between a missing permission and a silent zero. |
| `src/lib/frappe/agent-settings.ts` | New | Data layer. Copy the shape of `src/lib/frappe/item-attribute.ts` — same `BASE` constant, same private `call<T>()`, same `extractErrorMessage`, its own `AgentSettingsApiError`. |

CSRF is already handled centrally in `src/lib/frappe/proxy.server.ts` — client code just POSTs. Keep the payload's snake_case field names as they arrive rather than camel-casing them: half of them are Frappe vocabulary the operator also sees in Desk (`doctype`, `ptype`, `run_as_user`), and it keeps this file greppable against `agent_settings.py`.

---

## Contract

### What the API returns

`GET /api/method/alaiy_os.api.agent_settings.list_agents` — no arguments, returns every registered agent under `message`, ordered by name. Types below are the real payload; write them verbatim.

```ts
export class AgentSettingsApiError extends Error {}

export type PermissionRequirement = {
  doctype: string;
  ptype: string;          // "read" | "write" | "create" | …
  granted: boolean;       // does run_as_user hold it, right now
};

export type AgentTool = {
  tool_id: string;
  connector: string | null;
  declared: boolean;      // false = the tool declares nothing. NOT the same as satisfied.
  permissions: PermissionRequirement[];
  writes: boolean;        // any ptype other than read
};

export type Agent = {
  agent_id: string;
  agent_name: string;
  description: string | null;
  icon: string | null;    // lucide-ish name, e.g. "trending-up" — may not resolve, fall back
  model: string | null;
  page: string | null;    // ignore for now (see Out of scope)
  is_enabled: boolean;
  run_as_user: string;              // "Administrator" when unset
  runs_as_administrator: boolean;   // true = reads the whole site
  tools: AgentTool[];
  permissions_satisfied: boolean;
  unmet_permissions: string[];      // pre-formatted: "get_stock_cover: read on Bin"
  writes: boolean;
};

export function listAgents(): Promise<Agent[]>;
export function setAgentEnabled(agent: string, enabled: boolean, force?: boolean): Promise<{ agent: string; is_enabled: boolean }>;
export function setAgentRunAsUser(agent: string, user: string): Promise<Agent>;  // pending — see below
```

- `unmet_permissions` arrives pre-formatted as `"tool_id: ptype on doctype"`. Render the strings as-is; don't re-derive them from the matrix.
- 403 from `list_agents` means the user lacks OS Agent Registry read, which today is System Manager only. Expected — render the notice state, not an error toast.
- 417 from `set_agent_enabled` is the permission gate refusing. Frappe puts the sentence in `_server_messages`; `extractErrorMessage` in `item-attribute.ts` already unpacks that format.

### Backend

All three endpoints are live.

**Landed — nothing blocking.**

`set_agent_run_as_user(agent, user)` now ships alongside the other two. It sets the field, re-runs the permission check, and returns the agent's recomputed settings row — render what comes back rather than patching your copy, because one user change rewrites every chip on the card.

- Clearing it — pass an empty user — means Administrator, i.e. site-wide reads. Not a neutral blank; keep the warning chip.
- It validates and throws (417) for a user that doesn't exist, is disabled, or is Guest. Surface the sentence through `extractErrorMessage`.
- An enabled agent stays enabled even if the new user can't satisfy its tools, and comes back saying so — enabled and permissions missing together. That combination is now also the one the run-time check refuses loudly, so it can no longer produce a quiet report of zeros.

---

## Layout

### The page

One card per agent, collapsed by default. Summary first, detail on demand — an operator opens this page to answer "is anything wrong", not to read permission tables.

```
  Agents                                                    5 registered · 1 needs attention

  Agents read your data as a service user. This page shows what each one
  needs, whether its user has it, and lets you turn it on.

  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │  ▸  Daily Sales Digest                                       claude-sonnet-5   ( ●)  │
  │     R1 — Every morning, summarises yesterday's GMV, orders and returns.              │
  │     Runs as Administrator     Reads only     Permissions met                         │
  └──────────────────────────────────────────────────────────────────────────────────────┘

  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │  ▾  Stock Alert                                              claude-sonnet-5   (○ )  │
  │     R2 — Flags SKUs about to run out, by variant.                                    │
  │     Runs as agents@globali.com     Reads only     2 permissions missing              │
  │  ····································································································│
  │     get_stock_cover                                                                  │
  │        Bin                          read      granted                                │
  │        Sales Order                  read      granted                                │
  │        Sales Order Item             read      granted                                │
  │        Item Variant Attribute       read      missing                                │
  │        Unicommerce Connector Set…   read      missing                                │
  │                                                                                      │
  │     get_dead_stock                                            unicommerce            │
  │        (declares nothing)                     not declared                           │
  └──────────────────────────────────────────────────────────────────────────────────────┘
```

- **Header count.** `"N registered · M needs attention"`, where `M` counts `permissions_satisfied === false`. If `M` is 0, drop the second clause entirely.
- **Card order.** Keep the API's order (by name) — it matches Desk and stays stable as things get enabled. Don't sort by severity; the count already does that job.
- **Needs attention.** Tint the card header with `--miss-soft` rather than adding a coloured rail. Auto-expand those cards on first load.
- **The switch** is the only control in the collapsed row. Right-aligned, with an `aria-label` naming the agent — `"Enable Stock Alert"`.
- **Matrix rows** are grouped by `tool_id`, with the connector as a muted mono chip beside the tool name when set. Use tabular-nums and don't wrap doctype names — truncate with a `title` attribute.

---

## States

### Three tool states, not two

This is the part to get right. A tool that declares no permissions is not a tool that passed — it is a tool nobody has described yet, and it must never render as a tick.

| Payload | Meaning | Chip |
|---|---|---|
| `declared: true`, all `granted: true` | The service user holds everything this tool reads. | Permissions met |
| `declared: true`, any `granted: false` | This tool will read nothing and report zeros. | 2 permissions missing |
| `declared: false` | The tool declares no permissions. Unknown, not safe — every action agent will land here first. | Not declared |

Form carries the state as well as colour: met and missing are filled chips, not declared is a dashed outline. Nothing in this page should depend on hue alone.

### Agent-level chips

| Condition | Chip | Notes |
|---|---|---|
| `runs_as_administrator` | Runs as Administrator | True for every agent today — expected, not a bug. Tooltip: "Reads the whole site. Scheduled runs produce site-wide figures." |
| `!runs_as_administrator` | Runs as agents@globali.com | Show the address itself; it's the useful fact. |
| `writes: false` | Reads only | All five current agents. Quiet styling — this is the safe case. |
| `writes: true` | Writes data | Nothing hits this yet; A1–A6 will. Make it visually louder than any read chip. |
| `is_enabled && !permissions_satisfied` | Enabled · permissions missing | A legitimate combination after a force-enable. Both facts must render together. |

---

## Flow

### Turning an agent on

1. **Permissions met — just do it.** POST `set_agent_enabled { agent, enabled: true }`. Disable the switch while in flight, then refetch the list and toast `"Daily Sales Digest is on."` No optimistic update: the server's answer is the only one that counts here.
2. **Permissions missing — don't call, ask.** You already know from `permissions_satisfied`, so don't fire a request you expect to be refused. Open the dialog with the agent's own `unmet_permissions` listed, and say what enabling anyway would mean.
3. **Three ways out of the dialog:** Cancel (default focus, switch stays off) · Change Run As User (combobox of enabled users; on success refetch and re-evaluate — often the missing permission simply goes away) · Enable anyway, destructive styling, which POSTs with `force: true`.
4. **Always refetch, never guess.** After any mutation, refetch the list — readiness is computed server-side and a change to Run As User rewrites every chip on the card. If a 417 comes back despite step 2 (someone revoked a role while the page was open), show the server's sentence via `extractErrorMessage` and refetch.

Turning an agent off is never gated. No dialog, no confirmation — straight POST with `enabled: false`.

---

## State

### The four page states

| State | Render |
|---|---|
| loading | Three Skeleton cards at the real card height. Not a spinner on blank — the page shape shouldn't jump. |
| `[]` (empty) | Empty component: "No agents are registered." Then the fix, verbatim: "Agents register on migrate. Run `bench --site <site> migrate`, then reload." Nothing is broken in the UI when this happens. |
| 403 | Alert: "You need the System Manager role to manage agents." No retry button — retrying won't help. |
| network / 500 | Alert with the extracted message and a Retry button. If a previous list is in state, keep showing it and put the error above — stale data beats no data here. |

---

## Copy

### Strings

Use these as written so the page and the backend's own refusal message agree.

| Where | String |
|---|---|
| page title | Agents |
| page subtitle | Agents read your data as a service user. This page shows what each one needs, whether its user has it, and lets you turn it on. |
| header count | 5 registered · 1 needs attention |
| dialog title | Grant these permissions first |
| dialog body | Stock Alert runs as agents@globali.com, which is missing: |
| dialog consequence | Enabled like this it won't fail — it will report zeros, which looks like a quiet day. |
| dialog actions | Cancel · Change Run As User · Enable anyway |
| toast on enable | Daily Sales Digest is on. |
| toast on disable | Daily Sales Digest is off. |
| toast on force | Stock Alert is on, with permissions missing. |
| toast on user change | Stock Alert now runs as agents@globali.com. |
| admin tooltip | Reads the whole site. Scheduled runs produce site-wide figures. |
| undeclared tooltip | This tool doesn't declare what it reads, so we can't check it. |

---

## Boundaries

### Out of scope

- Run history and last-run cards. Separate piece, specced in `docs/frontend-integration.md`, and currently blocked on OS Agent Run being System Manager-only.
- `/os/settings/connectors` is a dead sidebar link too, of almost the same shape. Separate ticket — don't absorb it.
- Per-tool enable/disable. No backend for it. Tools are shown, not configured.
- The `page` field on an agent (a link to its own settings screen) is `null` everywhere. Read it, ignore it.
- Editing `required_permissions`. Those are declared in each agent's manifest in code, deliberately. This page reports them; it never edits them.

---

## Done

### Ready to review when

- [ ] The sidebar's Agents link resolves and the page lists every registered agent.
- [ ] Every agent shows Runs as Administrator — that's the true state today, and seeing it is half the point of the page.
- [ ] A tool with `declared: false` renders visibly differently from one whose permissions are met.
- [ ] Flipping on an agent with missing permissions opens the dialog and names the doctypes; Cancel leaves the switch off.
- [ ] Enable anyway works, and the card then shows enabled and missing together.
- [ ] Turning any agent off works with no dialog, always.
- [ ] A non-System-Manager sees the role notice, not a crash or an empty list.
- [ ] Keyboard: every switch, card toggle and dialog action is reachable and has a visible focus ring.
- [ ] `biome check` is clean and no new dependency was added.

---

**Backend reference:** `alaiy_os/api/agent_settings.py` · `alaiy_os/engine/executor.py:55` · `alaiy_os_globali_agents/shared/reads.py`
