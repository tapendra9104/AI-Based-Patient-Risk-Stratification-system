/**
 * ============================================
 * APP.JSX — Main Application Component
 * ============================================
 *
 * Purpose: The root component that sets up:
 * 1. React Router (page navigation)
 * 2. Sidebar + Content layout
 * 3. Toast notifications
 * 4. Page transitions
 * 5. Error Boundary (crash protection)
 * 6. Theme toggle (dark/light mode) — Feature 11
 * 7. Mobile bottom navigation — Feature 14
 *
 * Routes:
 *   /              → Home (Patient Analysis)
 *   /dashboard     → Dashboard (Stats & Charts)
 *   /history       → Patient History List
 *   /patient/:id   → Patient Detail View
 *   /about         → About the Project
 */

import { useState, useEffect, createContext, useContext } from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import { Activity, LayoutDashboard, History as HistoryIcon, Info, Sun, Moon } from "lucide-react";
import Sidebar from "./components/Sidebar";
import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import Dashboard from "./pages/Dashboard";
import History from "./pages/History";
import PatientDetail from "./pages/PatientDetail";
import About from "./pages/About";

// -----------------------------------------------
// THEME CONTEXT — Dark/Light Mode (Feature 11)
// -----------------------------------------------
export const ThemeContext = createContext();

export function useTheme() {
  return useContext(ThemeContext);
}

// Animated page wrapper for route transitions
function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

// -----------------------------------------------
// MOBILE BOTTOM NAV — Feature 14
// -----------------------------------------------
function MobileBottomNav() {
  const location = useLocation();

  const links = [
    { path: "/", label: "Analyze", icon: Activity },
    { path: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { path: "/history", label: "History", icon: HistoryIcon },
    { path: "/about", label: "About", icon: Info },
  ];

  return (
    <nav className="mobile-bottom-nav lg:hidden">
      {links.map((link) => {
        const Icon = link.icon;
        const active = location.pathname === link.path;
        return (
          <Link
            key={link.path}
            to={link.path}
            className={active ? "active" : ""}
          >
            <Icon className="w-5 h-5" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Inner app with access to router context
function AppContent() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Toast Notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: theme === "dark" ? "#18181b" : "#ffffff",
            color: theme === "dark" ? "#f4f4f5" : "#18181b",
            border: theme === "dark" ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
            borderRadius: "12px",
            fontSize: "13px",
            fontFamily: "Inter, sans-serif",
          },
          success: {
            iconTheme: { primary: "#10b981", secondary: theme === "dark" ? "#f4f4f5" : "#ffffff" },
            duration: 3000,
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: theme === "dark" ? "#f4f4f5" : "#ffffff" },
            duration: 5000,
          },
        }}
      />

      {/* Sidebar Navigation */}
      <Sidebar />

      {/* Main Content Area */}
      <main className="lg:pl-[240px] pt-14 lg:pt-0 min-h-screen pb-20 lg:pb-0">
        <div className="dot-grid min-h-screen">
          <ErrorBoundary>
            <AnimatePresence mode="wait">
              <Routes location={location} key={location.pathname}>
                <Route path="/" element={<PageTransition><Home /></PageTransition>} />
                <Route path="/dashboard" element={<PageTransition><Dashboard /></PageTransition>} />
                <Route path="/history" element={<PageTransition><History /></PageTransition>} />
                <Route path="/patient/:id" element={<PageTransition><PatientDetail /></PageTransition>} />
                <Route path="/about" element={<PageTransition><About /></PageTransition>} />
              </Routes>
            </AnimatePresence>
          </ErrorBoundary>

          {/* Footer */}
          <footer className="border-t border-white/[0.04] py-6 mt-8 no-print">
            <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-3">
              <p className="text-xs text-zinc-600">
                © 2026 RiskAI — AI Patient Risk Stratification System
              </p>
              <div className="flex items-center gap-4 text-xs text-zinc-600">
                <span>React + Node.js + FastAPI</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span className="text-accent-500">Gemini AI + RAG</span>
                <span className="w-1 h-1 rounded-full bg-zinc-700" />
                <span>Educational Use Only</span>
              </div>
            </div>
          </footer>
        </div>
      </main>

      {/* Mobile Bottom Navigation — Feature 14 */}
      <MobileBottomNav />
    </div>
  );
}

export default function App() {
  // Feature 11: Theme State — persisted in localStorage
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem("riskai-theme") || "dark";
  });

  // Apply theme class to document root
  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    localStorage.setItem("riskai-theme", theme);
  }, [theme]);

  function toggleTheme() {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <Router>
        <AppContent />
      </Router>
    </ThemeContext.Provider>
  );
}
