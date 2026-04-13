/**
 * ============================================
 * FILE UPLOAD ROUTES — Handle PDF Report Uploads
 * ============================================
 *
 * Purpose: Allows doctors to upload patient PDF reports
 *
 * Flow:
 *   1. Doctor uploads a PDF file through the frontend
 *   2. Multer saves the file temporarily
 *   3. pdf-parse extracts the text content from the PDF
 *   4. The extracted text is returned (can be used as additional
 *      context for the AI risk analysis)
 *
 * Why upload PDFs?
 * - Patients often bring lab reports, discharge summaries, etc.
 * - The AI can use this text as additional context for better analysis
 */

const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const pdfParse = require("pdf-parse");

const router = express.Router();

// -----------------------------------------------
// MULTER CONFIGURATION — How files are stored
// -----------------------------------------------
const storage = multer.diskStorage({
  // Where to save uploaded files
  destination: function (request, file, callback) {
    const uploadDir = path.join(__dirname, "..", "uploads");

    // Create the uploads folder if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    callback(null, uploadDir);
  },

  // How to name the saved file
  filename: function (request, file, callback) {
    // Create unique filename: timestamp-originalname.pdf
    const uniqueName = `${Date.now()}-${file.originalname}`;
    callback(null, uniqueName);
  },
});

// File filter: only allow PDF files
const fileFilter = function (request, file, callback) {
  if (file.mimetype === "application/pdf") {
    callback(null, true);   // Accept the file
  } else {
    callback(new Error("Only PDF files are allowed"), false);
  }
};

// Create multer upload instance with our settings
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,  // Max file size: 10 MB
  },
});

// -----------------------------------------------
// POST /api/upload
// -----------------------------------------------
// Upload a PDF file and extract its text content
router.post("/", upload.single("report"), async (request, response, next) => {
  try {
    // Check if a file was actually uploaded
    if (!request.file) {
      const error = new Error("No file uploaded. Please select a PDF file.");
      error.statusCode = 400;
      throw error;
    }

    // FLAW-4 Fix: Validate PDF magic bytes (%PDF-) to prevent spoofed MIME types
    // The first 5 bytes of any real PDF file are always "%PDF-"
    const fileBuffer = fs.readFileSync(request.file.path);
    const magicBytes = fileBuffer.slice(0, 5).toString("ascii");
    if (magicBytes !== "%PDF-") {
      // Clean up the invalid file
      try { fs.unlinkSync(request.file.path); } catch (_) {}
      const error = new Error("Invalid file: not a real PDF. The file content does not match PDF format.");
      error.statusCode = 400;
      throw error;
    }

    console.log(`📄 PDF uploaded: ${request.file.originalname} (${(request.file.size / 1024).toFixed(1)} KB)`);

    // Extract text from the PDF
    let extractedText = "";
    try {
      // pdf-parse reads the PDF buffer and extracts all text
      const pdfBuffer = fs.readFileSync(request.file.path);
      const pdfData = await pdfParse(pdfBuffer);

      extractedText = pdfData.text;
      console.log(`📝 Extracted ${extractedText.length} characters from PDF`);

    } catch (parseError) {
      console.error("⚠️  Could not extract PDF text:", parseError.message);
      extractedText = "[Could not extract text from this PDF]";
    }

    // Clean up: delete the uploaded file after extraction
    // (we only need the text, not the file itself)
    try {
      fs.unlinkSync(request.file.path);
    } catch (cleanupError) {
      console.warn("⚠️  Could not clean up uploaded file:", cleanupError.message);
    }

    // Return the extracted text
    response.json({
      success: true,
      message: "PDF processed successfully",
      data: {
        filename: request.file.originalname,
        size: request.file.size,
        extractedText: extractedText.substring(0, 5000),  // Limit to 5000 chars
        characterCount: extractedText.length,
      },
    });

  } catch (error) {
    // Handle multer-specific errors
    if (error.code === "LIMIT_FILE_SIZE") {
      error.message = "File is too large. Maximum size is 10 MB.";
      error.statusCode = 400;
    }
    next(error);
  }
});

module.exports = router;
