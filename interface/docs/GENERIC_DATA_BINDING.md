# Proposal: config-declared data bindings

**Status:** proposal, nothing implemented. Amends the Data Source Registry
section of [UI_RUNTIME.md](./UI_RUNTIME.md); does not replace it.

## The problem

A page definition can only reference a data source that someone has already
written in TypeScript. The registry is a closed `Map<string, DataSourceDefinition>`
populated by `registerDataSource` calls at module load, and
`validate-against-registry.ts` rejects any `data` binding naming an id that
isn't in it. So "config" describes layout and composition freely, but its
access to data is limited to whatever capabilities Git already ships.

The cost is concrete. Adding the Products page - a page whose four KPIs and
one table are structurally identical to the Customers page already in the
runtime - took four files:

| File | Why it was needed |
|---|---|
| `seeds/pages/products-page.ts` | the actual page config |
| `runtime/data/sources/products.ts` | register `products.overview`, `products` |
| `lib/frappe/item-list.server.ts` | fetch Items server-side |
| `lib/frappe/item-stats.server.ts` | `getProductsOverviewServer` |

Only the first is configuration. The other three are a deploy. And nothing in
them is novel - `products` is "list a doctype's fields," which
`customers` also is, which every future list page also will be.

This is the ceiling on the whole runtime. Ask Alaiy can rearrange a page that
exists, but "create a page showing open Purchase Orders by supplier" fails not
because the runtime can't compose it, but because nobody registered a
`purchase-orders` source. The interesting requests are exactly the ones that
need data nobody anticipated.

## The proposal

Let a page config declare *what data it wants* - doctype, fields, filters -
and have the runtime satisfy it through one generic, parameterised resolver,
instead of naming a hand-written source.

```jsonc
// today - names a capability that must already exist in Git
"data": {
  "rows": { "source": "products" }
}

// proposed - declares the query, satisfied by a generic resolver
"data": {
  "rows": {
    "source": "frappe.list",
    "params": {
      "doctype": "Item",
      "fields": ["name", "item_code", "item_name", "item_group", "stock_uom"],
      "filters": [["disabled", "=", 0]],
      "orderBy": "modified desc",
      "limit": 500
    }
  }
}
```

The registry doesn't go away. `frappe.list` *is* a registered source - it just
takes arguments. The vocabulary stays closed (a config still can't name a
Frappe method path, or SQL, or a function); what opens up is the *arguments*
to one reviewed, permission-enforcing capability.

## Most of this already exists

The audit that produced this proposal found three of the four pieces already
written, tested, and running in production - they're just not reachable from a
config.

**Listing** - `/api/resource/<doctype>?fields=&filters=&order_by=&limit_page_length=`
is Frappe's own endpoint, already proxied through
`next.config.mjs`'s `/api/method/*` and `/api/resource/*` rewrites, already
permission-applying, and already what the retired Products page used
(`obsolete/data/lib/frappe/item-list.ts`). Nothing new is needed here.

**Aggregation** - `alaiy_os/api/list_summary.py`'s `summarise()` is already a
generic, doctype-parameterised aggregate: count / total / average / overdue,
each as a `{current, previous}` pair over a date window with the preceding
equal-length window computed for the delta. It takes `doctype`, `filters`,
`or_filters`, `from_date`, `to_date`, `date_field`, `overdue_field`,
`settled_statuses` as arguments. Sales Orders and Purchase Orders both call
it. It is a helper, not a whitelisted endpoint.

**Field metadata** - `alaiy_os/api/list_view.py`'s `get_doctype_fields` already
returns permission-safe field metadata for any doctype, with a denylist that
excludes layout fieldtypes, child tables, and `Password` (its docstring calls
that "a security boundary, not a formatting choice"). This is what would
validate a config's `fields` list against the live site.

The missing piece is not the query machinery. It's a safe way to let
*configuration* choose the doctype.

## The hard constraint: permissions

`summarise()` runs its queries through `frappe.get_all`, which is
`frappe.get_list` with permissions ignored. That is safe today for exactly one
reason: every caller is a whitelisted endpoint with the doctype written as a
literal in Python, gated by an explicit check first -

```python
@frappe.whitelist()
def get_sales_orders_summary(filters=None, ...):
    frappe.has_permission("Sales Order", "read", throw=True)
    metrics = summarise("Sales Order", filters, ...)
```

The moment the doctype arrives as a parameter, that guarantee evaporates. A
generic endpoint built by lifting `summarise` as-is would be arbitrary,
permission-bypassing read access to every table in the database, callable by
any authenticated user, with the query supplied by whoever can write a config
row. **This is the single most important thing to get right**, and it is
non-negotiable regardless of how the rest is designed:

1. **Every query goes through `frappe.get_list`, never `frappe.get_all`.**
   Permission-applying by default, no exceptions, no `ignore_permissions`
   parameter on the endpoint.
2. **Explicit `has_permission(doctype, "read", throw=True)`** on entry, before
   any query is built, so the failure is a clean 403 rather than an empty list
   that reads as "no data."
3. **Field-level filtering reusing `list_view.py`'s existing denylist** -
   `Password`, `Table`, `Table MultiSelect` and layout types are never
   returnable, and `permlevel > 0` fields are dropped unless the user has that
   level. A config asking for `User.api_key` gets a validation error, not a
   key.
4. **A doctype denylist** on top of permissions, for things no OS page has any
   business reading through a generic binding regardless of role
   (`User`, `Access Log`, OAuth/token doctypes, anything holding secrets).
   Permissions are the boundary; this is the second one.
5. **Bounded queries** - a hard cap on `limit` (the existing fetcher already
   uses 500), a cap on `fields` length, and a closed allowlist of filter
   operators drawn from `constants/list.ts`'s existing
   `NUMERIC_OPERATORS`/`DATE_OPERATORS`/`SELECT_OPERATORS`/`TEXT_OPERATORS`,
   so no operator string reaches Frappe unvalidated.

The framing that matters: **once configs are LLM-writable, the config becomes
untrusted input that reads data.** Client-side validation is decoration.
Server-side permission enforcement is the only real boundary, and it has to
hold against a config row nobody reviewed.

## Two modes, not one

A single "doctype + fields" API only solves tables. Every KPI on every page in
this runtime is a period-over-period comparison - `{current, previous}`
flattened into `value` and `value_delta` - which is not a list of rows and
can't be expressed as one. If the generic binding only lists, then tables
become config and every KPI still needs bespoke code, which is roughly half
the win.

So: two resolvers, sharing one parameter vocabulary.

**`frappe.list`** - rows. `doctype`, `fields`, `filters`, `orFilters`,
`orderBy`, `limit`. Backed by `/api/resource`. Feeds `os-data-table`'s `rows`
and `os-chart`'s `rows`.

**`frappe.aggregate`** - a single figure with its comparison. `doctype`,
`metric` (`count` | `sum` | `avg`), `field` (for sum/avg), `filters`,
`dateField`, `period`. Backed by a whitelisted generalisation of
`list_summary.summarise`, returning `{ value, delta }` already flattened the
way `flattenComparison` does today. Feeds `os-kpi`'s `value` and `trend`.

Worked example - the Products page's first KPI, today vs. proposed:

```jsonc
// today: needs products.overview registered in TS, which needs
// getProductsOverviewServer, which needs alaiy_os.api.item_stats.get_products_overview
{ "id": "kpi-active-skus", "kind": "component", "type": "os-kpi",
  "props": { "title": "Active SKUs", "icon": "PackageCheck", "format": "number" },
  "data": {
    "value": { "source": "products.overview", "path": "active_skus" },
    "trend": { "source": "products.overview", "path": "active_skus_delta" } } }

// proposed: no TypeScript, no deploy
{ "id": "kpi-active-skus", "kind": "component", "type": "os-kpi",
  "props": { "title": "Active SKUs", "icon": "PackageCheck", "format": "number" },
  "data": {
    "value": { "source": "frappe.aggregate", "path": "value",
               "params": { "doctype": "Item", "metric": "count",
                           "filters": [["disabled", "=", 0]], "dateField": "creation" } },
    "trend": { "source": "frappe.aggregate", "path": "delta",
               "params": { "doctype": "Item", "metric": "count",
                           "filters": [["disabled", "=", 0]], "dateField": "creation" } } } }
```

## Runtime changes required

**`DataSourceRef` grows a `params` field.** Today it's `{ source, path? }`.
It becomes `{ source, path?, params? }`, with `params` a JSON-safe object
validated per-source by a zod schema, exactly the way
`component-props-schema.ts` already validates component props. This is a
schema change to `page-schema.ts` and `types/runtime/data-source-ref.ts`.

**`DataSourceDefinition.resolve` takes the params.** Today
`resolve(context: { searchParams })`. It becomes
`resolve(context: { searchParams, params })`. Every existing source ignores
`params` and keeps working unchanged - this is additive.

**`resolvePageData` must re-key its cache.** This is the subtle breaking
change and the easiest thing to get wrong. Today it collects the set of
*unique source ids* and resolves each exactly once - correct when an id fully
determines the query. With params, two nodes both naming `frappe.list` are
usually different queries, and deduplicating by id alone would silently serve
one node the other's rows. The key must become a stable hash of
`(source id, canonicalised params)`. Note the example above deliberately
repeats identical `params` across `value` and `trend` so they collapse to one
call under that rule.

**Batching, since one page is now many queries.** The Products page becomes
five bindings (four aggregates + one list) where it was two. `resolvePageData`
already resolves in parallel, which bounds latency but not load. The
optimisation the runtime should own - and the reason this belongs in the
runtime rather than in each config - is a batch endpoint taking N described
queries and answering them in one round trip, with identical
`(doctype, filters, window)` pairs collapsed server-side. Configs stay naive;
the runtime gets smart. This can land in a second phase.

## What this does not solve

Stated plainly, because a proposal that claims to remove all bespoke data code
would be wrong:

**Derived fields.** Products' `status` is computed from `disabled` /
`has_variants` / `variant_of` in that priority order. Customers' `status` is
computed from `disabled` and order count. Neither is a column in any table,
and `fields: [...]` can never return them. Options: a small closed expression
vocabulary in config (a `case`/`coalesce` form, not arbitrary expressions), a
registry of named formatter functions a config can reference by id, or accept
that derived columns keep needing code. The first is the most useful and the
most dangerous; the second is the most in keeping with how everything else in
this runtime works.

**Joins and hops.** "The customer's territory on a Sales Order row" is a link
traversal. Frappe's `fetch_from` covers some of it; a generic binding
shouldn't try to cover the rest in v1.

**Genuinely bespoke business logic.** `dashboard.overview` computes stock
accuracy and return rates; `item_stats.get_products_overview` approximates
"previous active SKUs" as items created before the window because there is no
historical enabled/disabled log, and documents why. That reasoning cannot be
expressed as doctype-plus-fields and shouldn't be. These stay hand-written.

**Static validation.** This is a real loss and worth accepting consciously.
Today `validateAgainstRegistry` proves offline that every binding on every seed
page resolves - `validate-against-registry.seed.test.ts` runs that gate against
the real registry with no live server and no Frappe session. With
config-declared queries, "is `Item.item_group` a real field, and may this user
read it?" is only answerable against a live site. Validation splits in two:
structural (are the params well-formed, is the operator in the allowlist, is
the limit under the cap) stays static and testable; semantic (does the doctype
exist, does the field exist, is it permitted) moves to request time and must
degrade gracefully - an unknown field drops that column, it does not blank the
page. Expect to lose the "a bad page fails a test instead of failing at
request time" property for generic bindings.

## Recommendation

**Do it, additively.** `frappe.list` and `frappe.aggregate` join the registry
alongside the hand-written sources rather than replacing them. Curated sources
remain the right answer for anything carrying real business logic; the generic
pair covers the long tail of "list this doctype, count that one," which is
most of what a new page needs and all of what an LLM can be trusted to
compose. A wholesale replacement would regress the dashboard and would put
`get_products_overview`'s documented approximations into a config that has
nowhere to record why.

Suggested phasing:

1. **Whitelist and harden the aggregate.** Generalise `summarise` behind a new
   whitelisted endpoint, converting `frappe.get_all` to `frappe.get_list`,
   adding the permission check, denylists, and caps. No frontend changes. This
   is the security work, done first and reviewable on its own.
2. **`params` through the runtime.** Extend `DataSourceRef`, the zod schema,
   `resolve()`, and `resolvePageData`'s cache key. Register `frappe.list` and
   `frappe.aggregate`. Prove it by rewriting the Products page config to use
   them and deleting `runtime/data/sources/products.ts` - a like-for-like
   replacement of a page that currently works, so any regression is visible.
3. **Field validation at request time** against `get_doctype_fields`, with
   graceful degradation for unknown/forbidden fields.
4. **Batching**, once real pages show the round-trip count is a problem.

Step 2's deletion of a file written days earlier is the point, not an
embarrassment: if the generic binding can't reproduce the Products page
exactly, it isn't ready to be offered to Ask Alaiy.

## Open questions

- Does `frappe.aggregate` need `groupBy`? "Sales by territory" is a chart, not
  a KPI, and would need it. Deferring it means charts stay code-backed.
- Where do a config's `filters` get their *values* when they're dynamic
  (the current user, this month, the selected company)? A closed set of
  substitution tokens is the obvious answer and needs its own vocabulary.
- Should `params` be allowed to reference `searchParams`, so a page's filter
  bar drives a generic binding? Without it, `os-filter-bar` only filters
  client-side over already-fetched rows.
- Does the doctype denylist live in Python, in the OS's own settings doctype,
  or both?
