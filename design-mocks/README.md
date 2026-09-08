# Mathfinder design mocks

This directory contains review-ready, self-contained HTML exports of Mathfinder's interactive UI mocks. The editable source remains alongside the application code.

## Unified Character workspace

- Download `character-ui/character-ui-mock.html` and open it directly in a browser. The complete UI, styles, scripts, and portrait are embedded in this one file.
- Editable source: `apps/web/src/mocks/character-ui/`
- Vite entry: `apps/web/character-ui-mock.html`
- Regenerate the committed export from the repository root with `npm run build:character-mock`.

The HTML inside `design-mocks/character-ui/` is a generated review artifact. Make changes in the editable source and rebuild the export rather than editing the compiled file directly.
