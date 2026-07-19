# Content Pipeline

This repo has **two different kinds of content artifacts** and pretending otherwise is how you get repo goblins.

## Source of truth

### Canonical handwritten rules content

These live in code under `packages/rules-data/`.

That is the durable, reviewable, versioned source of truth for:

- owner-authored Savage Company rules content that has been normalized into the app model
- curated rules-data definitions that the engine consumes directly

### Local ingestion workspace

`packages/content-db/` is the local ingestion + normalization workspace.

It owns:

- the local SQLite database at `packages/content-db/data/mathfinder.sqlite`
- scrape/cache/import workflows
- exporter logic that builds runtime-friendly JSON

This workspace is **not** the runtime asset itself. It is the kitchen, not the plated meal.

## Committed runtime artifact

The web app loads this file at runtime:

- `apps/web/public/usable-content.json`

This file is:

- generated
- committed on purpose
- required for fresh-clone app builds/runs

This is the reproducibility contract: a fresh clone should not need your local scrape DB or raw source documents just to run the app.

## Ignored local-only artifacts

These should stay out of git:

- `packages/content-db/data/`
- raw source manuscripts / scrape inputs
- local caches and DBs

In other words: commit the runtime export the app needs, not your basement full of machinery.

## Supported workflows

### 1) Bootstrap a local content DB from canonical rules-data

```bash
npm run content:bootstrap
```

That does:

1. initialize the local SQLite DB
2. seed it from `packages/rules-data`
3. export the runtime asset to `apps/web/public/usable-content.json`
4. verify the exported runtime asset shape

### 2) Re-export the runtime asset from your current DB

```bash
npm run content:refresh:web
```

That does:

1. export usable content from `packages/content-db`
2. write it directly to `apps/web/public/usable-content.json`
3. run a structural verification pass

### 3) Verify the committed runtime asset only

```bash
npm run content:verify:web
```

Use this when you want to sanity-check the committed asset without touching the DB.

## Low-level commands

If you want to drive the content DB manually:

```bash
npm run content:db:init
npm run content:db:seed-local
npm run db:scrape:aon-spells --workspace @mathfinder/content-db
npm run db:scrape:aon-feats --workspace @mathfinder/content-db
npm run db:export:usable-json --workspace @mathfinder/content-db -- ../../apps/web/public/usable-content.json
```

Most people should prefer the root `content:*` commands so the export target stays consistent.

## Runtime contract

`apps/web/src/content.ts` loads `usable-content.json` from the web public directory.

So if content changes and you want those changes in the app, the required step is:

```bash
npm run content:refresh:web
```

If you forget that step, the web app keeps using the old committed runtime snapshot like a stubborn mule.

## Commit policy

Commit `apps/web/public/usable-content.json` when:

- the runtime content actually changed
- the app should ship/run with the new snapshot

Do **not** commit:

- `packages/content-db/data/mathfinder.sqlite`
- scrape caches
- duplicate intermediate exports
- raw source files used only for local ingestion

## Recommended verification before pushing

```bash
npm run content:verify:web
npm run typecheck
npm run test
npm run build:web
```

That gets you a repo that is both:

- reproducible from clone
- honest about its runtime content snapshot
