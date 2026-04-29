import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkUserPassword() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    
    console.log(`✅ Connected to database: ${mongoose.connection.name}`);
    
    const Users = mongoose.connection.collection('users');
    const user = await Users.findOne({ email: 'test@example.com' });
    
    if (!user) {
      console.log('❌ User not found');
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log('\n👤 User found:');
    console.log(`   Name: ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
    console.log(`   Has password field: ${!!user.password}`);
    console.log(`   Password length: ${user.password?.length || 0}`);
    console.log(`   Password starts with: ${user.password?.substring(0, 20) || 'N/A'}`);
    
    // Test password comparison
    const testPasswords = ['password123', 'Password123!', 'test123', 'Dushan23340'];
    
    console.log('\n🔐 Testing password comparisons:');
    for (const testPass of testPasswords) {
      try {
        const isValid = await bcrypt.compare(testPass, user.password);
        console.log(`   "${testPass}": ${isValid ? '✅ VALID' : '❌ INVALID'}`);
      } catch (e: any) {
        console.log(`   "${testPass}": ⚠️ Error - ${e.message}`);
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkUserPassword();
