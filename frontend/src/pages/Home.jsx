/**
 * ============================================
 * HOME PAGE — Patient Analysis (Main Page)
 * ============================================
 *
 * Purpose: The main page where doctors input patient data
 *          and see the AI risk assessment result.
 *
 * Layout:
 * - Professional header with trust badges
 * - Patient input form
 * - Risk result display (appears after analysis)
 */

import { useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, Shield, Zap, Activity } from "lucide-react";
import toast from "react-hot-toast";
import PatientForm from "../components/PatientForm";
import RiskResult from "../components/RiskResult";

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState(null);

  function handleResult(result) {
    setAnalysisResult(result);
    toast.success("Risk analysis complete!");

    setTimeout(() => {
      document.getElementById("result-section")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 300);
  }

  function handleError(message) {
    toast.error(message);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -16 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-5"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-accent-500" />
              <span className="text-[11px] font-semibold text-accent-400 uppercase tracking-widest">
                AI Risk Analysis
              </span>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold font-display text-white tracking-tight">
              Patient Risk
              <span className="gradient-text ml-2">Stratification</span>
            </h1>
            <p className="text-sm text-zinc-500 mt-2 max-w-xl">
              Enter patient health data below. Our AI model analyzes vitals and symptoms
              using RAG-enhanced medical knowledge for comprehensive risk assessment.
            </p>
          </div>

          {/* Floating Brain Icon */}
          <div className="hidden md:flex">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-accent-600 to-accent-800
                          flex items-center justify-center shadow-xl shadow-accent-500/15 animate-float">
              <Brain className="w-7 h-7 text-white" />
            </div>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {[
            { icon: Shield, label: "HIPAA Aligned" },
            { icon: Zap, label: "RAG Powered" },
            { icon: Activity, label: "Real-time Analysis" },
            { icon: Sparkles, label: "Gemini AI + FAISS" },
          ].map((badge) => (
            <span
              key={badge.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                       bg-dark-850 border border-white/[0.06] text-[11px] text-zinc-400"
            >
              <badge.icon className="w-3 h-3 text-accent-500" />
              {badge.label}
            </span>
          ))}
        </div>
      </motion.div>

      {/* Patient Form */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <PatientForm onResult={handleResult} onError={handleError} />
      </motion.div>

      {/* Analysis Result */}
      {analysisResult && (
        <div id="result-section">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-1 h-5 rounded-full bg-accent-500" />
            <h2 className="text-lg font-bold font-display text-white">Analysis Result</h2>
          </div>
          <RiskResult result={analysisResult} />
        </div>
      )}
    </div>
  );
}
