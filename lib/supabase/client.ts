import { createBrowserClient } from "@supabase/ssr"

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Necessário para o preview do v0, que roda a app dentro de um iframe cross-origin.
      // Sem SameSite=None; Secure o navegador não envia o cookie de sessão dentro do iframe.
      cookieOptions: { sameSite: "none", secure: true },
    },
  )
}
