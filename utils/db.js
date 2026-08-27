import mongoose from 'mongoose';
import config from '../config/config.js';
import User from '../models/user.model.js';

const connectDB = async () => {
  try {

    const uri = config.mongoURI || process.env.MONGO_URI;
    console.log("uri", uri);
    if (!uri) {
      console.error('MongoDB URI is not configured. Please set MONGO_URI environment variable.');
      return false;
    }

    // Check if already connected
    if (mongoose.connection.readyState === 1) {
      console.log('MongoDB already connected');
      return true;
    }

    // Set connection options to handle timeouts and reconnections
    const options = {
      serverSelectionTimeoutMS: 10000, // Give up selecting a server after 10s
      socketTimeoutMS: 45000,          // Close sockets after 45s of inactivity
      heartbeatFrequencyMS: 10000,     // Check server health every 10s
      maxPoolSize: 10,                 // Keep up to 10 connections open
      minPoolSize: 2,                  // Keep at least 2 connections open
      connectTimeoutMS: 10000,         // Connection attempt timeout
    };

    const connection = await mongoose.connect(uri, options);

    console.log('MongoDB connected successfully to', connection.connection.host);

    // Initialize email queue services after database connection
    try {
      const { emailQueueService } = await import('../queues/emailQueue.js');
      const { recruitmentEmailQueueService } = await import('../queues/recruitmentEmailQueue.js');
      console.log('Email queue services initialized');
    } catch (queueError) {
      console.error('Error initializing email queue services:', queueError);
    }

    // Only create admin user if not in production or if explicitly needed
    if (process.env.NODE_ENV !== 'development') {
      const admin = await User.findOne({ isAdmin: true });

      if (admin) {
        console.log('Admin user already exists');
      } else {
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
    
    return true;
  } catch (error) {
    console.error('Error connecting mongodb', error);
    return false;
  }
}

export default connectDB;