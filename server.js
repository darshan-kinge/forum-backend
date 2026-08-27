import dotenv from 'dotenv';
import mongoose from 'mongoose';
import app from './index.js';
import connectDB from './utils/db.js';
import config from './config/config.js';

dotenv.config();

const port = config.port || 5000;

// ─── Request timeout middleware (30s) ───────────────────────────────────────
// Prevents slow/hanging requests from making the server appear unresponsive
app.use((req, res, next) => {
	const timeout = setTimeout(() => {
		if (!res.headersSent) {
			console.error(`Request timeout: ${req.method} ${req.url}`);
			res.status(503).json({ error: 'Request timed out. Please try again.' });
		}
	}, 30000);
	res.on('finish', () => clearTimeout(timeout));
	res.on('close', () => clearTimeout(timeout));
	next();
});

async function startServer() {
	try {
		console.log('Starting server...');
		await connectDB();
		console.log('Database connected, starting HTTP server...');
		app.listen(port, () => {
			console.log(`Server is running on port ${port}`);
			console.log('Server initialization complete');
		});
	} catch (error) {
		console.error('Failed to start server:', error);
		process.exit(1);
	}
}

// ─── MongoDB auto-reconnect ──────────────────────────────────────────────────
mongoose.connection.on('disconnected', () => {
	console.warn('MongoDB disconnected! Attempting to reconnect...');
	setTimeout(async () => {
		try {
			await connectDB();
			console.log('MongoDB reconnected successfully');
		} catch (err) {
			console.error('MongoDB reconnection failed:', err.message);
		}
	}, 5000); // wait 5s before retrying
});

mongoose.connection.on('error', (err) => {
	console.error('MongoDB connection error:', err.message);
});

// ─── Crash protection ────────────────────────────────────────────────────────
// Prevents the whole server from dying on one unhandled error
process.on('unhandledRejection', (reason, promise) => {
	console.error('Unhandled Promise Rejection:', reason);
	// Don't exit — just log it. PM2 will restart if it becomes truly fatal.
});

process.on('uncaughtException', (error) => {
	console.error('Uncaught Exception:', error);
	// For truly unexpected errors, exit cleanly so PM2 can restart
	if (error.code !== 'ECONNRESET' && error.code !== 'EPIPE') {
		process.exit(1);
	}
});

// ─── Graceful shutdown ───────────────────────────────────────────────────────
const shutdown = async (signal) => {
	console.log(`${signal} received. Shutting down gracefully...`);
	try {
		await mongoose.connection.close();
		console.log('MongoDB connection closed.');
		process.exit(0);
	} catch (e) {
		console.error('Error during shutdown:', e);
		process.exit(1);
	}
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Only start if not running in a serverless environment
if (!process.env.VERCEL) {
	startServer();
}

