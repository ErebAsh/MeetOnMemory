import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () =>
      console.log("Database connected"),
    );

    let dbUri = process.env.MONGODB_URI;
    if (dbUri.endsWith("/")) {
      dbUri = dbUri.slice(0, -1);
    }
    await mongoose.connect(`${dbUri}/mern_auth`);
    console.log("Mongo URI:", dbUri);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.warn(
      "Server running without database connection. Some features may not work.",
    );
  }
};

export default connectDB;
