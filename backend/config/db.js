/**
 * ============================================
 * DATABASE CONNECTION MODULE
 * ============================================
 *
 * Purpose: Connects our Node.js server to MongoDB
 *
 * How it works:
 * 1. Reads the MongoDB connection string from .env file
 * 2. Attempts to connect using Mongoose (MongoDB ORM)
 * 3. Logs success or failure
 * 4. Handles disconnections gracefully
 *
 * Why Mongoose?
 * - Provides schema validation (ensures data is correct before saving)
 * - Gives us a clean API for database operations (find, save, delete)
 * - Handles connection pooling automatically
 */

const mongoose = require("mongoose");

/**
 * connectDatabase — Establishes connection to MongoDB
 *
 * This function is called once when the server starts.
 * Mongoose will automatically handle reconnections if the
 * database temporarily goes down.
 */
async function connectDatabase() {
  try {
    // Get the connection string from environment variables
    const mongoURI = process.env.MONGODB_URI;

    if (!mongoURI) {
      console.error("❌ MONGODB_URI is not defined in .env file");
      console.error("   Please copy .env.example to .env and set your MongoDB connection string");
      process.exit(1);
    }

    // Connect to MongoDB with recommended settings
    const connection = await mongoose.connect(mongoURI, {
      // These options ensure stable connections
      serverSelectionTimeoutMS: 5000,   // Timeout after 5 seconds if can't connect
      socketTimeoutMS: 45000,           // Close sockets after 45 seconds of inactivity
    });

    console.log(`✅ MongoDB Connected: ${connection.connection.host}`);

    // Handle connection events for debugging
    mongoose.connection.on("error", (error) => {
      console.error("❌ MongoDB connection error:", error.message);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("⚠️  MongoDB disconnected. Attempting to reconnect...");
    });

    mongoose.connection.on("reconnected", () => {
      console.log("✅ MongoDB reconnected successfully");
    });

  } catch (error) {
    console.error("❌ Failed to connect to MongoDB:", error.message);
    console.error("\n📋 Troubleshooting:");
    console.error("   1. Is MongoDB running? (mongod command or MongoDB service)");
    console.error("   2. Is the MONGODB_URI correct in your .env file?");
    console.error("   3. If using MongoDB Atlas, is your IP whitelisted?");
    process.exit(1);
  }
}

module.exports = connectDatabase;
