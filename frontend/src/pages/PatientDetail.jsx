/**
 * ============================================
 * PATIENT DETAIL PAGE — Full Patient View
 * ============================================
 *
 * Purpose: Shows detailed view of a single patient
 *          with full assessment, vitals, history,
 *          re-analyze capability, inline editing,
 *          and report download.
 *
 * Features:
 * - Full patient data display
 * - Re-analyze capability (Feature 2)
 * - Inline edit mode for patient vitals (Feature 9)
 * - Download PDF Report button (Feature 3)
 * - Copy-to-clipboard on AI sections (Feature 13)
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  User, Heart, Droplets, Activity, ArrowLeft, Brain,
  RefreshCw, Clock, Stethoscope, TrendingUp, Loader2,
  ShieldCheck, ShieldAlert, ShieldX, Download, Edit3,
  Save, X, Copy, Check
} from "lucide-react";
import { getPatientById, reanalyzePatient, updatePatient } from "../services/api";
import toast from "react-hot-toast";

// Reusable copy-to-clipboard button
function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button onClick={handleCopy} className="copy-btn no-print" title={label}>
      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : label}
    </button>
  );
}

export default function PatientDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [patient, setPatient] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  // Feature 9: Edit mode state
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPatient();
  }, [id]);

  async function fetchPatient() {
    try {
      setIsLoading(true);
      const response = await getPatientById(id);
      setPatient(response.data);
    } catch (error) {
      toast.error("Failed to load patient details");
      navigate("/history");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReanalyze() {
    try {
      setIsReanalyzing(true);
      const response = await reanalyzePatient(id);
      setPatient(response.data.patient);
      toast.success("Patient re-analyzed successfully!");
    } catch (error) {
      toast.error(error.message || "Re-analysis failed");
    } finally {
      setIsReanalyzing(false);
    }
  }

  // Feature 9: Start editing
  function startEditing() {
    setEditData({
      name: patient.name,
      age: patient.age,
      gender: patient.gender,
      systolic: patient.bloodPressure?.systolic,
      diastolic: patient.bloodPressure?.diastolic,
      glucoseLevel: patient.glucoseLevel,
      heartRate: patient.heartRate,
      symptoms: patient.symptoms,
    });
    setIsEditing(true);
  }

  // Feature 9: Cancel editing
  function cancelEditing() {
    setIsEditing(false);
    setEditData({});
  }

  // Feature 9: Save edits
  async function saveEdits() {
    try {
      setIsSaving(true);
      const updates = {
        name: editData.name,
        age: parseInt(editData.age),
        gender: editData.gender,
        bloodPressure: {
          systolic: parseInt(editData.systolic),
          diastolic: parseInt(editData.diastolic),
        },
        glucoseLevel: parseFloat(editData.glucoseLevel),
        heartRate: parseInt(editData.heartRate),
        symptoms: editData.symptoms,
      };

      const response = await updatePatient(id, updates);
      setPatient(response.data);
      setIsEditing(false);
      toast.success("Patient updated successfully!");
    } catch (error) {
      toast.error(error.message || "Update failed");
    } finally {
      setIsSaving(false);
    }
  }

  // Feature 3: Download Report
  function handleDownloadReport() {
    window.print();
  }

  // Loading
  if (isLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <div className="skeleton h-8 w-48 rounded-xl" />
        <div className="skeleton h-64 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (!patient) return null;

  const risk = patient.riskAssessment?.risk || "Medium";
  const probability = patient.riskAssessment?.probability || "50%";

  const riskConfig = {
    Low: { icon: ShieldCheck, text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", badge: "risk-badge-low" },
    Medium: { icon: ShieldAlert, text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", badge: "risk-badge-medium" },
    High: { icon: ShieldX, text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", badge: "risk-badge-high" },
  };
  const config = riskConfig[risk] || riskConfig.Medium;
  const RiskIcon = config.icon;

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate("/history")} className="btn-ghost p-2 no-print">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            {isEditing ? (
              <input
                value={editData.name}
                onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                className="text-2xl font-bold font-display text-white bg-transparent border-b border-accent-500/40 outline-none"
              />
            ) : (
              <h1 className="text-2xl font-bold font-display text-white">{patient.name}</h1>
            )}
            <p className="text-sm text-zinc-500">
              {patient.age} yrs • {patient.gender} • ID: {patient._id?.slice(-6)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 no-print">
          {/* Feature 9: Edit/Save/Cancel buttons */}
          {isEditing ? (
            <>
              <button onClick={cancelEditing} className="btn-ghost flex items-center gap-2 text-xs">
                <X className="w-3.5 h-3.5" /> Cancel
              </button>
              <button
                onClick={saveEdits}
                disabled={isSaving}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {isSaving ? "Saving..." : "Save"}
              </button>
            </>
          ) : (
            <>
              <button onClick={startEditing} className="btn-ghost flex items-center gap-2 text-xs">
                <Edit3 className="w-3.5 h-3.5" /> Edit
              </button>
              <button onClick={handleDownloadReport} className="btn-ghost flex items-center gap-2 text-xs">
                <Download className="w-3.5 h-3.5" /> Report
              </button>
              <button
                onClick={handleReanalyze}
                disabled={isReanalyzing}
                className="btn-primary flex items-center gap-2 text-xs"
              >
                {isReanalyzing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                {isReanalyzing ? "Re-analyzing..." : "Re-analyze"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Risk Assessment Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className={`card-flat ${config.border} ${config.bg}`}
      >
        <div className="flex items-center gap-4 mb-4">
          <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center`}>
            <RiskIcon className={`w-6 h-6 ${config.text}`} />
          </div>
          <div>
            <div className={config.badge}>{risk} Risk • {probability}</div>
            <p className="text-xs text-zinc-500 mt-1">
              Last assessed: {new Date(patient.riskAssessment?.assessedAt || patient.updatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Brain className="w-3.5 h-3.5 text-accent-400" /> AI Reasoning
              </h4>
              <CopyButton text={patient.riskAssessment?.reason || ""} label="Copy" />
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{patient.riskAssessment?.reason}</p>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <h4 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider flex items-center gap-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-accent-400" /> Recommended Action
              </h4>
              <CopyButton text={patient.riskAssessment?.action || ""} label="Copy" />
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">{patient.riskAssessment?.action}</p>
          </div>
        </div>
      </motion.div>

      {/* Vitals Grid — Editable in edit mode (Feature 9) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Blood Pressure", field: ["systolic", "diastolic"], value: `${patient.bloodPressure?.systolic}/${patient.bloodPressure?.diastolic}`, unit: "mmHg", icon: Heart, color: "text-red-400", bg: "bg-red-500/10", isBP: true },
          { label: "Glucose Level", field: "glucoseLevel", value: patient.glucoseLevel, unit: "mg/dL", icon: Droplets, color: "text-blue-400", bg: "bg-blue-500/10" },
          { label: "Heart Rate", field: "heartRate", value: patient.heartRate, unit: "bpm", icon: Activity, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Age", field: "age", value: patient.age, unit: "years", icon: User, color: "text-accent-400", bg: "bg-accent-500/10" },
        ].map((vital) => (
          <div key={vital.label} className="card-flat">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${vital.bg} flex items-center justify-center`}>
                <vital.icon className={`w-3.5 h-3.5 ${vital.color}`} />
              </div>
              <span className="text-[11px] text-zinc-500 uppercase tracking-wider">{vital.label}</span>
            </div>
            {isEditing ? (
              vital.isBP ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={editData.systolic}
                    onChange={(e) => setEditData({ ...editData, systolic: e.target.value })}
                    className="input-field !py-1.5 !px-2 text-sm w-16"
                  />
                  <span className="text-zinc-500">/</span>
                  <input
                    type="number"
                    value={editData.diastolic}
                    onChange={(e) => setEditData({ ...editData, diastolic: e.target.value })}
                    className="input-field !py-1.5 !px-2 text-sm w-16"
                  />
                </div>
              ) : (
                <input
                  type="number"
                  value={editData[vital.field]}
                  onChange={(e) => setEditData({ ...editData, [vital.field]: e.target.value })}
                  className="input-field !py-1.5 !px-2 text-sm w-full"
                />
              )
            ) : (
              <p className="text-xl font-bold font-display text-white">
                {vital.value} <span className="text-xs text-zinc-500 font-normal">{vital.unit}</span>
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Symptoms — Editable in edit mode */}
      <div className="card-flat">
        <h3 className="section-title mb-3">
          <TrendingUp className="w-[18px] h-[18px] text-accent-400" />
          Reported Symptoms
        </h3>
        {isEditing ? (
          <textarea
            value={editData.symptoms}
            onChange={(e) => setEditData({ ...editData, symptoms: e.target.value })}
            rows={3}
            className="input-field resize-none w-full"
          />
        ) : (
          <p className="text-sm text-zinc-400 leading-relaxed">{patient.symptoms}</p>
        )}
      </div>

      {/* Assessment History */}
      {patient.assessmentHistory?.length > 1 && (
        <div className="card-flat">
          <h3 className="section-title mb-3">
            <Clock className="w-[18px] h-[18px] text-cyan-400" />
            Assessment History
            <span className="text-[11px] text-zinc-600 font-normal ml-1">
              ({patient.assessmentHistory.length} assessments)
            </span>
          </h3>
          <div className="space-y-2">
            {patient.assessmentHistory.slice().reverse().map((assessment, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 rounded-xl bg-dark-900 border border-white/[0.04]"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-bold ${
                    assessment.risk === "High" ? "text-red-400" : assessment.risk === "Medium" ? "text-amber-400" : "text-emerald-400"
                  }`}>
                    {assessment.risk}
                  </span>
                  <span className="text-xs text-zinc-500">{assessment.probability}</span>
                </div>
                <span className="text-[11px] text-zinc-600">
                  {new Date(assessment.assessedAt).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
