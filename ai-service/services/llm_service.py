"""
============================================
LLM SERVICE — Large Language Model Integration
============================================

Purpose: Communicates with the AI model (Google Gemini or OpenAI)
         to perform patient risk assessment.

How it works:
1. Receives patient data from the FastAPI endpoint
2. Gets relevant medical context from the RAG service
3. Constructs a carefully engineered prompt
4. Sends the prompt to the LLM (Gemini/OpenAI)
5. Parses the LLM's JSON response
6. Returns a structured risk assessment

Prompt Engineering (Important!):
- We tell the LLM exactly what role it plays (medical risk assistant)
- We give it the patient data in a clear format
- We provide relevant medical knowledge from RAG
- We enforce JSON output format
- We tell it NOT to hallucinate or make up information
"""

import os
import json
import logging
import asyncio
from typing import Optional

from models.schemas import PatientInput, RiskAssessmentOutput
from services.rag_service import rag_service

logger = logging.getLogger(__name__)


# -----------------------------------------------
# SYSTEM PROMPT — The "personality" of our AI
# -----------------------------------------------
# This prompt is sent with EVERY request. It sets the rules
# for how the AI should behave and respond.
SYSTEM_PROMPT = """You are a medical risk assessment assistant. Your role is to analyze patient health data and classify their risk level.

STRICT RULES:
1. Classify risk as exactly one of: "Low", "Medium", or "High"
2. Provide a probability percentage (e.g., "75%")
3. Give a clear, evidence-based medical reasoning
4. Recommend a specific clinical action
5. Do NOT hallucinate or fabricate medical claims
6. Base your assessment ONLY on the provided patient data and medical context
7. Respond ONLY in valid JSON format with these exact keys: risk, probability, reason, action

CLASSIFICATION CRITERIA:
- LOW: Vital signs within normal ranges, minor symptoms, low immediate concern
- MEDIUM: One or more moderately elevated readings, symptoms requiring monitoring
- HIGH: Multiple abnormal readings, dangerous vital sign combinations, urgent symptoms"""


def build_patient_prompt(patient: PatientInput, medical_context: str) -> str:
    """
    Build the complete prompt that we send to the LLM.

    This function takes the raw patient data and medical context
    and formats them into a clear, structured prompt.

    Parameters:
        patient: The patient's health data
        medical_context: Relevant medical knowledge from RAG

    Returns:
        str: The formatted prompt string
    """

    # Start with the patient data in a readable format
    prompt = f"""Analyze the following patient data and provide a risk assessment.

--- PATIENT DATA ---
Age: {patient.age} years
Gender: {patient.gender}
Blood Pressure: {patient.blood_pressure_systolic}/{patient.blood_pressure_diastolic} mmHg
Blood Glucose: {patient.glucose_level} mg/dL
Heart Rate: {patient.heart_rate} bpm
Reported Symptoms: {patient.symptoms}"""

    # Add PDF report text if available
    if patient.report_text:
        prompt += f"""

--- UPLOADED REPORT ---
{patient.report_text[:2000]}"""

    # Add RAG context (relevant medical knowledge)
    if medical_context:
        prompt += f"""

--- RELEVANT MEDICAL GUIDELINES ---
{medical_context}"""

    # Add the output format instruction
    prompt += """

--- INSTRUCTIONS ---
Based on the patient data and medical guidelines above, provide your assessment.
Respond with a JSON object containing exactly these fields:
{
  "risk": "Low" or "Medium" or "High",
  "probability": "percentage as string like 75%",
  "reason": "detailed medical reasoning for your classification",
  "action": "specific recommended clinical action"
}

Respond ONLY with the JSON object. No extra text before or after."""

    return prompt


async def analyze_patient_risk(patient: PatientInput) -> RiskAssessmentOutput:
    """
    Main function: Analyzes a patient's health risk using the LLM.

    This is the core function that ties everything together:
    1. Gets relevant medical context from RAG
    2. Builds the prompt
    3. Calls the LLM (with retry + model fallback)
    4. Parses and validates the response

    Parameters:
        patient: Patient data from the API request

    Returns:
        RiskAssessmentOutput: Structured risk assessment
    """

    # ---- Step 1: Retrieve relevant medical context using RAG ----
    # Create a search query from the patient's key information
    search_query = (
        f"Patient age {patient.age}, "
        f"blood pressure {patient.blood_pressure_systolic}/{patient.blood_pressure_diastolic}, "
        f"glucose {patient.glucose_level}, "
        f"heart rate {patient.heart_rate}, "
        f"symptoms: {patient.symptoms}"
    )

    medical_context = rag_service.retrieve_context(search_query, top_k=3)
    logger.info(f"📎 Retrieved {len(medical_context)} chars of medical context")

    # ---- Step 2: Build the prompt ----
    user_prompt = build_patient_prompt(patient, medical_context)
    logger.info(f"📝 Prompt built ({len(user_prompt)} chars)")

    # ---- Step 3: Call the LLM ----
    llm_provider = os.getenv("LLM_PROVIDER", "gemini").lower()

    if llm_provider == "gemini":
        raw_response = await _call_gemini_with_retry(user_prompt)
    elif llm_provider == "openai":
        raw_response = await _call_openai(user_prompt)
    else:
        raise ValueError(f"Unknown LLM provider: {llm_provider}. Use 'gemini' or 'openai'.")

    # ---- Step 4: Parse the JSON response ----
    result = _parse_llm_response(raw_response)

    logger.info(f"✅ Analysis complete: {result.risk} risk ({result.probability})")
    return result


# Gemini model fallback chain — try these in order if one hits quota limits
GEMINI_MODEL_CHAIN = ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro"]


async def _call_gemini_with_retry(prompt: str, max_retries: int = 3) -> str:
    """
    Call Gemini API with retry logic and model fallback.

    If a model hits rate limits (429), we:
    1. Retry with exponential backoff (up to max_retries)
    2. If all retries fail, try the next model in the chain
    3. If all models fail, raise the error
    """
    last_error = None

    for model_name in GEMINI_MODEL_CHAIN:
        try:
            return await _call_gemini(prompt, model_name=model_name)
        except Exception as e:
            error_str = str(e)
            last_error = e

            # Only try next model if this was a quota/rate-limit error
            if "429" in error_str or "quota" in error_str.lower() or "rate" in error_str.lower():
                logger.warning(f"⚠️  {model_name} quota exceeded, trying next model...")
                continue
            else:
                # Non-quota errors should not trigger model fallback
                raise

    # All models exhausted — raise the last error
    raise last_error


async def _call_gemini(prompt: str, model_name: str = "gemini-2.0-flash") -> str:
    """
    Call Google Gemini API for risk assessment.

    Gemini is Google's multimodal AI model.
    Supports retry with exponential backoff for 429 rate-limit errors.
    """
    import google.generativeai as genai

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key or api_key == "your_gemini_api_key_here":
        raise ValueError(
            "GEMINI_API_KEY not configured. "
            "Get a free key at: https://aistudio.google.com/apikey"
        )

    # Configure the Gemini client
    genai.configure(api_key=api_key)

    # Create the Gemini model
    model = genai.GenerativeModel(
        model_name=model_name,
        generation_config={
            "temperature": 0.3,       # Low temperature = more focused/consistent
            "top_p": 0.8,             # Nucleus sampling for diversity
            "max_output_tokens": 1024, # Limit response length
        },
    )

    # Combine system prompt + user prompt into one message
    full_prompt = f"{SYSTEM_PROMPT}\n\n{prompt}"

    # Retry with exponential backoff for rate limit errors
    max_retries = 3
    for attempt in range(max_retries):
        try:
            logger.info(f"🤖 Calling Gemini API ({model_name}, attempt {attempt + 1}/{max_retries})...")
            response = await model.generate_content_async(full_prompt)
            return response.text

        except Exception as e:
            error_str = str(e)
            is_rate_limit = "429" in error_str or "quota" in error_str.lower()

            if is_rate_limit and attempt < max_retries - 1:
                wait_time = (2 ** attempt) * 2  # 2s, 4s, 8s
                logger.warning(f"⏳ Rate limited on {model_name}. Retrying in {wait_time}s (attempt {attempt + 1}/{max_retries})...")
                await asyncio.sleep(wait_time)
            else:
                raise


async def _call_openai(prompt: str) -> str:
    """
    Call OpenAI API for risk assessment (alternative to Gemini).

    Uses GPT-4 or GPT-3.5-turbo depending on user preference.
    Requires an OpenAI API key with billing enabled.
    """
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("OpenAI package not installed. Run: pip install openai")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key or api_key == "your_openai_api_key_here":
        raise ValueError(
            "OPENAI_API_KEY not configured. "
            "Get a key at: https://platform.openai.com/api-keys"
        )

    client = OpenAI(api_key=api_key)

    logger.info("🤖 Calling OpenAI API...")

    response = client.chat.completions.create(
        model="gpt-3.5-turbo",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        temperature=0.3,
        max_tokens=1024,
    )

    return response.choices[0].message.content


def _parse_llm_response(raw_response: str) -> RiskAssessmentOutput:
    """
    Parse the LLM's raw text response into a structured object.

    LLMs sometimes add extra text around the JSON (like ```json markers
    or explanatory text). This function handles those cases.

    Parameters:
        raw_response: The raw text from the LLM

    Returns:
        RiskAssessmentOutput: Validated, structured response
    """
    try:
        # Clean up the response — remove markdown code blocks if present
        cleaned = raw_response.strip()

        # Remove ```json and ``` markers if the LLM wrapped its response
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]  # Remove ```json
        if cleaned.startswith("```"):
            cleaned = cleaned[3:]  # Remove ```
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]  # Remove trailing ```

        cleaned = cleaned.strip()

        # Try to find JSON in the response (in case there's extra text)
        json_start = cleaned.find("{")
        json_end = cleaned.rfind("}") + 1

        if json_start == -1 or json_end == 0:
            raise ValueError("No JSON object found in LLM response")

        json_str = cleaned[json_start:json_end]

        # Parse the JSON
        result_dict = json.loads(json_str)

        # Validate that all required fields are present
        required_fields = ["risk", "probability", "reason", "action"]
        for field in required_fields:
            if field not in result_dict:
                raise ValueError(f"Missing required field: {field}")

        # Validate risk level is one of the allowed values
        if result_dict["risk"] not in ["Low", "Medium", "High"]:
            # Try to normalize it (e.g., "low" → "Low", "HIGH" → "High")
            normalized = result_dict["risk"].strip().capitalize()
            if normalized in ["Low", "Medium", "High"]:
                result_dict["risk"] = normalized
            else:
                result_dict["risk"] = "Medium"  # Default to Medium if unclear

        # Create and return the validated Pydantic model
        return RiskAssessmentOutput(**result_dict)

    except json.JSONDecodeError as json_error:
        logger.error(f"❌ Failed to parse LLM JSON: {json_error}")
        logger.error(f"   Raw response: {raw_response[:500]}")

        # Return a safe fallback instead of crashing
        return RiskAssessmentOutput(
            risk="Medium",
            probability="50%",
            reason=f"AI response could not be parsed. Raw analysis: {raw_response[:300]}",
            action="Please retry the analysis or consult a physician directly."
        )

    except Exception as error:
        logger.error(f"❌ Error parsing LLM response: {error}")

        return RiskAssessmentOutput(
            risk="Medium",
            probability="50%",
            reason=f"Error processing AI analysis: {str(error)}",
            action="Please retry the analysis or consult a physician directly."
        )
