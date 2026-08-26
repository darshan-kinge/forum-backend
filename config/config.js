import dotenv from 'dotenv';
dotenv.config();

const config = {
    port: process.env.PORT,

    jwtSecret: process.env.JWT_SECRET,

    mongoURI: process.env.MONGO_URI,

    cloudName: process.env.CLOUD_NAME,

    apiKey: process.env.API_KEY,

    apiSecret: process.env.API_SECRET,

    apiVersion: 'v1',
    clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
    serverUrl: process.env.SERVER_URL || 'http://localhost:5000',

    resendApiKey: process.env.RESEND_API_KEY,

    adminEmail: process.env.ADMIN_EMAIL,
    adminPassword: process.env.ADMIN_PASSWORD
};
export default config;