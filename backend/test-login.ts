import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function testLogin() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    
    console.log('✅ Connected to database:', mongoose.connection.name);
    console.log('');
    
    // Get the users collection
    const Users = mongoose.connection.collection('users');
    
    // Count all users
    const totalUsers = await Users.countDocuments();
    console.log(`📊 Total users in database: ${totalUsers}`);
    console.log('');
    
    // List ALL users
    const allUsers = await Users.find({}).toArray();
    console.log('👥 All users in database:');
    allUsers.forEach((user, index) => {
      console.log(`  ${index + 1}. ${user.name}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Verified: ${user.isEmailVerified}`);
      console.log(`     Created: ${user.createdAt}`);
      console.log('');
    });
    
    // Specifically search for dasanayakadushan@gmail.com
    console.log('🔍 Searching for dasanayakadushan@gmail.com...');
    const specificUser = await Users.findOne({ email: 'dasanayakadushan@gmail.com' });
    
    if (specificUser) {
      console.log('✅ FOUND! User exists in database:');
      console.log(`   Name: ${specificUser.name}`);
      console.log(`   Email: ${specificUser.email}`);
      console.log(`   Role: ${specificUser.role}`);
      console.log(`   ID: ${specificUser._id}`);
    } else {
      console.log('❌ NOT FOUND! User does NOT exist in database.');
    }
    
    await mongoose.disconnect();
    console.log('');
    console.log('✅ Test complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

testLogin();
