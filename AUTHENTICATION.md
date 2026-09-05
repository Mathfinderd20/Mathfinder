# Authentication and outage viewing

Mathfinder requires a permanent Supabase account. The sign-in page offers Google
OAuth and email magic links. There is no guest or anonymous-account mode.
Supabase credentials are managed by its SDK; gameplay data uses an IndexedDB
cache partitioned by Supabase project and user ID.

## Deployment

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` to the hosted project
   before building. Never expose a service-role key in the frontend.
2. Apply committed migrations, including
   `20260905040000_require_permanent_accounts.sql`. It rejects existing anonymous
   JWTs and adds the runtime timestamp trigger required for concurrency checks.
3. Disable anonymous sign-ins in the hosted Auth settings. Enable Google with
   its client ID and secret, and register the Supabase Auth callback in Google.
4. Set the production Site URL and allow the exact frontend `/auth/callback`
   URL. Configure the same callback for development/staging. Keep email
   confirmation enabled and configure production SMTP and email templates.
5. Serve the Vite build over HTTPS, with SPA rewrites to `index.html` for deep
   links. Serve `/sw.js` with revalidation (`Cache-Control: no-cache`). OAuth
   callbacks and email links must open in the browser that initiated PKCE.

Google provider configuration and SMTP must be completed in the hosted project;
the repository does not contain provider credentials. Authentication can also
be exercised locally with Supabase's mail inbox.

## Persistence and recovery

Successful server reads atomically cache account data. The current repositories
operate against an in-memory view of that cache. Online changes are checkpointed
to IndexedDB before being sent, and the global banner displays pending saves.
Only records changed since the last server baseline can be written or deleted.
Updates/deletes compare the server `updated_at` token atomically; a newer server
version is not overwritten. Responses lost after commit are recognized by
comparing the requested payload before retrying.
Existing saved build slots are stored on the account profile and included in
the same cache and conflict checks.

During an outage, cached sheets and campaign summaries remain readable; editing
is disabled. Changes made just before connection loss are retained with their
baseline and retried on reconnection. Online events and a 30-second offline retry
restore connectivity. Conflicts remain read-only with an export button and an
explicit, confirmed action to discard pending changes and reload server data.
The exported JSON is a recovery artifact, not an automatic import workflow.

Offline startup requires a persisted permanent session plus a matching cache.
The fallback selector permits a session expired by at most seven days; it does
not authorize server requests. Explicit invalid-session responses require login.
Server revocation cannot be detected while disconnected. Browser caches are not
encrypted storage; anyone with access to the browser profile may inspect them.
Sign-out/account switching clears in-memory state and deletes the previous
account's IndexedDB snapshot. Signing out with pending changes requires confirmation.

The production service worker precaches the application shell, compiled chunks,
and rules compendium. It never caches Auth or Supabase API responses. Offline
page reload requires a successful prior service-worker installation; browser
eviction/private browsing/storage denial can prevent offline availability.

Legacy unscoped localStorage and anonymous development accounts are not silently
claimed, uploaded, or deleted. Existing real data associated with those accounts
needs a separately reviewed ownership migration before disabling anonymous access.

## Verification

Run `npm run verify`. Persistence tests cover account isolation, offline read-only
behavior, invalid sessions, anonymous users, version conflicts, and another
device adding records. Exercise a production preview with a configured Supabase
project for Google/email callbacks, service-worker installation, offline reload,
two-device edits, and sign-out. No hosted configuration is changed by these tests.

First-release limits: offline editing is disabled; campaign invitations remain a
separate feature. Browser snapshot writes from multiple tabs are not a shared
offline editing queue—keep unsynced recovery in one tab until resolved.
