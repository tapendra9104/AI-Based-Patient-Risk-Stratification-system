/**
 * ============================================
 * PATIENT MODEL — MongoDB Schema Definition
 * ============================================
 *
 * Purpose: Defines the structure of a Patient record in MongoDB
 *
 * What this file does:
 * 1. Defines what fields a patient record has (name, age, vitals, etc.)
 * 2. Validates data before saving (e.g., age must be a number)
 * 3. Stores the AI risk assessment result alongside patient data
 * 4. Provides methods to query patients from the database
 *
 * Think of this as a "blueprint" for patient records.
 * Every patient saved to the database must follow this structure.
 */

const mongoose = require("mongoose");

// -----------------------------------------------
// SUB-SCHEMA: Risk Assessment Result
// -----------------------------------------------
// This is embedded inside each patient document.
// It stores what the AI predicted about this patient.
const riskAssessmentSchema = new mongoose.Schema({
  risk: {
    type: String,
    enum: ["Low", "Medium", "High"],    // Only these 3 values allowed
    required: true,
  },
  probability: {
    type: String,                        // e.g., "85%"
    required: true,
  },
  reason: {
    type: String,                        // AI's explanation
    required: true,
  },
  action: {
    type: String,                        // Recommended next step
    required: true,
  },
  assessedAt: {
    type: Date,
    default: Date.now,                   // When this assessment was made
  },
});

// -----------------------------------------------
// MAIN SCHEMA: Patient Record
// -----------------------------------------------
const patientSchema = new mongoose.Schema(
  {
    // --- Personal Information ---
    name: {
      type: String,
      required: [true, "Patient name is required"],
      trim: true,                         // Remove extra spaces
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    age: {
      type: Number,
      required: [true, "Age is required"],
      min: [0, "Age cannot be negative"],
      max: [150, "Age cannot exceed 150"],
    },

    gender: {
      type: String,
      required: [true, "Gender is required"],
      enum: ["Male", "Female", "Other"],  // Only valid options
    },

    // --- Vital Signs ---
    bloodPressure: {
      systolic: {
        type: Number,
        required: [true, "Systolic BP is required"],
        min: [60, "Systolic BP too low"],
        max: [300, "Systolic BP too high"],
      },
      diastolic: {
        type: Number,
        required: [true, "Diastolic BP is required"],
        min: [30, "Diastolic BP too low"],
        max: [200, "Diastolic BP too high"],
      },
    },

    glucoseLevel: {
      type: Number,
      required: [true, "Glucose level is required"],
      min: [20, "Glucose level too low"],
      max: [700, "Glucose level too high"],
    },

    heartRate: {
      type: Number,
      required: [true, "Heart rate is required"],
      min: [30, "Heart rate too low"],
      max: [250, "Heart rate too high"],
    },

    // --- Symptoms (free text from patient/doctor) ---
    symptoms: {
      type: String,
      required: [true, "Symptoms description is required"],
      maxlength: [2000, "Symptoms text too long"],
    },

    // --- AI Risk Assessment ---
    // This gets filled in AFTER the AI analyzes the patient data
    riskAssessment: riskAssessmentSchema,

    // --- Assessment History ---
    // Every time the patient is re-assessed, we keep a log
    assessmentHistory: [riskAssessmentSchema],

    // --- Optional: PDF Report Reference ---
    reportFile: {
      type: String,        // File path of uploaded PDF
      default: null,
    },
    reportText: {
      type: String,        // Extracted text from PDF
      default: null,
    },
  },
  {
    // Automatically add createdAt and updatedAt timestamps
    timestamps: true,
  }
);

// -----------------------------------------------
// INDEX: Make searching faster
// -----------------------------------------------
// When a doctor searches patients by risk level, this index
// makes MongoDB find results much faster (like a book's index)
patientSchema.index({ "riskAssessment.risk": 1 });
patientSchema.index({ createdAt: -1 });  // Sort by newest first
patientSchema.index({ name: 1 });        // Speed up name search queries

// -----------------------------------------------
// VIRTUAL: Full blood pressure as string
// -----------------------------------------------
// This creates a computed field "bpReading" that isn't stored
// in the database but is available when we read a patient.
// Example: "120/80"
patientSchema.virtual("bpReading").get(function () {
  return `${this.bloodPressure.systolic}/${this.bloodPressure.diastolic}`;
});

// Make virtuals appear in JSON responses
patientSchema.set("toJSON", { virtuals: true });

// -----------------------------------------------
// EXPORT: Create and export the model
// -----------------------------------------------
// mongoose.model("Patient", patientSchema) tells Mongoose:
// "Create a collection called 'patients' with this schema"
const Patient = mongoose.model("Patient", patientSchema);

module.exports = Patient;
