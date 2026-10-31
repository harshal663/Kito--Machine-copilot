# Proactive Edge-to-Voice Machine Copilot

> **Edge Vibration Anomaly Detection • Cloudflare Workers AI (Llama 3.1 8B) • Proactive Voice Phone Dispatch (Bolna AI)**

Prevent catastrophic unplanned downtime on factory floors by detecting early mechanical anomalies at the edge (ESP32 FFT) and proactively placing phone calls to the shift supervisor in plain conversational language before machines fail.

---

## 1. System Architecture

```mermaid
flowchart LR
  subgraph Edge ["Factory Floor"]
    ESP["ESP32 + MPU6050 (Radix-2 FFT)"]
  end
  subgraph Cloud ["Backend Services"]
    API["FastAPI API (Port 8000)"]
    W["arq Background Worker"]
    PG[("PostgreSQL 16 + pgvector")]
    RD[("Redis 7 (Presence, Cooldown, SSE)")]
  end
  subgraph Web ["Operator UI"]
    FE["Next.js 15 App Router (Port 3000)"]
  end
  subgraph Integrations ["External Platforms (Live or Mock)"]
    LLM["Llama 3.1 8B (Cloudflare Workers AI)"]
    BOLNA["Bolna Voice Agent Platform"]
    PHONE["Supervisor Phone (+91...)"]
    NOTIF["Twilio SMS Fallback"]
  end

  ESP -- "POST /v1/telemetry (JSON <=512B)" --> API
  API -- "Lock & Enqueue" --> RD
  W -- "RAG Vector Query" --> PG
  W -- "Direct Async HTTP" --> LLM
  W -- "Outbound Call" --> BOLNA
  BOLNA -- "Spoken Voice Call" --> PHONE
  BOLNA -- "Signed Webhook" --> API
  API -- "Publish SSE" --> RD
  RD -- "Live Stream" --> FE
  W -- "Escalation SMS" --> NOTIF
```

### Key Technical Pillars
- **Firmware (Edge Node):** ESP32 sampling at 1000 Hz, iterative Radix-2 512-point FFT with Hann windowing, Welford running baseline tracking, and $k\sigma$ persistence detection.
- **Backend API & Queue:** Python 3.12 + FastAPI + `arq` async queue on Redis, strict prefixed ULIDs (`mch_`, `dev_`, `evt_`, `cal_`, `usr_`), 30-minute deduplication cooldowns, and monotonic sequence checking.
- **AI Diagnostics:** **Llama 3.1 8B Instruct** hosted on **Cloudflare Workers AI**.
  > **Note on LLM Architecture:** We do **not** use the heavy `openai` Python SDK. Model inference is executed via clean, high-performance async HTTP requests through Python's native `httpx.AsyncClient` directly to Cloudflare's native Workers AI endpoint (`POST https://api.cloudflare.com/client/v4/accounts/{id}/ai/run/{model}`).
- **Voice Dispatch:** Proactive outbound calls via **Bolna AI** communicating machine diagnostics, recommended actions, and capturing supervisor decisions directly on the phone call.
- **Dashboard:** TypeScript + Next.js 15 App Router + Tailwind CSS with live Server-Sent Events (SSE), theme switching (light/dark), and supervisory decision controls.
- **Safety Invariant:** Software strictly advises and logs; it **never** actuates physical machine controls.

---

## 2. Judge & Evaluator Guide: Quickstart

You can test and evaluate the entire application in two modes:
1. **Mode A (Default - 100% Offline / Zero API Keys Required):** Runs immediately with mock external providers. No paid tokens or credit cards needed.
2. **Mode B (Live Mode - Real Cloudflare & Bolna):** Plug in your API keys in `.env` to experience live Llama 3.1 diagnosis and real phone calls to your mobile.

---

### Prerequisites
- [Docker & Docker Compose](https://www.docker.com/) (for PostgreSQL with `pgvector` & Redis)
- [Python 3.12+](https://www.python.org/) with [`uv`](https://docs.astral.sh/uv/) package manager
- [Node.js 20+](https://nodejs.org/) with `npm`
- (Optional) `g++` (MinGW on Windows or GCC on Linux) to execute native firmware tests

---

### Step-by-Step Setup

#### 1. Clone & Configure Environment
```bash
git clone https://github.com/harshal663/Kito--Machine-copilot.git
cd Kito--Machine-copilot

# Copy the configuration template
cp .env.example .env
```

> **Evaluation Setting:**
> - To run **offline (recommended for quick evaluation)**: Leave `MOCK_EXTERNALS=true` in `.env`.
> - To run **live**: Set `MOCK_EXTERNALS=false` and provide `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_AUTH_TOKEN`, and `BOLNA_API_KEY`.

#### 2. Start Database and Cache (Docker)
In your terminal, start PostgreSQL 16 (with `pgvector`) and Redis 7:
```bash
docker compose up -d postgres redis
```

#### 3. Run Migrations & Seed Demo Factory
```bash
# Apply database migrations
cd backend
uv run alembic upgrade head

# Seed initial owner, machine, and device bindings
uv run python ../scripts/seed_demo.py
cd ..
```
*Demo credentials seeded:*
- **Email:** `owner@example.com`
- **Password:** `Password123!`

---

### Running the Services

Open 3 terminal windows to run the full stack:

#### Terminal 1: Backend API Server
```bash
cd backend
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
*API is live at [http://localhost:8000](http://localhost:8000). Interactive Swagger docs at [http://localhost:8000/docs](http://localhost:8000/docs).*

#### Terminal 2: Background Worker (AI Synthesis & Voice Dispatch)
```bash
cd backend
uv run arq app.workers.settings.WorkerSettings
```
*Processes RAG retrieval, runs Llama 3.1 diagnosis, and dispatches Bolna calls.*

#### Terminal 3: Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
*Dashboard opens at [http://localhost:3000](http://localhost:3000).*

---

## 3. Guided Walkthrough for Evaluators

### Step 1: Sign In & Explore
1. Navigate to [http://localhost:3000](http://localhost:3000).
2. Sign in with:
   - **Email:** `owner@example.com`
   - **Password:** `Password123!`
3. Notice the 4 stat cards (Machines, Healthy, Open Alerts, Offline Devices), the 14-day alert frequency chart, and the 24-hour vibration RMS trend chart.

### Step 2: Trigger a Simulated Vibration Anomaly
Open a new terminal and simulate an ESP32 sensor reporting a critical mechanical imbalance fault (1x fundamental frequency peak at 24.4 Hz):
```bash
uv run python simulator/simulate_device.py --mode imbalance --rpm 1465.0
```

### Step 3: Observe Live Reactions Across the Stack
1. **API Ingestion:** Receives telemetry, verifies device authentication, checks the 30-minute cooldown, and returns `202 Accepted`.
2. **Worker AI Diagnosis:** The worker queries manual chunks via `pgvector`, runs Llama 3.1 8B diagnostic synthesis, and outputs:
   - Ranked probable causes (e.g., *Spindle bearing wear / Mechanical unbalance*).
   - Severity rating (`HIGH`).
   - Plain-language spoken voice summary.
3. **Voice Dispatch:** Bolna calls the machine supervisor or records a simulated voice dispatch.
4. **Live Dashboard Update:** Watch the Dashboard update **in real time** via Server-Sent Events (SSE)—no page refresh required!

### Step 4: Operator Supervisory Decision
1. Click on the active alert in the dashboard.
2. Review the AI diagnosis, confidence metrics, and technical manual citations.
3. Select an action (**Acknowledge**, **Schedule Inspection**, or **Request Shutdown**).
4. An immutable audit log record is committed to PostgreSQL in the same database transaction.

---

## 4. Environment Variables Reference

| Variable | Description | Default / Example |
|---|---|---|
| `MOCK_EXTERNALS` | Run offline without paid external APIs | `true` |
| `DATABASE_URL` | PostgreSQL asyncpg connection string | `postgresql+asyncpg://copilot:copilot@localhost:5432/copilot` |
| `REDIS_URL` | Redis URL for caching, queues, and pub/sub | `redis://localhost:6379/0` |
| `JWT_SECRET` | Secret key used to sign JWT tokens | `change-me-to-at-least-32-random-characters-secret` |
| `LLM_PROVIDER` | LLM provider (`cloudflare` or `mock`) | `cloudflare` |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare Account ID for Workers AI | Hexadecimal account string |
| `CLOUDFLARE_AUTH_TOKEN` | Scoped API token with Workers AI read/write | Bearer token |
| `LLM_MODEL` | Cloudflare Llama 3.1 8B model identifier | `@cf/meta/llama-3.1-8b-instruct-fp8` |
| `VOICE_PROVIDER` | Voice provider (`bolna` or `mock`) | `bolna` |
| `BOLNA_API_KEY` | Bolna voice platform API key | `bolna_...` |
| `BOLNA_AGENT_ID` | Bolna voice agent ID configured with prompt | `agent_...` |
| `BOLNA_WEBHOOK_TOKEN` | Shared secret token for webhook verification | Random 32+ character string |

---

## 5. Verification & Test Suites

The repository contains automated verification suites spanning firmware, backend, frontend, and security:

```bash
# 1. Backend Lint & Formatting (Ruff)
cd backend && uv run ruff check . && uv run ruff format --check .

# 2. Strict Typecheck (mypy strict mode - 0 errors across 72 source files)
cd backend && uv run mypy --strict app

# 3. Backend Unit Tests
cd backend && uv run pytest tests/unit

# 4. Frontend Typecheck & Vitest Tests
cd frontend
npm run typecheck    # 0 TypeScript errors
npm test             # 17 unit & component tests passing

# 5. Native Firmware Tests (5 Unity tests)
cd firmware
g++ -std=c++17 -D UNIT_TEST -I include -I src -I test/test_native test/test_native/test_main.cpp src/baseline.cpp src/detector.cpp src/fft_analyzer.cpp src/telemetry_client.cpp -o test_runner
./test_runner        # 5 Tests 0 Failures
```

---

## 6. Repository Structure

```
├── firmware/          # ESP32 C++ firmware: FFT analyzer, baseline, detector, telemetry client
├── backend/           # Python 3.12 FastAPI API, arq background workers, RAG pgvector pipeline
├── frontend/          # Next.js 15 App Router dashboard, Tailwind CSS, SSE client
├── simulator/         # Hardware vibration anomaly & heartbeat simulator
├── scripts/           # DB seed scripts, OpenAPI exporters, password reset utilities
├── docs/final/        # Technical specifications (ARCHITECTURE.md, MODEL.md, SECURITY.md)
└── .github/workflows/ # GitHub Actions automated CI verification pipeline
```
