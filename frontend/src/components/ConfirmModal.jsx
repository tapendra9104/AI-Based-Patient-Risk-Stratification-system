/**
 * ============================================
 * CONFIRM MODAL — Custom Delete Confirmation
 * ============================================
 *
 * Purpose: Replaces ugly window.confirm() with a styled modal.
 *
 * Props:
 *   isOpen    — Whether modal is visible
 *   title     — Modal heading
 *   message   — Description text
 *   onConfirm — Called when user clicks confirm
 *   onCancel  — Called when user clicks cancel
 *   danger    — If true, confirm button is red
 */

import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";

export default function ConfirmModal({ isOpen, title, message, onConfirm, onCancel, danger = false }) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onCancel}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-sm card-flat border-white/[0.08] p-6 z-10"
        >
          <button
            onClick={onCancel}
            className="absolute top-3 right-3 p-1.5 rounded-lg text-zinc-500 hover:text-white hover:bg-white/[0.05]"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-start gap-3 mb-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              danger ? "bg-red-500/10" : "bg-amber-500/10"
            }`}>
              <AlertTriangle className={`w-5 h-5 ${danger ? "text-red-400" : "text-amber-400"}`} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="text-xs text-zinc-400 mt-1">{message}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button onClick={onCancel} className="btn-ghost text-xs">
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 rounded-xl text-xs font-semibold text-white transition-all ${
                danger
                  ? "bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20"
                  : "bg-accent-600 hover:bg-accent-500 shadow-lg shadow-accent-500/20"
              }`}
            >
              Confirm
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
