// Resolve as credenciais do Supabase, VAPID Web Push e Meta Facebook Ads
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://toiqncezuamuaqobsyun.supabase.co"

const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.publishablekey ||
  ""

const VAPID_PUBLIC =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  process.env.VAPID_PUBLIC_KEY ||
  "BLnF17klfFXsfCmayro8yc8HI7xbtZ_iQwi565pIC8WN1-p9-kJ200UrqFR4YUUx83rirg4E2-AeEsQsAUnBFJs"

const VAPID_PRIVATE =
  process.env.VAPID_PRIVATE_KEY ||
  "uogiZO9FeL7LAZ-jvPdf79vi54LvmdCIW1zuz_PPlyY"

const CRON_SECRET =
  process.env.CRON_SECRET ||
  "35223281tT!"

const FACEBOOK_APP_ID =
  process.env.FACEBOOK_APP_ID ||
  process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ||
  "1581224863381354"

const FACEBOOK_APP_SECRET =
  process.env.FACEBOOK_APP_SECRET ||
  "b2b007d2d11812035b77bc615f02f786"

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://bandodash.vercel.app"

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: { root: import.meta.dirname },
  typescript: { ignoreBuildErrors: true },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: VAPID_PUBLIC,
    VAPID_PUBLIC_KEY: VAPID_PUBLIC,
    VAPID_PRIVATE_KEY: VAPID_PRIVATE,
    CRON_SECRET: CRON_SECRET,
    FACEBOOK_APP_ID: FACEBOOK_APP_ID,
    NEXT_PUBLIC_FACEBOOK_APP_ID: FACEBOOK_APP_ID,
    FACEBOOK_APP_SECRET: FACEBOOK_APP_SECRET,
    NEXT_PUBLIC_APP_URL: APP_URL,
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
            value: "camera=(), microphone=(self), geolocation=()",
          },
        ],
      },
    ]
  },
}

export default nextConfig
