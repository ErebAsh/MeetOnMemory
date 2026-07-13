import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("Database connected"),
    );

    const rawUri =
      process.env.NODE_ENV === 'test' && process.env.TEST_MONGODB_URI
        ? process.env.TEST_MONGODB_URI
        : process.env.MONGODB_URI;

    // Strip trailing slash to avoid double-slash database name like //mern_auth
    const dbUri = rawUri.endsWith("/") ? rawUri.slice(0, -1) : rawUri;

    await mongoose.connect(`${dbUri}/mern_auth`);
    const sanitizedUri = dbUri.replace(/(mongodb(?:\+srv)?:\/\/[^:]+:)([^@]+)(@)/, "$1****$3");
    console.log("Mongo URI:", sanitizedUri);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.warn(
      "Server running without database connection. Some features may not work.",
    );
  }
};

export default connectDB;
