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
    .connect(uri, {
      // A serverless instance serves one request at a time, so a handful of
      // sockets is plenty. Every idle socket still counts against the Atlas
      // M0 connection cap, and each warm instance holds its own pool.
      maxPoolSize: 5,
      minPoolSize: 0,
      // Hobby functions are killed at 10s, so don't spend most of that
      // budget waiting on an unreachable replica set — fail fast and let the
      // caller see a real error instead of a timeout.
      serverSelectionTimeoutMS: 5000,
      // Drop sockets that have been idle long enough that the instance is
      // probably about to be frozen anyway.
      maxIdleTimeMS: 60_000,
      // By default Mongoose issues a createIndexes for every model on every
      // new connection — a handful of extra round trips on each cold start,
      // to no purpose once the indexes exist. Run `npm run sync-indexes`
      // after changing a schema's indexes instead.
      autoIndex: process.env.NODE_ENV !== "production",
    })
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
