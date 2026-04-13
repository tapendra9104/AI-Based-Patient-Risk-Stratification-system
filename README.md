# 🏥 AI Patient Risk Stratification System

> **Generative AI-powered** patient health risk assessment using **RAG (Retrieval Augmented Generation)**, **Google Gemini LLM**, and a modern full-stack architecture.

![Tech Stack](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react)
![Tech Stack](https://img.shields.io/badge/Node.js-Express-339933?style=flat&logo=node.js)
![Tech Stack](https://img.shields.io/badge/Python-FastAPI-009688?style=flat&logo=python)
![Tech Stack](https://img.shields.io/badge/AI-Google_Gemini-4285F4?style=flat&logo=google)
![Tech Stack](https://img.shields.io/badge/DB-MongoDB-47A248?style=flat&logo=mongodb)

---

## 🧠 What Does This System Do?

1. **Doctor enters patient data** → age, gender, blood pressure, glucose, heart rate, symptoms
2. **RAG retrieves relevant medical knowledge** → FAISS searches our medical document database
3. **Gemini AI analyzes the data** → Using patient data + medical context for intelligent assessment
4. **Returns structured risk assessment** → Risk level (Low/Medium/High), probability, reasoning, recommended action
5. **Saves to MongoDB** → Dashboard shows all patients, trends, and high-risk alerts

---

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐
│              │     │              │     │   AI Service (FastAPI)   │
│   React UI   │────▶│  Node.js     │────▶│                          │
│  (Port 3000) │     │  Express     │     │  1. RAG Context Retrieval│
│              │◀────│  (Port 5000) │◀────│  2. LLM (Gemini) Call   │
│  - Form      │     │              │     │  3. JSON Response Parse  │
│  - Dashboard │     │  - API Routes│     │     (Port 8000)          │
│  - History   │     │  - Validation│     └──────────┬───────────────┘
└──────────────┘     │  - MongoDB   │                │
                     └──────┬───────┘                │
                            │                   ┌────▼────┐
                     ┌──────▼───────┐           │  FAISS  │
                     │   MongoDB    │           │ Vector  │
                     │  (Database)  │           │   DB    │
                     └──────────────┘           └─────────┘
```

---

## ⚡ Quick Start (Setup Guide)

### Prerequisites

- **Node.js** v18+ → [Download](https://nodejs.org/)
- **Python** 3.9+ → [Download](https://www.python.org/)
- **MongoDB** → [Local Install](https://www.mongodb.com/try/download/community) OR [MongoDB Atlas (Free)](https://www.mongodb.com/atlas)
- **Google Gemini API Key** → [Get Free Key](https://aistudio.google.com/apikey)

---

### Step 1: Clone & Setup Environment

```bash
# Navigate to the project
cd "AI-Based Patient Risk Stratification"

# --- Backend Setup ---
cd backend
cp .env.example .env        # Create .env from template
npm install                  # Install Node.js dependencies

# --- AI Service Setup ---
cd ../ai-service
cp .env.example .env         # Create .env from template
pip install -r requirements.txt   # Install Python dependencies

# --- Frontend Setup ---
cd ../frontend
npm install                  # Install React dependencies
```

### Step 2: Configure Environment Variables

**Backend (`backend/.env`):**
```env
MONGODB_URI=mongodb://localhost:27017/patient_risk_db
PORT=5000
AI_SERVICE_URL=http://localhost:8000
```

**AI Service (`ai-service/.env`):**
```env
GEMINI_API_KEY=your_actual_gemini_api_key
LLM_PROVIDER=gemini
```

### Step 3: Start All Services

Open **3 terminals** and run:

```bash
# Terminal 1: Start AI Service (Python)
cd ai-service
python main.py
# OR: uvicorn main:app --reload --port 8000

# Terminal 2: Start Backend (Node.js)
cd backend
npm run dev

# Terminal 3: Start Frontend (React)
cd frontend
npm run dev
```

### Step 4: Open in Browser

Visit **http://localhost:3000** 🚀

---

## 📁 Project Structure

```
AI-Based Patient Risk Stratification/
│
├── frontend/                    # React.js Frontend
│   ├── src/
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Navbar.jsx       # Navigation bar
│   │   │   ├── PatientForm.jsx  # Patient data input form
│   │   │   ├── RiskResult.jsx   # AI result display
│   │   │   ├── PatientCard.jsx  # Patient summary card
│   │   │   ├── StatsCard.jsx    # Dashboard stat card
│   │   │   └── AlertBanner.jsx  # High-risk alert
│   │   ├── pages/               # Page components
│   │   │   ├── Home.jsx         # Main analysis page
│   │   │   ├── Dashboard.jsx    # Stats & charts
│   │   │   ├── History.jsx      # Patient records
│   │   │   └── About.jsx        # How it works
│   │   ├── services/
│   │   │   └── api.js           # Axios API client
│   │   ├── App.jsx              # Root component + router
│   │   ├── main.jsx             # Entry point
│   │   └── index.css            # Tailwind + custom styles
│   └── package.json
│
├── backend/                     # Node.js + Express Backend
│   ├── config/
│   │   └── db.js                # MongoDB connection
│   ├── models/
│   │   └── Patient.js           # Mongoose schema
│   ├── routes/
│   │   ├── patientRoutes.js     # Patient CRUD + analysis API
│   │   └── uploadRoutes.js      # PDF upload handler
│   ├── middleware/
│   │   ├── errorHandler.js      # Global error handling
│   │   └── validation.js        # Input validation rules
│   ├── server.js                # Express entry point
│   └── package.json
│
├── ai-service/                  # Python FastAPI AI Service
│   ├── models/
│   │   └── schemas.py           # Pydantic data models
│   ├── services/
│   │   ├── llm_service.py       # LLM (Gemini/OpenAI) integration
│   │   └── rag_service.py       # RAG with FAISS + embeddings
│   ├── knowledge_base/          # Medical documents for RAG
│   │   ├── medical_guidelines.txt
│   │   └── risk_factors.txt
│   ├── main.py                  # FastAPI entry point
│   └── requirements.txt
│
└── README.md
```

---

## 🔌 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/patient/analyze` | Submit patient data → AI risk analysis |
| `GET` | `/api/patient/history` | Get all patient records (paginated) |
| `GET` | `/api/patient/stats` | Dashboard statistics |
| `GET` | `/api/patient/:id` | Get single patient |
| `DELETE` | `/api/patient/:id` | Delete a patient |
| `POST` | `/api/upload` | Upload PDF report |
| `GET` | `/api/health` | Backend health check |

---

## 🧪 API Response Format

```json
{
  "risk": "High",
  "probability": "85%",
  "reason": "Patient presents with significantly elevated blood pressure (180/110 mmHg) classified as hypertensive crisis, combined with high blood glucose (280 mg/dL) indicating poorly controlled diabetes. Tachycardia (heart rate 110 bpm) and reported symptoms of chest pain and dizziness suggest acute cardiovascular distress.",
  "action": "Immediate emergency consultation required. Initiate antihypertensive therapy, monitor blood glucose, and perform ECG and cardiac biomarker assessment. Consider hospital admission for observation."
}
```

---

## 🧠 Key Concepts (For Presentation)

### What is RAG?
> "Imagine asking a doctor a question. A smart doctor first looks up the latest medical guidelines, THEN gives you an answer. RAG does the same — it retrieves relevant medical knowledge BEFORE sending data to the AI."

### What is Prompt Engineering?
> "It's like giving precise instructions to a brilliant but literal assistant. We tell the AI exactly what role to play, what format to respond in, and what NOT to do. This ensures consistent, reliable outputs."

### Why Microservice Architecture?
> "Instead of one giant application, we split it into 3 focused services. Each service does one thing well. If the AI service needs upgrading, we can swap it without touching the frontend or database."

---

## 📋 Medical Disclaimer

⚠️ **This system is for educational and research purposes only.**

It is NOT intended for clinical use or as a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of a qualified healthcare provider for any medical decisions.

---

## 🛠️ Tech Stack Summary

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Tailwind CSS | User interface |
| Backend | Node.js + Express 4 | API gateway |
| AI Service | Python FastAPI | AI/ML processing |
| LLM | Google Gemini | Risk analysis |
| RAG | FAISS + Sentence Transformers | Knowledge retrieval |
| Database | MongoDB + Mongoose | Data storage |
| Charts | Recharts | Dashboard visualizations |
| Animations | Framer Motion | Smooth UI transitions |
