# Render and Ultramarine update — October 29, 2026

- Ultramarine is selectable for all 18 investigation tools and conversational follow-ups. Requests use the documented Paper Instruments endpoint, server-only credentials, bounded context, structured validation and evidence checks. There is no automatic provider fallback.
- A real Ultramarine models request and minimal JSON completion returned HTTP 200; the completion stopped normally and contained a valid JSON answer. This smoke check did not send repository source.
- The current unit/service/PostgreSQL suite passed 49 tests; two live integration checks were skipped. Lint, TypeScript and the production build passed.
- The updated browser suite passed five real-data onboarding, authentication, mobile and authorization checks; the hosted persisted acceptance test was skipped.
- Three configured private AI keys were scanned against all non-ignored source files; no matches were found. Both environment files remain ignored.
- Render is configured for a free Node web service in Singapore, with a PORT-aware start command and public dependency-free health endpoint. Deployment status is recorded separately in DEPLOYMENT.md.
- Hosted Supabase schema application and the complete authenticated persisted workflow remain unverified. No deployment or database success is implied by local checks.

---

# Latest real-data and AI Studio verification

This update removes runtime sample repositories, commits, analytics and AI replies. Synthetic evidence is isolated in test fixtures and checked to be absent from application imports. The old /demo address redirects to the real workspace.

- Separate server-only credentials route feature analyses and conversational AI Detective requests without silent fallback. Neither key value is recorded here.
- Google accepted minimal requests using both newly supplied keys. The feature route initially received HTTP 500 and succeeded on a bounded follow-up. Its tiny output budget yielded no visible answer, so this verifies request acceptance rather than a complete structured repository analysis.
- AI Studio adds 16 focused tools with task-specific server instructions, date/file evidence filters, output validation and reference checks. Missing evidence blocks requests; no sample results are substituted.
- Lint and standalone TypeScript checks passed. The updated unit/service/PostgreSQL suite passed 42 tests, with two live checks skipped.
- The updated production build passed compilation, TypeScript and page generation with both ignored environment files loaded.
- Hosted Supabase still returns HTTP 404 / PGRST205 for the repositories endpoint. The migration remains unapplied because the plugin previously listed no accessible projects and denied schema access.
- Real persisted acceptance and Vercel deployment remain unverified. They require database migration, a confirmed account and real repository evidence.

Final verification on October 29, 2026: the production browser suite passed five checks, with the persisted live acceptance test skipped. A mobile decorative overflow was found and fixed before the passing run. AI Studio setup-instance checks passed for all 16 tools, category filtering, task selection, disabled inference without evidence, Escape dismissal and mobile layout, with zero page errors. The final production build passed. A scan of 22 generated browser JavaScript files found neither configured private key. Environment files remain ignored by Git.

The historical record below refers to earlier development checks. Its demo screenshots and demo browser flow have been removed from the latest application; later browser results are recorded separately.

---

## Earlier verification record

## Supabase connection update

The app's ignored `.env.local` is now configured for project `beezpkgdrxpidyhzcvuq` using the supplied publishable key. A direct request to `/auth/v1/settings` returned HTTP 200 and confirmed email authentication is enabled. `/rest/v1/repositories?select=id&limit=0` returned HTTP 404 / `PGRST205`, so the application table is not currently exposed in the API schema.

The connected Supabase plugin returned an empty project list and denied table inspection with “You do not have permission to perform this action.” The migration has **not** been applied remotely. Reconnect the plugin with project access before applying `supabase/migrations/20261028155647_initial_schema.sql`. The publishable key supports permitted app access; it does not authorize schema administration.

After configuration, standalone TypeScript and the local PostgreSQL migration/RLS test passed again. The original implementation verification below describes the earlier, credential-free test run.

Executed locally on Windows with Node 22.20.0 on October 28, 2026. No hosted deployment or complete live acceptance claim is made.

| Check                                        | Result                                                     | Evidence / scope                                                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production build                             | Passed                                                     | `npm run build`: compiled, TypeScript passed, five static pages generated; dynamic workspace/API/auth callback and Proxy emitted                                                                               |
| Standalone type check                        | Passed                                                     | `npm run typecheck` completed without errors before production build                                                                                                                                           |
| ESLint                                       | Passed                                                     | `npm run lint`, no errors or warnings; generated Monaco assets excluded                                                                                                                                        |
| Unit/service/SQL suite                       | Passed                                                     | `npm test`: 35 passed, 2 skipped, 6 test files; includes actual migration execution in PGlite PostgreSQL                                                                                                       |
| Production browser flow                      | Passed                                                     | 5 Playwright tests passed; 1 live acceptance test skipped; run against `next start` rather than development compilation                                                                                        |
| Browser JavaScript                           | Passed for captured pages                                  | Screenshot capture reported `pageErrors: []` for landing and demo overview                                                                                                                                     |
| Mobile                                       | Passed in tested viewport                                  | 390×844, navigation usable and document does not horizontally overflow                                                                                                                                         |
| Monaco                                       | Passed                                                     | Read-only before/after editor became visible using locally served package assets                                                                                                                               |
| Dependency audit                             | Initial production audit passed; repeat hit registry error | `npm audit --omit=dev` returned zero known vulnerabilities after DOMPurify 3.4.17 override. A later repeat returned npm registry HTTP 400 / retired audit endpoint; this is not an additional successful audit |
| Public GitHub smoke test                     | Failed: network timeout                                    | Real `octocat/Hello-World` request timed out after two six-second attempts; independent `curl` timed out after 15 seconds. Mocked GitHub contract/error tests pass. Actual network integration is unverified   |
| Hosted Supabase CRUD/RLS                     | Not run                                                    | Project connector failed to connect; no Supabase environment variables or dedicated test credentials were available                                                                                            |
| Supabase sign-up/email verification/recovery | Not run against provider                                   | Forms and recovery query routing tested locally; real email delivery and session flows still need a configured project                                                                                         |
| Hosted Gemini/Gemma inference                | Not run                                                    | No `GEMINI_API_KEY` was available. SDK contract, JSON parsing, missing-key and quota paths tested with mocks                                                                                                   |
| Vercel deployment                            | Not performed                                              | No deployed URL claimed. Follow `DEPLOYMENT.md`                                                                                                                                                                |

## Reproducible browser coverage

1. Landing → labeled synthetic demo → Code Graveyard → deleted payment validator diff → Ghost Replay graph → Monaco snapshots → AI Detective prompt → AI action remains disabled in demo → Settings.
2. Mobile repository navigation and horizontal overflow check.
3. Unauthenticated API request rejects access without returning credentials.
4. Recovery callback destination opens a new-password form without requiring an email field.
5. Repository import dialog opens and closes with Escape.

The first browser pass found a short-viewport sidebar overflow that made Settings unreachable. The sidebar now scrolls, and the full test passes. Earlier test attempts also encountered missing downloaded Chromium and slow initial development compilation; final checks used installed Chrome and the production server.

## SQL security coverage

The actual migration was executed inside PGlite PostgreSQL. A minimal `auth.users`/`auth.uid()` test harness substitutes two authenticated identities. Tests assert that the second identity cannot see another owner’s repositories, conversations, messages, runs, findings or reports; insert children under foreign parents; update a foreign repository; or receive ownership through an owner transfer. They also assert the hard AI quota cannot be raised through the RPC argument, private counters cannot be queried, and deletion cascades remove dependent data.

This validates PostgreSQL policies against the migration, not Supabase’s hosted auth/session behavior. The separately gated hosted integration suite must still be run with two real confirmed accounts.

## Release gates still open

- Apply migration to the intended Supabase project and verify real session handling, email confirmation, password reset and cross-user isolation.
- Restore outbound GitHub connectivity and run `RUN_LIVE_GITHUB=1`; import and inspect a real small repository through the UI.
- Configure Gemini access, consent to excerpt processing, and validate a real Gemma response and its citations.
- Run `tests/e2e/live.spec.ts` with a dedicated account and public test repository: sign in → import → inspect → request AI → follow up → save → reopen → export. Registration and email verification also require a real mailbox/manual verification.
- Test against the intended Vercel preview, then deploy and record the actual successful URL.

The application is locally implemented and the synthetic workflow is verified. It is not yet a fully verified competition release because these external gates remain open.
