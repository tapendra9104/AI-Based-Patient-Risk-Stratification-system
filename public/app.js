const form = document.getElementById("assessmentForm");
const resultBox = document.getElementById("latestResult");
const historyTableBody = document.querySelector("#historyTable tbody");
const benchmarkTableBody = document.querySelector("#benchmarkTable tbody");
const datasetMeta = document.getElementById("datasetMeta");
const apiUrlInput = document.getElementById("apiUrl");
const apiKeyInput = document.getElementById("apiKey");
const summaryTotal = document.getElementById("summaryTotal");
const summaryHighRisk = document.getElementById("summaryHighRisk");
const summaryIcuLikely = document.getElementById("summaryIcuLikely");
const summaryAverageRisk = document.getElementById("summaryAverageRisk");
const summaryWindowMeta = document.getElementById("summaryWindowMeta");
const recentHighRiskList = document.getElementById("recentHighRiskList");
const exportCsvButton = document.getElementById("exportCsvButton");
const simulateButton = document.getElementById("simulateButton");
const batchForm = document.getElementById("batchForm");
const batchPayloadInput = document.getElementById("batchPayload");
const batchResult = document.getElementById("batchResult");
const simulationResult = document.getElementById("simulationResult");
const timelinePatientIdInput = document.getElementById("timelinePatientId");
const timelineSearchButton = document.getElementById("timelineSearchButton");
const patientTrendSummary = document.getElementById("patientTrendSummary");
const modelInsights = document.getElementById("modelInsights");
const auditFeed = document.getElementById("auditFeed");
const serviceStatusBadge = document.getElementById("serviceStatusBadge");
const modelStatusText = document.getElementById("modelStatusText");
const liveClockText = document.getElementById("liveClockText");
const lastRefreshText = document.getElementById("lastRefreshText");
const connectionSummary = document.getElementById("connectionSummary");
const historyMeta = document.getElementById("historyMeta");
const historySyncText = document.getElementById("historySyncText");
const historyRefreshButton = document.getElementById("historyRefreshButton");

let riskChart;
let accuracyChart;
let patientTrendChart;
let liveRefreshTimerId = 0;
let historyRefreshTimerId = 0;
let historyRefreshInFlight = false;
let historyItemsCache = [];
let historyRenderSignature = "";
let operationalSummarySignature = "";
let auditFeedSignature = "";
let patientTrendSignature = "";

const storageKeys = { apiUrl: "patientRisk.apiUrl", apiKey: "patientRisk.apiKey" };
const DEFAULT_LOCAL_API_KEY = "demo-admin-key";
const RISK_COLORS = { LOW: "#2f9466", MEDIUM: "#d58a00", HIGH: "#c9402d" };
const HISTORY_PAGE_SIZE = 250;
const HISTORY_REFRESH_INTERVAL_MS = 5000;
const LIVE_REFRESH_INTERVAL_MS = 15000;
const LOCAL_TIMEZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
const LOCAL_DATE_TIME_OPTIONS = {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
};
const LOCAL_CLOCK_OPTIONS = {
  weekday: "short",
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZoneName: "short",
};
const LOCAL_CHART_LABEL_OPTIONS = {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
};

function getDefaultApiBase() {
  if (window.location.protocol === "file:") {
    return "http://127.0.0.1:5000/api";
  }

  const isLocalStaticServer = ["127.0.0.1", "localhost"].includes(window.location.hostname)
    && window.location.port === "5500";
  if (isLocalStaticServer) {
    return `${window.location.protocol}//${window.location.hostname}:5000/api`;
  }

  return `${window.location.origin}/api`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[character] || character));
}

function readStoredValue(key) {
  const value = window.localStorage.getItem(key);
  return value ? value.trim() : "";
}

function ensureApiKeyValue() {
  if (!apiKeyInput.value.trim()) {
    apiKeyInput.value = DEFAULT_LOCAL_API_KEY;
  }
}

const storedApiUrl = readStoredValue(storageKeys.apiUrl);
const storedApiKey = readStoredValue(storageKeys.apiKey);
if (storedApiUrl) {
  apiUrlInput.value = storedApiUrl;
} else {
  apiUrlInput.value = getDefaultApiBase();
}
if (storedApiKey) {
  apiKeyInput.value = storedApiKey;
}
ensureApiKeyValue();

function getApiBase() {
  return apiUrlInput.value.trim().replace(/\/$/, "");
}

function persistConnectionSettings() {
  const apiUrl = apiUrlInput.value.trim();
  const apiKey = apiKeyInput.value.trim() || DEFAULT_LOCAL_API_KEY;
  apiUrlInput.value = apiUrl;
  apiKeyInput.value = apiKey;
  if (apiUrl) {
    window.localStorage.setItem(storageKeys.apiUrl, apiUrl);
  } else {
    window.localStorage.removeItem(storageKeys.apiUrl);
  }
  if (apiKey) {
    window.localStorage.setItem(storageKeys.apiKey, apiKey);
  } else {
    window.localStorage.removeItem(storageKeys.apiKey);
  }
}

function getRequestHeaders(asJson = false) {
  const headers = {};
  const apiKey = apiKeyInput.value.trim() || DEFAULT_LOCAL_API_KEY;
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }
  if (asJson) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
}

async function parseJsonResponse(response, fallbackMessage) {
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || fallbackMessage);
  }
  return payload;
}

function riskClass(level) {
  return level === "HIGH" ? "risk-high" : level === "MEDIUM" ? "risk-medium" : "risk-low";
}

function severityClass(level) {
  return level === "severe" ? "severity-severe" : level === "moderate" ? "severity-moderate" : "severity-watch";
}

function triageClass(priority) {
  if (priority === "Immediate") return "triage-immediate";
  if (priority === "Urgent") return "triage-urgent";
  if (priority === "Priority") return "triage-priority";
  return "triage-routine";
}

function deltaClass(value) {
  if (!Number.isFinite(Number(value)) || Number(value) === 0) return "delta-neutral";
  return Number(value) < 0 ? "delta-good" : "delta-bad";
}

function toBoolean(value) {
  return String(value).toLowerCase() === "true";
}

function formatRiskScore(value) {
  return Number.isFinite(Number(value)) ? Number(value).toFixed(4) : "-";
}

function formatPercent(value) {
  return Number.isFinite(Number(value)) ? `${(Number(value) * 100).toFixed(1)}%` : "-";
}

function formatDate(value) {
  const date = parseApiDate(value);
  return formatLocalDateTime(date, LOCAL_DATE_TIME_OPTIONS, String(value || "-"));
}

function formatAbsoluteDateTime(value) {
  return formatDate(value);
}

function formatRelativeTime(value) {
  const date = parseApiDate(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffSeconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (diffSeconds < 10) return "just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
}

function buildLiveTimestampMarkup(value) {
  return `
    <div class="history-time-absolute">${escapeHtml(formatAbsoluteDateTime(value))}</div>
    <div class="history-time-relative">${escapeHtml(formatRelativeTime(value))}</div>
  `;
}

function formatLiveClock(value) {
  return formatLocalDateTime(value, LOCAL_CLOCK_OPTIONS);
}

function formatChartLabel(value) {
  const date = parseApiDate(value);
  return formatLocalDateTime(date, LOCAL_CHART_LABEL_OPTIONS, String(value));
}

function parseApiDate(value) {
  if (value instanceof Date) {
    return value;
  }

  const rawValue = String(value || "").trim();
  if (!rawValue) {
    return new Date(Number.NaN);
  }

  let normalizedValue = rawValue.replace(" ", "T");
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(normalizedValue)) {
    normalizedValue = `${normalizedValue}Z`;
  }
  return new Date(normalizedValue);
}

function formatLocalDateTime(date, options = LOCAL_DATE_TIME_OPTIONS, fallbackValue = "-") {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return String(fallbackValue || "-");
  }
  return date.toLocaleString([], options);
}

function humanizeKey(value) {
  return String(value).replace(/_/g, " ").replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildPayload(formData) {
  return {
    patient_id: formData.get("patient_id"),
    age: Number(formData.get("age")),
    systolic_bp: Number(formData.get("systolic_bp")),
    diastolic_bp: Number(formData.get("diastolic_bp")),
    heart_rate: Number(formData.get("heart_rate")),
    oxygen_level: Number(formData.get("oxygen_level")),
    cholesterol: Number(formData.get("cholesterol")),
    respiratory_rate: Number(formData.get("respiratory_rate")),
    temperature: Number(formData.get("temperature")),
    lactate: Number(formData.get("lactate")),
    sepsis_indicator: Number(formData.get("sepsis_indicator")),
    stress_level: Number(formData.get("stress_level")),
    diabetes: toBoolean(formData.get("diabetes")),
    prior_heart_disease: toBoolean(formData.get("prior_heart_disease")),
    chronic_kidney_disease: toBoolean(formData.get("chronic_kidney_disease")),
    smoker: toBoolean(formData.get("smoker")),
  };
}

function placeholderList(message) {
  return `<li class="placeholder">${escapeHtml(message)}</li>`;
}

function setPanelPlaceholder(element, title, message) {
  element.innerHTML = `<h2>${escapeHtml(title)}</h2><div class="placeholder">${escapeHtml(message)}</div>`;
}

function setServiceStatus(status, label, modelMessage) {
  serviceStatusBadge.className = `status-pill ${status}`;
  serviceStatusBadge.textContent = label;
  modelStatusText.textContent = modelMessage;
}

function setConnectionSummary(mode, message, lastSync = "") {
  const pill = connectionSummary?.parentElement;
  if (pill) {
    pill.classList.remove("connection-online", "connection-degraded", "connection-offline");
    pill.classList.add(mode);
  }
  connectionSummary.textContent = message;
  if (lastSync) {
    lastRefreshText.textContent = lastSync;
  }
}

function setHistorySyncStatus(message) {
  historySyncText.textContent = message;
}

function alertClass(level) {
  if (level === "critical") return "care-alert-critical";
  if (level === "elevated") return "care-alert-elevated";
  return "care-alert-watch";
}

function renderDoctorEntry(label, doctor) {
  if (!doctor?.name) {
    return `<article class="doctor-entry"><strong>${escapeHtml(label)}</strong><div class="placeholder">No doctor assigned.</div></article>`;
  }

  return `
    <article class="doctor-entry">
      <span class="doctor-role">${escapeHtml(label)}</span>
      <h4>${escapeHtml(doctor.name)}</h4>
      <p class="doctor-specialization">${escapeHtml(doctor.specialization || "-")}</p>
      <div class="contact-line"><span class="contact-label">Department</span><span>${escapeHtml(doctor.department || "-")}</span></div>
      <div class="contact-line"><span class="contact-label">Phone</span><span class="mono">${escapeHtml(doctor.phone || "-")}</span></div>
      <div class="contact-line"><span class="contact-label">Email</span><span>${escapeHtml(doctor.email || "-")}</span></div>
      <div class="contact-line"><span class="contact-label">Availability</span><span>${escapeHtml(doctor.availability || "-")}</span></div>
    </article>
  `;
}

function renderResult(data) {
  const factors = (data.explanation || []).map((item) => `
    <li><strong>${escapeHtml(item.feature)}</strong> <span class="mono">${escapeHtml(String(item.value))}</span><div>Impact ${escapeHtml(String(item.impact))}</div></li>
  `).join("");
  const findings = (data.abnormal_findings || []).map((item) => `
    <li>
      <span class="finding-severity ${severityClass(item.severity)}">${escapeHtml(item.severity)}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <div class="mono">${escapeHtml(humanizeKey(item.feature))}: ${escapeHtml(String(item.value))}</div>
      <div>${escapeHtml(item.reason)}</div>
    </li>
  `).join("");
  const actions = (data.recommended_actions || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const conditions = Object.entries(data.predicted_conditions || {}).sort((a, b) => Number(b[1]) - Number(a[1])).map(([name, value]) => `
    <li><strong>${escapeHtml(humanizeKey(name))}</strong> <span class="mono">${formatPercent(value)}</span></li>
  `).join("");
  const doctorRecommendation = data.doctor_recommendation || {};
  const doctorAlert = doctorRecommendation.alert?.visible ? `
    <div class="care-alert ${alertClass(doctorRecommendation.alert?.level)}">
      <div>
        <strong>${escapeHtml(doctorRecommendation.alert?.title || "Clinical alert")}</strong>
        <p>${escapeHtml(doctorRecommendation.alert?.message || "Clinical contact recommended.")}</p>
      </div>
      <span class="risk-badge risk-high">${escapeHtml(data.risk_level || "HIGH")}</span>
    </div>
  ` : "";

  resultBox.innerHTML = `
    <h2>Latest Prediction</h2>
    <div class="status-row">
      <div class="summary-copy">
        <strong>${escapeHtml(data.patient_id)}</strong>
        <div>${escapeHtml(data.clinical_summary || "No clinical summary returned.")}</div>
      </div>
      <span class="triage-chip ${triageClass(data.triage?.priority)}">${escapeHtml(data.triage?.priority || "Routine")}</span>
    </div>
    ${doctorAlert}
    <div class="detail-strip">
      <div class="detail-card"><span>Risk Level</span><strong><span class="risk-badge ${riskClass(data.risk_level)}">${escapeHtml(data.risk_level)}</span></strong></div>
      <div class="detail-card"><span>Risk Score</span><strong class="mono">${formatRiskScore(data.risk_score)}</strong></div>
      <div class="detail-card"><span>Response Target</span><strong>${escapeHtml(`${data.triage?.target_response_minutes ?? "-"} minutes`)}</strong></div>
    </div>
    <div class="detail-strip">
      <div class="detail-card"><span>Recommended Unit</span><strong>${escapeHtml(data.triage?.recommended_unit || "-")}</strong></div>
      <div class="detail-card"><span>Observation Frequency</span><strong>${escapeHtml(`${data.triage?.observation_frequency_minutes ?? "-"} minutes`)}</strong></div>
      <div class="detail-card"><span>Alert / ICU</span><strong>${data.alert_sent ? "Alert sent" : "No alert"} / ${data.icu_within_24h ? "ICU likely" : "ICU not likely"}</strong></div>
    </div>
    <div class="result-grid">
      <div class="result-card doctor-card">
        <h3>Recommended Doctor Contact</h3>
        <p class="doctor-note">${escapeHtml(doctorRecommendation.reason || "No doctor recommendation returned.")}</p>
        <div class="doctor-stack">
          ${renderDoctorEntry("Best match", doctorRecommendation.best_match)}
          ${renderDoctorEntry("Backup contact", doctorRecommendation.backup_match)}
        </div>
      </div>
      <div class="result-card"><h3>Top Risk Factors</h3><ul class="signal-list">${factors || placeholderList("No factors returned.")}</ul></div>
      <div class="result-card"><h3>Abnormal Findings</h3><ul class="signal-list">${findings || placeholderList("No abnormal findings flagged.")}</ul></div>
      <div class="result-card"><h3>Recommended Actions</h3><ul class="signal-list">${actions || placeholderList("No actions returned.")}</ul></div>
      <div class="result-card"><h3>Predicted Condition Signals</h3><ul class="signal-list">${conditions || placeholderList("No condition scores returned.")}</ul></div>
    </div>
  `;
}

function renderTable(items, totalCount = items.length) {
  if (!items.length) {
    historyMeta.textContent = "No stored assessments yet. Live refresh is active.";
    historyTableBody.innerHTML = `<tr><td colspan="6" class="placeholder">No patient assessments have been stored yet.</td></tr>`;
    return;
  }

  historyMeta.textContent = `Showing all ${totalCount} stored assessments. Background ledger sync checks every 5 seconds without reloading the page. Scroll in this panel to review older records.`;

  historyTableBody.innerHTML = items.map((row) => `
    <tr>
      <td class="history-time-cell live-timestamp" data-live-timestamp="${escapeHtml(String(row.created_at || ""))}">${buildLiveTimestampMarkup(row.created_at)}</td>
      <td>${escapeHtml(row.patient_id)}</td>
      <td class="mono">${formatRiskScore(row.risk_score)}</td>
      <td><span class="risk-badge ${riskClass(row.risk_level)}">${escapeHtml(row.risk_level)}</span></td>
      <td>${row.icu_within_24h ? "Yes" : "No"}</td>
      <td>${row.alert_sent ? "Yes" : "No"}</td>
    </tr>
  `).join("");
}

function normalizeHistoryRow(item) {
  return {
    id: item.id ?? item.assessment_id ?? `${item.patient_id}-${item.created_at ?? Date.now()}`,
    created_at: item.created_at ?? new Date().toISOString(),
    patient_id: item.patient_id ?? "-",
    risk_score: item.risk_score ?? 0,
    risk_level: item.risk_level ?? "LOW",
    icu_within_24h: Boolean(item.icu_within_24h),
    alert_sent: Boolean(item.alert_sent),
  };
}

function buildHistorySignature(items, totalCount = items.length) {
  return JSON.stringify({
    totalCount,
    items: items.map((item) => ({
      id: item.id,
      created_at: item.created_at,
      patient_id: item.patient_id,
      risk_score: item.risk_score,
      risk_level: item.risk_level,
      icu_within_24h: item.icu_within_24h,
      alert_sent: item.alert_sent,
    })),
  });
}

function buildOperationalSummarySignature(summary) {
  return JSON.stringify({
    assessment_count: summary.assessment_count ?? 0,
    high_risk_count: summary.high_risk_count ?? 0,
    icu_likely_count: summary.icu_likely_count ?? 0,
    average_risk_score: summary.average_risk_score ?? 0,
    window_limit: summary.window?.assessment_limit ?? null,
    recent_high_risk: (summary.recent_high_risk || []).map((item) => ({
      patient_id: item.patient_id,
      risk_score: item.risk_score,
      created_at: item.created_at,
      icu_within_24h: item.icu_within_24h,
    })),
  });
}

function buildAuditFeedSignature(payload) {
  return JSON.stringify(
    (payload.items || []).map((item) => ({
      action: item.action,
      actor_role: item.actor_role,
      resource_type: item.resource_type,
      resource_id: item.resource_id,
      status_code: item.status_code,
      created_at: item.created_at,
    }))
  );
}

function buildPatientTrendSignature(payload) {
  return JSON.stringify({
    patient_id: payload.patient_id ?? "",
    average_risk_score: payload.average_risk_score ?? null,
    trajectory: {
      requires_attention: payload.trajectory?.requires_attention ?? false,
      direction: payload.trajectory?.direction ?? "",
      consecutive_high_risk: payload.trajectory?.consecutive_high_risk ?? 0,
      delta_from_previous: payload.trajectory?.delta_from_previous ?? null,
    },
    latest_assessment: payload.latest_assessment
      ? {
          created_at: payload.latest_assessment.created_at,
          risk_level: payload.latest_assessment.risk_level,
          risk_score: payload.latest_assessment.risk_score,
        }
      : null,
    items: (payload.items || []).map((item) => ({
      created_at: item.created_at,
      risk_level: item.risk_level,
      risk_score: item.risk_score,
      trend_direction: item.trend_direction,
    })),
  });
}

function mergeHistoryItems(items, totalCount = items.length) {
  const normalizedItems = items.map(normalizeHistoryRow);
  const signature = buildHistorySignature(normalizedItems, totalCount);
  historyItemsCache = normalizedItems;
  if (signature === historyRenderSignature) {
    return false;
  }
  historyRenderSignature = signature;
  renderTable(historyItemsCache, totalCount);
  renderChart(historyItemsCache);
  return true;
}

function prependHistoryItem(item) {
  const normalized = normalizeHistoryRow(item);
  historyItemsCache = [
    normalized,
    ...historyItemsCache.filter((existing) => String(existing.id) !== String(normalized.id)),
  ].sort((left, right) => parseApiDate(right.created_at).getTime() - parseApiDate(left.created_at).getTime());
  historyRenderSignature = buildHistorySignature(historyItemsCache, historyItemsCache.length);
  renderTable(historyItemsCache, historyItemsCache.length);
  renderChart(historyItemsCache);
  setHistorySyncStatus(`Ledger updated ${formatDate(new Date().toISOString())}`);
}

function renderChart(items) {
  const canvas = document.getElementById("riskChart");
  if (typeof Chart === "undefined") {
    canvas.setAttribute("aria-label", "Chart library unavailable");
    return;
  }

  const counts = { LOW: 0, MEDIUM: 0, HIGH: 0 };
  items.forEach((item) => {
    counts[item.risk_level] = (counts[item.risk_level] || 0) + 1;
  });
  if (riskChart) riskChart.destroy();
  riskChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Low", "Medium", "High"],
      datasets: [{ data: [counts.LOW, counts.MEDIUM, counts.HIGH], backgroundColor: [RISK_COLORS.LOW, RISK_COLORS.MEDIUM, RISK_COLORS.HIGH], borderWidth: 0 }],
    },
    options: { cutout: "68%", plugins: { legend: { position: "bottom" } } },
  });
}

function renderBenchmarkTable(models) {
  if (!models.length) {
    benchmarkTableBody.innerHTML = `<tr><td colspan="6" class="placeholder">No benchmark models available.</td></tr>`;
    return;
  }

  benchmarkTableBody.innerHTML = models.map((model) => `
    <tr>
      <td>${escapeHtml(model.name)}</td>
      <td class="mono">${escapeHtml(String(model.mean_metrics.accuracy))}</td>
      <td class="mono">${escapeHtml(String(model.mean_metrics.precision))}</td>
      <td class="mono">${escapeHtml(String(model.mean_metrics.recall))}</td>
      <td class="mono">${escapeHtml(String(model.mean_metrics.f1_score))}</td>
      <td class="mono">${escapeHtml(String(model.mean_metrics.roc_auc))}</td>
    </tr>
  `).join("");
}

function renderAccuracyChart(folds, models) {
  const canvas = document.getElementById("accuracyChart");
  if (typeof Chart === "undefined") {
    canvas.setAttribute("aria-label", "Chart library unavailable");
    return;
  }
  if (accuracyChart) accuracyChart.destroy();
  if (!folds.length || !models.length) return;

  const colors = ["#0f9c8c", "#0b4f8a", "#c75b00", "#873260"];
  accuracyChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: folds.map((fold) => `Fold ${fold}`),
      datasets: models.map((model, index) => ({
        label: model.name,
        data: model.accuracy_by_fold,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        tension: 0.3,
        fill: false,
        pointRadius: 4,
      })),
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { min: 0.7, max: 1.0 } } },
  });
}

function renderOperationalSummary(summary) {
  summaryTotal.textContent = String(summary.assessment_count ?? 0);
  summaryHighRisk.textContent = `${summary.high_risk_count ?? 0} / ${summary.assessment_count ?? 0}`;
  summaryIcuLikely.textContent = String(summary.icu_likely_count ?? 0);
  summaryAverageRisk.textContent = formatPercent(summary.average_risk_score ?? 0);
  summaryWindowMeta.textContent = `Window: last ${summary.window?.assessment_limit ?? "-"} assessments`;
  const items = summary.recent_high_risk || [];
  recentHighRiskList.innerHTML = items.length
    ? items.map((item) => `
      <li>
        <strong>${escapeHtml(item.patient_id)}</strong>
        <span class="signal-inline"><span class="risk-badge risk-high">HIGH</span><span class="mono">${formatRiskScore(item.risk_score)}</span></span>
        <div>${item.icu_within_24h ? "ICU likely" : "Monitor closely"} at ${escapeHtml(formatDate(item.created_at))}</div>
      </li>
    `).join("")
    : placeholderList("No high-risk patients in the current summary window.");
}

function syncOperationalSummary(summary) {
  const signature = buildOperationalSummarySignature(summary);
  if (signature === operationalSummarySignature) {
    return false;
  }
  operationalSummarySignature = signature;
  renderOperationalSummary(summary);
  return true;
}

function renderOperationalSummaryPlaceholder(message) {
  summaryTotal.textContent = "-";
  summaryHighRisk.textContent = "-";
  summaryIcuLikely.textContent = "-";
  summaryAverageRisk.textContent = "-";
  summaryWindowMeta.textContent = "Window: last - assessments";
  recentHighRiskList.innerHTML = placeholderList(message);
}

function renderPatientTrendChart(items) {
  const canvas = document.getElementById("patientTrendChart");
  if (typeof Chart === "undefined") {
    canvas.setAttribute("aria-label", "Chart library unavailable");
    return;
  }
  if (patientTrendChart) patientTrendChart.destroy();
  if (!items.length) return;

  patientTrendChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: items.map((item) => formatChartLabel(item.created_at)),
      datasets: [{
        label: "Risk score",
        data: items.map((item) => item.risk_score),
        borderColor: "#0b4f8a",
        backgroundColor: "rgba(11, 79, 138, 0.15)",
        fill: true,
        tension: 0.25,
        pointRadius: 4,
        pointBackgroundColor: items.map((item) => RISK_COLORS[item.risk_level] || "#0b4f8a"),
      }],
    },
    options: { responsive: true, plugins: { legend: { position: "bottom" } }, scales: { y: { min: 0, max: 1 } } },
  });
}

function renderTimelineSummary(payload) {
  const latest = payload.latest_assessment;
  const trajectory = payload.trajectory || {};
  const recentItems = [...(payload.items || [])].reverse().slice(0, 4);

  patientTrendSummary.innerHTML = `
    <h2>Patient Trend Summary</h2>
    <div class="trend-summary">
      <div class="trend-topline">
        <div>
          <strong>${escapeHtml(payload.patient_id)}</strong>
          <div class="live-timestamp trend-time" data-live-timestamp="${escapeHtml(String(latest?.created_at || ""))}">${latest?.created_at ? buildLiveTimestampMarkup(latest.created_at) : ""}</div>
          <div class="trend-note">${trajectory.requires_attention ? "Latest assessment still needs clinician attention." : "Latest assessment is not currently in the highest alert state."}</div>
        </div>
        <span class="risk-badge ${riskClass(latest?.risk_level || "LOW")}">${escapeHtml(latest?.risk_level || "N/A")}</span>
      </div>
      <div class="trend-kpis">
        <div class="detail-card"><span>Latest Score</span><strong class="mono">${formatRiskScore(latest?.risk_score)}</strong></div>
        <div class="detail-card"><span>Average Score</span><strong class="mono">${formatRiskScore(payload.average_risk_score)}</strong></div>
        <div class="detail-card"><span>Direction</span><strong>${escapeHtml(trajectory.direction || "baseline")}</strong></div>
        <div class="detail-card"><span>Consecutive High Risk</span><strong>${escapeHtml(String(trajectory.consecutive_high_risk ?? 0))}</strong></div>
      </div>
      <p class="trend-note">Delta from previous assessment: <span class="mono">${escapeHtml(trajectory.delta_from_previous == null ? "-" : String(trajectory.delta_from_previous))}</span></p>
      <ul class="signal-list">
        ${recentItems.length ? recentItems.map((item) => `
          <li>
            <div class="live-timestamp trend-event-time" data-live-timestamp="${escapeHtml(String(item.created_at || ""))}">${buildLiveTimestampMarkup(item.created_at)}</div>
            <div><span class="risk-badge ${riskClass(item.risk_level)}">${escapeHtml(item.risk_level)}</span> <span class="mono">${formatRiskScore(item.risk_score)}</span> <span>${escapeHtml(item.trend_direction)}</span></div>
          </li>
        `).join("") : placeholderList("No recent patient events found.")}
      </ul>
    </div>
  `;
}

function syncPatientTimeline(payload) {
  const signature = buildPatientTrendSignature(payload);
  if (signature === patientTrendSignature) {
    return false;
  }
  patientTrendSignature = signature;
  renderPatientTrendChart(payload.items || []);
  renderTimelineSummary(payload);
  return true;
}

function renderTimelinePlaceholder(message) {
  if (patientTrendChart) {
    patientTrendChart.destroy();
    patientTrendChart = null;
  }
  setPanelPlaceholder(patientTrendSummary, "Patient Trend Summary", message);
}

function renderBatchResult(payload) {
  const createdMarkup = (payload.items || []).length
    ? payload.items.map((item) => `
      <li>
        <strong>${escapeHtml(item.patient_id)}</strong>
        <div><span class="risk-badge ${riskClass(item.risk_level)}">${escapeHtml(item.risk_level)}</span> <span class="mono">${formatRiskScore(item.risk_score)}</span></div>
      </li>
    `).join("")
    : placeholderList("No assessments were created.");
  const errorMarkup = (payload.errors || []).length
    ? payload.errors.map((item) => `
      <li><strong>${escapeHtml(item.patient_id || `Item ${item.index + 1}`)}</strong><div>${escapeHtml(item.error)}</div></li>
    `).join("")
    : placeholderList("No validation errors.");

  batchResult.innerHTML = `
    <h3>Batch Outcome</h3>
    <div class="mini-kpi-row">
      <span class="mini-kpi">Requested ${escapeHtml(String(payload.requested_count))}</span>
      <span class="mini-kpi">Created ${escapeHtml(String(payload.created_count))}</span>
      <span class="mini-kpi">Errors ${escapeHtml(String(payload.error_count))}</span>
    </div>
    <div class="result-grid">
      <div class="result-card"><h3>Created Items</h3><ul class="signal-list">${createdMarkup}</ul></div>
      <div class="result-card"><h3>Validation Errors</h3><ul class="signal-list">${errorMarkup}</ul></div>
    </div>
  `;
}

function renderSimulationResult(payload) {
  const baselineDoctor = payload.baseline?.doctor_recommendation || {};
  simulationResult.innerHTML = `
    <h2>What-If Scenario Planner</h2>
    <div class="mini-kpi-row">
      <span class="mini-kpi">Baseline ${escapeHtml(payload.baseline?.risk_level || "-")}</span>
      <span class="mini-kpi mono">${formatRiskScore(payload.baseline?.risk_score)}</span>
      <span class="mini-kpi">${escapeHtml(payload.baseline?.triage?.priority || "Routine")}</span>
    </div>
    <p class="trend-note">${escapeHtml(payload.baseline?.clinical_summary || "Scenario planning compares the current patient profile against intervention assumptions.")}</p>
    <p class="doctor-note">${escapeHtml(baselineDoctor.best_match?.name || "No doctor recommendation available.")}${baselineDoctor.best_match?.specialization ? ` / ${escapeHtml(baselineDoctor.best_match.specialization)}` : ""}</p>
    <div class="scenario-grid">
      ${(payload.scenarios || []).length ? payload.scenarios.map((scenario) => `
        <article class="scenario-card">
          <h3>${escapeHtml(scenario.label)}</h3>
          <div><span class="risk-badge ${riskClass(scenario.risk_level)}">${escapeHtml(scenario.risk_level)}</span> <span class="mono">${formatRiskScore(scenario.risk_score)}</span></div>
          <div class="scenario-delta ${deltaClass(scenario.score_delta)}">Delta ${escapeHtml(String(scenario.score_delta))}</div>
          <p>${escapeHtml(scenario.clinical_summary || "")}</p>
          <p class="doctor-note">Best doctor: ${escapeHtml(scenario.doctor_recommendation?.best_match?.name || "-")} / ${escapeHtml(scenario.doctor_recommendation?.best_match?.specialization || "-")}</p>
        </article>
      `).join("") : `<div class="placeholder">No scenarios returned.</div>`}
    </div>
  `;
}

function renderModelInsights(payload) {
  const metrics = Object.entries(payload.metrics || {}).map(([name, value]) => `
    <span class="mini-kpi">${escapeHtml(humanizeKey(name))}: <span class="mono">${escapeHtml(String(value))}</span></span>
  `).join("");
  const rows = (payload.feature_importances || []).map((item) => `
    <article class="insight-row">
      <h3>${escapeHtml(item.feature)}</h3>
      <div class="mini-kpi-row">
        <span class="mini-kpi">Importance <span class="mono">${escapeHtml(String(item.importance))}</span></span>
        <span class="mini-kpi">Baseline <span class="mono">${escapeHtml(String(item.baseline))}</span></span>
        <span class="mini-kpi">${escapeHtml(humanizeKey(item.direction))}</span>
      </div>
    </article>
  `).join("");

  modelInsights.innerHTML = `
    <h2>Model Governance</h2>
    <p class="trend-note">${escapeHtml(payload.classifier || "Model")} trained on ${escapeHtml(String(payload.dataset_size ?? "-"))} synthetic records at ${escapeHtml(formatDate(payload.trained_at))}.</p>
    <div class="mini-kpi-row">
      <span class="mini-kpi">Low threshold <span class="mono">${escapeHtml(String(payload.thresholds?.low ?? "-"))}</span></span>
      <span class="mini-kpi">High threshold <span class="mono">${escapeHtml(String(payload.thresholds?.high ?? "-"))}</span></span>
      <span class="mini-kpi">Features ${escapeHtml(String(payload.feature_count ?? "-"))}</span>
    </div>
    <div class="mini-kpi-row">${metrics}</div>
    <div class="insight-list">${rows || `<div class="placeholder">No feature importances returned.</div>`}</div>
  `;
}

function renderAuditFeed(payload) {
  auditFeed.innerHTML = `
    <h2>Audit Activity</h2>
    <div class="audit-list">
      ${(payload.items || []).length ? payload.items.map((item) => `
        <article class="audit-row">
          <strong>${escapeHtml(item.action)}</strong>
          <p>${escapeHtml(item.actor_role)} / ${escapeHtml(item.resource_type)}</p>
          <div class="audit-time-row">
            <div class="live-timestamp audit-timestamp" data-live-timestamp="${escapeHtml(String(item.created_at || ""))}">${buildLiveTimestampMarkup(item.created_at)}</div>
            <p>status ${escapeHtml(String(item.status_code))}</p>
          </div>
          <p>${escapeHtml(item.resource_id || "No resource id")}</p>
        </article>
      `).join("") : `<div class="placeholder">No audit events returned.</div>`}
    </div>
  `;
}

function syncAuditFeed(payload) {
  const signature = buildAuditFeedSignature(payload);
  if (signature === auditFeedSignature) {
    return false;
  }
  auditFeedSignature = signature;
  renderAuditFeed(payload);
  return true;
}

function renderBatchPlaceholder(message) {
  batchResult.innerHTML = `<div class="placeholder">${escapeHtml(message)}</div>`;
}

function renderSimulationPlaceholder(message) {
  setPanelPlaceholder(simulationResult, "What-If Scenario Planner", message);
}

function updateLiveClock() {
  liveClockText.textContent = `Local time (${LOCAL_TIMEZONE}): ${formatLiveClock(new Date())}`;
  refreshLiveTimestamps();
}

function refreshLiveTimestamps() {
  document.querySelectorAll(".live-timestamp").forEach((cell) => {
    const createdAt = cell.getAttribute("data-live-timestamp") || "";
    if (!createdAt) return;
    cell.innerHTML = buildLiveTimestampMarkup(createdAt);
  });
}

function startHistoryRefresh() {
  if (historyRefreshTimerId) {
    window.clearInterval(historyRefreshTimerId);
  }
  historyRefreshTimerId = window.setInterval(() => {
    loadHistory().catch(() => {});
  }, HISTORY_REFRESH_INTERVAL_MS);
}

function startLiveRefresh() {
  if (liveRefreshTimerId) {
    window.clearInterval(liveRefreshTimerId);
  }
  liveRefreshTimerId = window.setInterval(() => {
    refreshLivePanels().catch(() => {});
  }, LIVE_REFRESH_INTERVAL_MS);
}

function buildScenarios(payload) {
  return [
    { label: "Oxygen support", overrides: { oxygen_level: Math.min(100, payload.oxygen_level + 6), respiratory_rate: Math.max(14, payload.respiratory_rate - 4), stress_level: Math.max(0, payload.stress_level - 1.1) } },
    { label: "Sepsis bundle response", overrides: { temperature: Math.max(36.9, payload.temperature - 0.9), lactate: Math.max(0.8, payload.lactate - 1.1), sepsis_indicator: Math.max(0, payload.sepsis_indicator - 0.28), respiratory_rate: Math.max(14, payload.respiratory_rate - 3), stress_level: Math.max(0, payload.stress_level - 1.0) } },
    { label: "Cardio stabilization", overrides: { systolic_bp: Math.max(112, payload.systolic_bp - 18), diastolic_bp: Math.max(68, payload.diastolic_bp - 10), heart_rate: Math.max(62, payload.heart_rate - 18), oxygen_level: Math.max(payload.oxygen_level, 94), stress_level: Math.max(0, payload.stress_level - 1.2) } },
    { label: "Combined stabilization", overrides: { oxygen_level: Math.min(100, payload.oxygen_level + 7), respiratory_rate: Math.max(14, payload.respiratory_rate - 5), temperature: Math.max(36.9, payload.temperature - 0.9), lactate: Math.max(0.8, payload.lactate - 1.2), sepsis_indicator: Math.max(0, payload.sepsis_indicator - 0.32), systolic_bp: Math.max(110, payload.systolic_bp - 16), diastolic_bp: Math.max(66, payload.diastolic_bp - 10), heart_rate: Math.max(60, payload.heart_rate - 20), stress_level: Math.max(0, payload.stress_level - 1.8) } },
  ];
}

function parseBatchPayload() {
  const parsed = JSON.parse(batchPayloadInput.value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && Array.isArray(parsed.items)) return parsed.items;
  throw new Error("Batch JSON must be an array of patient objects.");
}

function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

async function loadHistory() {
  if (historyRefreshInFlight) {
    return;
  }

  historyRefreshInFlight = true;
  setHistorySyncStatus("Syncing ledger...");

  const allItems = [];
  let offset = 0;
  let totalCount = 0;

  try {
    while (offset === 0 || allItems.length < totalCount) {
      const response = await fetch(`${getApiBase()}/patients?limit=${HISTORY_PAGE_SIZE}&offset=${offset}`, { headers: getRequestHeaders() });
      const payload = await parseJsonResponse(response, "Could not load patient history");
      const items = payload.items || [];
      totalCount = Number(payload.total_count ?? items.length);
      allItems.push(...items);
      if (!items.length || items.length < HISTORY_PAGE_SIZE) break;
      offset += items.length;
    }

    const didUpdate = mergeHistoryItems(allItems, totalCount || allItems.length);
    setHistorySyncStatus(
      didUpdate
        ? `Ledger updated ${formatDate(new Date().toISOString())}`
        : `Ledger checked ${formatDate(new Date().toISOString())} - no new records`
    );
  } catch (error) {
    setHistorySyncStatus(`Ledger sync failed: ${error.message}`);
    throw error;
  } finally {
    historyRefreshInFlight = false;
  }
}

async function loadBenchmark() {
  const response = await fetch(`${getApiBase()}/metrics/benchmark`, { headers: getRequestHeaders() });
  const payload = await parseJsonResponse(response, "Could not load benchmark metrics");
  datasetMeta.textContent = `${payload.dataset?.name || "Dataset"} (${payload.dataset?.rows || "-"} rows, ${payload.dataset?.features || "-"} features)`;
  renderBenchmarkTable(payload.models || []);
  renderAccuracyChart(payload.folds || [], payload.models || []);
}

async function loadOperationalSummary() {
  const response = await fetch(`${getApiBase()}/patients/summary?limit=50`, { headers: getRequestHeaders() });
  return syncOperationalSummary(await parseJsonResponse(response, "Could not load patient summary"));
}

async function loadHealthStatus() {
  const response = await fetch(`${getApiBase()}/health/ready`, { headers: getRequestHeaders() });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok && response.status !== 503) {
    throw new Error(payload.error || "Could not load service status");
  }
  if (payload.status === "ok") {
    setServiceStatus(
      "status-ok",
      "Service healthy",
      payload.model_trained_at ? `Model trained ${formatDate(payload.model_trained_at)}` : "Model artifact available"
    );
    setConnectionSummary(
      "connection-online",
      `${payload.service} / v${payload.version}`,
      `Last sync ${formatDate(new Date().toISOString())}`
    );
    return;
  }

  setServiceStatus(
    "status-degraded",
    "Service degraded",
    payload.model_trained_at ? `Model trained ${formatDate(payload.model_trained_at)}` : "Model artifact unavailable"
  );
  setConnectionSummary(
    "connection-degraded",
    "Backend reachable with degraded readiness",
    `Last sync ${formatDate(new Date().toISOString())}`
  );
}

async function loadModelMetrics() {
  const response = await fetch(`${getApiBase()}/metrics/model?top_n=8`, { headers: getRequestHeaders() });
  renderModelInsights(await parseJsonResponse(response, "Could not load model metrics"));
}

async function loadAuditFeed() {
  const response = await fetch(`${getApiBase()}/audit/logs?limit=8`, { headers: getRequestHeaders() });
  if (response.status === 403) {
    throw new Error("Admin API key required to view audit events.");
  }
  return syncAuditFeed(await parseJsonResponse(response, "Could not load audit events"));
}

async function loadPatientTimeline(patientId) {
  const normalizedPatientId = patientId.trim();
  if (!normalizedPatientId) {
    renderTimelinePlaceholder("Enter a patient ID to view longitudinal risk.");
    return;
  }

  timelinePatientIdInput.value = normalizedPatientId;
  const response = await fetch(`${getApiBase()}/patients/${encodeURIComponent(normalizedPatientId)}/timeline?limit=12`, { headers: getRequestHeaders() });
  const payload = await parseJsonResponse(response, "Could not load patient timeline");
  return syncPatientTimeline(payload);
}

function getDefaultTimelinePatientId() {
  return timelinePatientIdInput.value.trim() || form.querySelector('[name="patient_id"]')?.value.trim() || "";
}

async function refreshLivePanels(activePatientId = "") {
  await loadHealthStatus().catch((error) => {
    setServiceStatus("status-error", "Service offline", "Model sync unavailable");
    setConnectionSummary("connection-offline", error.message, "Waiting for backend connection");
  });

  const coreResults = await Promise.allSettled([loadHistory(), loadOperationalSummary(), loadAuditFeed()]);
  const patientId = activePatientId || getDefaultTimelinePatientId();
  if (patientId) {
    await loadPatientTimeline(patientId).catch((error) => renderTimelinePlaceholder(error.message));
  } else {
    renderTimelinePlaceholder("Enter a patient ID to view longitudinal risk.");
  }
  const failures = coreResults.filter((result) => result.status === "rejected");
  if (failures.length === coreResults.length) {
    throw failures[0].reason;
  }
}

async function refreshDashboard(activePatientId = "") {
  await refreshLivePanels(activePatientId);
  await loadBenchmark().catch((error) => {
    datasetMeta.textContent = error.message;
    renderBenchmarkTable([]);
  });
  await loadModelMetrics().catch((error) => setPanelPlaceholder(modelInsights, "Model Governance", error.message));
}

async function exportAssessmentsCsv() {
  const response = await fetch(`${getApiBase()}/patients/export.csv?limit=50`, { headers: getRequestHeaders() });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || "Could not export CSV");
  }
  downloadTextFile(await response.text(), "patient_assessments.csv", "text/csv;charset=utf-8");
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistConnectionSettings();
  const payload = buildPayload(new FormData(form));
  try {
    const response = await fetch(`${getApiBase()}/patients/assess`, {
      method: "POST",
      headers: getRequestHeaders(true),
      body: JSON.stringify(payload),
    });
    const data = await parseJsonResponse(response, "Assessment request failed");
    renderResult(data);
    prependHistoryItem(data);
    timelinePatientIdInput.value = data.patient_id;
    await refreshLivePanels(data.patient_id);
  } catch (error) {
    resultBox.innerHTML = `<h2>Latest Prediction</h2><p class="mono">Error: ${escapeHtml(error.message)}</p>`;
  }
});

simulateButton.addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  persistConnectionSettings();
  const baseline = buildPayload(new FormData(form));
  try {
    const response = await fetch(`${getApiBase()}/patients/assess/simulate`, {
      method: "POST",
      headers: getRequestHeaders(true),
      body: JSON.stringify({ baseline, scenarios: buildScenarios(baseline) }),
    });
    renderSimulationResult(await parseJsonResponse(response, "What-if simulation failed"));
  } catch (error) {
    renderSimulationPlaceholder(error.message);
  }
});

batchForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  persistConnectionSettings();
  try {
    const items = parseBatchPayload();
    const response = await fetch(`${getApiBase()}/patients/assess/batch`, {
      method: "POST",
      headers: getRequestHeaders(true),
      body: JSON.stringify({ items, stop_on_error: false }),
    });
    const payload = await parseJsonResponse(response, "Batch intake failed");
    renderBatchResult(payload);
    if (payload.created_count > 0) {
      const lastPatientId = payload.items[payload.items.length - 1]?.patient_id || "";
      if (lastPatientId) timelinePatientIdInput.value = lastPatientId;
      await refreshLivePanels(lastPatientId);
    }
  } catch (error) {
    renderBatchPlaceholder(error.message);
  }
});

timelineSearchButton.addEventListener("click", async () => {
  persistConnectionSettings();
  await loadPatientTimeline(timelinePatientIdInput.value.trim()).catch((error) => renderTimelinePlaceholder(error.message));
});

timelinePatientIdInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  persistConnectionSettings();
  await loadPatientTimeline(timelinePatientIdInput.value.trim()).catch((error) => renderTimelinePlaceholder(error.message));
});

exportCsvButton.addEventListener("click", async () => {
  persistConnectionSettings();
  await exportAssessmentsCsv().catch((error) => {
    summaryWindowMeta.textContent = `Export failed: ${error.message}`;
  });
});

historyRefreshButton.addEventListener("click", async () => {
  persistConnectionSettings();
  await loadHistory().catch(() => {});
});

function reloadDashboard() {
  persistConnectionSettings();
  refreshDashboard().catch((error) => {
    resultBox.innerHTML = `<h2>Latest Prediction</h2><p class="mono">Error: ${escapeHtml(error.message)}</p>`;
  });
}

apiUrlInput.addEventListener("change", reloadDashboard);
apiKeyInput.addEventListener("change", reloadDashboard);

renderOperationalSummaryPlaceholder("Connect the backend to load the current high-risk queue.");
renderTimelinePlaceholder("Search for a patient once assessments exist.");
renderBatchPlaceholder("Submit a batch to view created items and validation errors.");
renderSimulationPlaceholder("Use the current patient form to compare likely outcomes after common stabilization steps.");
setServiceStatus("status-pending", "Service status pending", "Model sync not loaded");
historyMeta.textContent = "Loading stored assessment history.";
setHistorySyncStatus("Ledger sync pending.");
setConnectionSummary("connection-degraded", "Connect the API to activate live operations data.", "Waiting for first backend sync.");
setPanelPlaceholder(modelInsights, "Model Governance", "Connect the backend to load thresholds and top feature importances.");
setPanelPlaceholder(auditFeed, "Audit Activity", "Connect with an admin API key to view recent audit events.");
updateLiveClock();
window.setInterval(updateLiveClock, 1000);
startHistoryRefresh();
startLiveRefresh();
window.addEventListener("focus", () => {
  loadHistory().catch(() => {});
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    loadHistory().catch(() => {});
  }
});

refreshDashboard().catch(() => {
  resultBox.innerHTML = `<h2>Latest Prediction</h2><p class="mono">Connect backend at ${escapeHtml(getApiBase())} with a valid API key and run a prediction.</p>`;
  datasetMeta.textContent = "Connect backend to load real dataset benchmark.";
  renderOperationalSummaryPlaceholder("Connect the backend to load the current high-risk queue.");
  renderTimelinePlaceholder("Search for a patient once assessments exist.");
  historyMeta.textContent = "History unavailable until the backend connects.";
  setHistorySyncStatus("Ledger sync unavailable.");
  setServiceStatus("status-error", "Service offline", "Model sync unavailable");
  setConnectionSummary("connection-offline", "Backend connection unavailable.", "Waiting for backend connection");
  setPanelPlaceholder(modelInsights, "Model Governance", "Connect the backend to load thresholds and top feature importances.");
  setPanelPlaceholder(auditFeed, "Audit Activity", "Connect with an admin API key to view recent audit events.");
});
