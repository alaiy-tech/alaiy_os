# alaiy_os_core / config

Static assets that configure the AlaiyOS Desk experience.
Everything in this folder is served at:
  /assets/alaiy_os_core/config/<filename>

## Files

| File | Purpose |
|------|---------|
| `theme.css` | ERPNext CSS overrides — Bricolage Grotesque font, sidebar, topbar, buttons, inputs. Loaded on every Desk page via `app_include_css` in hooks.py. |

## Customising per brand

All brand-specific values are CSS variables at the top of `theme.css`
under the `/* 2. AlaiyOS design tokens */` block. To override for a
specific client, load a second CSS file after this one that re-declares
only the `--alaiy-*` variables you want to change. No other rules need
to be touched.

Example brand override snippet:
```css
:root {
  --alaiy-primary:       #E63946;  /* brand red   */
  --alaiy-primary-dark:  #C1121F;
  --alaiy-primary-light: #FFE5E7;
  --alaiy-sidebar-bg:    #1A0A0B;
}
```

## Adding more config assets

Place any future static config files here:
- `logo.svg`        — brand logo (reference in install.py via System Settings)
- `favicon.ico`     — browser tab icon
- `fonts/`          — self-hosted Bricolage Grotesque .woff2 files (replace the Google Fonts @import)
