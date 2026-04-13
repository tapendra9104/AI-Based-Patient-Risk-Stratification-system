/**
 * ============================================
 * HISTORY PAGE — Patient Records List
 * ============================================
 *
 * Purpose: Shows all past patient records with search,
 *          filter by risk level, sort options, and pagination.
 *
 * Features:
 * - Search patients by name
 * - Filter by risk level
 * - Sort by date, name, or risk
 * - Paginated card grid
 * - Delete records with confirmation modal
 * - Click to navigate to patient detail
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  History as HistoryIcon, Search, Filter, ArrowUpDown,
  ChevronLeft, ChevronRight, Users
} from "lucide-react";
import { getPatientHistory, deletePatient } from "../services/api";
import PatientCard from "../components/PatientCard";
import ConfirmModal from "../components/ConfirmModal";
import toast from "react-hot-toast";

export default function History() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [pagination, setPagination] = useState({});
  const [isLoading, setIsLoading] = useState(true);

  // Filter, search, sort
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("");
  const [sortBy, setSortBy] = useState("-createdAt");
  const [currentPage, setCurrentPage] = useState(1);

  // Delete confirmation modal state
  const [deleteModal, setDeleteModal] = useState({ open: false, patientId: null, patientName: "" });

  // Fetch patients
  const fetchPatients = useCallback(async () => {
    try {
      setIsLoading(true);
      const params = { page: currentPage, limit: 12, sort: sortBy };
      if (riskFilter) params.risk = riskFilter;
      if (searchQuery) params.search = searchQuery;

      const response = await getPatientHistory(params);
      setPatients(response.data.patients);
      setPagination(response.data.pagination);
    } catch (error) {
      toast.error("Failed to load patient history");
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, riskFilter, searchQuery, sortBy]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);
  useEffect(() => { setCurrentPage(1); }, [riskFilter, searchQuery, sortBy]);

  // Delete handler — show modal instead of window.confirm
  function handleDeleteClick(patientId) {
    const patient = patients.find(p => p._id === patientId);
    setDeleteModal({
      open: true,
      patientId,
      patientName: patient?.name || "this patient",
    });
  }

  async function confirmDelete() {
    try {
      await deletePatient(deleteModal.patientId);
      toast.success("Patient record deleted");
      setDeleteModal({ open: false, patientId: null, patientName: "" });
      fetchPatients();
    } catch (error) {
      toast.error("Failed to delete patient");
    }
  }

  // Debounced search
  const [searchInput, setSearchInput] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setSearchQuery(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Filter buttons
  const filterButtons = [
    { label: "All", value: "" },
    { label: "Low", value: "Low" },
    { label: "Medium", value: "Medium" },
    { label: "High", value: "High" },
  ];

  // Sort options
  const sortOptions = [
    { label: "Newest First", value: "-createdAt" },
    { label: "Oldest First", value: "createdAt" },
    { label: "Name A-Z", value: "name" },
    { label: "Name Z-A", value: "-name" },
  ];

  // Risk filter pill colors
  const pillColors = {
    "": "",
    Low: "border-emerald-500/30 text-emerald-400",
    Medium: "border-amber-500/30 text-amber-400",
    High: "border-red-500/30 text-red-400",
  };

  return (
    <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={deleteModal.open}
        title="Delete Patient Record"
        message={`Are you sure you want to permanently delete ${deleteModal.patientName}'s record? This action cannot be undone.`}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteModal({ open: false, patientId: null, patientName: "" })}
        danger
      />

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-white tracking-tight flex items-center gap-3">
            <HistoryIcon className="w-6 h-6 text-accent-400" />
            Patient History
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {pagination.totalPatients || 0} total records
          </p>
        </div>
      </div>

      {/* Search, Filter & Sort Bar */}
      <div className="card-flat">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search patients by name..."
              className="input-field pl-10"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5">
            <Filter className="w-4 h-4 text-zinc-600 mr-1" />
            {filterButtons.map((btn) => {
              const active = riskFilter === btn.value;
              return (
                <button
                  key={btn.value}
                  onClick={() => setRiskFilter(btn.value)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    active
                      ? btn.value
                        ? pillColors[btn.value] + " bg-white/[0.03]"
                        : "border-accent-500/30 text-accent-400 bg-accent-500/5"
                      : "border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-white/[0.03]"
                  }`}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-1.5">
            <ArrowUpDown className="w-4 h-4 text-zinc-600" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field text-xs !py-2 w-auto"
            >
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Patient Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="skeleton h-40 rounded-2xl" />
          ))}
        </div>
      ) : patients.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {patients.map((patient, index) => (
            <PatientCard
              key={patient._id}
              patient={patient}
              index={index}
              onDelete={handleDeleteClick}
              onClick={() => navigate(`/patient/${patient._id}`)}
            />
          ))}
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="card-flat text-center py-20"
        >
          <Users className="w-12 h-12 mx-auto mb-3 text-zinc-700" />
          <h3 className="text-sm font-semibold text-zinc-400">No patients found</h3>
          <p className="text-xs text-zinc-600 mt-1">
            {searchQuery || riskFilter
              ? "Try adjusting your search or filter"
              : "Start by analyzing a patient on the home page"
            }
          </p>
        </motion.div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="btn-ghost flex items-center gap-1 text-xs disabled:opacity-30"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            Previous
          </button>

          {/* Page numbers */}
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(pagination.totalPages, 5) }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                  currentPage === page
                    ? "bg-accent-500/15 text-accent-400 border border-accent-500/20"
                    : "text-zinc-500 hover:text-white hover:bg-white/[0.04]"
                }`}
              >
                {page}
              </button>
            ))}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(pagination.totalPages, p + 1))}
            disabled={currentPage === pagination.totalPages}
            className="btn-ghost flex items-center gap-1 text-xs disabled:opacity-30"
          >
            Next
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
