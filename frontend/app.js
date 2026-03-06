const form = document.getElementById("assessmentForm");
const resultBox = document.getElementById("latestResult");
const historyTableBody = document.querySelector("#historyTable tbody");
const benchmarkTableBody = document.querySelector("#benchmarkTable tbody");
const datasetMeta = document.getElementById("datasetMeta");
const apiUrlInput = document.getElementById("apiUrl");
const apiKeyInput = document.getElementById("apiKey");

let riskChart;
let accuracyChart;

const storageKeys = {
  apiUrl: "patientRisk.apiUrl",
  apiKey: "patientRisk.apiKey",
};

const DEFAULT_LOCAL_API_KEY = "demo-admin-key";

function readStoredValue(key) {
  const value = window.localStorage.getItem(key);
  return value ? value.trim() : "";
}

function inferDefaultApiKey() {
  return DEFAULT_LOCAL_API_KEY;
}

function ensureApiKeyValue() {
  if (!apiKeyInput.value.trim()) {
    apiKeyInput.value = inferDefaultApiKey();
  }
}

const storedApiUrl = readStoredValue(storageKeys.apiUrl);
const storedApiKey = readStoredValue(storageKeys.apiKey);

if (storedApiUrl) {
  apiUrlInput.value = storedApiUrl;
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
  const apiKey = apiKeyInput.value.trim() || inferDefaultApiKey();

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
  const apiKey = apiKeyInput.value.trim() || inferDefaultApiKey();
  if (apiKey) {
    apiKeyInput.value = apiKey;
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
  if (level === "HIGH") return "risk-high";
  if (level === "MEDIUM") return "risk-medium";
  return "risk-low";
}

function toBoolean(value) {
  return String(value).toLowerCase() === "true";
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
    diabetes: toBoolean(formData.get("diabetes")),
    prior_heart_disease: toBoolean(formData.get("prior_heart_disease")),
    chronic_kidney_disease: toBoolean(formData.get("chronic_kidney_disease")),
    smoker: toBoolean(formData.get("smoker")),
  };
}

function renderResult(data) {
  const factors = (data.explanation || [])
    .map(
      (item) =>
        `<li>${item.feature}: <span class="mono">${item.value}</span>, impact <span class="mono">${item.impact}</span></li>`
    )
    .join("");

  resultBox.innerHTML = `
    <h2>Latest Prediction</h2>
    <p><strong>Patient:</strong> ${data.patient_id}</p>
    <p><strong>Risk Score:</strong> <span class="mono">${data.risk_score}</span></p>
    <p><strong>Risk Level:</strong> <span class="risk-badge ${riskClass(data.risk_level)}">${data.risk_level}</span></p>
    <p><strong>ICU need within 24h:</strong> ${data.icu_within_24h ? "Likely" : "Not likely"}</p>
    <p><strong>Alert Sent:</strong> ${data.alert_sent ? "Yes" : "No"}</p>
    <h3>Top Risk Factors</h3>
    <ul>${factors || "<li>No factors returned</li>"}</ul>
  `;
}

function renderTable(items) {
  historyTableBody.innerHTML = items
    .map(
      (row) => `
      <tr>
        <td>${new Date(row.created_at).toLocaleString()}</td>
        <td>${row.patient_id}</td>
        <td class="mono">${row.risk_score}</td>
        <td><span class="risk-badge ${riskClass(row.risk_level)}">${row.risk_level}</span></td>
        <td>${row.icu_within_24h ? "Yes" : "No"}</td>
      </tr>`
    )
    .join("");
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

  if (riskChart) {
    riskChart.destroy();
  }

  riskChart = new Chart(canvas, {
    type: "doughnut",
    data: {
      labels: ["Low", "Medium", "High"],
      datasets: [
        {
          data: [counts.LOW, counts.MEDIUM, counts.HIGH],
          backgroundColor: ["#2f9466", "#d58a00", "#c9402d"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "68%",
      plugins: {
        legend: {
          position: "bottom",
        },
      },
    },
  });
}

function renderBenchmarkTable(models) {
  benchmarkTableBody.innerHTML = models
    .map(
      (model) => `
      <tr>
        <td>${model.name}</td>
        <td class="mono">${model.mean_metrics.accuracy}</td>
        <td class="mono">${model.mean_metrics.precision}</td>
        <td class="mono">${model.mean_metrics.recall}</td>
        <td class="mono">${model.mean_metrics.f1_score}</td>
        <td class="mono">${model.mean_metrics.roc_auc}</td>
      </tr>`
    )
    .join("");
}

function renderAccuracyChart(folds, models) {
  const canvas = document.getElementById("accuracyChart");
  if (typeof Chart === "undefined") {
    canvas.setAttribute("aria-label", "Chart library unavailable");
    return;
  }

  if (accuracyChart) {
    accuracyChart.destroy();
  }

  const colors = ["#0f9c8c", "#0b4f8a", "#c75b00", "#873260"];
  accuracyChart = new Chart(canvas, {
    type: "line",
    data: {
      labels: folds.map((fold) => `Fold ${fold}`),
      datasets: models.map((model, idx) => ({
        label: model.name,
        data: model.accuracy_by_fold,
        borderColor: colors[idx % colors.length],
        backgroundColor: colors[idx % colors.length],
        tension: 0.3,
        fill: false,
        pointRadius: 4,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
        },
      },
      scales: {
        y: {
          min: 0.7,
          max: 1.0,
        },
      },
    },
  });
}

async function loadHistory() {
  const response = await fetch(`${getApiBase()}/patients?limit=25`, {
    headers: getRequestHeaders(),
  });
  const payload = await parseJsonResponse(response, "Could not load patient history");
  const items = payload.items || [];
  renderTable(items);
  renderChart(items);
}

async function loadBenchmark() {
  const response = await fetch(`${getApiBase()}/metrics/benchmark`, {
    headers: getRequestHeaders(),
  });
  const payload = await parseJsonResponse(response, "Could not load benchmark metrics");
  const models = payload.models || [];
  const dataset = payload.dataset || {};
  const folds = payload.folds || [];

  datasetMeta.textContent = `${dataset.name || "Dataset"} (${dataset.rows || "-"} rows, ${
    dataset.features || "-"
  } features)`;
  renderBenchmarkTable(models);
  renderAccuracyChart(folds, models);
}

async function refreshDashboard() {
  await Promise.all([loadHistory(), loadBenchmark()]);
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
    await refreshDashboard();
  } catch (error) {
    resultBox.innerHTML = `<h2>Latest Prediction</h2><p class="mono">Error: ${error.message}</p>`;
  }
});

function reloadDashboard() {
  persistConnectionSettings();
  refreshDashboard().catch((error) => {
    resultBox.innerHTML = `<h2>Latest Prediction</h2><p class="mono">Error: ${error.message}</p>`;
  });
}

apiUrlInput.addEventListener("change", reloadDashboard);
apiKeyInput.addEventListener("change", reloadDashboard);

refreshDashboard().catch(() => {
  resultBox.innerHTML = `
    <h2>Latest Prediction</h2>
    <p class="mono">Connect backend at ${getApiBase()} with a valid API key and run a prediction.</p>
  `;
  datasetMeta.textContent = "Connect backend to load real dataset benchmark.";
});
