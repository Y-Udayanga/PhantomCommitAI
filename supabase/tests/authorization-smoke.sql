-- Requires two existing Auth users. All verification writes are rolled back.
-- Does not issue tokens, change passwords, or modify existing Auth users.
begin;
select set_config('phantom.verify_a',(select id::text from auth.users order by created_at,id limit 1),true), set_config('phantom.verify_b',(select id::text from auth.users order by created_at,id offset 1 limit 1),true);
select set_config('request.jwt.claim.sub',current_setting('phantom.verify_a'),true);
set local role authenticated;
do $$ declare changed integer; begin
 if auth.uid() is null or current_setting('phantom.verify_b')='' then raise exception 'Two test identities are required'; end if;
 if not public.consume_request('github',90) then raise exception 'Authenticated quota call failed'; end if;
 insert into public.repositories(owner_id,github_owner,github_name,full_name,github_url,default_branch) values(auth.uid(),'Y-Udayanga','PhantomCommitAI','Y-Udayanga/PhantomCommitAI','https://github.com/Y-Udayanga/PhantomCommitAI','main') on conflict(owner_id,full_name) do nothing;
 perform set_config('phantom.verify_repo',(select id::text from public.repositories where owner_id=auth.uid() and full_name='Y-Udayanga/PhantomCommitAI'),true);
 update public.repositories set description=description where id=current_setting('phantom.verify_repo')::uuid;
 get diagnostics changed=row_count;
 if changed<>1 then raise exception 'Owner CRUD failed'; end if;
end $$;
select set_config('request.jwt.claim.sub',current_setting('phantom.verify_b'),true);
do $$ declare changed integer; begin
 if exists(select 1 from public.repositories where id=current_setting('phantom.verify_repo')::uuid) then raise exception 'Cross-user read allowed'; end if;
 update public.repositories set description=description where id=current_setting('phantom.verify_repo')::uuid;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Cross-user update allowed'; end if;
 delete from public.repositories where id=current_setting('phantom.verify_repo')::uuid;
 get diagnostics changed=row_count;
 if changed<>0 then raise exception 'Cross-user delete allowed'; end if;
 begin
  insert into public.repositories(owner_id,github_owner,github_name,full_name,github_url,default_branch) values(current_setting('phantom.verify_a')::uuid,'octocat','Hello-World','octocat/Hello-World','https://github.com/octocat/Hello-World','master');
  raise exception 'Forged ownership insert allowed';
 exception when insufficient_privilege then null;
 end;
end $$;
reset role;
rollback;
select 'PASS' as result, 'Authenticated quota and owner CRUD; cross-user read, update, delete and forged ownership blocked. All verification writes rolled back.' as verified;
