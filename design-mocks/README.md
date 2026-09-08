# Mathfinder design mocks

This directory contains review-ready static exports of Mathfinder's interactive UI mocks. The editable source remains alongside the application code.

## Unified Character workspace

- Open `character-ui/character-ui-mock.html` through any local static web server.
- Editable source: `apps/web/src/mocks/character-ui/`
- Vite entry: `apps/web/character-ui-mock.html`
- Regenerate the committed export from the repository root with `npm run build:character-mock`.

For example, with Python installed:

```sh
python -m http.server 5177 --directory design-mocks/character-ui
```

Then open `http://127.0.0.1:5177/character-ui-mock.html`.

The files inside `design-mocks/character-ui/` are generated review artifacts. Make changes in the editable source and rebuild the export rather than editing the compiled HTML, CSS, or JavaScript directly.
