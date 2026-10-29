import { it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
const ready = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY &&
  process.env.TEST_USER_A_EMAIL &&
  process.env.TEST_USER_A_PASSWORD &&
  process.env.TEST_USER_B_EMAIL &&
  process.env.TEST_USER_B_PASSWORD
);
it.skipIf(!ready)(
  "persists a repository and enforces cross-user ownership, including child inserts",
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!,
      key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
    const a = createClient(url, key, { auth: { persistSession: false } }),
      b = createClient(url, key, { auth: { persistSession: false } });
    const aa = await a.auth.signInWithPassword({
      email: process.env.TEST_USER_A_EMAIL!,
      password: process.env.TEST_USER_A_PASSWORD!,
    });
    expect(aa.error).toBeNull();
    const bb = await b.auth.signInWithPassword({
      email: process.env.TEST_USER_B_EMAIL!,
      password: process.env.TEST_USER_B_PASSWORD!,
    });
    expect(bb.error).toBeNull();
    const r = await a
      .from("repositories")
      .insert({
        owner_id: aa.data.user!.id,
        github_owner: "test",
        github_name: "fixture",
        full_name: `test/fixture-${Date.now()}`,
        github_url: "https://github.com/test/fixture",
        default_branch: "main",
      })
      .select()
      .single();
    expect(r.error).toBeNull();
    try {
      const own = await a.from("repositories").select().eq("id", r.data.id);
      expect(own.data).toHaveLength(1);
      const other = await b.from("repositories").select().eq("id", r.data.id);
      expect(other.error).toBeNull();
      expect(other.data).toHaveLength(0);
      const update = await b
        .from("repositories")
        .update({ description: "tampered" })
        .eq("id", r.data.id)
        .select();
      expect(update.data).toHaveLength(0);
      const child = await b.from("analysis_runs").insert({
        repository_id: r.data.id,
        owner_id: bb.data.user!.id,
        status: "running",
        analysis_type: "test",
      });
      expect(child.error).not.toBeNull();
      const transfer = await a
        .from("repositories")
        .update({ owner_id: bb.data.user!.id })
        .eq("id", r.data.id);
      expect(transfer.error).not.toBeNull();
      const thread = await a
        .from("investigation_threads")
        .insert({
          repository_id: r.data.id,
          owner_id: aa.data.user!.id,
          title: "Integration test",
        })
        .select()
        .single();
      expect(thread.error).toBeNull();
      const message = await a
        .from("investigation_messages")
        .insert({ thread_id: thread.data.id, role: "user", content: "test" });
      expect(message.error).toBeNull();
      expect(
        (
          await b
            .from("investigation_messages")
            .select()
            .eq("thread_id", thread.data.id)
        ).data,
      ).toHaveLength(0);
      expect(
        (
          await b.from("investigation_messages").insert({
            thread_id: thread.data.id,
            role: "user",
            content: "tampered",
          })
        ).error,
      ).not.toBeNull();
    } finally {
      await a.from("repositories").delete().eq("id", r.data.id);
      await a.auth.signOut();
      await b.auth.signOut();
    }
  },
);
