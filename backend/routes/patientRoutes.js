/**
 * ============================================
 * PATIENT ROUTES — API Endpoints for Patient Operations
 * ============================================
 *
 * Purpose: Handles all patient-related API requests
 *
 * Endpoints:
 *   POST /api/patient/analyze   — Submit patient data → AI analysis → Save to DB
 *   GET  /api/patient/history   — Get all patient records (with filters)
 *   GET  /api/patient/:id       — Get a single patient by ID
 *   DELETE /api/patient/:id     — Delete a patient record
 *   GET  /api/patient/stats     — Dashboard statistics
 *
 * Flow for /analyze:
 *   1. Receive patient data from React frontend
 *   2. Validate the input
 *   3. Send data to FastAPI AI service for risk analysis
 *   4. Save patient + AI result to MongoDB
 *   5. Return the result to the frontend
 */

const express = require("express");
const axios = require("axios");
const Patient = require("../models/Patient");
const { validatePatientInput, handleValidationErrors } = require("../middleware/validation");
const { authGuard } = require("../middleware/authMiddleware");

const router = express.Router();

// URL of the Python FastAPI AI service
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || "http://localhost:8000";

// -----------------------------------------------
// POST /api/patient/analyze
// -----------------------------------------------
// Main endpoint: Takes patient data, gets AI risk assessment, saves everything
router.post("/analyze", authGuard, validatePatientInput, handleValidationErrors, async (request, response, next) => {
  try {
    const patientData = request.body;

    console.log(`\n📋 New patient analysis request: ${patientData.name}`);

    // ---- Step 1: Call the AI service for risk assessment ----
    let aiResult;

    try {
      console.log("🧠 Sending data to AI service...");

      const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, {
        age: patientData.age,
        gender: patientData.gender,
        blood_pressure_systolic: patientData.bloodPressure.systolic,
        blood_pressure_diastolic: patientData.bloodPressure.diastolic,
        glucose_level: patientData.glucoseLevel,
        heart_rate: patientData.heartRate,
        symptoms: patientData.symptoms,
        report_text: patientData.reportText || null,
      }, {
        timeout: 30000,  // 30 second timeout (LLM can be slow)
      });

      aiResult = aiResponse.data;
      console.log(`✅ AI Result: ${aiResult.risk} risk (${aiResult.probability})`);

    } catch (aiError) {
      // If AI service is down, provide a fallback response
      console.error("⚠️  AI service unavailable:", aiError.message);
      console.log("📌 Using rule-based fallback assessment...");

      aiResult = generateFallbackAssessment(patientData);
    }

    // ---- Step 2: Create the risk assessment object ----
    const riskAssessment = {
      risk: aiResult.risk,
      probability: aiResult.probability,
      reason: aiResult.reason,
      action: aiResult.action,
      assessedAt: new Date(),
    };

    // ---- Step 3: Save to MongoDB ----
    const patient = new Patient({
      name: patientData.name,
      age: patientData.age,
      gender: patientData.gender,
      bloodPressure: {
        systolic: patientData.bloodPressure.systolic,
        diastolic: patientData.bloodPressure.diastolic,
      },
      glucoseLevel: patientData.glucoseLevel,
      heartRate: patientData.heartRate,
      symptoms: patientData.symptoms,
      riskAssessment: riskAssessment,
      assessmentHistory: [riskAssessment],  // First entry in history
    });

    const savedPatient = await patient.save();
    console.log(`💾 Patient saved to database (ID: ${savedPatient._id})`);

    // ---- Step 4: Send response to frontend ----
    response.status(201).json({
      success: true,
      message: "Patient analyzed and saved successfully",
      data: {
        patient: savedPatient,
        riskAssessment: aiResult,
      },
    });

  } catch (error) {
    next(error);  // Pass to global error handler
  }
});

// -----------------------------------------------
// GET /api/patient/history
// -----------------------------------------------
// Returns all patients, with optional filtering and sorting
router.get("/history", async (request, response, next) => {
  try {
    // Read query parameters for filtering
    const { risk, search, page = 1, limit = 20, sort = "-createdAt" } = request.query;

    // Build the database query
    const query = {};

    // Filter by risk level if provided (e.g., ?risk=High)
    if (risk && ["Low", "Medium", "High"].includes(risk)) {
      query["riskAssessment.risk"] = risk;
    }

    // Search by patient name if provided (e.g., ?search=John)
    if (search) {
      // Escape regex special characters to prevent ReDoS attacks
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.name = { $regex: escapedSearch, $options: "i" };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute the query
    const [patients, totalCount] = await Promise.all([
      Patient.find(query)
        .sort(sort)                  // Sort by newest first (default)
        .skip(skip)                  // Skip records for pagination
        .limit(parseInt(limit))      // Limit results per page
        .lean(),                     // Return plain objects (faster)

      Patient.countDocuments(query), // Total count for pagination info
    ]);

    response.json({
      success: true,
      data: {
        patients,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / parseInt(limit)),
          totalPatients: totalCount,
          hasMore: skip + patients.length < totalCount,
        },
      },
    });

  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------
// GET /api/patient/stats
// -----------------------------------------------
// Returns dashboard statistics (counts by risk level, trends, etc.)
router.get("/stats", async (request, response, next) => {
  try {
    // Run all stat queries in parallel for speed
    const [totalPatients, riskDistribution, recentPatients, weeklyTrend] = await Promise.all([
      // Total count
      Patient.countDocuments(),

      // Count by risk level
      Patient.aggregate([
        { $group: { _id: "$riskAssessment.risk", count: { $sum: 1 } } },
      ]),

      // 5 most recent patients
      Patient.find()
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),

      // Daily patient count for the last 7 days
      Patient.aggregate([
        {
          $match: {
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    // Format risk distribution into a clean object
    const riskCounts = { Low: 0, Medium: 0, High: 0 };
    riskDistribution.forEach((item) => {
      if (item._id) riskCounts[item._id] = item.count;
    });

    response.json({
      success: true,
      data: {
        totalPatients,
        riskDistribution: riskCounts,
        highRiskCount: riskCounts.High,
        recentPatients,
        weeklyTrend,
      },
    });

  } catch (error) {
    next(error);
  }
});

// -----------------------------------------------
// GET /api/patient/:id
// -----------------------------------------------
// Returns a single patient by their MongoDB ID
router.get("/:id", async (request, response, next) => {
  try {
    const patient = await Patient.findById(request.params.id).lean();

    if (!patient) {
      const error = new Error("Patient not found");
      error.statusCode = 404;
      throw error;
    }

    response.json({
      success: true,
      data: patient,
    });

  } catch (error) {
    // Handle invalid MongoDB ObjectId format
    if (error.name === "CastError") {
      error.message = "Invalid patient ID format";
      error.statusCode = 400;
    }
    next(error);
  }
});

// -----------------------------------------------
// DELETE /api/patient/:id
// -----------------------------------------------
// Removes a patient record from the database
router.delete("/:id", authGuard, async (request, response, next) => {
  try {
    const patient = await Patient.findByIdAndDelete(request.params.id);

    if (!patient) {
      const error = new Error("Patient not found");
      error.statusCode = 404;
      throw error;
    }

    console.log(`🗑️  Patient deleted: ${patient.name} (${patient._id})`);

    response.json({
      success: true,
      message: `Patient '${patient.name}' deleted successfully`,
    });

  } catch (error) {
    if (error.name === "CastError") {
      error.message = "Invalid patient ID format";
      error.statusCode = 400;
    }
    next(error);
  }
});

// -----------------------------------------------
// PUT /api/patient/:id — Feature 9: Edit Patient
// -----------------------------------------------
// Updates patient personal info and vitals
router.put("/:id", authGuard, async (request, response, next) => {
  try {
    const updates = request.body;

    // Only allow updating specific fields (whitelist approach)
    const allowedFields = ["name", "age", "gender", "bloodPressure", "glucoseLevel", "heartRate", "symptoms"];
    const sanitizedUpdates = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        sanitizedUpdates[field] = updates[field];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      const error = new Error("No valid fields to update");
      error.statusCode = 400;
      throw error;
    }

    const patient = await Patient.findByIdAndUpdate(
      request.params.id,
      { $set: sanitizedUpdates },
      { new: true, runValidators: true }
    );

    if (!patient) {
      const error = new Error("Patient not found");
      error.statusCode = 404;
      throw error;
    }

    console.log(`✏️  Patient updated: ${patient.name} (${patient._id})`);

    response.json({
      success: true,
      message: `Patient '${patient.name}' updated successfully`,
      data: patient,
    });

  } catch (error) {
    if (error.name === "CastError") {
      error.message = "Invalid patient ID format";
      error.statusCode = 400;
    }
    if (error.name === "ValidationError") {
      error.statusCode = 400;
    }
    next(error);
  }
});

// -----------------------------------------------
// POST /api/patient/:id/reanalyze
// -----------------------------------------------
// Re-run AI analysis on an existing patient and add to assessment history
router.post("/:id/reanalyze", async (request, response, next) => {
  try {
    const patient = await Patient.findById(request.params.id);

    if (!patient) {
      const error = new Error("Patient not found");
      error.statusCode = 404;
      throw error;
    }

    // Call AI service with existing patient data
    let aiResult;
    try {
      const aiResponse = await axios.post(`${AI_SERVICE_URL}/analyze`, {
        age: patient.age,
        gender: patient.gender,
        blood_pressure_systolic: patient.bloodPressure.systolic,
        blood_pressure_diastolic: patient.bloodPressure.diastolic,
        glucose_level: patient.glucoseLevel,
        heart_rate: patient.heartRate,
        symptoms: patient.symptoms,
        report_text: patient.reportText || null,
      }, { timeout: 30000 });
      aiResult = aiResponse.data;
    } catch (aiError) {
      aiResult = generateFallbackAssessment(patient);
    }

    const newAssessment = {
      risk: aiResult.risk,
      probability: aiResult.probability,
      reason: aiResult.reason,
      action: aiResult.action,
      assessedAt: new Date(),
    };

    // Update current assessment and push to history
    patient.riskAssessment = newAssessment;
    patient.assessmentHistory.push(newAssessment);
    await patient.save();

    response.json({
      success: true,
      message: "Patient re-analyzed successfully",
      data: { patient, riskAssessment: aiResult },
    });
  } catch (error) {
    if (error.name === "CastError") {
      error.message = "Invalid patient ID format";
      error.statusCode = 400;
    }
    next(error);
  }
});

// -----------------------------------------------
// HELPER: Fallback risk assessment (no AI service)
// -----------------------------------------------
// If the Python AI service is down, we use simple rules
// to still provide a basic risk assessment.
function generateFallbackAssessment(data) {
  let riskScore = 0;
  const reasons = [];

  // Check blood pressure
  const bpSys = data.bloodPressure?.systolic || data.blood_pressure_systolic;
  const bpDia = data.bloodPressure?.diastolic || data.blood_pressure_diastolic;
  const glucose = data.glucoseLevel || data.glucose_level;
  const hr = data.heartRate || data.heart_rate;

  if (bpSys > 180 || bpDia > 120) {
    riskScore += 3;
    reasons.push(`Blood pressure reading of ${bpSys}/${bpDia} mmHg indicates a hypertensive crisis requiring immediate attention`);
  } else if (bpSys > 140 || bpDia > 90) {
    riskScore += 2;
    reasons.push(`Elevated blood pressure at ${bpSys}/${bpDia} mmHg exceeds the normal range of 120/80 mmHg`);
  } else {
    reasons.push(`Blood pressure at ${bpSys}/${bpDia} mmHg is within acceptable limits`);
  }

  // Check glucose
  if (glucose > 200) {
    riskScore += 3;
    reasons.push(`Blood glucose of ${glucose} mg/dL is critically elevated, suggesting poorly controlled diabetes or diabetic emergency`);
  } else if (glucose > 140) {
    riskScore += 2;
    reasons.push(`Blood glucose of ${glucose} mg/dL is above normal (70-100 mg/dL), indicating possible glucose intolerance`);
  }

  // Check heart rate
  if (hr > 120) {
    riskScore += 2;
    reasons.push(`Tachycardia detected with heart rate of ${hr} bpm (normal: 60-100 bpm)`);
  } else if (hr < 50) {
    riskScore += 2;
    reasons.push(`Bradycardia detected with heart rate of ${hr} bpm (normal: 60-100 bpm)`);
  }

  // Check age factor
  if (data.age > 65) {
    riskScore += 1;
    reasons.push(`Patient age of ${data.age} years is a significant cardiovascular risk factor`);
  }

  // Check symptoms
  const symptoms = (data.symptoms || "").toLowerCase();
  if (symptoms.includes("chest pain") || symptoms.includes("shortness of breath")) {
    riskScore += 2;
    reasons.push("Reported symptoms of chest pain and/or dyspnea warrant urgent cardiac evaluation");
  }

  // Determine risk level based on total score
  let risk, probability;
  if (riskScore >= 5) {
    risk = "High";
    probability = `${Math.min(70 + riskScore * 3, 95)}%`;
  } else if (riskScore >= 3) {
    risk = "Medium";
    probability = `${40 + riskScore * 5}%`;
  } else {
    risk = "Low";
    probability = `${10 + riskScore * 8}%`;
  }

  return {
    risk,
    probability,
    reason: reasons.length > 0
      ? `Based on clinical analysis: ${reasons.join(". ")}.`
      : "All vital signs appear within normal physiological ranges. No immediate risk factors identified based on the provided data.",
    action: risk === "High"
      ? "Urgent: Immediate emergency consultation required. Initiate monitoring protocol, perform ECG and cardiac biomarker assessment. Consider hospital admission for observation."
      : risk === "Medium"
        ? "Schedule a follow-up appointment within the next 48-72 hours. Monitor blood pressure and glucose levels daily. Consider additional diagnostic testing."
        : "Continue routine health monitoring. Maintain healthy lifestyle habits. Schedule regular check-up in 3-6 months.",
  };
}

module.exports = router;
