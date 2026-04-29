import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function findUser() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI!);
    
    const db = mongoose.connection.db;
    const adminDb = db?.admin();
    const databases = await adminDb!.listDatabases();
    
    console.log('\n🔍 Searching for dasanayakadushan@gmail.com across ALL databases...\n');
    
    for (const dbInfo of databases.databases) {
      const dbName = dbInfo.name;
      
      // Skip system databases
      if (['admin', 'local', 'config'].includes(dbName)) {
        continue;
      }
      
      console.log(`\n📊 Checking database: ${dbName}`);
      
      // Connect to this specific database
      const dbUri = process.env.MONGODB_URI!.replace(/\?.*/, '').replace(/\/[^/?]*$/, `/${dbName}`) + 
                    (process.env.MONGODB_URI!.includes('?') ? process.env.MONGODB_URI!.substring(process.env.MONGODB_URI!.indexOf('?')) : '');
      
      const conn = await mongoose.createConnection(dbUri).asPromise();
      
      try {
        const Users = conn.collection('users');
        const user = await Users.findOne({ email: 'dasanayakadushan@gmail.com' });
        
        if (user) {
          console.log(`  ✅ FOUND!`);
          console.log(`     Name: ${user.name}`);
          console.log(`     Email: ${user.email}`);
          console.log(`     Role: ${user.role}`);
          console.log(`     ID: ${user._id}`);
          console.log(`     Created: ${user.createdAt}`);
        } else {
          console.log(`  ❌ Not found`);
        }
      } catch (e: any) {
        console.log(`  ⚠️  Error checking: ${e.message}`);
      } finally {
        await conn.close();
      }
    }
    
    await mongoose.disconnect();
    console.log('\n✅ Search complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findUser();
