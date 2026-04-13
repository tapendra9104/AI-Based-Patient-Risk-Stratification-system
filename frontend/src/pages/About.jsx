/**
 * ============================================
 * ABOUT PAGE — Project Information
 * ============================================
 *
 * Purpose: Explains how the system works, the tech stack,
 *          and the AI/ML approach.
 *
 * Sections:
 * 1. How It Works (connected step flow)
 * 2. What is RAG
 * 3. Technology Stack (grouped by category)
 * 4. Medical disclaimer
 */

import { motion } from "framer-motion";
import {
  Brain, Database, Server, Monitor, ArrowRight,
  Cpu, FileSearch, MessageSquare, Shield, Zap, BookOpen
} from "lucide-react";

export default function About() {
  // Pipeline steps
  const steps = [
    {
      icon: Monitor,
      title: "Patient Data Input",
      description: "Doctor enters patient vitals (BP, glucose, heart rate) and symptoms through the React frontend.",
      color: "accent",
    },
    {
      icon: Server,
      title: "Backend Processing",
      description: "Node.js/Express validates the data and forwards it to the Python AI microservice.",
      color: "cyan",
    },
    {
      icon: FileSearch,
      title: "RAG Context Retrieval",
      description: "FAISS vector database retrieves the most relevant medical guidelines for this patient's condition.",
      color: "blue",
    },
    {
      icon: Brain,
      title: "LLM Analysis",
      description: "Google Gemini AI receives patient data + medical context and performs intelligent risk assessment.",
      color: "purple",
    },
    {
      icon: MessageSquare,
      title: "Structured Response",
      description: "AI returns JSON with risk level (Low/Medium/High), probability, reasoning, and recommended action.",
      color: "amber",
    },
    {
      icon: Database,
      title: "Storage & Dashboard",
      description: "Results are saved in MongoDB. Doctors can view history, trends, and filter by risk level.",
      color: "emerald",
    },
  ];

  // Tech stack grouped by layer
  const techGroups = [
    {
      category: "Frontend",
      items: [
        { name: "React.js", desc: "UI with hooks & components" },
        { name: "Tailwind CSS", desc: "Utility-first styling" },
        { name: "Framer Motion", desc: "Animations & transitions" },
        { name: "Recharts", desc: "Data visualization" },
      ],
    },
    {
      category: "Backend",
      items: [
        { name: "Node.js + Express", desc: "REST API gateway" },
        { name: "MongoDB + Mongoose", desc: "Document database & ODM" },
      ],
    },
    {
      category: "AI / ML",
      items: [
        { name: "Python FastAPI", desc: "AI microservice" },
        { name: "Google Gemini", desc: "Generative AI for risk analysis" },
        { name: "LangChain", desc: "LLM orchestration & chaining" },
        { name: "FAISS", desc: "Facebook's vector similarity search" },
        { name: "Sentence Transformers", desc: "Text → vector embeddings" },
      ],
    },
  ];

  const iconColors = {
    accent: "text-accent-400 bg-accent-500/10",
    cyan: "text-cyan-400 bg-cyan-500/10",
    blue: "text-blue-400 bg-blue-500/10",
    purple: "text-purple-400 bg-purple-500/10",
    amber: "text-amber-400 bg-amber-500/10",
    emerald: "text-emerald-400 bg-emerald-500/10",
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-2 h-2 rounded-full bg-accent-500" />
          <span className="text-[11px] font-semibold text-accent-400 uppercase tracking-widest">
            System Architecture
          </span>
        </div>
        <h1 className="text-3xl font-bold font-display text-white tracking-tight">
          How It <span className="gradient-text">Works</span>
        </h1>
        <p className="text-sm text-zinc-500 mt-2 max-w-xl">
          Understanding the AI-powered patient risk stratification pipeline —
          from data input to intelligent risk assessment.
        </p>
      </motion.div>

      {/* Architecture Flow Badge */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="card-flat"
      >
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs font-medium">
          {["React UI", "Node.js API", "FastAPI", "RAG + LLM", "Response", "Dashboard"].map(
            (item, i, arr) => (
              <div key={i} className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-lg bg-accent-500/8 text-accent-300 border border-accent-500/15">
                  {item}
                </span>
                {i < arr.length - 1 && (
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-600" />
                )}
              </div>
            )
          )}
        </div>
      </motion.div>

      {/* Step-by-step Flow (connected with line) */}
      <div className="relative">
        {/* Vertical connecting line */}
        <div className="absolute left-[22px] top-6 bottom-6 w-px bg-gradient-to-b from-accent-500/30 via-zinc-700/30 to-emerald-500/30 hidden md:block" />

        <div className="space-y-3">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const colorClass = iconColors[step.color] || iconColors.accent;
            return (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.08 * index }}
                className="relative flex items-start gap-4 card"
              >
                {/* Step Icon */}
                <div className={`w-11 h-11 rounded-xl ${colorClass} flex items-center justify-center flex-shrink-0 relative z-10`}>
                  <Icon className="w-5 h-5" />
                </div>
                {/* Step Content */}
                <div className="pt-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                      Step {index + 1}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-white mb-1">{step.title}</h3>
                  <p className="text-xs text-zinc-500 leading-relaxed">{step.description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* What is RAG? */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-cyan-500" />
          <h2 className="text-lg font-bold font-display text-white">What is RAG?</h2>
        </div>

        <div className="card-flat space-y-4">
          <p className="text-sm text-zinc-400 leading-relaxed">
            <strong className="text-white">RAG (Retrieval Augmented Generation)</strong> is like giving the AI
            a relevant textbook page before asking it a question.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { num: "1", title: "Store", desc: "Medical guidelines are converted into vector embeddings and stored in FAISS.", color: "text-cyan-400" },
              { num: "2", title: "Retrieve", desc: "When a patient comes in, we find the most relevant medical knowledge for their symptoms.", color: "text-accent-400" },
              { num: "3", title: "Augment", desc: "This context is added to the LLM prompt, making the AI response more accurate.", color: "text-emerald-400" },
            ].map((item) => (
              <div key={item.num} className="p-4 rounded-xl bg-dark-900 border border-white/[0.04]">
                <span className={`text-lg font-bold font-display ${item.color}`}>{item.num}.</span>
                <h4 className="text-xs font-semibold text-white mt-1 mb-1">{item.title}</h4>
                <p className="text-[11px] text-zinc-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tech Stack */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-accent-500" />
          <h2 className="text-lg font-bold font-display text-white">Technology Stack</h2>
        </div>

        <div className="space-y-4">
          {techGroups.map((group) => (
            <div key={group.category}>
              <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2 ml-1">
                {group.category}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {group.items.map((tech) => (
                  <div key={tech.name} className="card !p-3.5 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-accent-500/8 flex items-center justify-center flex-shrink-0">
                      <Cpu className="w-4 h-4 text-accent-400" />
                    </div>
                    <div>
                      <h4 className="text-xs font-semibold text-white">{tech.name}</h4>
                      <p className="text-[11px] text-zinc-500">{tech.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Disclaimer */}
      <div className="card-flat border-amber-500/15 bg-amber-500/[0.02]">
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
            <Shield className="w-[18px] h-[18px] text-amber-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-1">Medical Disclaimer</h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              This system is a <strong className="text-amber-300">decision-support tool</strong> for
              healthcare professionals. It does NOT replace professional medical judgment.
              All AI assessments should be reviewed by a qualified physician before clinical decisions are made.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
