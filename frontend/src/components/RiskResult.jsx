/**
 * ============================================
 * RISK RESULT COMPONENT — AI Analysis Display
 * ============================================
 *
 * Purpose: Shows the AI's risk assessment in a professional
 *          layout after patient analysis.
 *
 * Features:
 * - Color-coded risk badge
 * - Animated probability circle
 * - AI reasoning section
 * - Recommended action
 * - Patient info summary
 * - Download PDF Report (Feature 3)
 * - Copy-to-clipboard (Feature 13)
 */

import { motion } from "framer-motion";
import {
  ShieldCheck, ShieldAlert, ShieldX,
  TrendingUp, Stethoscope, ArrowRight, User, Download, Brain, Copy, Check
} from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

// Feature 13: Copy-to-clipboard helper
function CopyButton({ text, label = "Copy" }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
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

export default function RiskResult({ result }) {
  if (!result) return null;

  const { patient, riskAssessment } = result;
  const risk = riskAssessment?.risk || "Medium";
  const probability = riskAssessment?.probability || "50%";
  const reason = riskAssessment?.reason || "No reasoning provided";
  const action = riskAssessment?.action || "Please consult a physician";

  // Risk level config
  const riskConfig = {
    Low: {
      border: "border-emerald-500/20",
      bg: "bg-emerald-500/[0.04]",
      text: "text-emerald-400",
      badge: "risk-badge-low",
      icon: ShieldCheck,
      label: "Low Risk",
      desc: "Patient vitals are within safe ranges",
      stroke: "#10b981",
    },
    Medium: {
      border: "border-amber-500/20",
      bg: "bg-amber-500/[0.04]",
      text: "text-amber-400",
      badge: "risk-badge-medium",
      icon: ShieldAlert,
      label: "Medium Risk",
      desc: "Some indicators need monitoring",
      stroke: "#f59e0b",
    },
    High: {
      border: "border-red-500/20",
      bg: "bg-red-500/[0.04]",
      text: "text-red-400",
      badge: "risk-badge-high",
      icon: ShieldX,
      label: "High Risk",
      desc: "Immediate medical attention recommended",
      stroke: "#ef4444",
    },
  };

  const config = riskConfig[risk] || riskConfig.Medium;
  const RiskIcon = config.icon;
  const probabilityNumber = parseInt(probability) || 50;
  const circumference = 2 * Math.PI * 50;

  // Feature 3: Download Report as PDF using browser print
  function handleDownloadReport() {
    window.print();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-4"
    >
      {/* Main Result Card */}
      <div className={`card-flat ${config.border} ${config.bg}`}>
        <div className="flex flex-col md:flex-row items-center gap-8">

          {/* Left: Probability Circle */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <div className="relative w-36 h-36">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
                <motion.circle
                  cx="60" cy="60" r="50"
                  fill="none"
                  stroke={config.stroke}
                  strokeWidth="7"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: circumference * (1 - probabilityNumber / 100) }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <motion.span
                  className={`text-2xl font-bold font-display ${config.text}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                >
                  {probability}
                </motion.span>
                <span className="text-[10px] text-zinc-500">probability</span>
              </div>
            </div>

            <div className={config.badge}>
              <RiskIcon className="w-3.5 h-3.5" />
              {config.label}
            </div>
            <p className="text-[11px] text-zinc-500 text-center max-w-[160px]">{config.desc}</p>
          </div>

          {/* Right: Details */}
          <div className="flex-1 space-y-5 w-full">
            {/* Patient Summary */}
            {patient && (
              <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
                <div className="w-10 h-10 rounded-xl bg-accent-500/10 flex items-center justify-center">
                  <User className="w-[18px] h-[18px] text-accent-400" />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-white">{patient.name}</h4>
                  <p className="text-xs text-zinc-500">
                    {patient.age} yrs • {patient.gender} • BP: {patient.bloodPressure?.systolic}/{patient.bloodPressure?.diastolic}
                  </p>
                </div>
              </div>
            )}

            {/* AI Reasoning */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  <Brain className="w-3.5 h-3.5 text-accent-400" />
                  AI Analysis & Reasoning
                </h4>
                <CopyButton text={reason} label="Copy" />
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{reason}</p>
            </div>

            {/* Recommended Action */}
            <div className={`p-4 rounded-xl border ${config.border} ${config.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="flex items-center gap-2 text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                  <Stethoscope className="w-3.5 h-3.5 text-accent-400" />
                  Recommended Action
                </h4>
                <CopyButton text={action} label="Copy" />
              </div>
              <p className="text-sm text-zinc-300 leading-relaxed flex items-start gap-2">
                <ArrowRight className="w-3.5 h-3.5 mt-1 flex-shrink-0 text-accent-400" />
                {action}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center justify-between no-print">
        {/* Disclaimer */}
        <p className="text-[11px] text-zinc-600">
          ⚠️ AI-assisted assessment for informational purposes only. Not a substitute for professional medical diagnosis.
        </p>

        {/* Feature 3: Download Report Button */}
        <button
          onClick={handleDownloadReport}
          className="btn-ghost flex items-center gap-2 text-xs"
        >
          <Download className="w-3.5 h-3.5" />
          Download Report
        </button>
      </div>
    </motion.div>
  );
}
