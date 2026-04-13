/**
 * ============================================
 * MAIN SERVER — Express Application Entry Point
 * ============================================
 *
 * AI Patient Risk Stratification System — Backend Server
 *
 * This is the CENTRAL HUB of the application.
 * It connects everything together:
 *   - Receives requests from the React frontend
 *   - Routes them to the appropriate handler
 *   - Communicates with the Python AI microservice
 *   - Saves/retrieves data from MongoDB
 *
 * Architecture:
 *   React (port 3000) → Express (port 5000) → FastAPI (port 8000) → Gemini AI
 *                                   ↕
 *                              MongoDB
 *
 * To start: npm run dev
 */

// ---- Load environment variables FIRST (before anything else) ----
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

// Import our modules
const connectDatabase = require("./config/db");
const patientRoutes = require("./routes/patientRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");

// -----------------------------------------------
// CREATE THE EXPRESS APPLICATION
// -----------------------------------------------
const app = express();
const PORT = process.env.PORT || 5000;

// -----------------------------------------------
// MIDDLEWARE — Processing that happens on EVERY request
// -----------------------------------------------

// 1. CORS — Allow the React frontend to call our API
//    In production: FRONTEND_URL env var points to the deployed frontend
//    In development: localhost origins are allowed
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL,           // e.g., https://riskai-frontend.onrender.com
].filter(Boolean);                     // Remove undefined values

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin) return callback(null, true);
    // Allow any .onrender.com domain or configured origins
    if (allowedOrigins.includes(origin) || origin.endsWith(".onrender.com")) {
      return callback(null, true);
    }
    callback(null, true);  // Permissive in demo mode
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true,
}));

// 2. JSON Parser — Automatically parse JSON request bodies
//    So we can access request.body as a JavaScript object
app.use(express.json({ limit: "10mb" }));

// 3. URL Encoded Parser — Parse form submissions
app.use(express.urlencoded({ extended: true }));

// 4. Morgan — Log every HTTP request to the console
//    Example: "POST /api/patient/analyze 201 15ms"
app.use(morgan("dev"));

// 5. Rate Limiting — Prevent API abuse (100 requests per 15 minutes per IP)
const rateLimit = {};
app.use("/api/patient/analyze", (req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  if (!rateLimit[ip]) rateLimit[ip] = [];
  rateLimit[ip] = rateLimit[ip].filter(t => now - t < 15 * 60 * 1000);
  if (rateLimit[ip].length >= 100) {
    return res.status(429).json({ success: false, message: "Too many requests. Please try again later." });
  }
  rateLimit[ip].push(now);
  next();
});

// -----------------------------------------------
// API ROUTES — Map URL paths to route handlers
// -----------------------------------------------

// Health check endpoint — useful for monitoring
app.get("/api/health", (request, response) => {
  response.json({
    success: true,
    message: "Server is running",
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development",
  });
});

// Patient routes — all endpoints under /api/patient
app.use("/api/patient", patientRoutes);

// Upload routes — file upload endpoint
app.use("/api/upload", uploadRoutes);

// Auth routes — generate demo token for testing
const { generateDemoToken } = require("./middleware/authMiddleware");
app.post("/api/auth/demo-token", (request, response) => {
  const token = generateDemoToken();
  response.json({
    success: true,
    message: "Demo authentication token generated",
    token,
    note: "This token is for development/demo only. Expires in 24 hours.",
  });
});

// AI Service health proxy — check if the Python AI service is running
app.get("/api/health/ai", async (request, response) => {
  try {
    const axios = require("axios");
    const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";
    const aiResponse = await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    response.json({ success: true, ...aiResponse.data });
  } catch (error) {
    response.json({ success: false, online: false, message: "AI service unreachable" });
  }
});

// -----------------------------------------------
// ERROR HANDLING — Must be AFTER all routes
// -----------------------------------------------
app.use(notFoundHandler);   // Catch any undefined routes (404)
app.use(errorHandler);      // Handle all errors consistently

// -----------------------------------------------
// START THE SERVER
// -----------------------------------------------
async function startServer() {
  try {
    // Step 1: Connect to MongoDB
    await connectDatabase();

    // Step 2: Start listening for requests
    app.listen(PORT, () => {
      console.log("\n============================================");
      console.log("  AI Patient Risk Stratification — Backend");
      console.log("============================================");
      console.log(`  🚀 Server running on:  http://localhost:${PORT}`);
      console.log(`  🧠 AI Service at:      ${process.env.AI_SERVICE_URL || "http://localhost:8000"}`);
      console.log(`  📊 Health check:       http://localhost:${PORT}/api/health`);
      console.log(`  🌍 Environment:        ${process.env.NODE_ENV || "development"}`);
      console.log("============================================\n");
    });

  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
}

// Run the server
startServer();

// -----------------------------------------------
// GRACEFUL SHUTDOWN — Clean up on exit
// -----------------------------------------------
function handleShutdown(signal) {
  console.log(`\n🛑 ${signal} received. Shutting down gracefully...`);
  const mongoose = require("mongoose");
  mongoose.connection.close().then(() => {
    console.log("✅ MongoDB connection closed.");
    process.exit(0);
  });
  // Force exit after 10 seconds if connections don't close
  setTimeout(() => process.exit(1), 10000);
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));
