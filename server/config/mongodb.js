import mongoose from "mongoose";

const connectDB = async () => {
  try {
    mongoose.connection.on("connected", () => console.log("Database connected"));

    await mongoose.connect(`${process.env.MONGODB_URI}/mern_auth`);
    console.log("Mongo URI:", process.env.MONGODB_URI);
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.warn("⚠️  Server running without database connection. Some features may not work.");
  }
};

export default connectDB;
