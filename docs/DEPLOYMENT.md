# Render deployment

The deployment target is now Render. Supabase remains the only database and authentication provider. Google Gemma and Paper Instruments Ultramarine run server-side. No Render database, Redis instance, worker or persistent disk is required.

## Service settings

| Setting        | Value                                                 |
| -------------- | ----------------------------------------------------- |
| Workspace      | Yasindu's workspace, explicitly confirmed by the user |
| Project        | PhantomCommit AI                                      |
| Environment    | Production                                            |
| Source         | `https://github.com/Y-Udayanga/PhantomCommitAI`       |
| Branch         | `main`                                                |
| Root directory | Repository root, where package.json lives             |
| Runtime        | Node                                                  |
| Build command  | `npm ci && npm run build`                             |
| Start command  | `npm run start:render`                                |
| Health path    | `/api/health`                                         |
| Compute plan   | Free unless the user explicitly approves another plan |
| Region         | Singapore                                             |

The start wrapper binds Next.js to `0.0.0.0` and Render's injected `PORT`, forwarding termination signals to the actual server. A fast health endpoint does not call external providers or the database. Application mutation and callback URLs use `APP_ORIGIN`, or Render's automatically injected `RENDER_EXTERNAL_URL`, to preserve the public HTTPS origin behind the proxy.

## Environment

Import the project's ignored `.env` and `.env.local` settings into the service before its first build. Never commit the files or paste secrets into build logs. Supply:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `GEMINI_API_KEY` for Gemma analysis tools
- `GEMINI_DETECTIVE_API_KEY` for Gemma chat
- `GEMMA_MODEL=gemma-4-26b-a4b-it`
- `ULTRAMARINE_API_KEY` and `ULTRAMARINE_MODEL=ultramarine-1-flash`
- Optional server-only `GITHUB_TOKEN`
- `NODE_VERSION=22.20.0`
- Optional `APP_ORIGIN` for a custom domain; omit it for the default Render URL

Only variables deliberately prefixed with `NEXT_PUBLIC_` may enter the browser build. Rebuild after changing those public variables. Private provider credentials are read server-side.

## Source connection and rollout

The public Git repository flow does not require granting Render broader GitHub account access. Deploys from that flow are manual. To enable automatic Git-triggered deploys, connect the intended repository through the Git provider flow or configure a validated Blueprint. Do not describe a public URL connection as automatic deployment.

Before deploying, run lint, TypeScript, unit tests and the production build. Commit and push the intended source revision, then verify its SHA on GitHub. Configure the service and monitor the exact resulting deploy until Render reports `live`; then request its health endpoint and landing page, inspect runtime logs, and run browser smoke tests against the actual URL.

## Supabase release gates

Render hosting does not create Supabase tables. Apply the SQL migration after obtaining access to the intended Supabase project. Verify real CRUD, sessions and cross-user isolation. Set Supabase Site URL and auth redirect allowlists to the actual deployed origin, including `/auth/callback` and the recovery callback documented in README.

The initial migration was applied through the authenticated dashboard SQL Editor on October 29, 2026. All 11 tables have RLS; authenticated owner CRUD and cross-user isolation passed rolled-back hosted SQL checks. Browser import and persisted investigation workflows still require verification in an app session.

## Account verification

During project creation Render displayed an Add Card identity-verification step with a temporary $1 authorization. Existing credits do not by themselves establish that this requirement is satisfied. The user must complete any required payment verification directly. Never enter or invent payment details or claim deployment succeeded while account verification blocks resource creation.

## Current status

The user deployed [PhantomCommit AI](https://phantomcommitai.onrender.com). On October 29, 2026, its landing page and health endpoint returned HTTP 200. The initial status response reported missing Supabase configuration. The existing Render service now has the Supabase project URL and publishable key, plus APP_ORIGIN=https://phantomcommitai.onrender.com; saving these settings triggered a rebuild that reached live. The status endpoint now reports database configuration present, and an unauthenticated repository request returns HTTP 401. This does not prove schema availability.

Supabase Authentication → URL Configuration must use:

- Site URL: `https://phantomcommitai.onrender.com`
- Confirmation callback: `https://phantomcommitai.onrender.com/auth/callback`
- Recovery callback: `https://phantomcommitai.onrender.com/auth/callback?next=/auth%3Faction%3Dupdate`

The production Site URL is correct and both exact callback URLs above are now saved; there are no localhost redirects. The schema is applied. Anonymous table/function requests are rejected with 42501 as intended. The hosted SQL owner CRUD and cross-user checks passed; the full browser acceptance scenario is a separate test.

References: [Render Next.js](https://render.com/docs/deploy-nextjs-app), [environment settings](https://render.com/docs/configure-environment-variables), [deployment lifecycle](https://render.com/docs/deploys), [Ultramarine API](https://docs.paperinstruments.com/docs/ultramarine/chat-completions).

## GitHub request allowance

Set GITHUB_TOKEN as a server-only Render environment variable. Use a token restricted to public-repository read access; private access and write permissions are unnecessary for this MVP. Do not put it in a NEXT_PUBLIC variable or source control. The public status response exposes only github.tokenConfigured, which indicates presence rather than successful authentication. Verify a real repository operation after the environment change is deployed.

Without authentication GitHub uses the host IP quota, which can be exhausted on shared hosting. Successful conditional 304 responses avoid primary-rate usage only for correctly authenticated requests. Coalescing, short caches and cooldowns reduce repeat traffic; they cannot grant more upstream quota.

References: [GitHub REST rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api), [GitHub token management](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).
