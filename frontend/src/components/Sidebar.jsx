/**
 * ============================================
 * SIDEBAR COMPONENT — Vertical Navigation
 * ============================================
 *
 * Professional sidebar navigation matching healthcare
 * dashboard design patterns. Replaces the old top navbar.
 *
 * Features:
 * - Logo & brand
 * - Navigation links with active state
 * - AI status indicator
 * - Mobile responsive (overlay drawer)
 */

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Activity, LayoutDashboard, History, Info,
  Menu, X, Brain, Sparkles, Sun, Moon
} from "lucide-react";
import { useTheme } from "../App";

export default function Sidebar() {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  // Navigation links
  const navLinks = [
    { path: "/", label: "Analyze", icon: Activity, description: "Patient risk analysis" },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard, description: "Stats & trends" },
    { path: "/history", label: "History", icon: History, description: "Patient records" },
    { path: "/about", label: "About", icon: Info, description: "System info" },
  ];

  const isActive = (path) => location.pathname === path;

  // Sidebar content (shared between desktop and mobile)
  function SidebarContent() {
    return (
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="p-5 pb-6">
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-accent-600 flex items-center justify-center
                          shadow-lg shadow-accent-500/20 group-hover:shadow-accent-500/40 transition-shadow">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold font-display text-white tracking-tight">
                Risk<span className="text-accent-400">AI</span>
              </h1>
              <p className="text-[10px] text-zinc-500 -mt-0.5">Patient Stratification</p>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-3 space-y-1">
          <p className="text-[10px] font-semibold text-zinc-600 uppercase tracking-widest px-3 mb-2">
            Navigation
          </p>
          {navLinks.map((link) => {
            const Icon = link.icon;
            const active = isActive(link.path);

            return (
              <Link
                key={link.path}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                          transition-all duration-200 group ${
                  active
                    ? "bg-accent-500/10 text-accent-400 border border-accent-500/20"
                    : "text-zinc-400 hover:text-white hover:bg-white/[0.03] border border-transparent"
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${active ? "text-accent-400" : "text-zinc-500 group-hover:text-zinc-300"}`} />
                <div>
                  <span className="block">{link.label}</span>
                  <span className={`block text-[10px] -mt-0.5 ${active ? "text-accent-400/60" : "text-zinc-600"}`}>
                    {link.description}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Theme Toggle — Feature 11 */}
        <div className="px-3 mb-2">
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium
                      text-zinc-400 hover:text-white hover:bg-white/[0.03] border border-transparent
                      transition-all duration-200"
          >
            {theme === "dark" ? (
              <Sun className="w-[18px] h-[18px] text-amber-400" />
            ) : (
              <Moon className="w-[18px] h-[18px] text-indigo-400" />
            )}
            <div>
              <span className="block">{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
              <span className="block text-[10px] -mt-0.5 text-zinc-600">
                Switch theme
              </span>
            </div>
          </button>
        </div>

        {/* AI Status Indicator */}
        <div className="p-4 mx-3 mb-4 rounded-xl bg-accent-500/5 border border-accent-500/10">
          <div className="flex items-center gap-2 mb-1.5">
            <div className="relative">
              <Brain className="w-4 h-4 text-accent-400" />
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-emerald-400 rounded-full">
                <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-40" />
              </span>
            </div>
            <span className="text-xs font-semibold text-accent-300">AI Engine</span>
          </div>
          <p className="text-[10px] text-zinc-500">
            Gemini + RAG Pipeline Active
          </p>
          <div className="flex items-center gap-1.5 mt-2">
            <Sparkles className="w-3 h-3 text-accent-500" />
            <span className="text-[10px] text-zinc-600">FAISS Vector Index Ready</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 h-14 flex items-center justify-between px-4
                      bg-dark-950/90 backdrop-blur-lg border-b border-white/[0.06]">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent-600 flex items-center justify-center">
            <Activity className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold font-display text-white">
            Risk<span className="text-accent-400">AI</span>
          </span>
        </Link>
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/[0.05]"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={`lg:hidden fixed top-14 left-0 bottom-0 z-50 w-[260px]
                        bg-dark-900 border-r border-white/[0.06] transform transition-transform duration-300
                        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <SidebarContent />
      </aside>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-[240px] lg:fixed lg:inset-y-0 lg:left-0
                        bg-dark-900 border-r border-white/[0.06]">
        <SidebarContent />
      </aside>
    </>
  );
}
