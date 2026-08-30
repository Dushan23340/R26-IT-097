import pg from "pg";

const { Pool } = pg;

// Shared PostgreSQL instance — the same database analytics-service already
// uses (adaptive_learning_analytics). User records live in the "core"
// schema (see db/migrations/001_core_users_and_resources.sql) so this
// service doesn't need — and doesn't get — its own database.
const pool = new Pool({
  host: process.env.PGHOST || "127.0.0.1",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.PGDATABASE || "adaptive_learning_analytics",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  max: Number(process.env.PGPOOL_MAX) || 10,
});

pool.on("error", (err) => {
  console.error("❌ Unexpected PostgreSQL pool error:", err);
});

export async function query(text, params) {
  return pool.query(text, params);
}

export async function connectToDatabase() {
  console.log(
    "🔍 Database config - PGHOST/PGDATABASE:",
    `${process.env.PGHOST || "127.0.0.1"}/${process.env.PGDATABASE || "adaptive_learning_analytics"}`,
  );

  try {
    const { rows } = await pool.query("SELECT current_database() AS db, now() AS ts");
    console.log("✅ PostgreSQL connected successfully");
    console.log(`📊 Active database: "${rows[0].db}"`);
    console.log('📂 User records live in schema "core", table "users" (was MongoDB\'s "users" collection).');
  } catch (error) {
    console.error("❌ PostgreSQL connection error:", error);
    console.error(
      "💡 Start Postgres locally (brew services start postgresql@16) and run db/migrations/001_core_users_and_resources.sql once.",
    );
    process.exit(1);
  }
}

export default pool;
