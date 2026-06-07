# @path-builder/web

Interactive Pathfinder 1e character sheet — the first UI for Path-Builder.

A Vite + React app that imports `@path-builder/rules-engine` directly and renders
a live sheet. Components are kept presentational so they can later be ported to
React Native for the phone build.

## Run it

From the repo root:

```bash
npm install
npm run dev --workspace @path-builder/web      # start the dev server
npm run build --workspace @path-builder/web    # production build
npm run typecheck --workspace @path-builder/web
```

Then open the printed local URL (default http://localhost:5173).

## What it demonstrates

- **Live recompute**: the whole sheet is a pure render of `(build + active buffs)`.
  Toggle a buff or level up and every derived number updates instantly.
- **Buffs / auras**: toggle Bless, Heroism, Mage Armor, etc. Each is just a bundle
  of `Modifier`s appended at runtime — the exact mechanism the DM aura broadcast
  will use to push effects onto player sheets.
- **The "why" UX**: click any stat to expand its full provenance breakdown.
- **Level up / undo**: backed by the engine's pure `levelUp` / `levelDown`.
- **Validation**: illegal builds surface inline.
