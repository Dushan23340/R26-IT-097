import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const email = process.argv[2] || "test@example.com";

async function deleteTestUser() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(uri);

    console.log(`✅ Connected to database: ${mongoose.connection.name}`);

    const Users = mongoose.connection.collection("users");

    const user = await Users.findOne({ email });

    if (!user) {
      console.log(`❌ User ${email} not found`);
      await mongoose.disconnect();
      process.exit(0);
    }

    console.log("\n👤 Found user to delete:");
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user._id}`);

    const result = await Users.deleteOne({ email });

    console.log(`\n✅ User deleted successfully! (${result.deletedCount} document removed)`);

    const remainingUsers = await Users.countDocuments();
    console.log(`\n📊 Remaining users in database: ${remainingUsers}`);

    await mongoose.disconnect();
    console.log("\n✅ Complete.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

deleteTestUser();
