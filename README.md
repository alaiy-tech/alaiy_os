# Alaiy OS

A clean, minimal Frappe v16 / ERPNext v16 app that provisions a self-contained
**Alaiy OS** workspace environment on install and keeps it reconciled on every
`bench migrate`.

The app does not fake the sidebar via the DOM or inject global UI overrides.
It does patch two Frappe prototype methods client-side
(`public/js/route_guard.js` — see "Access control" below) for sidebar
ownership and route handling; that's the one deliberate exception, not
something this app tries to avoid altogether.

## What it provisions

On `after_install` and `after_migrate` (`alaiy_os/setup/install.py`), plus
Frappe's own fixtures sync (`alaiy_os/fixtures/*.json`, declared in
`hooks.py`'s `fixtures` list):

1. **Role** — one role, `OS Manager` (`constants/roles.py`), managed as a
   fixture (`fixtures/role.json`). It is **not** granted any DocType
   permissions automatically — there is no `Custom DocPerm` reconciliation
   anywhere in this app. If a non-`System Manager` role needs access to
   `OS Agent Registry`, `OS Connector Registry`, etc., that has to be
   configured explicitly (Role Permission Manager / a `Custom DocPerm`),
   the same as for any other Frappe app.
2. **Workspace + sidebar** — the `OS` and `OS Settings` workspaces, with
   links/shortcuts rebuilt from `constants/workspace.py` /
   `constants/workspace_settings.py` on every run (the app is the source of
   truth — manual UI edits to these two workspaces are overwritten on
   migrate). Connector-specific sections are appended dynamically from
   `OS Connector Registry` rows and other installed apps' hooks.
3. **Shared connector doctypes + Item custom fields** — `Item Supplier
   Attribute`, `Supplier Item Availability`, `Channel Listing` (real
   `doctype/*.json` files under `alaiy_os/doctype/`) and the Item custom
   fields they — plus the product-dimension fields — need, all managed as a
   fixture (`fixtures/custom_field.json`). **All three doctypes are
   deprecated** — see each one's own `description` field. `Item Supplier
   Attribute` is still populated by the Cloudstore connector, but
   `Supplier Item Availability` and `Channel Listing` are unused by any
   current connector; neither is the recommended pattern for new work
   (both real connectors model this state their own way instead).
4. **Foreign workspace restriction** — every public Workspace not owned by
   `alaiy_os` (ERPNext's, Frappe's own, any other installed app's) is hidden
   from the workspace switcher and locked to `Administrator`; configurable
   per-site (a `site_config.json` flag) or per-app (a hook another app can
   declare in its own `hooks.py`) — see `restrict_foreign_workspaces()`'s
   docstring in `setup/install.py`. The stock "Welcome Workspace" and
   "desktop" Page are removed outright.
5. **Login/home redirects** — a bare `/`, a bare `/desk`, and login all
   resolve to the OS workspace (`/desk/ask-alaiy`) instead of Frappe's own
   defaults.
6. **CDN image referrer policy** — Item product images are usually supplier
   or marketplace CDN URLs with hotlink protection that 403s any
   cross-origin `Referer`. `public/js/referrer_policy.js` (loaded first in
   `app_include_js`, before anything else can fetch an image) stamps
   `referrerpolicy="no-referrer"` onto every `<img>` in the desk via a
   `MutationObserver`. There is also a narrower, Item-form-only version of
   the same fix (`public/js/item.js`, wired through the `doctype_js` hook)
   still present alongside it — both currently run on the Item form.

## Access control

There are two real mechanisms — not three, and no `boot_session` hook exists
anywhere in this app:

1. `setup/boot.py`'s `on_login` / `get_home_page` — redirect on login and
   resolve `/` to the OS workspace.
2. `public/js/route_guard.js` — a client-side patch that (a) makes sure
   Alaiy OS's own Workspace Sidebar wins whenever a shared doctype (e.g.
   `Item`) also has an ERPNext/HRMS sidebar pointing at it, and (b) sends a
   bare `/desk` (no workspace slug) to the OS workspace instead of Frappe's
   default. It's a sidebar-selection and navigation convenience, not a
   permission check.

Neither mechanism restricts what `System Manager` or `Administrator` can see
— both always get the full, unrestricted Desk. Actual visibility
restriction of *other* apps' workspaces is handled server-side, by
`restrict_foreign_workspaces()` (see above), not by any client-side code.

## Install

```bash
bench get-app alaiy_os /path/to/alaiy_os
bench --site <site> install-app alaiy_os
bench --site <site> migrate
bench build --app alaiy_os
```

## Structure

```
alaiy_os/
├── hooks.py                          # app_include_js/css, fixtures, provisioning hooks
├── setup/install.py                  # after_install/after_migrate provisioning
├── setup/boot.py                     # on_login + get_home_page redirects
├── constants/                        # workspace/sidebar/role/onboarding definitions
├── fixtures/role.json                # OS Manager role (synced via Frappe's fixtures hook)
├── fixtures/custom_field.json        # Item custom fields (synced via Frappe's fixtures hook)
├── doctype/                          # this app's DocTypes — OS Agent Registry,
│                                      # OS Connector Registry, OS Theme Settings, the
│                                      # shared connector doctypes, ...
├── public/images/logo-square.png     # app icon / favicon / sidebar logo
├── public/js/route_guard.js          # client-side sidebar-ownership + route patch
├── public/js/referrer_policy.js      # document-wide no-referrer stamping for CDN images
├── public/js/item.js                 # Item-form-only version of the same fix (doctype_js hook)
└── public/css/core.css               # scoped styles (no global ERPNext UI overrides)
```
