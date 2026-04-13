/**
 * ============================================
 * INPUT VALIDATION MIDDLEWARE
 * ============================================
 *
 * Purpose: Validates patient data BEFORE it reaches our routes.
 *
 * Why validate inputs?
 * 1. Security — Prevents injection attacks and malformed data
 * 2. Data integrity — Ensures MongoDB only gets clean, valid data
 * 3. Better UX — Tells users exactly what's wrong with their input
 *
 * How it works:
 * - Uses express-validator library to define validation rules
 * - Each rule checks one field (e.g., "age must be between 0 and 150")
 * - If validation fails, sends a 400 error with details
 * - If validation passes, the request continues to the route handler
 */

const { body, validationResult } = require("express-validator");

/**
 * validatePatientInput — Rules for patient data validation
 *
 * This is an array of validation rules. Express runs them in order.
 * Each rule checks one field from the request body.
 */
const validatePatientInput = [
  // Name: must be a non-empty string
  body("name")
    .trim()
    .notEmpty()
    .withMessage("Patient name is required")
    .isLength({ max: 100 })
    .withMessage("Name cannot exceed 100 characters"),

  // Age: must be a number between 0 and 150
  body("age")
    .isInt({ min: 0, max: 150 })
    .withMessage("Age must be a number between 0 and 150"),

  // Gender: must be one of the allowed values
  body("gender")
    .isIn(["Male", "Female", "Other"])
    .withMessage("Gender must be Male, Female, or Other"),

  // Blood Pressure — Systolic (top number): 60-300 mmHg
  body("bloodPressure.systolic")
    .isInt({ min: 60, max: 300 })
    .withMessage("Systolic BP must be between 60 and 300 mmHg"),

  // Blood Pressure — Diastolic (bottom number): 30-200 mmHg
  body("bloodPressure.diastolic")
    .isInt({ min: 30, max: 200 })
    .withMessage("Diastolic BP must be between 30 and 200 mmHg"),

  // Glucose Level: 20-700 mg/dL
  body("glucoseLevel")
    .isFloat({ min: 20, max: 700 })
    .withMessage("Glucose level must be between 20 and 700 mg/dL"),

  // Heart Rate: 30-250 bpm
  body("heartRate")
    .isInt({ min: 30, max: 250 })
    .withMessage("Heart rate must be between 30 and 250 bpm"),

  // Symptoms: must be a non-empty string
  body("symptoms")
    .trim()
    .notEmpty()
    .withMessage("Symptoms description is required")
    .isLength({ max: 2000 })
    .withMessage("Symptoms text cannot exceed 2000 characters"),
];

/**
 * handleValidationErrors — Checks if any validation rule failed
 *
 * This middleware runs AFTER all the validation rules above.
 * If any rule failed, it collects all the error messages
 * and sends them back as a clear 400 response.
 */
function handleValidationErrors(request, response, next) {
  const errors = validationResult(request);

  if (!errors.isEmpty()) {
    // Extract just the error messages into a clean array
    const errorMessages = errors.array().map((error) => ({
      field: error.path,
      message: error.msg,
    }));

    return response.status(400).json({
      success: false,
      message: "Validation failed. Please check your input.",
      errors: errorMessages,
    });
  }

  // All validations passed — continue to the route handler
  next();
}

module.exports = { validatePatientInput, handleValidationErrors };
