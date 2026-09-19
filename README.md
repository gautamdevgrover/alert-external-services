# CyberForce - External Services Monitoring & Alerting System

Production-ready, centralized DevOps monitoring and alerting infrastructure for CyberForce. Continuously checks service/API health, remaining credits/balance, spend, and usage across 12 external third-party providers, eliminating service disruptions caused by exhausted quotas, billing limits, or API outages.

---

## Architecture Overview

```
                          ┌─────────────────────────┐
                          │   React + Tailwind UI   │
                          │   (Recharts Analytics)  │
                          └────────────┬────────────┘
                                       │ (REST API)
                                       ▼
┌──────────────────────┐  HTTP   ┌─────────────────────────┐
│                      │ ◄─────► │   Express API Server    │
│  PostgreSQL 16 DB    │         │  (RateLimit, Helmet)    │
│  (History, Alerts,   │         └─────────────────────────┘
│   Thresholds, Runs)  │
│                      │         ┌─────────────────────────┐
└──────────▲───────────┘         │    Monitoring Worker    │
           │                     │  (15m Health / Daily)   │
           │                     └────────────┬────────────┘
           │ Writes                           │
           │ Results                          │ Runs 3x Retries + State Check
           └──────────────────────────────────┤
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
         ┌─────────────────────────┐                     ┌─────────────────────────┐
         │     Alert Engine        │                     │   12 Provider Modules   │
         │  State: HEALTHY/WARN/   │                     │  - Plivo    - AWS       │
         │         CRITICAL/DOWN   │                     │  - Twilio   - MongoDB   │
         │  Anti-Spam & Recovery   │                     │  - 11Labs   - LiveKit   │
         └────────────┬────────────┘                     │  - Apollo   - Voyage AI │
                      │                                  │  - Deepgram - Redis     │
              ┌───────┴───────┐                          │  - Face++   - OpenAI    │
              ▼               ▼                          └─────────────────────────┘
         [Email SMTP]    [Webhook/Slack]
```

### Key Capabilities
- **Modular Provider Integrations**: Standalone provider drivers implementing a uniform `BaseProvider` contract.
- **Quota & Balance Precision**: Native tracking of balance (`$`), credits (characters/tokens), spend (`$`), or resource usage (`%`). If a provider does not expose a credit API (e.g., Face++, Voyage AI), it flags `metricType: "manual"` ("Manual monitoring required") without faking values.
- **Anti-Spam Deduplication Engine**: Alerts fire **only** when state transitions (e.g. `HEALTHY` $\rightarrow$ `WARNING` $\rightarrow$ `CRITICAL` $\rightarrow$ `DOWN`), or when the configurable cooldown expires.
- **Automated Recovery Alerts**: Notifies the team immediately when a degraded or down service recovers (`DOWN` $\rightarrow$ `HEALTHY`) and auto-resolves open alerts.
- **Exponential Backoff & Resilience**: Retries temporary network blips 3 times (2s, 5s delays) before marking a service `DOWN`. Failure in one provider never impacts the rest of the system.
- **Zero-Secret Leakage Guarantee**: API keys and tokens are read strictly from environment variables. Secrets are masked in structured logs, never stored in PostgreSQL, and never sent to frontend payloads.

---

## Monitored Services & Supported Metrics

| Service | Provider Module | Monitored Metric | Type | Health Check Method |
| :--- | :--- | :--- | :--- | :--- |
| **Plivo** | `src/providers/plivo` | `cash_credits` (USD balance) | Balance | `GET /v1/Account/{auth_id}/` |
| **Twilio** | `src/providers/twilio` | Account Balance (USD) | Balance | `GET /v1/Accounts/{sid}/Balance.json` |
| **ElevenLabs** | `src/providers/elevenlabs`| `character_count` vs `character_limit` | Credits | `GET /v1/user/subscription` |
| **Apollo.io** | `src/providers/apollo` | Available credits / API rate limit | Credits / Usage | `GET /v1/users/api_profile` |
| **Deepgram** | `src/providers/deepgram` | Project balances (USD) | Balance | `GET /v1/projects/{id}/balances` |
| **Face++** | `src/providers/faceplusplus`| Service accessibility | Manual | `POST /facepp/v3/faceset/getfacesets` |
| **OpenAI** | `src/providers/openai` | MTD Spend (`/costs`) or Model Health | Spend / Usage | `GET /v1/models` + `/v1/organization/costs` |
| **AWS** | `src/providers/aws` | Month-to-date spend & budget | Spend | STS `GetCallerIdentity` + Cost Explorer |
| **MongoDB Atlas**| `src/providers/mongodb`| Pending monthly invoice spend | Spend | Digest Auth `GET /api/atlas/v2/orgs/{id}/invoices` |
| **LiveKit** | `src/providers/livekit` | Active rooms & server health | Usage / Manual | RoomServiceClient `listRooms()` |
| **Voyage AI** | `src/providers/voyage` | API connectivity & token health | Manual | Non-destructive `POST /v1/embeddings` |
| **Redis** | `src/providers/redis` | Memory utilized vs `maxmemory` | Usage | `PING` + `INFO memory` |

---

## Directory Structure

```
cyberforce-alert/
├── backend/
│   ├── src/
│   │   ├── api/                  # Express REST API Server
│   │   │   ├── routes/           # /services, /alerts, /metrics, /history, /thresholds
│   │   │   └── server.ts
│   │   ├── config/               # Environment and configuration loaders
│   │   ├── db/                   # PostgreSQL schema, migrations, and seeds
│   │   │   ├── index.ts          # Connection pool
│   │   │   ├── migrate.ts        # Database migration runner
│   │   │   ├── schema.sql        # Database schema
│   │   │   └── seed.ts           # Initial seeds for 12 services & thresholds
│   │   ├── providers/            # 12 Modular Provider Drivers
│   │   │   ├── base.provider.ts
│   │   │   ├── aws/
│   │   │   ├── mongodb/
│   │   │   ├── redis/
│   │   │   ├── livekit/
│   │   │   ├── elevenlabs/
│   │   │   ├── openai/
│   │   │   ├── voyage/
│   │   │   ├── faceplusplus/
│   │   │   ├── deepgram/
│   │   │   ├── apollo/
│   │   │   ├── twilio/
│   │   │   ├── plivo/
│   │   │   └── index.ts          # Central Provider Registry
│   │   ├── services/             # Core Business Logic
│   │   │   ├── alert.service.ts  # State-machine & anti-spam alert engine
│   │   │   ├── monitoring.service.ts # Runner with retries & threshold checks
│   │   │   └── notification/     # Email & Webhook alert channels
│   │   ├── types/                # Domain TypeScript models
│   │   ├── utils/                # Logger with secret masking
│   │   └── worker/               # Standalone Cron Worker daemon
│   ├── tests/                    # Unit tests for all 12 providers & alerts
│   ├── Dockerfile
│   ├── package.json
│   └── tsconfig.json
├── frontend/                     # React + TypeScript + Vite Dashboard
│   ├── src/
│   │   ├── components/           # SummaryCards, ServiceTable, StatusBadge, Navbar
│   │   ├── pages/                # DashboardPage, ServiceDetailPage, AlertsPage, ConfigurationPage
│   │   ├── services/api.ts       # Axios client
│   │   └── types.ts
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml            # Multi-container orchestration (postgres, api, worker, ui)
├── .env.example                  # Sanitized environment template
├── package.json                  # Root runner scripts
└── README.md
```

---

## Quick Start (Step-by-Step)

### 1. Installation
Install root, backend, and frontend dependencies:
```bash
npm run install:all
```

### 2. Configure Environment Variables
Copy the template to `.env`:
```bash
cp .env.example .env
```
Fill in the credentials for the services you wish to monitor. Services without configured environment variables will safely display `Not Configured` or `DOWN` without crashing the application.

### 3. Start Database & Run Migrations
Start PostgreSQL with Docker:
```bash
docker compose up -d postgres
```
Run database migrations and seed the initial 12 services and threshold rules:
```bash
npm run db:migrate
npm run db:seed
```

### 4. Start Services Locally

#### Terminal 1: Backend API Server (Port 4000)
```bash
npm run dev:backend
```

#### Terminal 2: Monitoring Worker (Scheduler)
```bash
npm run dev:worker
```

#### Terminal 3: Frontend Dashboard (Port 3000)
```bash
npm run dev:frontend
```
Open your browser at [http://localhost:3000](http://localhost:3000).

---

## Docker Compose (Production Deployment)

Run the entire stack (PostgreSQL, Backend API, Monitoring Worker, and Nginx Frontend) with a single command:
```bash
docker compose up -d --build
```

Verify running containers:
```bash
docker compose ps
```

View real-time logs:
```bash
docker compose logs -f backend worker
```

To stop all containers:
```bash
docker compose down
```

---

## API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Server and database health check (`{"status": "healthy"}`) |
| `GET` | `/api/services` | List all 12 services with latest normalized metric, status, and check time |
| `GET` | `/api/services/:service` | Detailed status, configuration audit, and recent alerts for a specific service |
| `GET` | `/api/alerts` | List alerts (supports `?status=active` or `?status=resolved` or `?service=apollo`) |
| `POST`| `/api/alerts/:id/resolve` | Manually mark an active alert as resolved |
| `GET` | `/api/metrics` | Dashboard KPI summary cards (Total, Healthy, Warning, Critical, Down, Manual) |
| `GET` | `/api/history/:service` | Historical telemetry and daily snapshots for charting (`?days=30`) |
| `GET` | `/api/thresholds` | Retrieve current warning/critical thresholds and cooldown settings |
| `PUT` | `/api/thresholds/:service` | Dynamically update warning/critical thresholds and alert cooldowns |
| `POST`| `/api/monitoring/run` | Manually trigger a check across all services or for a single service |

---

## How Thresholds & Alerts Work

### State Machine Lifecycle
Every service transitions through 4 distinct states:
- `HEALTHY`: Quota/spend within normal operating parameters.
- `WARNING`: Value has crossed the warning threshold (e.g. ElevenLabs remaining $< 20\%$, Plivo balance $< \$10$).
- `CRITICAL`: Value has crossed the critical threshold (e.g. ElevenLabs remaining $< 10\%$, Plivo balance $< \$5$).
- `DOWN`: API call failed after 3 retries or returned 401/403/5xx.

### Anti-Spam Deduplication
1. **On State Change**: An alert is dispatched immediately (e.g. `HEALTHY` $\rightarrow$ `WARNING`).
2. **Same State Repeated**: If the next scheduled check runs and the service is still in `WARNING`, duplicate notifications are **suppressed**.
3. **Cooldown Window**: An alert is re-sent only if the service remains degraded after the cooldown window (default: 360 minutes / 6 hours).
4. **Recovery Notification**: When a degraded/down service returns to normal, a `RECOVERY` alert is triggered, and all active alerts for that service are marked as resolved.

---

## How to Add a New Provider

To add a 13th provider (e.g. `SendGrid`, `HuggingFace`, etc.):

1. **Create Provider Directory**:
   Create `backend/src/providers/myprovider/myprovider.provider.ts` extending `BaseProvider`:
   ```typescript
   import { BaseProvider } from '../base.provider';
   import { HealthCheckResult, NormalizedMonitoringResult } from '../../types/monitoring';

   export class MyProvider extends BaseProvider {
     readonly serviceKey = 'myprovider';
     readonly serviceName = 'My Provider';

     isConfigured(): boolean {
       return !!process.env.MYPROVIDER_API_KEY;
     }

     getRequiredEnvVars(): string[] {
       return ['MYPROVIDER_API_KEY'];
     }

     async checkHealth(): Promise<HealthCheckResult> { ... }
     async getMetrics(): Promise<NormalizedMonitoringResult> { ... }
   }
   ```
2. **Register in Registry**:
   Add the provider instance in `backend/src/providers/index.ts`.
3. **Add Initial Seed**:
   Add default metadata and thresholds in `backend/src/db/seed.ts`.
4. **Add Unit Test**:
   Create `backend/tests/providers/myprovider.test.ts` with mocked responses.

---

## Running the Automated Test Suite

Execute the Jest test suite covering all 12 providers and the alert engine:
```bash
npm test
```
All external APIs are mocked using `axios-mock-adapter` and Jest mocks; no external network calls or credentials are required for tests to run and pass.

---

## Deployment to AWS EC2

### 1. Launch EC2 Instance
- Launch an Ubuntu 24.04 LTS instance (e.g. `t3.small` or `t3.medium`).
- Configure Security Group:
  - Allow Inbound Port 22 (SSH) from your IP.
  - Allow Inbound Port 80 (HTTP) and 443 (HTTPS) from `0.0.0.0/0`.
  - Allow Inbound Port 3000 (if testing frontend directly without Nginx reverse proxy).

### 2. Install Docker & Docker Compose on EC2
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker ubuntu
newgrp docker
```

### 3. Clone Repository & Setup
```bash
git clone <your-repo-url> cyberforce-alert
cd cyberforce-alert
cp .env.example .env
nano .env  # Add your production API credentials and SMTP settings
```

### 4. Start Stack
```bash
docker compose up -d --build
```

### 5. Verify Health
```bash
curl http://localhost:4000/health
# Response: {"status":"healthy","database":"connected","timestamp":"..."}
```
Open `http://<your-ec2-public-ip>:3000` in your web browser to view the CyberForce Monitor Dashboard.

---

## Troubleshooting

- **Database Connection Error**:
  Check if PostgreSQL container is running:
  ```bash
  docker compose ps
  docker compose logs postgres
  ```
  Ensure `DATABASE_URL` matches your credentials.
- **Provider Status Displays "Down"**:
  Navigate to the service in the dashboard to review the safe sanitized error reason. Verify that the required environment variables are exported in `.env`.
- **Alert Emails Not Delivering**:
  Verify SMTP configuration (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`). For Gmail or Google Workspace, use a generated App Password rather than your account password.
