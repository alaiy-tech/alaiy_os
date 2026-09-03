# Who owns an agent

`OS Agent Registry` records what an agent **is**. Until now it recorded nothing
about where the definition came from, and that gap turns out to matter in three
places. This branch adds one field, `source_app`, and surfaces it. The rest of
this note is what it unlocks and what is deliberately not done yet.

## The gap

Every agent app registers its agents by upserting registry rows:

```
alaiy_os_agent_shopify_listing   after_migrate -> one row
alaiy_os_agent_amazon_listing    after_migrate -> one row
alaiy_os_globali_agents          after_migrate -> six rows
alaiy_os_connector_nayaglobal    after_migrate -> one pack row
alaiy_os_connector_amazon_sp_api after_migrate -> one pack row
```

plus whatever an operator writes by hand in the Desk, plus (in a devbench) the
seeder's demo rows. Off the row itself, all of those look identical.

Three consequences:

1. **A hand-edit to an owned agent disappears.** Edit a prompt in the Desk on an
   agent whose app reconciles it, and the next `bench migrate` silently
   overwrites it. Nothing warned the person editing. This is the one that has
   actually cost people work.
2. **Nothing can safely delete a row.** Any tool that removes agents — an
   uninstall flow, a cleanup command — has no way to know which rows are its own,
   so either it deletes another app's work or it cannot delete at all.
3. **The Agents page cannot group or explain.** Sixteen rows on a bench, from six
   sources, presented as one flat list.

## What this branch does

- `OS Agent Registry.source_app` — Data, read-only, `in_standard_filter`. The
  registering app stamps itself; empty means the row is the operator's own.
- `api/agent_settings.list_agents` returns it.
- The Agents card shows it: the app name for an owned row, `Local` for one that
  is nobody's but the operator's, with the tooltip saying what that means for
  editing.

Read-only in the form on purpose. An app that owns a row overwrites it on every
reconcile, so editing this field cannot change who owns the agent — only what the
page claims about it.

## What it does not do

**Nothing sets it yet.** The field is added and surfaced; no app writes it, so
every row reads `Local` until each registering app adds one line to its own
upsert. That ordering is intentional — the field has to exist before six apps
can start stamping it — but it means this branch is half of a change.

The other half, per app:

```python
"source_app": "alaiy_os_globali_agents",   # in the scalar dict of its _upsert
```

Five apps to touch: `alaiy_os_agent_shopify_listing`,
`alaiy_os_agent_amazon_listing`, `alaiy_os_globali_agents`,
`alaiy_os_connector_nayaglobal`, `alaiy_os_connector_amazon_sp_api`. Plus
devbench's `lib/seed/os_core.py`, whose two demo agents (`catalog-auditor`,
`connector-doctor`) should read as seed data rather than as anyone's app.

## The marketplace, and why installation is not in core

`alaiy_os_agents` is a different shape of agent app: a catalogue of definitions
plus an **Agents Marketplace** page that installs them one at a time, rather than
an app whose install registers everything it ships. Install, update, enable,
disable and uninstall are all operator actions there.

It works today against `main` with no core change, because every gate the
lifecycle needs already exists here:

| verb | what actually enforces it |
|---|---|
| enable | `api/agent_settings.set_agent_enabled` — refuses when the run-as user cannot satisfy a declared permission |
| disable | `chat/skills.py` filters `is_enabled` at request time; `engine/factory.py` and `engine/executor.py` refuse a disabled agent |
| install | `OS Agent Tool`'s controller resolves every handler path on save, so a broken manifest fails the install |
| uninstall | `ignore_links_on_delete = ["OS Agent Run"]` in hooks.py, which is what lets an agent that has run be deleted at all |

So the marketplace drives core rather than extending it, and its install record
(`OS Agent Install`, provenance + the manifest digest as installed) lives in that
app — the installer owns the install record.

### The question left open

Should install/uninstall become core verbs?

The argument for: two apps now both want to know "did I put this row here", and
the second one will duplicate `OS Agent Install`.

The argument against, and the reason it is not in this branch: an install record
carries things core has no opinion about — which catalogue, at which version,
whether an update is pending. Core would either store fields it cannot interpret
or force every installer into one versioning scheme. `source_app` is the part
that is genuinely core's, because *ownership* is a fact about the registry row
itself. Versioning is a fact about a catalogue.

Worth revisiting once a second marketplace-shaped app exists. One is not a
pattern.
