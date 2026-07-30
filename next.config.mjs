// Resolve as credenciais do Supabase a partir dos nomes padrão OU dos nomes
// que o projeto tem hoje (publishablekey / sescretkey). A URL do projeto entra
// como fallback. Só a URL e a chave publishable (ambas públicas por natureza)
// são expostas ao navegador via `env`; a chave secreta NUNCA entra aqui.
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://toiqncezuamuaqobsyun.supabase.co"

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.publishablekey ||
  ""

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: import.meta.dirname },
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
