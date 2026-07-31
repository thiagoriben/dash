import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join, isAbsolute } from "node:path"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))

// Recebe o caminho do .sql como argumento (relativo à raiz do projeto ou absoluto).
const arg = process.argv[2]
if (!arg) {
  console.error("[v0] uso: node scripts/apply-migration.mjs <caminho.sql>")
  process.exit(1)
}
const sqlPath = isAbsolute(arg) ? arg : join(__dirname, "..", arg)
const sql = readFileSync(sqlPath, "utf8")

const PROJECT_REF = "toiqncezuamuaqobsyun"
const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error("[v0] SUPABASE_DB_PASSWORD ausente")
  process.exit(1)
}

const client = new pg.Client({
  host: "aws-0-us-east-2.pooler.supabase.com",
  port: 5432,
  user: `postgres.${PROJECT_REF}`,
  password,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
})

try {
  await client.connect()
  console.log("[v0] conectado")
  await client.query(sql)
  console.log(`[v0] migração aplicada: ${arg}`)
} catch (e) {
  console.error("[v0] erro:", e.message)
  process.exitCode = 3
} finally {
  await client.end()
}
