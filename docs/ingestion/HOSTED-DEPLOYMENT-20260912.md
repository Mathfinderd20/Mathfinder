# Hosted staging deployment — 2026-09-12

The user explicitly approved Wrangler's requested OAuth permissions. Sign-in completed and `wrangler whoami` confirmed `mathfinderd20@gmail.com`, account `bbd20759773ffe35ec98139df791b959`, with account/user/zone read and Worker/script/route write plus background access. No additional scopes were requested. The prior approval blocker is resolved.

## Deployed resources

| Resource | Target                                                                     | Version                                |
| -------- | -------------------------------------------------------------------------- | -------------------------------------- |
| Backend  | `mathfinder-stage-ingestion`, route `stage.diresheets.com/api/ingestion/*` | `9a1c775a-e956-474c-a70f-d2767f862f93` |
| UI       | `mathfinder-stage`, custom domain `stage.diresheets.com`                   | `55bca4de-fe65-49e9-9745-11738b150bc0` |

The backend binds the staging-only SQLite `Catalogue` Durable Object and pins authentication to Supabase `pkupqzdnefnjwndwzhdr`. Promotion is locked. Production Worker, domain and database are untouched. No paid upgrade was provisioned.

The UI was built in an isolated export of `origin/stage` at `93d43b454bc09f0b83e33ff3a478f04ffd4bb7a1`, with only the import page/styles, route, profile link and API environment type added. `scripts/prepare-ingestion-stage-ui.mjs` records that preparation. Unrelated uncommitted work was not packaged. The build used the staging revision's lockfile. Build, web type checking and all 234 web tests passed. Cloudflare uploaded eight changed assets; the existing catalogue assets required no upload. No reviewed-catalogue cutover was performed.

## Hosted verification

- Unsigned request with the staging Origin: 403, administrator required, `Cache-Control: no-store`.
- Disallowed Origin: 403, Origin denied.
- The browser loaded the deployed admin page using its existing staging session and successfully listed the empty holding area.
- A single Mage Armor job was requested through the hosted UI. Two attempts failed using the raw TLS socket adapter; the second preserved the curated `runtime-network-proxy-rejected` code. The replacement public-network HTTP adapter fetched and parsed it on retry: one candidate, one extracted, zero currently failed, one unknown-eligibility quarantine, zero additions/enrichments/corrections/unchanged/conflicts/exclusions/promotions. No second job or duplicate approved record was created. No broad crawl was requested.
- The hosted UI displays parser 1.2.0, the eligibility review requirement and a disabled promotion button.
- Reprocess saved source completed through the hosted UI, leaving one quarantined entry in the same job. Reloading the page preserved the saved job. The reprocess endpoint uses retained raw source rather than a fetch request.

## Cloudflare HTTP transport

The raw TLS socket path failed both locally and hosted. Cloudflare documents native HTTP fetch as the supported path for HTTP services. The final adapter uses global fetch with `global_fetch_strictly_public`, exact HTTPS source/redirect scope and typed public-IP DNS preflight. It has no private-network or origin binding and passes no user credentials to sources. The provider's public-only connection routing is the boundary against private destinations after DNS changes; Node retains its pinned-IP transport. This is an explicit runtime adaptation, not an automatic insecure fallback. See [Cloudflare's binding/SSRF model](https://blog.cloudflare.com/workers-environment-live-object-bindings/) and [compatibility flags](https://developers.cloudflare.com/workers/configuration/compatibility-flags/).

Local provider-runtime live verification retrieved 49,777 bytes from the fixed Mage Armor URL. Content-db now passes 101 tests and type checking, including stream cancellation, manual redirects and private-DNS rejection. Local provider-runtime persistence/reprocessing/retry/cancellation tests also pass. An adversarial live DNS-rebinding test has not been performed; the final network boundary depends on the documented provider behavior and the deployed configuration.

## Operational limitations

These are direct staging deployments; the focused UI additions still need to be integrated into the staging source branch so a later Git-triggered build does not remove them. The backend has its own explicit Wrangler config; the root app deployment command does not deploy it. The shared checkout and its source-policy reviews remain unfinished.

The previous staging UI version was `25581381-4d16-4cad-8856-f6164d0b0e2f`. No rollback has been executed. Provider snapshots/history, legacy source classification, cleanup and remaining Astra/user decisions retain their existing review requirements. This deployment is not final build acceptance.
