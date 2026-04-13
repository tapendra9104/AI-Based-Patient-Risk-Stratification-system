/**
 * ============================================
 * API SERVICE — Axios HTTP Client
 * ============================================
 *
 * Purpose: Centralizes ALL API calls in one place.
 *
 * Why a separate API service?
 * 1. Single source of truth — if the API URL changes, we change it here only
 * 2. Consistent error handling — all API errors are handled the same way
 * 3. Easy to debug — all API calls go through this file
 * 4. Reusable — any component can import and use these functions
 */

import axios from "axios";

// -----------------------------------------------
// CREATE AXIOS INSTANCE
// -----------------------------------------------
// In development: Vite proxy forwards /api → localhost:5000
// In production: VITE_API_URL points to the deployed backend
const API_BASE = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : "/api";

const api = axios.create({
  baseURL: API_BASE,
  timeout: 60000,          // 60 second timeout (cold starts on free tier can be slow)
  headers: {
    "Content-Type": "application/json",
  },
});

// -----------------------------------------------
// RESPONSE INTERCEPTOR — Handle errors globally
// -----------------------------------------------
api.interceptors.response.use(
  // Success handler — just return the data
  (response) => response,

  // Error handler — format error messages
  (error) => {
    let message = "Something went wrong. Please try again.";

    if (error.response) {
      // The server responded with an error status
      const data = error.response.data;
      message = data?.message || data?.detail || `Server error (${error.response.status})`;
    } else if (error.request) {
      // The request was made but no response received
      message = "Cannot connect to server. Make sure the backend is running.";
    }

    console.error("🔴 API Error:", message);
    return Promise.reject(new Error(message));
  }
);

// -----------------------------------------------
// PATIENT API FUNCTIONS
// -----------------------------------------------

/**
 * analyzePatient — Submit patient data for AI risk analysis
 *
 * This is the main function. It sends patient data to the backend,
 * which forwards it to the AI service, then returns the result.
 *
 * @param {Object} patientData - Patient form data
 * @returns {Object} - { patient, riskAssessment }
 */
export async function analyzePatient(patientData) {
  const response = await api.post("/patient/analyze", patientData);
  return response.data;
}

/**
 * getPatientHistory — Fetch all patient records with optional filters
 *
 * @param {Object} params - Query parameters
 * @param {string} params.risk - Filter by risk level (Low/Medium/High)
 * @param {string} params.search - Search by patient name
 * @param {number} params.page - Page number for pagination
 * @returns {Object} - { patients, pagination }
 */
export async function getPatientHistory(params = {}) {
  const response = await api.get("/patient/history", { params });
  return response.data;
}

/**
 * getPatientById — Fetch a single patient's full record
 *
 * @param {string} patientId - MongoDB ObjectId
 * @returns {Object} - Full patient data with risk assessment
 */
export async function getPatientById(patientId) {
  const response = await api.get(`/patient/${patientId}`);
  return response.data;
}

/**
 * deletePatient — Remove a patient record
 *
 * @param {string} patientId - MongoDB ObjectId
 * @returns {Object} - Success confirmation
 */
export async function deletePatient(patientId) {
  const response = await api.delete(`/patient/${patientId}`);
  return response.data;
}

/**
 * reanalyzePatient — Re-run AI analysis on an existing patient
 *
 * @param {string} patientId - MongoDB ObjectId
 * @returns {Object} - Updated patient with new risk assessment
 */
export async function reanalyzePatient(patientId) {
  const response = await api.post(`/patient/${patientId}/reanalyze`);
  return response.data;
}

/**
 * getDashboardStats — Fetch dashboard statistics
 *
 * Returns: total patients, risk distribution, recent patients, trends
 *
 * @returns {Object} - Dashboard statistics
 */
export async function getDashboardStats() {
  const response = await api.get("/patient/stats");
  return response.data;
}

/**
 * uploadReport — Upload a PDF report for text extraction
 *
 * @param {File} file - The PDF file to upload
 * @returns {Object} - { filename, extractedText, characterCount }
 */
export async function uploadReport(file) {
  const formData = new FormData();
  formData.append("report", file);

  const response = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 60000,  // 60 sec timeout for file uploads
  });
  return response.data;
}

/**
 * updatePatient — Update patient data (Feature 9)
 *
 * @param {string} patientId - MongoDB ObjectId
 * @param {Object} updates - Fields to update
 * @returns {Object} - Updated patient data
 */
export async function updatePatient(patientId, updates) {
  const response = await api.put(`/patient/${patientId}`, updates);
  return response.data;
}

export default api;

/**
 * checkBackendHealth — Check if the backend server is running
 * @returns {Object} - { success, message, timestamp }
 */
export async function checkBackendHealth() {
  try {
    const response = await api.get("/health", { timeout: 5000 });
    return { online: true, ...response.data };
  } catch {
    return { online: false };
  }
}

/**
 * checkAIHealth — Check if the AI service is running
 * @returns {Object} - AI service health status
 */
export async function checkAIHealth() {
  try {
    const response = await api.get("/health/ai", { timeout: 5000 });
    return { online: true, ...response.data };
  } catch {
    return { online: false };
  }
}
