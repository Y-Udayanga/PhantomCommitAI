import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
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
export function checkDb(error: { message: string } | null) {
  if (error) throw new Error("DATABASE_ERROR");
}
