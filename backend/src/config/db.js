import mongoose from "mongoose";

// Cached across invocations of the same warm serverless instance, so we
// don't open a fresh connection (and exhaust Atlas's connection limit) on
// every request. Also safe for local/PM2 use — just resolves immediately
// on subsequent calls.
let connectionPromise = null;

export function connectDB() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (connectionPromise) return connectionPromise;

  const uri = process.env.MONGO_URI;
  if (!uri) throw new Error("MONGO_URI is not set in .env");

  connectionPromise = mongoose
    .connect(uri)
    .then((conn) => {
      console.log(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      return conn;
    })
    .catch((err) => {
      connectionPromise = null; // allow retry on next call instead of caching a failure
      throw err;
    });

  return connectionPromise;
}
