import mongoose, { type Connection } from "mongoose";

declare global {
  var __bsFincorpMongoose: { conn: Connection | null; promise: Promise<Connection> | null } | undefined;
}

const MONGODB_URI = process.env.MONGODB_URI;

export function requireDbUrl(): string {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB connection string."
    );
  }
  return MONGODB_URI;
}

const CONNECTION_OPTIONS = {
  bufferCommands: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10_000,
  connectTimeoutMS: 10_000,
};

export async function dbConnect(): Promise<Connection> {
  const url = requireDbUrl();
  if (globalThis.__bsFincorpMongoose?.conn) {
    return globalThis.__bsFincorpMongoose.conn;
  }

  const state = mongoose.connection.readyState;
  if (state === 1 || state === 2) {
    const conn = mongoose.connection;
    globalThis.__bsFincorpMongoose = { conn, promise: Promise.resolve(conn) };
    return conn;
  }

  if (!globalThis.__bsFincorpMongoose?.promise) {
    const connectionPromise = mongoose.connect(url, CONNECTION_OPTIONS).then((m) => m.connection);
    // Reset the cached promise on failure so a later request can retry instead
    // of awaiting a rejected promise for the rest of the process lifetime.
    connectionPromise.catch(() => {
      globalThis.__bsFincorpMongoose = undefined;
    });
    globalThis.__bsFincorpMongoose = { conn: null, promise: connectionPromise };
  }

  const pending = globalThis.__bsFincorpMongoose.promise;
  if (!pending) throw new Error("DB connection promise was not initialized.");
  const conn = await pending;
  globalThis.__bsFincorpMongoose.conn = conn;
  return conn;
}