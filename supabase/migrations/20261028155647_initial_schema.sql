-- Apply once using Supabase CLI or SQL editor. No service-role key is needed by the app.
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null default '' check (length(display_name)<=80), avatar_url text,
 created_at timestamptz not null default now()
);
create table public.repositories (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 github_owner text not null, github_name text not null, full_name text not null, github_url text not null,
 default_branch text not null, description text, created_at timestamptz not null default now(), unique(owner_id,full_name)
);
create table public.commits (
 id uuid primary key default gen_random_uuid(), repository_id uuid not null references public.repositories(id) on delete cascade,
 sha text not null check(sha ~ '^[a-f0-9]{40}$'), message text not null, author_name text not null,
 committed_at timestamptz not null, html_url text not null, parent_shas text[] not null default '{}',
 details_loaded boolean not null default false, files_incomplete boolean not null default false,
 unique(repository_id,sha)
);
create table public.file_changes (
 id uuid primary key default gen_random_uuid(), commit_id uuid not null references public.commits(id) on delete cascade,
 file_path text not null, previous_path text, change_type text not null,
 additions integer not null check(additions>=0), deletions integer not null check(deletions>=0),
 patch_excerpt text check(length(patch_excerpt)<=12000), diff_truncated boolean not null default true,
 unique(commit_id,file_path)
);
create table public.analysis_runs (
 id uuid primary key default gen_random_uuid(), repository_id uuid not null references public.repositories(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade,
 status text not null check(status in ('running','completed','failed')), analysis_type text not null,
 started_at timestamptz not null default now(), completed_at timestamptz, error_message text
);
create table public.ai_findings (
 id uuid primary key default gen_random_uuid(), analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
 finding_type text not null, title text not null, description text not null, explanation text not null,
 severity text not null check(severity in ('info','low','medium','high')),
 evidence_status text not null check(evidence_status in ('direct','hypothesis','insufficient','contradicted')),
 evidence_json jsonb not null default '[]', recommended_action text not null, created_at timestamptz not null default now()
);
create table public.investigation_threads (
 id uuid primary key default gen_random_uuid(), repository_id uuid not null references public.repositories(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade, title text not null, created_at timestamptz not null default now()
);
create table public.investigation_messages (
 id uuid primary key default gen_random_uuid(), thread_id uuid not null references public.investigation_threads(id) on delete cascade,
 role text not null check(role in ('user','assistant')), content text not null,
 evidence_json jsonb not null default '[]', created_at timestamptz not null default now()
);
create table public.reports (
 id uuid primary key default gen_random_uuid(), analysis_run_id uuid not null references public.analysis_runs(id) on delete cascade,
 owner_id uuid not null references auth.users(id) on delete cascade, title text not null, report_content text not null, created_at timestamptz not null default now()
);
create table public.ai_cache (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 repository_id uuid not null references public.repositories(id) on delete cascade,
 cache_key text not null, result jsonb not null, created_at timestamptz not null default now(), unique(owner_id,cache_key)
);
create index repositories_owner on public.repositories(owner_id);
create index commits_repository_date on public.commits(repository_id,committed_at desc);
create index commits_message_search on public.commits using gin(to_tsvector('english',message));
create index changes_commit on public.file_changes(commit_id);
create index runs_repository on public.analysis_runs(repository_id);
create index runs_owner on public.analysis_runs(owner_id);
create index findings_run on public.ai_findings(analysis_run_id);
create index threads_repository on public.investigation_threads(repository_id);
create index threads_owner on public.investigation_threads(owner_id);
create index messages_thread on public.investigation_messages(thread_id,created_at);
create index reports_owner on public.reports(owner_id);
create index reports_run on public.reports(analysis_run_id);
create index cache_repository on public.ai_cache(repository_id);

alter table public.profiles enable row level security;
create policy profile_owner on public.profiles for all to authenticated using(id=(select auth.uid())) with check(id=(select auth.uid()));
alter table public.repositories enable row level security;
create policy repository_owner on public.repositories for all to authenticated using(owner_id=(select auth.uid())) with check(owner_id=(select auth.uid()));
alter table public.commits enable row level security;
create policy commit_owner on public.commits for all to authenticated using(exists(select 1 from public.repositories r where r.id=repository_id and r.owner_id=(select auth.uid()))) with check(exists(select 1 from public.repositories r where r.id=repository_id and r.owner_id=(select auth.uid())));
alter table public.file_changes enable row level security;
create policy file_owner on public.file_changes for all to authenticated using(exists(select 1 from public.commits c where c.id=commit_id)) with check(exists(select 1 from public.commits c where c.id=commit_id));
alter table public.analysis_runs enable row level security;
create policy run_owner on public.analysis_runs for all to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id)) with check(owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id));
alter table public.ai_findings enable row level security;
create policy finding_owner on public.ai_findings for all to authenticated using(exists(select 1 from public.analysis_runs a where a.id=analysis_run_id)) with check(exists(select 1 from public.analysis_runs a where a.id=analysis_run_id));
alter table public.investigation_threads enable row level security;
create policy thread_owner on public.investigation_threads for all to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id)) with check(owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id));
alter table public.investigation_messages enable row level security;
create policy message_owner on public.investigation_messages for all to authenticated using(exists(select 1 from public.investigation_threads t where t.id=thread_id)) with check(exists(select 1 from public.investigation_threads t where t.id=thread_id));
alter table public.reports enable row level security;
create policy report_owner on public.reports for all to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.analysis_runs a where a.id=analysis_run_id)) with check(owner_id=(select auth.uid()) and exists(select 1 from public.analysis_runs a where a.id=analysis_run_id));
alter table public.ai_cache enable row level security;
create policy cache_owner on public.ai_cache for all to authenticated using(owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id)) with check(owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id));
grant select,insert,update,delete on public.profiles,public.repositories,public.commits,public.file_changes,public.analysis_runs,public.ai_findings,public.investigation_threads,public.investigation_messages,public.reports,public.ai_cache to authenticated;
revoke all on public.profiles,public.repositories,public.commits,public.file_changes,public.analysis_runs,public.ai_findings,public.investigation_threads,public.investigation_messages,public.reports,public.ai_cache from anon;

-- One narrow SECURITY DEFINER RPC owns a private atomic counter. Callers cannot edit counters.
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
create table private.request_limits(user_id uuid not null references auth.users(id) on delete cascade,bucket text not null,window_start timestamptz not null,hits integer not null,primary key(user_id,bucket));
alter table private.request_limits enable row level security;
create function public.consume_request(bucket text,max_requests integer) returns boolean language plpgsql security definer set search_path='' as $$
declare hits_now integer; cap integer;
begin
 if auth.uid() is null or bucket not in ('ai','github') then return false; end if;
 cap := least(max_requests,case when bucket='ai' then 8 else 90 end);
 insert into private.request_limits as limits(user_id,bucket,window_start,hits) values(auth.uid(),bucket,date_trunc('minute',now()),1)
 on conflict(user_id,bucket) do update set hits=case when limits.window_start=date_trunc('minute',now()) then limits.hits+1 else 1 end,window_start=date_trunc('minute',now()) returning hits into hits_now;
 return hits_now<=cap;
end $$;
revoke all on function public.consume_request(text,integer) from public,anon;
grant execute on function public.consume_request(text,integer) to authenticated;
