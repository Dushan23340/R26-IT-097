import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

async function fixPasswordHash() {
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
    
    console.log('\n👤 Found user:', user.name);
    console.log('📝 Current password (plain text):', user.password);
    
    // Hash the password
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(user.password, salt);
    
    console.log('🔐 New hashed password length:', hashedPassword.length);
    
    // Update the user with hashed password
    await Users.updateOne(
      { _id: user._id },
      { $set: { password: hashedPassword } }
    );
    
    console.log('✅ Password updated successfully!');
    
    // Verify the password works
    const isValid = await bcrypt.compare(user.password, hashedPassword);
    console.log('🔍 Verification - password "password123" is:', isValid ? '✅ VALID' : '❌ INVALID');
    
    await mongoose.disconnect();
    console.log('\n✅ Fix complete. You can now login with:');
    console.log('   Email: test@example.com');
    console.log('   Password: password123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixPasswordHash();
