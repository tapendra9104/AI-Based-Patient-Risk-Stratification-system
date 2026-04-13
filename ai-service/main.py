"""
============================================
FASTAPI MAIN — AI Microservice Entry Point
============================================

AI Patient Risk Stratification — AI Service

This is the Python microservice that handles all AI/ML operations:
  1. Receives patient data from the Node.js backend
  2. Retrieves relevant medical context using RAG (FAISS)
  3. Sends patient data + context to the LLM (Gemini/OpenAI)
  4. Returns structured risk assessment as JSON

Architecture:
  Node.js Backend (port 5000) → This Service (port 8000) → Gemini/OpenAI API
                                        ↕
                                  FAISS (RAG)

To start: uvicorn main:app --reload --port 8000
"""

import os
import logging
from datetime import datetime
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

# Import our modules
from models.schemas import PatientInput, RiskAssessmentOutput, HealthCheckResponse
from services.llm_service import analyze_patient_risk
from services.rag_service import rag_service

# Load environment variables from .env file
load_dotenv()

# -----------------------------------------------
# LOGGING SETUP — So we can see what's happening
# -----------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ai-service")


# -----------------------------------------------
# LIFESPAN — Code that runs on startup and shutdown
# -----------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan manager — runs code when the server starts and stops.

    On startup: Initialize the RAG system (load documents, build FAISS index)
    On shutdown: Clean up resources
    """
    # ---- STARTUP ----
    logger.info("=" * 50)
    logger.info("  AI Patient Risk Stratification — AI Service")
    logger.info("=" * 50)

    # Initialize the RAG system
    logger.info("🚀 Starting up...")
    rag_service.initialize()

    # Check which LLM provider is configured
    llm_provider = os.getenv("LLM_PROVIDER", "gemini")
    logger.info(f"🤖 LLM Provider: {llm_provider}")

    if llm_provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key and api_key != "your_gemini_api_key_here":
            logger.info("✅ Gemini API key configured")
        else:
            logger.warning("⚠️  Gemini API key NOT configured!")
            logger.warning("   Get a free key at: https://aistudio.google.com/apikey")

    logger.info("=" * 50)

    yield  # Server is running

    # ---- SHUTDOWN ----
    logger.info("👋 Shutting down AI service...")


# -----------------------------------------------
# CREATE THE FASTAPI APPLICATION
# -----------------------------------------------
app = FastAPI(
    title="AI Patient Risk Stratification — AI Service",
    description="Analyzes patient health data using Generative AI (LLM) and RAG for risk assessment",
    version="1.0.0",
    lifespan=lifespan,
)

# -----------------------------------------------
# CORS — Allow the Node.js backend to call us
# -----------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # AI service is internal — only called by backend, not browsers
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------------------------
# ENDPOINTS
# -----------------------------------------------

@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """
    Health check endpoint.

    Returns the current status of the AI service,
    including whether RAG is initialized and which LLM is configured.
    Used by the Node.js backend to verify this service is running.
    """
    return HealthCheckResponse(
        status="healthy",
        service="AI Risk Assessment Service",
        timestamp=datetime.now().isoformat(),
        rag_status="ready" if rag_service.is_initialized else "not_initialized",
        llm_provider=os.getenv("LLM_PROVIDER", "gemini"),
    )


@app.post("/analyze", response_model=RiskAssessmentOutput)
async def analyze_patient(patient: PatientInput):
    """
    Main endpoint: Analyze patient data and return risk assessment.

    Flow:
    1. Validate patient data (Pydantic does this automatically)
    2. Retrieve relevant medical context from RAG
    3. Send data + context to the LLM
    4. Parse and return the structured result

    Request body: PatientInput (age, gender, vitals, symptoms)
    Response: RiskAssessmentOutput (risk, probability, reason, action)
    """
    try:
        logger.info(f"📋 New analysis request: age={patient.age}, gender={patient.gender}")

        # Call our LLM service which handles everything
        result = await analyze_patient_risk(patient)

        logger.info(f"✅ Analysis complete: {result.risk} ({result.probability})")
        return result

    except ValueError as value_error:
        # Configuration errors (missing API key, etc.)
        logger.error(f"⚙️  Configuration error: {value_error}")
        raise HTTPException(
            status_code=503,
            detail=str(value_error)
        )

    except Exception as error:
        # Unexpected errors
        logger.error(f"❌ Analysis failed: {error}")
        raise HTTPException(
            status_code=500,
            detail=f"Risk analysis failed: {str(error)}"
        )


@app.post("/analyze/batch")
async def analyze_batch(patients: list[PatientInput]):
    """
    Batch analysis: Analyze multiple patients at once.

    Useful for processing a queue of patients.
    Returns a list of risk assessments.
    """
    results = []
    for i, patient in enumerate(patients):
        try:
            logger.info(f"📋 Batch analysis {i+1}/{len(patients)}")
            result = await analyze_patient_risk(patient)
            results.append({
                "index": i,
                "success": True,
                "data": result.model_dump()
            })
        except Exception as error:
            results.append({
                "index": i,
                "success": False,
                "error": str(error)
            })

    return {"results": results, "total": len(patients)}


# -----------------------------------------------
# RUN THE SERVER
# -----------------------------------------------
if __name__ == "__main__":
    import uvicorn
    # Render sets PORT env var. Fallback to AI_SERVICE_PORT or 8000
    port = int(os.getenv("PORT", os.getenv("AI_SERVICE_PORT", 8000)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
