require('dotenv').config({ path: __dirname + '/.env' });
const mongoose = require('mongoose');

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error('MONGO_URI not set in environment');
  process.exit(2);
}

console.log('Testing MongoDB connection...');

mongoose.set('strictQuery', false);

mongoose.connect(uri)
  .then(() => {
    console.log('MongoDB connection successful');
    return mongoose.connection.close();
  })
  .then(() => process.exit(0))
  .catch(err => {
    console.error('MongoDB connection failed:', err && err.message ? err.message : err);
    process.exit(1);
  });
