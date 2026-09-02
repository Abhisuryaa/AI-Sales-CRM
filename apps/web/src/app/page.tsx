import Link from "next/link";

import { AgentTicker } from "@/components/landing/agent-ticker";
import { PipelineHero } from "@/components/landing/pipeline-hero";
import { PipelineWalkthrough } from "@/components/landing/pipeline-walkthrough";
import { auth } from "@/auth";

/**
 * DESIGN CONTRACT — "Live Wire"
 * THESIS: the hero is the mechanism — a live, looping simulation of the real
 * AI pipeline; agents are circles, the human approval gate is a square.
 * Refuses the stock hero (headline-plus-screenshot, gradient orb).
 * OWN-WORLD: ink-blue terminal ground #0B1220, paper cards #F2F5FA, wire
 * hairlines #2A3A55, signal amber #FFB224 for the human gate. Type:
 * Bricolage Grotesque display, Figtree body, Martian Mono data.
 * STORY: watch a lead run the pipeline, watch a human stamp it, open the app.
 * FIRST VIEWPORT: sim stage fills the fold — 8-station track, live lead card,
 * counting score, amber APPROVE stamp; CTA bottom-left of the stage.
 * FORM: public landing at "/", app moved to "Open app".
 * FINISH: unreviewed and undocumented is unfinished; this build ends with the
 * finish review, the verdict, DESIGN.md, and every shipping raster carrying
 * its provenance.
 */
const FEATURES = [
  { name: "Leads & AI qualification", body: "0–100 scores, tiers, and reasons — auto-reject the noise before it reaches a human." },
  { name: "Company research agent", body: "Buying signals, firmographics, tech stack — merged onto every lead record." },
  { name: "Decision-maker ID", body: "Signers, seniority, likelihood — your contact scored against them." },
  { name: "Personalized drafting", body: "Emails that quote the lead's own words. Structured LLM outputs, 3 retries, provider fallback." },
  { name: "Human approval queue", body: "Nothing sends itself. Managers edit and approve; feedback is stored." },
  { name: "Pipeline Kanban", body: "Seven stages, drag-and-drop, stage-change history on every deal." },
  { name: "Companies & contacts", body: "Full CRUD with owners, decision scores, and enrichment attached." },
  { name: "Tasks & notes", body: "Follow-ups with priorities and due dates, threaded to deals." },
  { name: "Unified timeline", body: "Calls, meetings, emails, agent runs — one activity stream per record." },
  { name: "Search & filters", body: "Status, owner, stage, free text — everywhere, fast." },
  { name: "Webhooks & n8n", body: "Signed inbound hooks, outgoing endpoints, importable workflow JSONs." },
  { name: "Background jobs", body: "A durable Postgres queue with retries, backoff, and Redis locks." },
  { name: "Audit logs", body: "Every mutation recorded: who, what, before, after, when." },
  { name: "Role-based access", body: "Admin, manager, rep, viewer — enforced at the API, not the UI." },
  { name: "Admin panel", body: "Users, roles, webhook endpoints, and the audit trail in one place." },
  { name: "Provider choice", body: "OpenAI, Anthropic, or a deterministic mock — swap with one env var." },
] as const;

const STACK = [
  "Next.js 15", "TypeScript", "Tailwind v4", "shadcn-style UI", "Auth.js v5", "PostgreSQL",
  "Prisma", "FastAPI", "Python 3.13", "Redis", "n8n", "Docker", "GitHub Actions", "OpenAI", "Anthropic",
] as const;

export default async function LandingPage() {
  const session = await auth();

  return (
    <div className="lp">
      {/* Design contract: see the module-level comment. Live Wire direction. */}
      <div hidden dangerouslySetInnerHTML={{ __html: "<!-- DESIGN CONTRACT Live Wire / seed: livewire-2024 / source: apps/web/src/app/page.tsx header -->" }} />
      <header className="lp-nav">
        <span className="lp-logo">AI Sales CRM</span>
        <nav className="lp-nav-links">
          <a href="#features">What&rsquo;s inside</a>
          <a href="#pipeline">The pipeline</a>
          <a href="#stack">Stack</a>
        </nav>
        {session?.user ? (
          <Link href="/dashboard" className="lp-btn lp-btn-primary">Open app</Link>
        ) : (
          <div className="lp-nav-cta">
            <Link href="/login" className="lp-btn lp-btn-ghost">Sign in</Link>
            <Link href="/login" className="lp-btn lp-btn-primary">Open the app</Link>
          </div>
        )}
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-kicker mono">RESEARCH → QUALIFY → DRAFT → YOU APPROVE</p>
            <h1>
              Your leads run the gauntlet.
              <br />
              <em>You sign the sends.</em>
            </h1>
            <p className="lp-sub">
              An AI CRM where agents research, enrich, qualify, and draft — and a
              human approves every email before it leaves. Watch it work below.
            </p>
          </div>
          <PipelineHero />
          <div className="lp-hero-foot">
            <Link href="/login" className="lp-btn lp-btn-primary">Open the app</Link>
            <span className="lp-foot-hint mono">admin@acme.test · admin1234</span>
          </div>
        </section>

        <section className="lp-logband">
          <AgentTicker />
          <p className="lp-band-note">
            The agents service is a separate FastAPI app with its own queue, Redis
            locks, and retry policy — the CRM talks to it over HTTP, so AI is a
            component, not a coupler.
          </p>
        </section>

        <section className="lp-features" id="features">
          <h2 className="mono">WHAT&rsquo;S INSIDE</h2>
          <div className="lp-feature-grid">
            {FEATURES.map((f) => (
              <div className="lp-feature" key={f.name}>
                <h3>{f.name}</h3>
                <p>{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="lp-pipeline" id="pipeline">
          <h2 className="mono">TEN STEPS, ONE PIPELINE</h2>
          <p className="lp-pipeline-sub">
            Each step is a real endpoint in this codebase — scroll to walk it.
          </p>
          <PipelineWalkthrough />
        </section>

        <section className="lp-stack" id="stack">
          <h2 className="mono">BUILT FROM PARTS YOU KNOW</h2>
          <ul className="lp-stack-list">
            {STACK.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </section>

        <section className="lp-cta">
          <h2>Watch it qualify your next lead.</h2>
          <p>
            Three demo users, seeded data, and a pipeline that runs end-to-end on a
            deterministic mock provider — no API keys needed to try it.
          </p>
          <div className="lp-cta-row">
            <Link href="/login" className="lp-btn lp-btn-primary">Open the app</Link>
            <Link href="#pipeline" className="lp-btn lp-btn-ghost">Re-read the pipeline</Link>
          </div>
          <div className="lp-cta-logins mono">
            <span>admin@acme.test · admin1234</span>
            <span>manager@acme.test · manager1234</span>
            <span>rep@acme.test · rep1234</span>
          </div>
        </section>
      </main>

      <footer className="lp-footer mono">
        <span>AI Sales CRM — a working reference build</span>
        <span>web :3000 · agents :8000 · postgres :5433 · redis :6380</span>
      </footer>
    </div>
  );
}
