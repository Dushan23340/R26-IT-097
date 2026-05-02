import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/test";

/**
 * True when the URI already names a database (path after host), e.g.
 * mongodb://127.0.0.1:27017/test or mongodb+srv://host/mydb?...
 * Atlas URIs like ...mongodb.net/?appName=... have NO db segment — we then use MONGODB_DB_NAME or "test".
 */
function uriSpecifiesDatabase(uri) {
  const base = uri.split("?")[0];
  const stripped = base.replace(/^mongodb(\+srv)?:\/\/[^/]+/, "");
  if (!stripped || stripped === "/") return false;
  const segment = stripped.replace(/^\//, "").split("/")[0];
  return segment.length > 0;
}

export async function connectToDatabase() {
  const MONGODB_URI = process.env.MONGODB_URI || DEFAULT_URI;
  const dbNameOverride = process.env.MONGODB_DB_NAME || "test";

  console.log(
    "🔍 Database config - MONGODB_URI:",
    process.env.MONGODB_URI ? "SET (from .env)" : "NOT SET — using default local URI",
  );
  if (process.env.MONGODB_URI) {
    console.log("🔍 Database config - Value:", MONGODB_URI.replace(/\/\/[^@]+@/, "//***:***@"));
  } else {
    console.log("💡 Tip: run `docker compose up -d` from the repo root for local MongoDB.");
  }

  const connectOptions = {};
  if (!uriSpecifiesDatabase(MONGODB_URI)) {
    connectOptions.dbName = dbNameOverride;
    console.log(
      `📌 No database name in MONGODB_URI — Mongoose will use dbName="${dbNameOverride}" (set MONGODB_DB_NAME to override).`,
    );
    console.log(
      '💡 Or add the DB to your URI, e.g. ...mongodb.net/test?retryWrites=true&w=majority',
    );
  }

  try {
    await mongoose.connect(MONGODB_URI, connectOptions);
    console.log("✅ MongoDB connected successfully");
    console.log(`📊 Active database: "${mongoose.connection.name}"`);
    console.log(`📂 User documents use collection "users" in that database.`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error);
    console.error("💡 Start local DB: docker compose up -d   ·  Or fix MONGODB_URI for Atlas.");
    process.exit(1);
  }
}

export default mongoose;
