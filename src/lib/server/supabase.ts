import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { ServiceError } from "./github";
export const configured = () =>
  !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
export async function database() {
  if (!configured()) throw new Error("SETUP_REQUIRED");
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (values) => {
          try {
            values.forEach(({ name, value, options }) =>
              store.set(name, value, options),
            );
          } catch {
            /* Server components cannot set cookies; proxy refreshes. */
          }
        },
      },
    },
  );
}
export async function authenticated() {
  const db = await database();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("UNAUTHORIZED");
  return { db, user };
}
export function checkDb(error: { message: string; code?: string } | null) {
  if (!error) return;
  // SQLSTATE only: raw messages/details can contain source code and user data.
  console.error("database_request_failed", {
    code: /^[A-Z0-9]{5,9}$/.test(error.code || "") ? error.code : "unknown",
  });
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code || "")) {
    throw new ServiceError(
      503,
      "Database setup is incomplete. An administrator must apply the PhantomCommit AI database migration to the connected Supabase project.",
    );
  }
  // Keep raw database messages (which may include user data) off the client.
  throw new Error("DATABASE_ERROR");
}
