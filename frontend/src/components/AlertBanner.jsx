/**
 * ============================================
 * ALERT BANNER COMPONENT — High Risk Notification
 * ============================================
 *
 * Purpose: Displays a prominent banner when high-risk patients exist.
 *          Grabs the doctor's attention immediately.
 *
 * Props:
 *   count   — Number of high-risk patients
 *   visible — Whether to show the banner
 */

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { useState } from "react";

export default function AlertBanner({ count = 0, visible = true }) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if no high-risk patients or dismissed
  if (count === 0 || !visible || isDismissed) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -12 }}
        className="relative overflow-hidden rounded-xl border border-red-500/20 bg-red-500/[0.06] p-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Pulsing alert icon */}
            <div className="relative flex-shrink-0">
              <div className="w-9 h-9 rounded-xl bg-red-500/15 flex items-center justify-center">
                <AlertTriangle className="w-[18px] h-[18px] text-red-400" />
              </div>
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full">
                <span className="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-50" />
              </span>
            </div>

            <div>
              <p className="text-sm font-semibold text-red-300">
                {count} High-Risk Patient{count > 1 ? "s" : ""} Detected
              </p>
              <p className="text-xs text-red-400/60 mt-0.5">
                Immediate medical attention recommended. Review the dashboard for details.
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg text-red-400/40 hover:text-red-300 hover:bg-red-500/10 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
