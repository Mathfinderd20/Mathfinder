# Deployment runbook

Use this checklist when shipping Mathfinder. GitHub, hosted Supabase, and the
Docker-served web app are separate release steps. Pushing Git does not rebuild
Docker, and rebuilding Docker does not apply database migrations.

## Environments

Production and staging are isolated deployments:

| Environment | Branch  | Worker             | Domain                 | Backend                     |
| ----------- | ------- | ------------------ | ---------------------- | --------------------------- |
| Production  | `main`  | `mathfinder`       | `diresheets.com`       | Production Supabase project |
| Staging     | `stage` | `mathfinder-stage` | `stage.diresheets.com` | Staging Supabase project    |

Each Cloudflare Worker requires these Vite build variables:

```text
VITE_APP_ENV=production|staging
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=PROJECT_PUBLISHABLE_KEY
```

The build rejects invalid environment names, server-only Supabase credentials,
non-HTTPS hosted URLs, and staging builds pointed at the production project.
`VITE_*` values are public browser configuration and must never contain a
service-role key, database password, or OAuth client secret.

Deploy production with `npm run deploy` (which explicitly selects Wrangler's
top-level environment) and staging with `npm run deploy:stage`. Always dry-run
the appropriate command before changing a hosted deployment. The normal
promotion path is `feature/*` → `stage` → `main`; merge production hotfixes back
into `stage` promptly.

## 1. Prepare a focused branch

Start from a clean, current `main`:

```sh
git switch main
git fetch origin
git merge --ff-only origin/main
git switch -c feature/descriptive-name
```

Keep unrelated work in separate commits or branches. Before publishing:

```sh
npm run verify
git diff --check
git fetch origin
git rebase origin/main
```

Push the branch and open a pull request. Use `Closes #123` only when the pull
request completes every acceptance criterion; otherwise use `Refs #123`.
Wait for required checks before merging.

## 2. Validate Supabase migrations locally

If the change adds or modifies migrations, run:

```sh
npm run supabase:start
npm run supabase:reset
npm run supabase:lint
npm run supabase:verify
npm run supabase:stop
```

`supabase db reset` destroys only the local development database. Never point
reset commands at a hosted project.

On Windows PowerShell, execution policy may block `npx.ps1`. Use `npx.cmd`
instead of weakening the machine-wide policy:

```powershell
npx.cmd supabase login
npx.cmd supabase link --project-ref YOUR_PROJECT_REF
```

Never paste access tokens, database passwords, service-role keys, or generated
credentials into issues, pull requests, logs, or chat.

## 3. Apply hosted migrations before dependent frontend code

Do this only after explicit approval for the hosted database change. First
inspect exactly what would run:

```sh
npx supabase db push --linked --dry-run
```

On restricted PowerShell systems, use `npx.cmd` in that command and the ones
below. If the dry run lists only reviewed migrations, apply them:

```sh
npx supabase db push --linked
npx supabase migration list --linked
```

Verify new tables, columns, or RPCs before deploying frontend code that depends
on them. Do not deploy that frontend first: a missing RPC turns an otherwise
healthy release into a runtime failure.

Apply and verify every migration in staging first. Before either staging or
production operations, explicitly link the intended project and verify its ref;
the CLI's previous link is not an environment boundary. Inspect a production
dry run only after the same migrations and dependent frontend have passed
staging acceptance.

Database migrations and frontend rollback have different lifecycles. Prefer
backward-compatible, additive migrations. Do not reverse a hosted migration
merely because the frontend was rolled back.

## 4. Preserve a Docker rollback image

Before replacing a healthy container, record its image:

```sh
docker inspect mathfinder-server-1 --format "{{.Image}}"
```

Tag the returned image ID with the commit being replaced:

```sh
docker image tag IMAGE_ID mathfinder-rollback:before-COMMIT
```

This creates a local rollback pointer without changing the running container.

## 5. Build and recreate the web container

After the pull request is merged, update local `main` and build from it:

```sh
git switch main
git fetch origin
git merge --ff-only origin/main
docker compose build
docker compose up -d --no-build
docker compose ps
```

The Vite configuration is compiled into the browser bundle at image-build time.
Changing container environment variables cannot reconfigure an existing image.
Only publish to Docker Hub when a shared image release is actually intended.

## 6. Smoke-test the deployment

At minimum, verify the shell, callback route, service worker, and any changed
feature paths:

```sh
curl -I http://localhost:5173/
curl -I http://localhost:5173/auth/callback
curl -I http://localhost:5173/sw.js
docker compose ps
```

Then exercise the signed-in workflow in a browser. HTTP 200 proves that Nginx
serves the shell; it does not prove that authentication, RPC authorization, or
data synchronization works.

## Stale JavaScript chunks after deployment

Vite gives production assets content-based names. An old browser tab can ask a
new container for a chunk that no longer exists and report:

```text
Failed to fetch dynamically imported module: /assets/example-old-hash.js
```

Mathfinder's entry point listens for Vite's `vite:preloadError` event and
reloads once. The generated service worker activates immediately and claims
open clients. Nginx sends no-cache headers for the app shell and `sw.js`, while
hashed assets are immutable.

Do not remove those safeguards or cache `index.html` indefinitely. During
incident diagnosis:

1. Request the failing asset directly and confirm whether it returns 404.
2. Confirm `/sw.js` has `Cache-Control: no-cache, no-store, must-revalidate`.
3. Confirm navigations return `Cache-Control: no-cache`.
4. Hard-refresh once (`Ctrl+Shift+R`) for tabs created before recovery support
   was deployed.
5. Rebuild and recreate the container rather than editing generated asset names
   in source.

## Frontend rollback

If smoke tests fail and a quick fix is unsafe, retag the preserved image and
recreate the container:

```sh
docker image tag mathfinder-rollback:before-COMMIT joshdabomb/mathfinder-server:latest
docker compose up -d --force-recreate --no-build
```

Verify the rollback with `docker compose ps` and the HTTP checks above. Record
the failure in the relevant issue or pull request before attempting another
release.
