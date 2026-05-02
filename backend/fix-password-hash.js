import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const email = process.argv[2] || "test@example.com";

async function fixPasswordHash() {
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

    console.log("\n👤 Found user:", user.name);

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(String(user.password), salt);

    await Users.updateOne({ _id: user._id }, { $set: { password: hashedPassword } });

    console.log("✅ Password updated to a bcrypt hash.");

    await mongoose.disconnect();
    console.log("\n✅ Fix complete.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

fixPasswordHash();
