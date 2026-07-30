import pg from "pg"

const PROJECT_REF = "toiqncezuamuaqobsyun"
const password = process.env.SUPABASE_DB_PASSWORD

const client = new pg.Client({
  host: "aws-0-us-east-2.pooler.supabase.com",
  port: 5432,
  user: `postgres.${PROJECT_REF}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
})

await client.connect()

const authUsers = await client.query(
  "select id, email, created_at from auth.users order by created_at",
)
console.log("[v0] auth.users:", authUsers.rowCount)
for (const u of authUsers.rows) {
  console.log("  -", u.email, "|", u.created_at.toISOString())
}

const profiles = await client.query(
  "select username, role, approved, created_at from public.profiles order by created_at",
)
console.log("[v0] profiles:", profiles.rowCount)
for (const p of profiles.rows) {
  console.log("  -", p.username, "| role:", p.role, "| approved:", p.approved)
}

await client.end()
