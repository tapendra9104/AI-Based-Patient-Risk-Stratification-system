/**
 * ============================================
 * STATS CARD COMPONENT — Dashboard KPI Card
 * ============================================
 *
 * Purpose: Displays a single statistic with icon,
 *          trend indicator, and subtitle.
 *
 * Props:
 *   title    — Label text (e.g., "Total Patients")
 *   value    — The number to display
 *   icon     — Lucide icon component
 *   color    — "violet" | "emerald" | "amber" | "red" | "cyan"
 *   trend    — Optional trend text (e.g., "+12%")
 *   subtitle — Optional description
 */

import { motion } from "framer-motion";

export default function StatsCard({ title, value, icon: Icon, color = "violet", trend, subtitle, index = 0 }) {
  // Color configuration
  const colors = {
    violet: { bg: "bg-accent-500/10", text: "text-accent-400", border: "border-accent-500/10" },
    emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", border: "border-emerald-500/10" },
    amber: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/10" },
    red: { bg: "bg-red-500/10", text: "text-red-400", border: "border-red-500/10" },
    cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", border: "border-cyan-500/10" },
  };

  const c = colors[color] || colors.violet;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.08 }}
      className={`card-flat ${c.border}`}
    >
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">{title}</p>
        <div className={`w-9 h-9 rounded-xl ${c.bg} flex items-center justify-center`}>
          <Icon className={`w-[18px] h-[18px] ${c.text}`} />
        </div>
      </div>

      <p className="stat-number">{value}</p>

      <div className="flex items-center gap-2 mt-1.5">
        {trend && (
          <span className={`text-xs font-semibold ${
            trend.startsWith("+") ? "text-emerald-400" : trend.startsWith("-") ? "text-red-400" : "text-zinc-400"
          }`}>
            {trend}
          </span>
        )}
        {subtitle && (
          <span className="text-[11px] text-zinc-500">{subtitle}</span>
        )}
      </div>
    </motion.div>
  );
}
