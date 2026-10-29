# Recovery, impact, security and feature history

The four tools share the authenticated workspace, public GitHub App credential, commit cache and validated Google analysis service. Open **Smart code recovery**, **Code impact graph**, **Security regressions** or **Feature evolution** in the sidebar. Existing Graveyard and Resurrection workflows retain their behavior; Resurrection links to the new recovery preview and passes its selected artifact through the shared workspace state.

## Configuration and migration

No new environment variables or separate AI provider are needed. Use the existing Supabase URL/publishable key, GitHub App configuration and `GEMINI_API_KEY`. The existing Gemma model routing and provider fallback policy still apply; each explanation records the actual model used. No service-role credential is required.

Apply only `supabase/migrations/20261029154742_forensic_investigations.sql` after the initial schema. This migration was generated with the Supabase CLI. **The new migration has not been applied to hosted Supabase by this implementation.** The repository's initial migration was previously applied through SQL Editor; reconcile CLI migration history before `db push`. Do not rerun the initial schema or reset the database. Deploy the migration before the application update. Existing workflows continue to use their original tables.

The one new table stores bounded derived investigation results and review decisions, with indexed repository/owner/date queries and ownership policies checking both the authenticated user and the owned repository. It cascades on repository/account deletion. It deliberately avoids storing full historical/current snapshots or full replacement files. A recovery diff can still contain substantial source; it is sensitive repository data. Results expire after 30 days in the app; expired rows are physically removed on the owner's next scan. Inactive owners' expired rows require an administrator's scheduled cleanup if a strict physical deletion deadline is needed. Users can delete individual or all forensic investigations immediately from history.

## API and service boundaries

All endpoints return the existing `{data}` / `{error}` envelope:

| Endpoint | Method | Behavior |
| --- | --- | --- |
| `/api/repositories/:id/forensics` | GET | Latest 20 unexpired owned investigations |
| same | POST | Validated bounded investigation; optional explicit Google consent |
| same | DELETE | Delete owned forensic history for the repository |
| `/api/repositories/:id/forensics/:record` | PATCH | Review a finding in that record; dismissal requires a reason |
| same | DELETE | Delete one owned record |

POST accepts `kind` (`recovery`, `impact`, `security`, `timeline`), `branch`, optional full `base`/`head`/`source` SHAs, `file`, `query`, up to 12 `paths`, `page`, optional rule `categories`, `ai` and `consent`. Existing same-origin, 16 KiB body, verified Supabase session and 90/minute request controls apply. AI calls additionally consume the existing 8/minute AI allowance. Saved records and exports have no public sharing route. Finding updates use an optimistic review version check to avoid silently overwriting another tab's decision.

`forensic-service.ts` orchestrates evidence retrieval. `forensics.ts` contains pure discovery, timeline and security rules. `dependencies.ts` uses the installed TypeScript compiler through a filesystem-free virtual compiler host. `recovery-patch.ts` uses jsdiff to build and check unified patches entirely in memory. There is no cloning, execution, shell access or GitHub write operation in these services.

## Recovery

Search filename, previous filename, deleted-line keyword/symbol or commit SHA. Search inspects five historical commits per page, with next/previous navigation and optional range intersection. Preview loads the first parent's implementation and the selected target snapshot. GitHub's recorded rename metadata is preserved; automatic patch placement across renames is refused.

Patch generation reverses the **entire selected file change**, including its additions, using zero-fuzz matching against the selected snapshot. It then generates a fresh unified diff and checks application against that exact content. Source commit, requested branch and base SHA accompany the proposal. This verifies text application, not compilation, semantic correctness or compatibility. The application cannot apply, commit, push or merge a patch. It refuses missing/truncated evidence, stale context, unsafe paths, possible secrets and ambiguous renamed placement. Copy and download are explicit user actions.

An explicit target SHA overrides the branch tip. The requested branch is contextual metadata; the service does not prove that a manually selected historical SHA is still its current tip. Recheck the branch before manually applying an exported patch. Gemma reviews bounded historical/current excerpts and suggests a strategy; its proposed compatibility changes are not automatically substituted into the validated deterministic patch.

## Impact graph

Choose an ancestor base and target. Diverged/behind GitHub comparisons are rejected rather than misrepresenting merge-base diffs. Default paths are changed JS/TS files; explicitly include callers/imported modules to expand the scope. Both revisions use the same selected path set. Recorded renames may require including both old and new paths.

The compiler records file containment, locally resolved imports/re-exports, bound function calls, class construction/heritage and JSX component references. Symbol resolution avoids joining a shadowed parameter to a same-named function. Relative modules must be in the selected set; package aliases, external packages, reflective/dynamic calls and runtime dispatch remain unresolved. A syntax/binding edge does not prove runtime reachability.

React Flow supports zoom, pan, node search, relationship filters, direct/transitive dependent highlighting, focus/expand, source evidence and base/target views. Dependency differences show additions/removals; changed relationships appear as removal plus addition. Line movement is ignored, although repeated same-named local declarations can still complicate identity matching. Select a node to populate the question scope, then request a Gemma explanation. Only target graph selection is used for the AI dependent calculation.

Limits: 12 files, 150 KB per snapshot, 600,000 total source characters across both revisions, 500 nodes and 1,500 edges per graph. Snapshots are fetched in bounded batches and GitHub responses reuse the existing credential-keyed cache. The parser never reads repository files from the server filesystem. No whole-repository blast radius or complete call graph is claimed.

## Security

Focused diff rules detect removed authentication, ownership/permission, validation and header controls, SQL RLS/policy removal, introduced credential-shaped strings, RLS disabling and selected unsafe sinks. Equivalent added guard patterns suppress simple removal alerts; comment-only lines are excluded. Control-removal rules run on JS/TS and SQL paths; secret-shaped additions can be reviewed in other text files.

Each finding has a stable scope-local ID, category, severity, separate qualitative confidence, source SHA/path/changed line, masked evidence, detection method and verification/remediation guidance. These are **review leads**, not confirmed exploitable vulnerabilities. The dashboard provides search, category/severity/status filters, review/resolution/dismissal/reopen actions, dismissal notes and report export. Gemma interpretation is shown separately with checked Git references.

This is not Semgrep, whole-program data-flow analysis, a dependency vulnerability scanner or an exhaustive security audit. Multiline constructs, string literals, custom guards, renamed checks, equivalent controls in other files, unsafe deserialization, cryptography and indirect sinks are not comprehensively covered. False positives and false negatives are expected. No accuracy percentage has been measured.

## Feature timeline

The vertical timeline displays actual added/modified/removed/renamed file events, authors, dates, SHAs, patches and GitHub evidence. Search matches paths or changed source, not commit messages alone. Results are ordered within the current five-commit page; page boundaries are not a continuous global chronology. The range option intersects with the first 100 GitHub comparison commits and explicitly discloses that limit. Categories, spacing scale, detailed evidence and security/recovery navigation are available.

Feature association is labeled as a search lead. The tool does not prove semantic feature identity, semantic refactoring, original introduction, expansion or restoration across arbitrary history. A first visible addition is labeled **introduced in scope**. It does not reconstruct arbitrary rename chains. Gemma can explain observed milestones and uncertainty, but inferred motives remain hypotheses.

## Privacy and AI

The shared analysis service now masks common credential formats, quoted credential assignments, environment-style assignments, JWTs and private key blocks before provider calls, and masks structured returned text. Forensic displays and exports receive masked results. Patch generation is withheld if masking would alter the current file or historical patch. This conservative masker is not an exhaustive secret scanner: unknown formats, encodings and contextual personal information may remain. Existing commit-detail storage is unchanged and may retain bounded original patch excerpts under its existing ownership policies.

Repository text, commit messages and user questions are untrusted evidence in the existing prompt. There are no model tools or source execution facilities. Zod output parsing and provenance checks constrain structured answers, but cannot prove semantic correctness or eliminate prompt injection. Users must review AI claims and compatibility advice. AI context is bounded (including a 7,000-character static summary); snapshots may be partial. Google explanations require explicit consent and can fail independently of deterministic capability. Cancel stops the browser request; work already started on the server may finish saving. No background jobs were added.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and `npm run test:e2e`. New tests cover recovery feasibility/refusal, scope validation, security positive/negative fixtures, redaction, symbol binding/shadowing, dependency differences/traversal, rename provenance, unavailable snapshots, divergent branches, consent, untrusted prompt boundaries, endpoint authorization and UI empty states. The PGlite test executes both migrations and tests tenant CRUD isolation, hostile ownership and cascades.

Browser checks cover protected routes and mobile setup pages. `scripts/verify-responsive.mjs` now includes all four tools. These checks do not replace a real authenticated populated acceptance run against migrated Supabase, GitHub and a live model. Provider tests use mocked SDK responses. No live accuracy benchmark or production acceptance claim is made.
