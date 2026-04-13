"""
============================================
PYDANTIC MODELS — Data Validation Schemas
============================================

Purpose: Defines the exact structure of data flowing in and out of our AI service.

What is Pydantic?
- Pydantic is like a "data contract" library.
- It ensures that incoming data has the right fields and types.
- If someone sends age="abc" instead of a number, Pydantic catches it
  BEFORE our code even runs.

Why use it?
1. Automatic input validation (no manual if/else checks needed)
2. Auto-generates API documentation (Swagger/OpenAPI)
3. Type hints make the code self-documenting
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class PatientInput(BaseModel):
    """
    PatientInput — What the Node.js backend sends us for analysis.

    Each field has:
    - A type (int, float, str)
    - A description (shown in API docs)
    - Min/max constraints (validation)
    - An example value (shown in API docs)
    """
    age: int = Field(
        ...,  # ... means "required"
        ge=0,  # greater than or equal to 0
        le=150,  # less than or equal to 150
        description="Patient's age in years",
        examples=[45]
    )
    gender: str = Field(
        ...,
        description="Patient's gender",
        examples=["Male"]
    )
    blood_pressure_systolic: int = Field(
        ...,
        ge=60,
        le=300,
        description="Systolic blood pressure (top number) in mmHg",
        examples=[140]
    )
    blood_pressure_diastolic: int = Field(
        ...,
        ge=30,
        le=200,
        description="Diastolic blood pressure (bottom number) in mmHg",
        examples=[90]
    )
    glucose_level: float = Field(
        ...,
        ge=20,
        le=700,
        description="Blood glucose level in mg/dL",
        examples=[180.0]
    )
    heart_rate: int = Field(
        ...,
        ge=30,
        le=250,
        description="Heart rate in beats per minute (bpm)",
        examples=[88]
    )
    symptoms: str = Field(
        ...,
        min_length=1,
        max_length=2000,
        description="Patient's symptoms described in text",
        examples=["Chest pain, shortness of breath, dizziness"]
    )
    report_text: Optional[str] = Field(
        default=None,
        description="Extracted text from uploaded PDF report (optional)",
        examples=["Lab results show elevated cholesterol..."]
    )


class RiskAssessmentOutput(BaseModel):
    """
    RiskAssessmentOutput — What our AI service returns after analysis.

    This is the structured JSON that the LLM must produce.
    Having a Pydantic model ensures the response always has
    these exact fields — no more, no less.
    """
    risk: str = Field(
        ...,
        description="Risk classification: Low, Medium, or High",
        examples=["High"]
    )
    probability: str = Field(
        ...,
        description="Risk probability as a percentage string",
        examples=["85%"]
    )
    reason: str = Field(
        ...,
        description="Detailed medical reasoning for the risk assessment",
        examples=["Patient shows elevated blood pressure and glucose levels..."]
    )
    action: str = Field(
        ...,
        description="Recommended clinical action for the healthcare provider",
        examples=["Schedule immediate cardiology consultation..."]
    )


class HealthCheckResponse(BaseModel):
    """Response model for the health check endpoint."""
    status: str = "healthy"
    service: str = "AI Risk Assessment Service"
    timestamp: str
    rag_status: str = "not_initialized"
    llm_provider: str = "unknown"
