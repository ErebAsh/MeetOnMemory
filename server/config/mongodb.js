import mongoose from "mongoose";

const connectDB = async () => {
  mongoose.connection.on("connected", () => console.log("Database connected"));

  await mongoose.connect(`${process.env.MONGODB_URI}/mern_auth`);
  console.log("Mongo URI:", process.env.MONGODB_URI);
};

export default connectDB;
