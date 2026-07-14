<!--
  Thanks for contributing to Alaiy OS!
  Please fill out this template so reviewers can understand and verify your change.
-->

## Description

<!-- What does this PR do and why? Provide context for the reviewer. -->

## Related issue(s)

<!-- Link issues this PR addresses, e.g. "Closes #26". Use "Closes"/"Fixes" to auto-close on merge. -->

- Closes #

## Type of change

<!-- Put an "x" in the boxes that apply. -->

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behaviour)
- [ ] Refactor / code cleanup (no functional change)
- [ ] Documentation update
- [ ] Build / CI / tooling

## How has this been tested?

<!--
  Describe how you verified your change. Alaiy OS provisions on install/migrate,
  so please note the commands you ran and the site behaviour observed.
-->

- [ ] `bench --site <site> install-app alaiy_os`
- [ ] `bench --site <site> migrate`
- [ ] `bench build --app alaiy_os`
- [ ] Verified as an `Alaiy OS User` (workspace, sidebar, route guard)
- [ ] Verified as `System Manager` / `Administrator` (bypass still works)

**Test environment:**

- Frappe version:
- ERPNext version:

## Screenshots (if UI-related)

<!-- Before / after screenshots or recordings. -->

## Checklist

- [ ] My code follows the style and conventions of this project.
- [ ] I have performed a self-review of my own code.
- [ ] I have commented my code where necessary, particularly in hard-to-understand areas.
- [ ] I have not monkey-patched Frappe internals or introduced global UI overrides (see README).
- [ ] I have made corresponding changes to the documentation (README.md / DOC.md) where needed.
- [ ] My changes generate no new warnings or errors.
- [ ] Any dependent changes have been merged and published.
