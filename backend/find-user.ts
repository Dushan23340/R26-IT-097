import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function findUser() {
  try {
    console.log('Connecting to MongoDB Atlas...');
    await mongoose.connect(process.env.MONGODB_URI!);
    
    console.log('Database name:', mongoose.connection.name);
    console.log('Full URI:', process.env.MONGODB_URI);
    
    // List all collections
    const collections = await mongoose.connection.db!.collections();
    console.log('\n📁 All collections:', collections.map(c => c.collectionName));
    
    // Try to find users in different possible collection names
    const possibleNames = ['users', 'user', 'User'];
    
    for (const name of possibleNames) {
      const collection = mongoose.connection.collection(name);
      const count = await collection.countDocuments();
      console.log(`\nCollection "${name}": ${count} documents`);
      
      if (count > 0) {
        const docs = await collection.find({}).limit(5).toArray();
        console.log('Sample documents:');
        docs.forEach((doc, i) => {
          console.log(`${i + 1}.`, doc.name || doc.email || doc._id);
        });
      }
    }
    
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findUser();
