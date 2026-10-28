# Vercel deployment

No hosted deployment has been performed. Complete these steps before claiming production readiness.

1. Create or select the intended Supabase project. Run the migration once and enable email auth/confirmation. Never run the migration against an unrelated project.
2. Add the environment values in `.env.example` to local `.env.local`. Start the app and run the live acceptance tests described in README. Test two independent accounts and password recovery through real email.
3. Push the application directory to [the existing Git remote](https://github.com/Y-Udayanga/PhantomCommitAI). This working copy has not been pushed automatically. The repo root is the directory with `package.json`, not its parent workspace folder.
4. Import that GitHub repository in Vercel. Select the intended account/team. Choose Next.js, Node 22, install `npm ci`, build `npm run build`, default `.next` output. No custom server is needed.
5. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as configuration values for Preview and Production. Add `GEMINI_API_KEY` and optional `GITHUB_TOKEN` as secrets. Set `GEMMA_MODEL=gemma-4-26b-a4b-it`. Never prefix private values with `NEXT_PUBLIC_`.
6. Deploy a preview through Vercel’s Git workflow. Add that exact preview origin’s `/auth/callback` redirect URLs in Supabase. Do not use a broad redirect wildcard for untrusted deployments.
7. Test sign-up, email confirmation, sign-in, reset, import, commit inspection, snapshot comparison, AI consent, evidence references, saved follow-up, export and data deletion. Test unauthenticated requests and cross-user reads/writes. Run E2E against the preview using `E2E_BASE_URL`.
8. Confirm production database connectivity and a successful real Gemma call. A configured key or green configuration indicator does not prove either.
9. Deploy the tested branch using Git-to-Vercel. Set Supabase Site URL to the final origin and allow its callback and recovery callback URLs. Redeploy after changing public variables because Next.js embeds them at build time.
10. Record the actual successful URL and test results in `docs/VERIFICATION.md` and the DEV draft. Do not publish a fabricated link.

The API route exports a 60-second function duration. GitHub requests have six-second timeouts and at most one retry; a batch has at most three commits and shares a public-visibility check. Gemma requests have 18-second timeouts, no SDK internal retries, and one bounded retry for HTTP 500/503. Provider calls, database operations and source context are bounded. Large repositories require repeated user-driven requests. No work is left in an unawaited promise.

Keep region placement near Supabase where your Vercel plan permits. Verify current function limits and quota in the selected account. To roll back an application deploy, use Vercel’s known-good deployment; database migrations require their own reviewed recovery strategy. Do not drop a production schema to roll back frontend code.

References: [Vercel Git deployments](https://vercel.com/docs/git), [Supabase SSR setup](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Gemma API](https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api).
