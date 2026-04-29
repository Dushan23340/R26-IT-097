import mongoose from 'mongoose';

export async function connectToDatabase() {
  // MONGODB_URI is injected by tsx from root .env file
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/emotion-learn-lounge';
  
  console.log('🔍 Database config - MONGODB_URI:', process.env.MONGODB_URI ? 'SET' : 'NOT SET');
  if (process.env.MONGODB_URI) {
    console.log('🔍 Database config - Value:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@'));
  }
  
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ MongoDB connected successfully');
    console.log(`📊 Database name: ${mongoose.connection.name}`);
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}

export default mongoose;
