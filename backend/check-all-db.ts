import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function checkAllDatabases() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    
    // Get admin database to list all databases
    const adminDb = mongoose.connection.db?.admin();
    const databases = await adminDb!.listDatabases();
    
    console.log('\n📊 All databases in your MongoDB Atlas cluster:');
    databases.databases.forEach((db: any) => {
      console.log(`  - ${db.name} (${db.sizeOnDisk} bytes)`);
    });
    
    // Check the default database (from connection string)
    const defaultDb = mongoose.connection.name;
    console.log(`\n🎯 Current default database: ${defaultDb}`);
    
    // Check for users in the default database
    const Users = mongoose.connection.collection('users');
    const userCount = await Users.countDocuments();
    console.log(`\n👥 Users in database "${defaultDb}": ${userCount}`);
    
    if (userCount > 0) {
      const users = await Users.find({}).toArray();
      console.log('\nAll users:');
      users.forEach((user, index) => {
        console.log(`  ${index + 1}. ${user.name} (${user.email}) - ${user.role}`);
      });
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Check complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAllDatabases();
