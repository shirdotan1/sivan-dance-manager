import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";

function env() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (see .env.local).");
  }
  return { url, key };
}

/**
 * Supabase client bound to the request's auth cookies. Server Components
 * can't write cookies, so setAll is a no-op there; the proxy refreshes the
 * session before rendering, and Server Actions / Route Handlers can write.
 */
export async function createClient() {
  const { url, key } = env();
  const cookieStore = await cookies();
  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: ignore (the proxy keeps the session fresh).
        }
      },
    },
  });
}

/**
 * Data Access Layer entry point: verifies the signed-in user (JWT checked
 * by Supabase) and returns a client. Every read and Server Action goes
 * through this, so authorization never relies on the UI alone.
 *
 * Request-time only: `connection()` stops every render that is not a real
 * request (build prerender, a link's prefetch) before the session loads.
 * The session load reads the clock, and what callers do with the client —
 * the weekly-slot renewal writes rows — must never run in a prefetch.
 */
export async function requireUser() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) redirect("/login");
  return { supabase, userId: data.claims.sub as string };
}
