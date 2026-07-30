import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"
import pg from "pg"

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, "..", "supabase", "schema.sql"), "utf8")

const PROJECT_REF = "toiqncezuamuaqobsyun"
const password = process.env.SUPABASE_DB_PASSWORD
if (!password) {
  console.error("[v0] SUPABASE_DB_PASSWORD ausente")
  process.exit(1)
}

// Tenta várias formas de conexão (pooler nas regiões comuns + conexão direta).
const candidates = [
  {
    label: "pooler session (us-east-2)",
    config: {
      host: "aws-0-us-east-2.pooler.supabase.com",
      port: 5432,
      user: `postgres.${PROJECT_REF}`,
      password,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    },
  },
]

async function tryConnect() {
  for (const c of candidates) {
    const client = new pg.Client({ ...c.config, connectionTimeoutMillis: 15000 })
    try {
      await client.connect()
      console.log(`[v0] conectado via: ${c.label}`)
      return client
    } catch (e) {
      console.log(`[v0] falhou ${c.label}: ${e.message}`)
      try { await client.end() } catch {}
    }
  }
  return null
}

const client = await tryConnect()
if (!client) {
  console.error("[v0] Não foi possível conectar em nenhum endpoint.")
  process.exit(2)
}

try {
  await client.query(sql)
  console.log("[v0] schema aplicado com sucesso")
  const { rows } = await client.query(
    "select count(*)::int as n from information_schema.tables where table_schema='public'"
  )
  console.log(`[v0] tabelas no schema public: ${rows[0].n}`)
} catch (e) {
  console.error("[v0] erro ao aplicar schema:", e.message)
  process.exitCode = 3
} finally {
  await client.end()
}
