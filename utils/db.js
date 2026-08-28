import mongoose from 'mongoose';
import config from '../config/config.js';
import User from '../models/user.model.js';

// Module-level cache — survives across warm Vercel invocations
let cachedConnection = null;

const connectDB = async () => {
  try {
    const uri = config.mongoURI || process.env.MONGO_URI;
    if (!uri) {
      console.error('MongoDB URI is not configured.');
      return false;
    }

    // Reuse existing connection (critical for Vercel serverless)
    if (mongoose.connection.readyState === 1) {
      return true;
    }

    // If a connection attempt is already in progress, wait for it
    if (cachedConnection) {
      await cachedConnection;
      return true;
    }

    const options = {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      heartbeatFrequencyMS: 10000,
      maxPoolSize: 10,
      connectTimeoutMS: 10000,
      bufferCommands: false, // Fail fast if not connected
    };

    // Cache the promise so concurrent requests share one connection attempt
    cachedConnection = mongoose.connect(uri, options);
    const connection = await cachedConnection;
    console.log('MongoDB connected to', connection.connection.host);

    // Defer heavy init work — don't block the first request
    setImmediate(async () => {
      try {
        const { emailQueueService } = await import('../queues/emailQueue.js');
        const { recruitmentEmailQueueService } = await import('../queues/recruitmentEmailQueue.js');
        console.log('Email queue services initialized');
      } catch (queueError) {
        console.error('Error initializing email queue services:', queueError);
      }

      try {
        if (process.env.NODE_ENV !== 'development') {
          const admin = await User.findOne({ isAdmin: true });
          if (!admin) {
            const user = new User({
              first_name: 'Website',
              last_name: 'Admin',
              email: config.adminEmail,
              password: config.adminPassword,
              isAdmin: true,
            });
            await user.save();
            console.log('Admin user created');
          }
        }
      } catch (e) {
        console.error('Admin init error:', e.message);
      }
    });

    return true;
  } catch (error) {
    cachedConnection = null; // Reset so next request can retry
    console.error('MongoDB connection error:', error.message);
    return false;
  }
}

export default connectDB;