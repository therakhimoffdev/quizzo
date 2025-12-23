// lib/db.js
import mongoose from "mongoose";

let cached = global.mongoose; // serverless caching

if (!cached) cached = global.mongoose = { conn: null, promise: null };

async function connectDB() {
    if (cached.conn) return cached.conn;

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 30000, // 30s timeout
        };

        cached.promise = mongoose.connect(process.env.MONGODB_URI, opts).then(mongoose => mongoose);
    }

    try {
        cached.conn = await cached.promise;
    } catch (error) {
        cached.promise = null;
        throw error;
    }

    return cached.conn;
}

export default connectDB;
