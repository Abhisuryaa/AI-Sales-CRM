# Shared Contracts — AI Sales CRM

All agents MUST conform exactly. Do not rename anything here.

## Repos layout
- `apps/web` — Next.js 15.5 (App Router, src dir, `@/*` alias), React 19, Tailwind v4, shadcn-style components (hand-written, new-york style, neutral base), next-auth@5.0.0-beta.32 (Auth.js v5), zod 4, recharts, lucide-react, sonner.
- `packages/database` — Prisma schema + client. Export style: `"exports": { ".": "./src/index.ts" }` (source-exported; web must set `transpilePackages: ["@ai-crm/database"]` in next.config.ts).
- `services/agents` — FastAPI + Python 3.13, uv-managed, port 8000.
- DB: Postgres at `postgresql://postgres:postgres@127.0.0.1:5433/ai_sales_crm`, Redis `redis://127.0.0.1:6380/0`.

## Prisma enums (exact values)
- Role: `ADMIN, MANAGER, SALES_REP, VIEWER`
- DealStage order for Kanban: `NEW, QUALIFIED, DISCOVERY, PROPOSAL, NEGOTIATION, WON, LOST`
- DealStatus: `OPEN, WON, LOST`
- TaskStatus: `TODO, IN_PROGRESS, DONE`; TaskPriority: `LOW, MEDIUM, HIGH, URGENT`
- ActivityType: `NOTE, CALL, MEETING, EMAIL_SENT, EMAIL_RECEIVED, STAGE_CHANGE, ENRICHMENT, QUALIFICATION, APPROVAL, WEBHOOK, AGENT_RUN, SYSTEM`
- LeadStatus flow: `NEW → RESEARCHING → ENRICHING → IDENTIFYING → QUALIFYING → DRAFTING → PENDING_APPROVAL → APPROVED → CONVERTED`; also `REJECTED, FAILED`
- LeadTier: `HOT, WARM, COLD, UNQUALIFIED`
- JobStatus: `QUEUED, RUNNING, SUCCEEDED, FAILED, RETRYING, DEAD`
- AgentRunKind: `PIPELINE, RESEARCH, ENRICHMENT, IDENTIFY, QUALIFY, PERSONALIZE, FOLLOWUP`

Key models (see `packages/database/prisma/schema.prisma` for full fields): User, Company, Contact, Deal, Task, Note, Activity, EmailMessage, Lead (research/enrichment/decisionMakers/qualification Json columns), PipelineJob, AgentRun (steps Json: array of {step, status, detail, at}), Approval, WebhookEvent, WebhookEndpoint, WebhookDelivery, AuditLog.

## RBAC matrix (enforce in web API layer, helper `requireAuth(roles?)` in `src/lib/rbac.ts`)
- ADMIN: everything incl. admin panel (users CRUD, audit logs, webhook endpoints).
- MANAGER: read all, write all CRM objects, approve/reject emails, view dashboard.
- SALES_REP: read all, write only own-owned records (ownerId == session.user.id) plus create leads/notes/tasks/activities; can move own deals' stages; cannot approve AI emails (approval requires MANAGER or ADMIN); cannot access admin.
- VIEWER: read-only everything, no writes.

## Web API surface (all under `/api`, JSON; 401 if no session; 403 if role denied)
- `POST /api/auth/register` — ADMIN-only user creation (also used by admin panel).
- `GET/POST /api/companies`, `GET/PATCH/DELETE /api/companies/[id]`
- `GET/POST /api/contacts`, `GET/PATCH/DELETE /api/contacts/[id]`
- `GET/POST /api/deals?stage=&ownerId=&q=`, `GET/PATCH/DELETE /api/deals/[id]`; `PATCH` with `{stage}` writes Activity type=STAGE_CHANGE (from→to) and sets closedAt/status on WON/LOST.
- `GET/POST /api/tasks`, `PATCH /api/tasks/[id]` (status transitions set completedAt)
- `GET/POST /api/notes` (body: {body, companyId?, contactId?, dealId?})
- `GET /api/activities?dealId=&contactId=&companyId=&type=&limit=50` (timeline, desc by occurredAt)
- `GET /api/dashboard` — counts (companies, contacts, open deals by stage, pipeline value, win rate, leads by status, tasks due, recent activities 10)
- `GET/POST /api/leads`; `GET /api/leads/[id]` (include agentRuns latest, emails, approvals); `POST /api/leads/[id]/run` → proxies to agents service `POST /pipeline/leads/{id}/run` (AGENTS_API_URL); `POST /api/leads/[id]/convert` — converts APPROVED lead to Company+Contact+Deal (NEW stage, value from qualification.dealValueEstimate, owner = lead creator) and marks CONVERTED. Conversion is implemented WEB-side.
- `GET /api/emails?status=pending_approval`; `POST /api/emails/[id]/approve` {decision: approved|rejected|edited, editedSubject?, editedBody?, feedback?} — MANAGER/ADMIN only; approved → status approved; writes Approval row + Activity APPROVAL. Rejected lead → status REJECTED.
- Webhooks inbound: `POST /api/webhooks/ingest` header `x-webhook-secret: WEBHOOK_SECRET` body `{companyName, domain?, website?, contactFirstName?, contactLastName?, contactEmail?, contactTitle?, source?, notes?}` → creates WebhookEvent + Lead (status NEW) → fire-and-forget POST to agents `POST /pipeline/leads/{id}/run`. Responds 202 `{leadId}`.
- Admin: `GET/POST /api/admin/users`, `PATCH /api/admin/users/[id]` (role, isActive), `GET /api/admin/audit-logs?limit=100`, `GET/POST /api/admin/webhook-endpoints`. All ADMIN-only; user mutations write AuditLog.
- Every mutating endpoint writes AuditLog {action, entityType, entityId, before?, after?}.

## Auth.js v5 (Auth.js) setup — exact shape
- `src/auth.ts`: NextAuth with CredentialsProvider (email+password vs User.passwordHash via bcryptjs compare), session strategy "jwt", callbacks: jwt (embed id, role, name), session (expose id/role on session.user). `pages: { signIn: "/login" }`. `authorized` in auth.config.ts middleware: public paths `/login`, `/api/auth`, `/api/webhooks/ingest`, `/_next`, favicon, images; everything else requires session.
- `src/middleware.ts` combines `auth.config.ts` + `auth.ts` exports (NextAuth(config).auth).
- session.user type augmentation in `src/types/next-auth.d.ts` (id: string, role: Role).

## Agents HTTP API (FastAPI, port 8000; consumed by web + n8n)
- `GET /health` → `{status:"ok"}`
- `POST /pipeline/leads/{leadId}/run` → 202 `{runId}`; runs full pipeline in background: research → enrichment → identify → qualify → personalize → email draft (EmailMessage row status pending_approval + Approval row pending + Lead.status=PENDING_APPROVAL). Idempotent-ish: rejects if a run is already active for lead (409).
- `GET /pipeline/leads/{leadId}` → `{status, currentStep, steps:[{step,status,detail,at}], error}`
- `POST /webhooks/inbound` header `x-webhook-secret` — same lead-creation contract as web ingest (for n8n direct), creates lead + starts pipeline, 202.
- `POST /automations/followup` {leadId, dealId?} — schedules follow-up email draft job (background), writes PipelineJob type=followup.
- Auth: all non-health endpoints require header `x-webhook-secret` == env WEBHOOK_SECRET (shared dev value: `dev-webhook-secret`).

## Agents internals
- DB access: direct Postgres via SQLAlchemy/asyncpg or psycopg3 to same DATABASE_URL; writes Lead.*, AgentRun, PipelineJob, EmailMessage, Approval, Activity (AGENT_RUN/ENRICHMENT/QUALIFICATION types), and on convert step it DOES NOT convert (web owns conversion).
- Queue: PipelineJob table as the queue + asyncio worker loop (poll QUEUED jobs by priority/runAt, execute with retries: attempts < maxAttempts else DEAD; lastError recorded). Redis used for rate-limit/lock (SET NX) — optional but include redis client usage for job lock.
- LLM providers (`services/agents/app/llm/`): interface `complete_json(system, user, schema) -> dict`. Providers: `mock` (deterministic, no network — default when no keys), `openai` (client.chat.completions with response_format json_schema, model gpt-4o-mini; retries 3 with exp backoff + timeout 30s), `anthropic` (messages API, model claude-3-5-haiku-latest, tool-use structured output or JSON parsing; same retry). Provider selection via LLM_PROVIDER env; graceful fallback to mock on missing key. Log tokens/cost into AgentRun.provider/model/tokensUsed.
- Agent steps (each updates AgentRun.steps[] entries {step, status: started|ok|failed, detail, at} and Lead.status):
  1. research: web research stub that uses provided domain/notes + LLM to produce research JSON {summary, industry, size, painPoints[], buyingSignals[]}
  2. enrichment: merge deterministic enrichment (website URL construction, domain guess) + LLM {employeeRange, hqLocation, techStack[], funding}
  3. identify: decision makers JSON {makers: [{name, title, seniority, likelihood}]} (uses contact fields if present)
  4. qualify: score 0-100 + tier + reasons[] + dealValueEstimate (number) + recommendedAction; updates Lead.score/tier/qualification; REJECTED if tier==UNQUALIFIED (status REJECTED, pipeline stops)
  5. personalize: email {subject, body} referencing research painPoints + decision maker; writes EmailMessage (status pending_approval, direction outbound) + Approval(pending) + Lead.status=PENDING_APPROVAL + Activity APPROVAL.
- Follow-up agent: draft follow-up email referencing previous EmailMessage body; new EmailMessage pending_approval.
- Errors: any step failure → Lead.status=FAILED, error recorded, AgentRun.status=failed; PipelineJob retry logic as above.

## n8n
- Workflow JSON at `n8n/workflows/lead-intake.json`: Webhook node (POST path `lead-intake`) → Set node (map fields) → HTTP Request to `http://agents:8000/webhooks/inbound` with header `x-webhook-secret: {{$env.WEBHOOK_SECRET}}` → IF leadId → Respond 202. Second workflow `n8n/workflows/followup-digest.json`: Schedule daily → HTTP GET agents `/pipeline/leads?status=PENDING_APPROVAL` optional — skip if complex; keep first workflow only + a follow-up trigger workflow: Schedule (interval 1h) → HTTP POST agents `/automations/n8n/trigger-followups` (agents picks APPROVED >24h old leads needing follow-up and drafts). Add matching agents endpoint `POST /automations/n8n/trigger-followups` → 202 {scheduled: n}.

## Ports/env (single source)
- web 3000, agents 8000, postgres 5433, redis 6380
- env names exactly: DATABASE_URL, REDIS_URL, WEBHOOK_SECRET, AGENTS_API_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, LLM_PROVIDER, OPENAI_API_KEY, ANTHROPIC_API_KEY, N8N_WEBHOOK_URL

## UI conventions
- shadcn new-york style, neutral palette, CSS variables in globals.css (Tailwind v4 `@theme inline` tokens), dark-mode-ready class names; cn() in `src/lib/utils.ts`; components in `src/components/ui/<name>.tsx`.
- Components required (exact paths/exports): button, card (Card,CardHeader,CardTitle,CardDescription,CardContent,CardFooter), input, label, table (Table,TableHeader,TableBody,TableRow,TableHead,TableCell), badge, dialog (Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter,DialogTrigger,DialogClose), select (all standard parts), textarea, dropdown-menu (standard parts), tabs, avatar, separator, skeleton, sonner Toaster wrapper.
- Layout: left sidebar nav (Dashboard, Leads, Pipeline, Companies, Contacts, Tasks, Approvals, Activity, Admin) + topbar with user dropdown (name/role/sign out). Icon set lucide-react.

## Definition of done per slice
- TypeScript strict passes (`pnpm --filter web typecheck` or tsc), FastAPI imports clean (uv run python -c "import app.main").
- No TODO/stub/placeholder; every handler implemented.
