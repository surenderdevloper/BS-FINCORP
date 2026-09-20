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
    const opts = { bufferCommands: true, maxPoolSize: 10 };
    globalThis.__bsFincorpMongoose = {
      conn: null,
      promise: mongoose.connect(url, opts).then((m) => m.connection),
    };
  }

  const pending = globalThis.__bsFincorpMongoose.promise;
  if (!pending) throw new Error("DB connection promise was not initialized.");
  const conn = await pending;
  globalThis.__bsFincorpMongoose.conn = conn;
  return conn;
}