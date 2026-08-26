import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {v2 as cloudinary} from 'cloudinary';
import mongoose from 'mongoose';

import connectDB from './utils/db.js';

import config from './config/config.js';

import errorHandler from './middlewares/error-middleware.js';

// Import models to register schemas
import './models/user.model.js';
import './models/gallery.model.js';
import './models/blog.model.js';
import './models/event.model.js';
import './models/member.model.js';
import './models/team.model.js';
import './models/badge.model.js';
import './models/emailQueue.model.js';
import './models/recruitment.model.js';
import './models/recruitmentApplication.model.js';
import './models/recruitmentEmailQueue.model.js';
import './models/form.model.js';
import './models/formResponse.model.js';

import authRoute from './routes/auth.routes.js';
import memberRoute from './routes/member.routes.js';
import galleryRoute from './routes/gallery.routes.js';
import blogRoute from './routes/blog.routes.js';
import eventRoute from './routes/event.routes.js';
import teamRoute from './routes/team.routes.js';
import recruitmentRoute from './routes/recruitment.routes.js';
import formRoute from './routes/form.routes.js';
import adminRoute from './routes/admin.routes.js';
dotenv.config();

const app = express();

// CORS configuration - allow multiple origins for production and development
const allowedOrigins = [
  process.env.CLIENT_URL || 'http://localhost:5173',
  'https://snsf.club',
  'https://www.snsf.club',
  'https://snsf.live',
  'https://www.snsf.live',
  'http://localhost:5173',
  'http://localhost:5174'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS: Blocked origin ${origin}`);
      callback(new Error(`CORS policy: origin ${origin} is not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json());

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

app.use('/uploads', express.static('uploads'));

app.get('/api/v1', (req, res) => {
  res.send('Welcome to the SNSF API');
});

app.get('/api/v1/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  // Try to connect if not connected
  if (dbStatus === 'disconnected') {
    try {
      await connectDB();
    } catch (error) {
      console.error('Health check: Database connection failed:', error);
    }
  }
  
  const finalDbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  res.status(200).json({ 
    status: 'OK', 
    message: 'Server is running',
    database: finalDbStatus,
    environment: process.env.NODE_ENV || 'development',
    databaseName: mongoose.connection.db?.databaseName || 'unknown',
    host: mongoose.connection.host || 'unknown',
    mongoUri: config.mongoURI ? 'configured' : 'not configured',
    timestamp: new Date().toISOString()
  });
});

app.use(`/api/${config.apiVersion}/auth`, authRoute); // http://localhost:3000/api/v1/auth
app.use(`/api/${config.apiVersion}/member`, memberRoute); // http://localhost:3000/api/v1/member
app.use(`/api/${config.apiVersion}/gallery`, galleryRoute); // http://localhost:3000/api/v1/gallery
app.use(`/api/${config.apiVersion}/blog`, blogRoute); // http://localhost:3000/api/v1/blog
app.use(`/api/${config.apiVersion}/events`, eventRoute); // http://localhost:3000/api/v1/event
app.use(`/api/${config.apiVersion}/team`, teamRoute); // http://localhost:3000/api/v1/team
app.use(`/api/${config.apiVersion}/recruitment`, recruitmentRoute); // http://localhost:3000/api/v1/recruitment
app.use(`/api/${config.apiVersion}/form`, formRoute); // http://localhost:3000/api/v1/form
app.use(`/api/${config.apiVersion}/admin`, adminRoute); // http://localhost:3000/api/v1/admin

app.use(errorHandler);

// Note: Server startup is handled in server.js for PM2/production
// This file only exports the app for Vercel serverless functions

// Export for Vercel and server.js
export default app;