/**
 * ============================================
 * PATIENT FORM COMPONENT — Main Input Form
 * ============================================
 *
 * Purpose: Collects patient health data and symptoms
 *          for AI risk analysis.
 *
 * Features:
 * - Three-step visual form (Personal → Vitals → Symptoms)
 * - Real-time input validation
 * - PDF report upload support
 * - Loading state with animated spinner
 * - Step-by-step progress indicator during analysis (Feature 4)
 * - Keyboard navigation: Enter → next field, Ctrl+Enter → submit (Feature 12)
 */

import { useState, useRef, useEffect } from "react";
import {
  User, Calendar, Heart, Droplets, Activity, FileText,
  Upload, Loader2, AlertTriangle, Send, Zap
} from "lucide-react";
import { analyzePatient, uploadReport } from "../services/api";

// Feature 4: Analysis progress steps
const PROGRESS_STEPS = [
  { label: "Sending data to server...", duration: 1500 },
  { label: "AI analyzing patient vitals...", duration: 4000 },
  { label: "Retrieving medical knowledge (RAG)...", duration: 3000 },
  { label: "Generating risk assessment...", duration: 2000 },
  { label: "Processing results...", duration: 1000 },
];

export default function PatientForm({ onResult, onError }) {
  // Form state
  const [formData, setFormData] = useState({
    name: "",
    age: "",
    gender: "Male",
    bloodPressure: { systolic: "", diastolic: "" },
    glucoseLevel: "",
    heartRate: "",
    symptoms: "",
  });

  const [reportText, setReportText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState({});

  // Feature 4: Progress tracking
  const [progressStep, setProgressStep] = useState(0);
  const progressRef = useRef(null);

  // Feature 12: Keyboard navigation refs
  const formRef = useRef(null);

  // Feature 4: Step through progress messages during loading
  useEffect(() => {
    if (!isLoading) {
      setProgressStep(0);
      return;
    }

    let step = 0;
    setProgressStep(0);

    function advanceStep() {
      step++;
      if (step < PROGRESS_STEPS.length) {
        setProgressStep(step);
        progressRef.current = setTimeout(advanceStep, PROGRESS_STEPS[step].duration);
      }
    }

    progressRef.current = setTimeout(advanceStep, PROGRESS_STEPS[0].duration);

    return () => {
      if (progressRef.current) clearTimeout(progressRef.current);
    };
  }, [isLoading]);

  // Handle input changes
  function handleChange(event) {
    const { name, value } = event.target;

    if (name === "systolic" || name === "diastolic") {
      setFormData((prev) => ({
        ...prev,
        bloodPressure: { ...prev.bloodPressure, [name]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  }

  // Feature 12: Keyboard navigation — Enter moves to next field
  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      // Ctrl+Enter submits the form
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        formRef.current?.requestSubmit();
        return;
      }

      // Don't intercept Enter in textarea
      if (event.target.tagName === "TEXTAREA") return;

      event.preventDefault();

      // Find all focusable inputs and move to next
      const inputs = formRef.current?.querySelectorAll("input, select, textarea");
      if (!inputs) return;

      const currentIndex = Array.from(inputs).indexOf(event.target);
      if (currentIndex >= 0 && currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      }
    }
  }

  // Handle PDF upload
  async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setErrors((prev) => ({ ...prev, file: "Only PDF files are accepted" }));
      return;
    }

    try {
      setIsUploading(true);
      const result = await uploadReport(file);
      setReportText(result.data.extractedText);
      setErrors((prev) => ({ ...prev, file: null }));
    } catch (error) {
      setErrors((prev) => ({ ...prev, file: error.message }));
    } finally {
      setIsUploading(false);
    }
  }

  // Validate form
  function validateForm() {
    const newErrors = {};

    if (!formData.name.trim()) newErrors.name = "Patient name is required";
    if (!formData.age || formData.age < 0 || formData.age > 150) newErrors.age = "Enter valid age (0-150)";
    if (!formData.bloodPressure.systolic) newErrors.systolic = "Required";
    if (!formData.bloodPressure.diastolic) newErrors.diastolic = "Required";
    if (!formData.glucoseLevel) newErrors.glucoseLevel = "Required";
    if (!formData.heartRate) newErrors.heartRate = "Required";
    if (!formData.symptoms.trim()) newErrors.symptoms = "Describe symptoms";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Submit form
  async function handleSubmit(event) {
    event.preventDefault();
    if (!validateForm()) return;

    try {
      setIsLoading(true);

      const payload = {
        name: formData.name.trim(),
        age: parseInt(formData.age),
        gender: formData.gender,
        bloodPressure: {
          systolic: parseInt(formData.bloodPressure.systolic),
          diastolic: parseInt(formData.bloodPressure.diastolic),
        },
        glucoseLevel: parseFloat(formData.glucoseLevel),
        heartRate: parseInt(formData.heartRate),
        symptoms: formData.symptoms.trim(),
      };

      if (reportText) payload.reportText = reportText;

      const result = await analyzePatient(payload);
      onResult(result.data);

      // Feature 8: Reset form after successful analysis
      setFormData({
        name: "", age: "", gender: "Male",
        bloodPressure: { systolic: "", diastolic: "" },
        glucoseLevel: "", heartRate: "", symptoms: "",
      });
      setReportText("");
    } catch (error) {
      onError(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Step indicators
  const steps = [
    { num: 1, label: "Patient Info", icon: User },
    { num: 2, label: "Vital Signs", icon: Heart },
    { num: 3, label: "Symptoms", icon: FileText },
  ];

  // Render a single input field
  function renderInput(name, label, icon, type = "text", placeholder = "", props = {}) {
    const Icon = icon;
    const value = name === "systolic" || name === "diastolic"
      ? formData.bloodPressure[name]
      : formData[name];

    return (
      <div className="space-y-1.5">
        <label htmlFor={name} className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <Icon className="w-3.5 h-3.5 text-accent-500" />
          {label}
        </label>
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`input-field ${errors[name] ? "border-red-500/40 focus:border-red-500/60" : ""}`}
          {...props}
        />
        {errors[name] && (
          <p className="flex items-center gap-1 text-[11px] text-red-400">
            <AlertTriangle className="w-3 h-3" />
            {errors[name]}
          </p>
        )}
      </div>
    );
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
      {/* Step Indicators */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <div key={step.num} className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-850 border border-white/[0.06]">
                <div className="w-5 h-5 rounded-md bg-accent-500/15 flex items-center justify-center">
                  <Icon className="w-3 h-3 text-accent-400" />
                </div>
                <span className="text-[11px] font-medium text-zinc-400">{step.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className="w-6 h-px bg-zinc-800" />
              )}
            </div>
          );
        })}
      </div>

      {/* Keyboard shortcut hint — Feature 12 */}
      <p className="text-center text-[10px] text-zinc-600">
        Press <kbd className="px-1.5 py-0.5 rounded bg-dark-850 border border-white/[0.06] text-zinc-400 text-[9px] font-mono">Enter</kbd> to next field
        {" • "}
        <kbd className="px-1.5 py-0.5 rounded bg-dark-850 border border-white/[0.06] text-zinc-400 text-[9px] font-mono">Ctrl+Enter</kbd> to submit
      </p>

      {/* Section 1: Personal Information */}
      <div className="card-flat">
        <h3 className="section-title mb-4">
          <User className="w-[18px] h-[18px] text-accent-400" />
          Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {renderInput("name", "Full Name", User, "text", "e.g., Rahul Sharma")}
          {renderInput("age", "Age (years)", Calendar, "number", "e.g., 45", { min: 0, max: 150 })}
          <div className="space-y-1.5">
            <label htmlFor="gender" className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <User className="w-3.5 h-3.5 text-accent-500" />
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              className="input-field"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>
      </div>

      {/* Section 2: Vital Signs */}
      <div className="card-flat">
        <h3 className="section-title mb-4">
          <Heart className="w-[18px] h-[18px] text-red-400" />
          Vital Signs
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {renderInput("systolic", "BP Systolic (mmHg)", Heart, "number", "120", { min: 60, max: 300 })}
          {renderInput("diastolic", "BP Diastolic (mmHg)", Heart, "number", "80", { min: 30, max: 200 })}
          {renderInput("glucoseLevel", "Glucose (mg/dL)", Droplets, "number", "100", { min: 20, max: 700 })}
          {renderInput("heartRate", "Heart Rate (bpm)", Activity, "number", "72", { min: 30, max: 250 })}
        </div>
        {/* Normal ranges reference */}
        <div className="mt-3 pt-3 border-t border-white/[0.04] flex flex-wrap gap-x-6 gap-y-1">
          <span className="text-[10px] text-zinc-600">Normal ranges:</span>
          <span className="text-[10px] text-zinc-600">BP: 90/60 – 120/80</span>
          <span className="text-[10px] text-zinc-600">Glucose: 70 – 100 mg/dL</span>
          <span className="text-[10px] text-zinc-600">HR: 60 – 100 bpm</span>
        </div>
      </div>

      {/* Section 3: Symptoms & History */}
      <div className="card-flat">
        <h3 className="section-title mb-4">
          <FileText className="w-[18px] h-[18px] text-amber-400" />
          Symptoms & History
        </h3>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="symptoms" className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <FileText className="w-3.5 h-3.5 text-accent-500" />
              Symptoms Description
            </label>
            <textarea
              id="symptoms"
              name="symptoms"
              value={formData.symptoms}
              onChange={handleChange}
              placeholder="Describe symptoms in detail... e.g., Chest pain for 2 days, shortness of breath during walking, mild dizziness"
              rows={4}
              className={`input-field resize-none ${errors.symptoms ? "border-red-500/40" : ""}`}
            />
            {errors.symptoms && (
              <p className="flex items-center gap-1 text-[11px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {errors.symptoms}
              </p>
            )}
          </div>

          {/* PDF Upload */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Upload className="w-3.5 h-3.5 text-accent-500" />
              Upload Report (PDF) — Optional
            </label>
            <div className="flex items-center gap-3">
              <label className="btn-ghost cursor-pointer flex items-center gap-2 text-xs">
                <Upload className="w-3.5 h-3.5" />
                {isUploading ? "Uploading..." : "Choose PDF"}
                <input
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
              {reportText && (
                <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  Report extracted ({reportText.length} chars)
                </span>
              )}
            </div>
            {errors.file && (
              <p className="flex items-center gap-1 text-[11px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {errors.file}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Submit Button + Progress Indicator (Feature 4) */}
      {isLoading ? (
        <div className="space-y-3">
          {/* Progress Steps */}
          <div className="card-flat border-accent-500/20 bg-accent-500/[0.02]">
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Analyzing Patient...</p>
                <p className="text-xs text-zinc-500">{PROGRESS_STEPS[progressStep]?.label}</p>
              </div>
            </div>

            {/* Progress bar */}
            <div className="w-full h-1.5 rounded-full bg-dark-850 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${((progressStep + 1) / PROGRESS_STEPS.length) * 100}%`,
                  background: "linear-gradient(90deg, #8b5cf6, #a78bfa)",
                }}
              />
            </div>

            {/* Step dots */}
            <div className="flex items-center justify-between mt-2">
              {PROGRESS_STEPS.map((step, i) => (
                <div key={i} className="flex items-center gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                    i <= progressStep ? "bg-accent-400" : "bg-zinc-700"
                  }`} />
                  <span className={`text-[9px] hidden md:inline ${
                    i <= progressStep ? "text-zinc-400" : "text-zinc-700"
                  }`}>
                    {step.label.split("...")[0]}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <button
          type="submit"
          disabled={isLoading}
          className="btn-primary w-full flex items-center justify-center gap-2 py-4 text-sm"
        >
          <Send className="w-4 h-4" />
          Analyze Patient Risk
        </button>
      )}
    </form>
  );
}
