"""
FastAPI entry point for the AI microservice.
"""

import logging
import os
from contextlib import asynccontextmanager
from datetime import datetime

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from models.schemas import HealthCheckResponse, PatientInput, RiskAssessmentOutput
from services.llm_service import analyze_patient_risk
from services.rag_service import rag_service

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("ai-service")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Run service startup and shutdown hooks.

    RAG warm-up is started in the background so the web process can satisfy
    Render health checks immediately.
    """
    logger.info("=" * 50)
    logger.info("  AI Patient Risk Stratification - AI Service")
    logger.info("=" * 50)

    logger.info("Starting up...")
    if rag_service.start_background_initialization():
        logger.info("RAG warm-up started in the background")
    else:
        logger.info("RAG status: %s", rag_service.get_status())

    llm_provider = os.getenv("LLM_PROVIDER", "gemini")
    logger.info("LLM Provider: %s", llm_provider)

    if llm_provider == "gemini":
        api_key = os.getenv("GEMINI_API_KEY", "")
        if api_key and api_key != "your_gemini_api_key_here":
            logger.info("Gemini API key configured")
        else:
            logger.warning("Gemini API key NOT configured")
            logger.warning("Get a free key at: https://aistudio.google.com/apikey")

    logger.info("=" * 50)
    yield
    logger.info("Shutting down AI service...")


app = FastAPI(
    title="AI Patient Risk Stratification - AI Service",
    description=(
        "Analyzes patient health data using Generative AI (LLM) and RAG "
        "for risk assessment"
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthCheckResponse)
async def health_check():
    """Return service status for Render and backend health checks."""
    rag_status = rag_service.get_status()
    return HealthCheckResponse(
        status="degraded" if rag_status == "failed" else "healthy",
        service="AI Risk Assessment Service",
        timestamp=datetime.now().isoformat(),
        rag_status=rag_status,
        llm_provider=os.getenv("LLM_PROVIDER", "gemini"),
    )


@app.post("/analyze", response_model=RiskAssessmentOutput)
async def analyze_patient(patient: PatientInput):
    """Analyze one patient and return a structured risk assessment."""
    try:
        logger.info(
            "New analysis request: age=%s, gender=%s",
            patient.age,
            patient.gender,
        )
        result = await analyze_patient_risk(patient)
        logger.info("Analysis complete: %s (%s)", result.risk, result.probability)
        return result

    except ValueError as value_error:
        logger.error("Configuration error: %s", value_error)
        raise HTTPException(status_code=503, detail=str(value_error))

    except Exception as error:
        logger.error("Analysis failed: %s", error)
        raise HTTPException(
            status_code=500,
            detail=f"Risk analysis failed: {error}",
        )


@app.post("/analyze/batch")
async def analyze_batch(patients: list[PatientInput]):
    """Analyze multiple patients and return per-item results."""
    results = []
    for index, patient in enumerate(patients):
        try:
            logger.info("Batch analysis %s/%s", index + 1, len(patients))
            result = await analyze_patient_risk(patient)
            results.append(
                {
                    "index": index,
                    "success": True,
                    "data": result.model_dump(),
                }
            )
        except Exception as error:
            results.append(
                {
                    "index": index,
                    "success": False,
                    "error": str(error),
                }
            )

    return {"results": results, "total": len(patients)}


if __name__ == "__main__":
    import uvicorn

    port = int(os.getenv("PORT", os.getenv("AI_SERVICE_PORT", 8000)))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
