/**
 * ============================================
 * DASHBOARD PAGE — Overview & Statistics
 * ============================================
 *
 * Purpose: Shows a bird's-eye view of all patient data.
 *          Professional dashboard layout matching healthcare
 *          industry design patterns.
 *
 * Sections:
 * 1. Header with greeting and refresh
 * 2. Alert banner for high-risk patients
 * 3. Summary stat cards with trends
 * 4. Charts row (pie + bar)
 * 5. Recent patients
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Users, AlertTriangle, ShieldCheck, ShieldAlert,
  BarChart3, RefreshCw, TrendingUp, Clock
} from "lucide-react";
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import { getDashboardStats, checkBackendHealth, checkAIHealth } from "../services/api";
import StatsCard from "../components/StatsCard";
import PatientCard from "../components/PatientCard";
import AlertBanner from "../components/AlertBanner";
import toast from "react-hot-toast";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState({ backend: null, ai: null });

  useEffect(() => { fetchStats(); checkHealth(); }, []);

  async function checkHealth() {
    const [backend, ai] = await Promise.all([checkBackendHealth(), checkAIHealth()]);
    setHealthStatus({ backend, ai });
  }

  async function fetchStats() {
    try {
      setIsLoading(true);
      const response = await getDashboardStats();
      setStats(response.data);
    } catch (error) {
      toast.error("Failed to load dashboard data");
    } finally {
      setIsLoading(false);
    }
  }

  // Get greeting based on time of day
  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 17) return "Good Afternoon";
    return "Good Evening";
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
        <div className="skeleton h-10 w-64 rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="skeleton h-80 rounded-2xl" />
          <div className="skeleton h-80 rounded-2xl" />
        </div>
      </div>
    );
  }

  // Prepare chart data
  const riskDistribution = stats?.riskDistribution || { Low: 0, Medium: 0, High: 0 };

  const pieData = [
    { name: "Low Risk", value: riskDistribution.Low, color: "#10b981" },
    { name: "Medium Risk", value: riskDistribution.Medium, color: "#f59e0b" },
    { name: "High Risk", value: riskDistribution.High, color: "#ef4444" },
  ].filter((item) => item.value > 0);

  const weeklyData = (stats?.weeklyTrend || []).map((item) => ({
    date: new Date(item._id).toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
    patients: item.count,
  }));

  // Custom tooltip for charts
  const ChartTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="px-3 py-2 rounded-xl bg-dark-850 border border-white/[0.08] shadow-xl">
        <p className="text-xs text-zinc-400">{label}</p>
        <p className="text-sm font-semibold text-white">{payload[0].value}</p>
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight">
            {getGreeting()}, Doctor 👋
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5 flex items-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </p>
        </div>
        <button onClick={fetchStats} className="btn-ghost flex items-center gap-2 text-xs">
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Service Health Indicators */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-850 border border-white/[0.06]">
          <span className={`w-2 h-2 rounded-full ${healthStatus.backend?.online ? "bg-emerald-400" : healthStatus.backend === null ? "bg-zinc-600 animate-pulse" : "bg-red-400"}`} />
          <span className="text-[11px] text-zinc-400">Backend</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-dark-850 border border-white/[0.06]">
          <span className={`w-2 h-2 rounded-full ${healthStatus.ai?.online ? "bg-emerald-400" : healthStatus.ai === null ? "bg-zinc-600 animate-pulse" : "bg-red-400"}`} />
          <span className="text-[11px] text-zinc-400">AI Service</span>
        </div>
      </div>

      {/* High Risk Alert */}
      <AlertBanner count={stats?.highRiskCount || 0} />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Patients"
          value={stats?.totalPatients || 0}
          icon={Users}
          color="violet"
          trend={stats?.totalPatients > 0 ? `+${stats.totalPatients}` : null}
          subtitle="all time"
          index={0}
        />
        <StatsCard
          title="Low Risk"
          value={riskDistribution.Low}
          icon={ShieldCheck}
          color="emerald"
          subtitle="safe range"
          index={1}
        />
        <StatsCard
          title="Medium Risk"
          value={riskDistribution.Medium}
          icon={ShieldAlert}
          color="amber"
          subtitle="needs monitoring"
          index={2}
        />
        <StatsCard
          title="High Risk"
          value={riskDistribution.High}
          icon={AlertTriangle}
          color="red"
          subtitle="urgent attention"
          index={3}
        />
      </div>

      {/* Charts Row — Feature 15: Responsive/scrollable on mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Risk Distribution Pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="card-flat"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="section-title">
                <TrendingUp className="w-[18px] h-[18px] text-accent-400" />
                Risk Distribution
              </h3>
              <p className="section-subtitle">Patient risk breakdown</p>
            </div>
          </div>

          <div className="overflow-x-auto -mx-2 px-2" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="min-w-[300px]">
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={65}
                        outerRadius={100}
                        paddingAngle={4}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {pieData.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex items-center justify-center gap-5 mt-1">
                    {pieData.map((item) => (
                      <div key={item.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: item.color }} />
                        <span className="text-[11px] text-zinc-400">{item.name}: {item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-sm text-zinc-600">
                  No patient data yet
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Weekly Trend Bar Chart */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="card-flat"
        >
          <div className="mb-4">
            <h3 className="section-title">
              <BarChart3 className="w-[18px] h-[18px] text-cyan-400" />
              Weekly Trend
            </h3>
            <p className="section-subtitle">Patient analysis volume</p>
          </div>

          <div className="overflow-x-auto -mx-2 px-2" style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="min-w-[350px]">
              {weeklyData.length > 0 ? (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={weeklyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                    <XAxis dataKey="date" tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#52525b", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="patients" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[260px] flex items-center justify-center text-sm text-zinc-600">
                  Trend data will appear after a few days
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Recent Patients */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1 h-5 rounded-full bg-accent-500" />
          <h3 className="text-lg font-semibold font-display text-white">Recent Patients</h3>
          <span className="text-[11px] text-zinc-600 ml-1">
            {stats?.recentPatients?.length || 0} shown
          </span>
        </div>

        {stats?.recentPatients?.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.recentPatients.map((patient, index) => (
              <PatientCard key={patient._id} patient={patient} index={index} onClick={() => navigate(`/patient/${patient._id}`)} />
            ))}
          </div>
        ) : (
          <div className="card-flat text-center py-16">
            <Users className="w-10 h-10 mx-auto mb-3 text-zinc-700" />
            <p className="text-sm text-zinc-500">No patients analyzed yet</p>
            <p className="text-xs text-zinc-600 mt-1">Go to Analyze page to add your first patient</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}
