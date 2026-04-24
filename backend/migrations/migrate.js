const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const pool = require("../db");

async function ensureMigrationsTable() {
  await pool.query(`
    create table if not exists public.schema_migrations (
      id bigserial primary key,
      filename text not null unique,
      checksum text not null,
      executed_at timestamptz not null default now()
    )
  `);
}

function getSqlFiles(dir) {
  return fs
    .readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

function sha256(content) {
  return crypto.createHash("sha256").update(content).digest("hex");
}

async function getExecutedMigrations() {
  const result = await pool.query(`
    select filename, checksum
    from public.schema_migrations
    order by filename asc
  `);

  const map = new Map();
  for (const row of result.rows) {
    map.set(row.filename, row.checksum);
  }
  return map;
}

async function run() {
  const dir = __dirname;

  await ensureMigrationsTable();

  const files = getSqlFiles(dir);
  const executed = await getExecutedMigrations();

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const sql = fs.readFileSync(fullPath, "utf8");
    const checksum = sha256(sql);

    if (executed.has(file)) {
      const oldChecksum = executed.get(file);

      if (oldChecksum !== checksum) {
        throw new Error(
          `Migration já executada com conteúdo diferente: ${file}. ` +
          `Crie uma nova migration em vez de alterar a antiga.`
        );
      }

      console.log(`Pulando: ${file} (já executada)`);
      continue;
    }

    console.log(`Rodando: ${file}`);

    const client = await pool.connect();
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query(
        `
          insert into public.schema_migrations (filename, checksum)
          values ($1, $2)
        `,
        [file, checksum]
      );
      await client.query("commit");
      console.log(`Concluída: ${file}`);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  console.log("Migrations concluídas");
  process.exit(0);
}

run().catch((err) => {
  console.error("Erro ao rodar migrations:", err);
  process.exit(1);
});
