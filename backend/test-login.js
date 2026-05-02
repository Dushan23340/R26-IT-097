import mongoose from "mongoose";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const targetEmail = process.argv[2] || process.env.TEST_USER_EMAIL || "test@example.com";

async function testLogin() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("❌ MONGODB_URI is not set in .env");
    process.exit(1);
  }
  try {
    console.log("🔗 Connecting to MongoDB...");
    await mongoose.connect(uri);

    console.log("✅ Connected to database:", mongoose.connection.name);
    console.log("");

    const Users = mongoose.connection.collection("users");

    const totalUsers = await Users.countDocuments();
    console.log(`📊 Total users in database: ${totalUsers}`);
    console.log("");

    const allUsers = await Users.find({}).toArray();
    console.log("👥 All users in database:");
    allUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Role: ${user.role}`);
      console.log("");
    });

    console.log(`🔍 Searching for ${targetEmail}...`);
    const specificUser = await Users.findOne({ email: targetEmail });

    if (specificUser) {
      console.log("✅ FOUND! User exists in database:");
      console.log(`   Name: ${specificUser.name}`);
      console.log(`   Email: ${specificUser.email}`);
      console.log(`   Role: ${specificUser.role}`);
      console.log(`   ID: ${specificUser._id}`);
    } else {
      console.log("❌ NOT FOUND! User does NOT exist in database.");
    }

    await mongoose.disconnect();
    console.log("");
    console.log("✅ Test complete");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

testLogin();
