import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/cp_sync';
  
  // Attach error listener to prevent process crashes if DB drops/offline
  mongoose.connection.on('error', (err) => {
    // Suppress unhandled connection error events
  });

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 1000,
    });
    console.log(`[MongoDB] Connected successfully to ${uri}`);
  } catch (err) {
    console.warn(`[MongoDB] Connection failed (${err.message}). System operating in memory-cache mode.`);
  }
}
