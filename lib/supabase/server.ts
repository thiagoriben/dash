import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Preview do v0 roda em iframe cross-origin: cookie precisa de SameSite=None; Secure.
      cookieOptions: { sameSite: "none", secure: true },
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, { ...options, sameSite: "none", secure: true }),
            )
          } catch {
            // called from a Server Component; ignore (proxy refreshes tokens)
          }
        },
      },
    },
  )
}

/** Admin client using the service role / secret key. SERVER ONLY. */
export function createAdminClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://toiqncezuamuaqobsyun.supabase.co"
  const secretKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.sescretkey!

  return createServerClient(url, secretKey, {
      cookies: { getAll() { return [] }, setAll() {} },
      auth: { autoRefreshToken: false, persistSession: false },
    },
  )
}
