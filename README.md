# Alaiy OS Core

A clean, minimal Frappe v16 / ERPNext v16 app that provisions a self-contained
**Alaiy OS** workspace environment on install and keeps it reconciled on every
`bench migrate`.

The app uses only Frappe's supported hooks and APIs. It does **not** monkey-patch
Frappe internals, fake the sidebar via the DOM, or inject global UI overrides.

## What it provisions

On `after_install` and `after_migrate` (`alaiy_os_core/setup/install.py`):

1. **Roles** — `Alaiy OS Manager` and `Alaiy OS User`.
2. **Admin user** — created from `boot_config.py`; password set once on install.
3. **Workspace** — `Alaiy OS`, with links/shortcuts rebuilt from code each run
   (the app is the source of truth — manual UI edits are overwritten on migrate).
4. **DocType permissions** — `Custom DocPerm` records reconciled two-way (added
   for new target DocTypes, removed for ones dropped from the list).
5. **Standard workspace restrictions** — AlaiyOS roles stripped from standard
   ERPNext workspaces so they don't appear in the sidebar for AlaiyOS users.
6. **Login redirect** — the admin user's `home_page` is set to `/app/os`.

## Configuration

All credentials live in a single file:
`alaiy_os_core/client/config/boot_config.py`

```python
ALAIY_OS_ADMIN_USERNAME = "alaiyosadmin"
ALAIY_OS_ADMIN_EMAIL    = "admin@example.com"
ALAIY_OS_ADMIN_PASSWORD = "alaiyos123"
```

Install **fails loudly** if any of these are missing or empty.

## Access control — three layers

1. `home_page` DB field — redirects AlaiyOS users on login.
2. `boot_session` hook — filters the sidebar boot data to only `Alaiy OS`.
3. `public/js/route_guard.js` — intercepts client-side navigation and redirects
   AlaiyOS users back to `/os`.

All three explicitly bypass `System Manager` and `Administrator`.

## Install

```bash
bench get-app alaiy_os_core /path/to/alaiy-os-core
bench --site <site> install-app alaiy_os_core
bench --site <site> migrate
bench build --app alaiy_os_core
```

## Structure

```
alaiy_os_core/
├── hooks.py
├── client/config/boot_config.py     # credentials
├── setup/install.py                 # all provisioning logic
├── setup/boot.py                    # boot_session + on_session_creation
├── public/images/logo-square.png    # app icon
├── public/js/route_guard.js         # client-side route protection
├── public/css/core.css          # scoped styles (no global overrides)
└── workspace/Alaiy OS/Alaiy OS.json # workspace fixture for version control
```
