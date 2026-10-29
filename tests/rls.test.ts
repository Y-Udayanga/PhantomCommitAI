import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";

it("executes migration in PostgreSQL and enforces tenant policies and atomic quotas", async () => {
  const pg = new PGlite();
  const a = "10000000-0000-4000-8000-000000000001",
    b = "10000000-0000-4000-8000-000000000002";
  await pg.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated; insert into auth.users values('${a}'),('${b}');`,
  );
  await pg.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20261028155647_initial_schema.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await pg.exec(`set role authenticated; set request.jwt.claim.sub='${a}';`);
  const r = await pg.query<{ id: string }>(
    `insert into public.repositories(owner_id,github_owner,github_name,full_name,github_url,default_branch) values('${a}','test','fixture','test/fixture','https://github.com/test/fixture','main') returning id`,
  );
  const id = r.rows[0].id;
  const t = await pg.query<{ id: string }>(
    `insert into public.investigation_threads(repository_id,owner_id,title) values('${id}','${a}','test') returning id`,
  );
  await pg.exec(
    `insert into public.investigation_messages(thread_id,role,content) values('${t.rows[0].id}','user','hello');`,
  );
  const run = await pg.query<{ id: string }>(
    `insert into public.analysis_runs(repository_id,owner_id,status,analysis_type) values('${id}','${a}','completed','test') returning id`,
  );
  await pg.exec(
    `insert into public.ai_findings(analysis_run_id,finding_type,title,description,explanation,severity,evidence_status,recommended_action) values('${run.rows[0].id}','test','test','test','test','info','insufficient','test'); insert into public.reports(analysis_run_id,owner_id,title,report_content) values('${run.rows[0].id}','${a}','test','test');`,
  );
  await pg.exec(`set request.jwt.claim.sub='${b}';`);
  for (const table of [
    "repositories",
    "investigation_threads",
    "investigation_messages",
    "analysis_runs",
    "ai_findings",
    "reports",
  ])
    expect((await pg.query(`select * from public.${table}`)).rows).toHaveLength(
      0,
    );
  await expect(
    pg.exec(
      `insert into public.investigation_threads(repository_id,owner_id,title) values('${id}','${b}','intrusion')`,
    ),
  ).rejects.toThrow(/row-level security/);
  await expect(
    pg.exec(
      `insert into public.investigation_messages(thread_id,role,content) values('${t.rows[0].id}','user','intrusion')`,
    ),
  ).rejects.toThrow(/row-level security/);
  await expect(
    pg.exec(
      `insert into public.analysis_runs(repository_id,owner_id,status,analysis_type) values('${id}','${b}','running','intrusion')`,
    ),
  ).rejects.toThrow(/row-level security/);
  await expect(
    pg.exec(
      `insert into public.reports(analysis_run_id,owner_id,title,report_content) values('${run.rows[0].id}','${b}','intrusion','test')`,
    ),
  ).rejects.toThrow(/row-level security/);
  expect(
    (
      await pg.query(
        `update public.repositories set description='intrusion' where id='${id}' returning id`,
      )
    ).rows,
  ).toHaveLength(0);
  await pg.exec(`set request.jwt.claim.sub='${a}';`);
  await expect(
    pg.exec(`update public.repositories set owner_id='${b}' where id='${id}'`),
  ).rejects.toThrow(/row-level security/);
  for (let i = 0; i < 8; i++)
    expect(
      (
        await pg.query<{ allowed: boolean }>(
          `select public.consume_request('ai',999999) as allowed`,
        )
      ).rows[0].allowed,
    ).toBe(true);
  expect(
    (
      await pg.query<{ allowed: boolean }>(
        `select public.consume_request('ai',999999) as allowed`,
      )
    ).rows[0].allowed,
  ).toBe(false);
  await expect(
    pg.query("select * from private.request_limits"),
  ).rejects.toThrow(/permission denied/);
  await pg.exec(`delete from public.repositories where id='${id}';`);
  expect(
    (await pg.query("select * from public.investigation_messages")).rows,
  ).toHaveLength(0);
  expect(
    (await pg.query("select * from public.ai_findings")).rows,
  ).toHaveLength(0);
  await pg.close();
}, 120000);
