import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function deleteTestUser() {
  try {
    console.log('🔗 Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI!);
    
    console.log(`✅ Connected to database: ${mongoose.connection.name}`);
    
    const Users = mongoose.connection.collection('users');
    
    // Find the test user
    const user = await Users.findOne({ email: 'test@example.com' });
    
    if (!user) {
      console.log('❌ User test@example.com not found');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log('\n👤 Found user to delete:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   ID: ${user._id}`);
    
    // Delete the user
    const result = await Users.deleteOne({ email: 'test@example.com' });
    
    console.log(`\n✅ User deleted successfully! (${result.deletedCount} document removed)`);
    
    // Verify deletion
    const remainingUsers = await Users.countDocuments();
    console.log(`\n📊 Remaining users in database: ${remainingUsers}`);
    
    await mongoose.disconnect();
    console.log('\n✅ Complete. You can now sign up fresh with test@example.com through the app!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteTestUser();
