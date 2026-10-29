-- Bounded derived results only; snapshots remain ephemeral. Rerun investigations after expiry.
create table public.forensic_investigations (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.repositories(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('recovery','impact','security','timeline')),
  result jsonb not null check (octet_length(result::text) <= 2000000),
  review jsonb not null default '{}' check (jsonb_typeof(review) = 'object' and octet_length(review::text) <= 100000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '30 days')
);
create index forensic_owner_repository_date on public.forensic_investigations(owner_id,repository_id,created_at desc);
create index forensic_expiry on public.forensic_investigations(expires_at);
alter table public.forensic_investigations enable row level security;
revoke all on public.forensic_investigations from anon, authenticated;
grant select,insert,update,delete on public.forensic_investigations to authenticated;
create policy forensic_owner on public.forensic_investigations for all to authenticated
using (owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id and r.owner_id=(select auth.uid())))
with check (owner_id=(select auth.uid()) and exists(select 1 from public.repositories r where r.id=repository_id and r.owner_id=(select auth.uid())));
