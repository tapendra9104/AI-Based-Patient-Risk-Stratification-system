/**
 * ============================================
 * GLOBAL ERROR HANDLER MIDDLEWARE
 * ============================================
 *
 * Purpose: Catches ALL errors that occur in any route and sends
 *          a clean, consistent error response to the client.
 *
 * How it works:
 * - When any route throws an error or calls next(error),
 *   Express automatically routes to this middleware.
 * - We format the error into a standard JSON response.
 * - In development mode, we include the error stack trace for debugging.
 * - In production mode, we hide internal details for security.
 *
 * Why a global handler?
 * - Without this, Express sends ugly HTML error pages.
 * - This ensures every error response has the same JSON format.
 */

function errorHandler(error, request, response, next) {
  // Log the error for server-side debugging
  console.error("🔴 Error occurred:");
  console.error(`   Path: ${request.method} ${request.path}`);
  console.error(`   Message: ${error.message}`);

  // In development, also log the full stack trace
  if (process.env.NODE_ENV === "development") {
    console.error(`   Stack: ${error.stack}`);
  }

  // Determine the HTTP status code
  // If the error already has a status code, use it. Otherwise, default to 500.
  const statusCode = error.statusCode || 500;

  // Build the error response object
  const errorResponse = {
    success: false,
    message: error.message || "Internal Server Error",

    // Only include the stack trace in development (not in production)
    ...(process.env.NODE_ENV === "development" && { stack: error.stack }),
  };

  // Send the error response
  response.status(statusCode).json(errorResponse);
}

/**
 * notFoundHandler — Handles requests to routes that don't exist
 *
 * Example: If someone visits /api/xyz (which doesn't exist),
 * this sends back a 404 "Route not found" error.
 */
function notFoundHandler(request, response, next) {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

module.exports = { errorHandler, notFoundHandler };
