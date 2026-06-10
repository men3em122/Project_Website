import dns from 'dns';
import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is not defined in environment variables');
  }

  if (uri.includes('<db_password>')) {
    console.error(
      '❌ MongoDB connection failed: MONGODB_URI still contains the <db_password> placeholder.\n' +
      '   Replace it with your real Atlas database password in backend/.env'
    );
    process.exit(1);
  }

  // Windows/system DNS often refuses SRV lookups; fall back to public resolvers.
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 }).catch((error) => {
    console.error('❌ MongoDB connection failed:', error);
    if (error instanceof Error && error.message.includes('authentication failed')) {
      console.error('   Check that MONGODB_URI has the correct username and password.');
    }
    process.exit(1);
  });
  console.log('✅ MongoDB connected successfully');
}

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB disconnected');
});
