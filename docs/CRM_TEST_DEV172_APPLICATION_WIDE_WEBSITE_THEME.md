# CRM Test dev.172 application-wide website theme

**Target:** CRM Test only  
**Baseline:** `2.1.0-dev.171` with migration 107  
**Database change:** none  
**Human UAT:** pending

## User observation

The deployed dev.171 Agent dashboard used the new NYSA website palette and typography, while the shared CORE
header, navigation and other application screens retained the older visual system. On a wide display the main
workspace also stopped at 1,500 px, leaving a large unused area.

## Correction

Dev.172 promotes the website-aligned design tokens to the shared CORE theme:

- ink `#0a2233`, ink-soft `#173646`, pine `#315f55`, pine-dark `#193f39`;
- bronze `#a9783a`, gold `#d0aa64`, mineral `#eee7dc`, alabaster `#faf8f3` and mist `#eef0eb`;
- the website UI font stack throughout CORE and the website serif heading stack for page and panel headings;
- pine primary actions, website-aligned focus states, square controls and consistent shell/navigation treatment;
- a 1,920 px shared workspace ceiling with proportional side padding for wide screens.

The existing official NYSA logo assets, all application screens, fields, information and governed actions remain
unchanged. This is a visual-system change only. Production, R2 and Property Finder remain excluded.

Automated checks and deployment observations must be recorded separately. Automated success does not establish a
human UAT pass.
