import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

const mongoServer = await MongoMemoryServer.create();
const uri = mongoServer.getUri();

// Set the URI for the app to use BEFORE any other imports run
process.env.TEST_MONGODB_URI = uri.replace(/\/$/, ""); 
process.env.NODE_ENV = 'test';

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    const collection = collections[key];
    await collection.deleteMany({});
  }
});
