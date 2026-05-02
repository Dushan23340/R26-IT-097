import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const targetEmail = process.argv[2] || process.env.TEST_USER_EMAIL;
if (!targetEmail) {
  console.error("Usage: node find-user.js <email>");
  console.error("   or set TEST_USER_EMAIL in .env");
  process.exit(1);
}

async function findUser() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(uri);

    const db = mongoose.connection.db;
    const adminDb = db.admin();
    const databases = await adminDb.listDatabases();

    console.log(`\n🔍 Searching for ${targetEmail} across user databases...\n`);

    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;

      if (["admin", "local", "config"].includes(dbName)) {
        continue;
      }

      console.log(`\n📊 Checking database: ${dbName}`);

      const base = uri.replace(/\?.*/, "").replace(/\/[^/?]*$/, `/${dbName}`);
      const qs = uri.includes("?") ? uri.substring(uri.indexOf("?")) : "";
      const dbUri = base + qs;

      const conn = await mongoose.createConnection(dbUri).asPromise();

      try {
        const Users = conn.collection("users");
        const user = await Users.findOne({ email: targetEmail });

        if (user) {
          console.log(`  ✅ FOUND!`);
          console.log(`     Name: ${user.name}`);
          console.log(`     Email: ${user.email}`);
          console.log(`     Role: ${user.role}`);
          console.log(`     ID: ${user._id}`);
        } else {
          console.log(`  ❌ Not found`);
        }
      } catch (e) {
        console.log(`  ⚠️  Error checking: ${e.message}`);
      } finally {
        await conn.close();
      }
    }

    await mongoose.disconnect();
    console.log("\n✅ Search complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

findUser();
