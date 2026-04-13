/**
 * ============================================
 * PATIENT CARD COMPONENT — Single Patient Display
 * ============================================
 *
 * Purpose: Displays a single patient's summary in a compact card.
 *          Used in the Dashboard and History pages.
 *          Has a colored left border based on risk level.
 *
 * Props:
 *   patient  — The patient data object from MongoDB
 *   onDelete — Callback function when delete is clicked
 *   onClick  — Callback function when card is clicked
 */

import { motion } from "framer-motion";
import { User, Heart, Droplets, Activity, Trash2, Clock } from "lucide-react";

export default function PatientCard({ patient, onDelete, onClick, index = 0 }) {
  const risk = patient.riskAssessment?.risk || "Unknown";
  const probability = patient.riskAssessment?.probability || "N/A";

  // Risk-based left border colors
  const borderColors = {
    Low: "border-l-emerald-500",
    Medium: "border-l-amber-500",
    High: "border-l-red-500",
  };

  const riskStyles = {
    Low: "risk-badge-low",
    Medium: "risk-badge-medium",
    High: "risk-badge-high",
  };

  // Show relative time (e.g., "2 hours ago")
  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      onClick={onClick}
      className={`card cursor-pointer group border-l-[3px] ${borderColors[risk] || "border-l-zinc-700"}`}
    >
      {/* Header: Name + Risk Badge */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-500/8 flex items-center justify-center
                        group-hover:bg-accent-500/15 transition-colors">
            <User className="w-[18px] h-[18px] text-accent-400" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white group-hover:text-accent-300 transition-colors">
              {patient.name}
            </h4>
            <p className="text-xs text-zinc-500">
              {patient.age} yrs • {patient.gender}
            </p>
          </div>
        </div>
        <div className={riskStyles[risk] || "risk-badge-medium"}>
          {risk} • {probability}
        </div>
      </div>

      {/* Vitals Row */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-dark-800 text-[11px] text-zinc-400">
          <Heart className="w-3 h-3 text-red-400" />
          {patient.bloodPressure?.systolic}/{patient.bloodPressure?.diastolic}
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-dark-800 text-[11px] text-zinc-400">
          <Droplets className="w-3 h-3 text-blue-400" />
          {patient.glucoseLevel} mg/dL
        </span>
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-dark-800 text-[11px] text-zinc-400">
          <Activity className="w-3 h-3 text-emerald-400" />
          {patient.heartRate} bpm
        </span>
      </div>

      {/* Footer: Time + Delete */}
      <div className="mt-3 pt-3 border-t border-white/[0.04] flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-600">
          <Clock className="w-3 h-3" />
          {timeAgo(patient.createdAt)}
        </span>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(patient._id);
            }}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400
                     hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
            title="Delete patient"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
