import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function checkDatabase() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }
  try {
    console.log("🔗 Connecting to MongoDB...");
    console.log("📝 URI:", uri.replace(/\/\/.*@/, "//***:***@"));
    console.log("");

    await mongoose.connect(uri);

    const dbName = mongoose.connection.name;
    console.log("✅ Connected to database:", dbName);
    console.log("");

    const collections = await mongoose.connection.db.collections();
    console.log("📁 Collections in database:");
    if (collections.length === 0) {
      console.log("   (No collections found)");
    } else {
      collections.forEach((col) => {
        console.log(`   - ${col.collectionName}`);
      });
    }
    console.log("");

    const usersCollection = mongoose.connection.collection("users");
    const userCount = await usersCollection.countDocuments();
    console.log(`👤 Users in database: ${userCount}`);

    if (userCount > 0) {
      const users = await usersCollection.find({}).limit(5).toArray();
      console.log("");
      console.log("Sample users:");
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
      });
    }

    await mongoose.disconnect();
    console.log("");
    console.log("✅ Check complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkDatabase();
