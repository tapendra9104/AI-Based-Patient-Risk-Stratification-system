/**
 * ============================================
 * AUTH MIDDLEWARE — JWT Authentication (FLAW-2 Fix)
 * ============================================
 *
 * Purpose: Protects API endpoints with JWT token verification.
 *
 * How it works:
 * 1. Checks for Authorization header with Bearer token
 * 2. Verifies the token using the JWT_SECRET
 * 3. If valid, allows the request through
 * 4. If invalid/missing, returns 401 Unauthorized
 *
 * Demo Mode:
 * - When AUTH_ENABLED=false (default), all requests pass through
 * - This allows easy development and presentation without login
 * - In production, set AUTH_ENABLED=true and configure JWT_SECRET
 *
 * Usage:
 *   const { authGuard } = require("./middleware/authMiddleware");
 *   router.post("/analyze", authGuard, handler);
 */

const jwt = require("jsonwebtoken");

// Secret key for signing/verifying tokens
const JWT_SECRET = process.env.JWT_SECRET || "riskai-demo-secret-key-2026";

// Check if auth is enabled (disabled by default for demo)
const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

/**
 * authGuard — Middleware to protect routes
 *
 * If AUTH_ENABLED is false (default), all requests pass through.
 * If AUTH_ENABLED is true, requires a valid Bearer token.
 */
function authGuard(request, response, next) {
  // Skip auth in demo mode
  if (!AUTH_ENABLED) {
    return next();
  }

  try {
    // Get the Authorization header
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return response.status(401).json({
        success: false,
        message: "Authentication required. Provide a Bearer token.",
      });
    }

    // Extract the token (remove "Bearer " prefix)
    const token = authHeader.split(" ")[1];

    // Verify the token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Attach user info to request for downstream use
    request.user = decoded;
    next();

  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return response.status(401).json({
        success: false,
        message: "Token expired. Please log in again.",
      });
    }

    return response.status(401).json({
      success: false,
      message: "Invalid authentication token.",
    });
  }
}

/**
 * generateDemoToken — Creates a demo JWT token for testing
 *
 * This is NOT for production use. It creates a token that
 * can be used to test the auth system during development.
 *
 * @returns {string} A signed JWT token
 */
function generateDemoToken() {
  return jwt.sign(
    {
      userId: "demo-doctor-001",
      name: "Dr. Demo User",
      role: "doctor",
    },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
}

module.exports = { authGuard, generateDemoToken, JWT_SECRET };
