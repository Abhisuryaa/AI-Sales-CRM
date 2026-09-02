# AI Sales CRM

Monorepo: AI-assisted sales CRM. Next.js 15 web app + FastAPI agents service + Postgres/Redis + n8n automations. Full pipeline: a lead enters, AI researches → enriches → identifies decision makers → qualifies → drafts a personalized email that lands in a manager approval queue.

## Quickstart (local dev, no Docker)

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres (5433) + Redis (6380) — portable binaries, no admin rights
node scripts/db.mjs up

# 3. Apply schema + seed demo data
pnpm db:migrate
pnpm db:seed

# 4. Agents service — http://127.0.0.1:8000  (docs at /docs)
cd services/agents
uv sync
uv run uvicorn app.main:app --reload --port 8000

# 5. Web app — http://localhost:3000  (new terminal, repo root)
pnpm dev:web
```

Copy `.env.example` to `.env` (repo root) and to `services/agents/.env` first; `services/agents/.env` is committed with dev defaults in this workspace.

### Default logins (after seed)

| Email | Password | Role |
| --- | --- | --- |
| `admin@acme.test` | `admin1234` | ADMIN |
| `manager@acme.test` | `manager1234` | MANAGER |
| `rep@acme.test` | `rep1234` | SALES_REP |

## Quickstart (Docker Compose)

```bash
docker compose up --build
# web    → http://localhost:3000
# agents → http://localhost:8000 (health: /health)
# n8n    → http://localhost:5678
# postgres → localhost:5433  (postgres/postgres, db ai_sales_crm)
# redis    → localhost:6380
```

First run: apply migrations + seed against the Dockerized Postgres:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_sales_crm \
  pnpm --filter @ai-crm/database exec prisma migrate deploy
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/ai_sales_crm \
  pnpm db:seed
```

Both containers read config from `docker-compose.yml` environment; `.env` files are never baked into images. On first boot the n8n container imports the workflows from `n8n/workflows/` automatically (`n8n import:workflow --separate --input=/import/workflows`, guarded by a sentinel so it runs once).

## The AI pipeline

```mermaid
flowchart LR
    A[Lead created\nweb form · /api/webhooks/ingest · n8n webhook] --> B[POST /pipeline/leads/id/run\nagents service]
    B --> C[research\nweb research + LLM summary]
    C --> D[enrichment\ndomain/tech stack/size]
    D --> E[identify\ndecision makers]
    E --> F[qualify\nscore 0-100 · tier · deal value]
    F -->|tier = UNQUALIFIED| R[lead REJECTED\npipeline stops]
    F --> G[personalize\nemail draft referencing pain points]
    G --> H[EmailMessage status=pending_approval\n+ Approval row]
    H --> I{Manager / Admin\napprove or reject}
    I -->|approved| J[Lead APPROVED\n→ convert to Company + Contact + Deal]
    I -->|rejected| K[Lead REJECTED]

    subgraph automations
      S[Schedule every hour] --> T[agents drafts\nfollow-up emails]
    end
```

After approval, `POST /api/leads/{id}/convert` (web-side) creates the Company/Contact/Deal records. The hourly n8n `Followup Trigger` workflow asks the agents service for APPROVED leads older than 24h and schedules follow-up drafts.

## End-to-end smoke test

With both services running (web on :3000, agents on :8000):

```bash
node scripts/smoke.mjs
```

Exercises login, CRUD, webhook ingest, the full AI pipeline (polls to PENDING_APPROVAL), manager email approval, and lead conversion — prints PASS/FAIL per step, exits non-zero on failure.

## n8n workflows

Import via the n8n UI (Workflows → Import from File), via CLI (`n8n import:workflow --separate --input=n8n/workflows`), or let the compose stack import them on first boot:

- `n8n/workflows/lead-intake.json` — Webhook `POST /webhook/lead-intake` → map fields → `POST http://agents:8000/webhooks/inbound` (`x-webhook-secret` from `$env.WEBHOOK_SECRET`) → respond 202 `{leadId}`.
- `n8n/workflows/followup-trigger.json` — Schedule (every hour) → `POST http://agents:8000/automations/n8n/trigger-followups` → 202 `{scheduled: n}`.

Set `WEBHOOK_SECRET` in the n8n environment (compose already does) so the `$env.WEBHOOK_SECRET` expressions resolve.

## Environment variables

Single source of names: `local/contracts.md` + `.env.example`.

| Variable | Used by | Example / default | Notes |
| --- | --- | --- | --- |
| `DATABASE_URL` | web, agents | `postgresql://postgres:postgres@localhost:5433/ai_sales_crm` | Direct Postgres (Prisma / SQLAlchemy). |
| `REDIS_URL` | agents | `redis://127.0.0.1:6380/0` | Rate-limit/job lock (`SET NX`). |
| `WEBHOOK_SECRET` | agents, n8n | `dev-webhook-secret` | Shared secret; `x-webhook-secret` header on agents endpoints. |
| `AGENTS_API_URL` | web | `http://127.0.0.1:8000` | Base URL for pipeline proxy calls. |
| `NEXTAUTH_SECRET` | web | (32+ chars) | Auth.js v5 JWT signing. |
| `NEXTAUTH_URL` | web | `http://localhost:3000` | Canonical web origin. |
| `LLM_PROVIDER` | agents | `mock` \| `openai` \| `anthropic` | `mock` = deterministic, no network, default with no keys. |
| `OPENAI_API_KEY` | agents | — | Used when `LLM_PROVIDER=openai` (model gpt-4o-mini). |
| `ANTHROPIC_API_KEY` | agents | — | Used when `LLM_PROVIDER=anthropic` (claude-3-5-haiku-latest). |
| `N8N_WEBHOOK_URL` | agents | — | Optional outbound n8n callback. |

## Workspace layout

```
apps/web            Next.js 15 App Router (React 19, Tailwind v4, Auth.js v5, shadcn-style UI)
packages/database   Prisma schema + client (source-exported, transpiled by web)
services/agents     FastAPI + Python 3.13 (uv-managed, port 8000)
n8n/workflows       Importable n8n workflow JSON
scripts/db.mjs      Portable Postgres/Redis lifecycle (up|down|status|reset)
```

## Feature list

- **Dashboard** — company/contact counts, open deals by stage, pipeline value, win rate, leads by status, tasks due, recent activity.
- **Leads** — AI pipeline runs (research → enrichment → identify → qualify → personalize), step-by-step run status, approval queue for drafted emails.
- **Pipeline** — Kanban across `NEW → QUALIFIED → DISCOVERY → PROPOSAL → NEGOTIATION → WON/LOST` with stage-change audit trail.
- **Companies / Contacts / Deals / Tasks / Notes / Activities** — full CRUD behind RBAC, timelines, audit logs on every mutation.
- **Email approvals** — MANAGER/ADMIN approve / reject / edit AI-drafted emails; edits + feedback recorded on the Approval row.
- **Lead conversion** — APPROVED lead → Company + Contact + Deal in one click (web-side).
- **Admin** — user CRUD (roles, active flag), audit log viewer, webhook endpoint registry. ADMIN only.
- **RBAC** — ADMIN / MANAGER / SALES_REP (own-records writes, no approvals) / VIEWER (read-only), enforced in the web API layer.
- **Automations** — n8n intake webhook + hourly follow-up trigger; agents queue with retries (QUEUED → RUNNING → SUCCEEDED/RETRYING → DEAD), Redis-backed job locks.
- **LLM providers** — `mock` (deterministic, zero keys) / `openai` / `anthropic` with retries, fallback to mock, token/cost logging into AgentRun.

## Development commands

```bash
pnpm dev            # web + agents in parallel (filtered by workspace)
pnpm dev:web        # Next.js dev server (3000)
pnpm dev:agents     # agents via uv (8000)
pnpm typecheck      # tsc across the workspace
pnpm db:up          # node scripts/db.mjs up  (Postgres 5433 + Redis 6380)
pnpm db:migrate     # prisma migrate dev
pnpm db:seed        # seed demo users/companies/deals
```

See `docs/ARCHITECTURE.md` for the system diagram and data flow.
