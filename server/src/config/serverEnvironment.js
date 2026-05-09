import dotenv from 'dotenv';

dotenv.config();

const defaultMongoUri = 'mongodb://127.0.0.1:27017/realtime_chat_app';

export const serverEnvironment = {
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  apiKey: process.env.API_KEY || '',
  rateLimit: parseInt(process.env.RATE_LIMIT || '120', 10),
  rateWindowMs: parseInt(process.env.RATE_WINDOW_MS || '60000', 10),
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGO_URI || defaultMongoUri,
};

export function validateMongoUri(explicitMongoUri) {
  if (!explicitMongoUri) {
    console.warn('No MONGO_URI provided in environment; falling back to local MongoDB. For production, set MONGO_URI in server/.env');
    return;
  }

  if (explicitMongoUri.includes('<') || explicitMongoUri.includes('>') || explicitMongoUri.includes('PASSWORD')) {
    console.error('MONGO_URI appears to contain a placeholder. Replace <db_password> with your actual password in server/.env before starting.');
    process.exit(1);
  }
}