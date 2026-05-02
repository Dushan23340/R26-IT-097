import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

async function testMongoDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }
  try {
    console.log("Connecting to MongoDB...");
    console.log("URI:", uri.substring(0, 40) + "...");

    await mongoose.connect(uri);
    console.log("✅ Connected to MongoDB\n");

    if (!mongoose.connection.db) {
      throw new Error("Database connection not established");
    }
    const collections = await mongoose.connection.db.collections();
    console.log("📁 Collections:", collections.map((c) => c.collectionName));

    const usersCollection = mongoose.connection.collection("users");
    const userCount = await usersCollection.countDocuments();
    console.log(`\n👤 Total users in database: ${userCount}`);

    if (userCount > 0) {
      const users = await usersCollection.find({}).toArray();
      console.log("\nUsers:");
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
      });
    }

    await mongoose.disconnect();
    console.log("\n✅ Test complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testMongoDB();
