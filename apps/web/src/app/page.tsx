import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

import { AgentTicker } from "@/components/landing/agent-ticker";
import { PipelineHero } from "@/components/landing/pipeline-hero";
import { PipelineWalkthrough } from "@/components/landing/pipeline-walkthrough";
import { auth } from "@/auth";

/**
 * DESIGN CONTRACT — "Forge"
 * THESIS: the hero is the mechanism — a live, looping simulation of the real
 * AI pipeline as a forge run: agents are circles, the human gate is a square
 * that quenches. Refuses the stock hero (headline-plus-screenshot, gradient orb).
 * OWN-WORLD: warm graphite ground #17150F with film grain, bone type #F2EAD8,
 * hairline seams #3A3427, heat orange #FF5C1F = AI activity, quench teal
 * #2DD4BF = human verdict, copper #C08552 chrome. Sharp corners, uppercase
 * labels. Type: Bebas Neue display, Source Sans 3 body, Chakra Petch labels,
 * Geist Mono data. DB-derived: luxury-dark ground + cyberpunk energy +
 * Bold Statement pairing, fused away from every default cluster.
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
      {/* Design contract: see the module-level comment. Forge direction. */}
      <div hidden dangerouslySetInnerHTML={{ __html: "<!-- DESIGN CONTRACT Live Wire / seed: forge-2024 / source: apps/web/src/app/page.tsx header -->" }} />
      <header className="lp-nav">
        <span className="lp-logo">AI Sales CRM</span>
        <nav className="lp-nav-links">
          <a href="#features">What&rsquo;s inside</a>
          <a href="#pipeline">The pipeline</a>
          <a href="#stack">Stack</a>
        </nav>
        {session?.user ? (
          <Button asChild size="sm">
            <Link href="/dashboard">Open app</Link>
          </Button>
        ) : (
          <div className="lp-nav-cta">
            <Button asChild variant="ghost" size="sm">
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Open the app</Link>
            </Button>
          </div>
        )}
      </header>

      <main>
        <section className="lp-hero">
          <div className="lp-hero-copy">
            <p className="lp-kicker mono">RESEARCH → QUALIFY → DRAFT → YOU APPROVE</p>
            <h1>
              Raw leads in.
              <br />
              <em>Signed deals out.</em>
            </h1>
            <p className="lp-sub">
              Agents research, enrich, qualify, and draft in the heat of the
              pipeline. <strong>Nothing ships until a human cools it.</strong>{" "}
              Watch a lead run the gauntlet below.
            </p>
          </div>
          <PipelineHero />
          <div className="lp-hero-foot">
            <Button asChild>
              <Link href="/login">Open the app</Link>
            </Button>
            <Badge variant="outline" className="lp-foot-hint mono">admin@acme.test · admin1234</Badge>
          </div>
        </section>

        <section className="lp-logband">
          <AgentTicker />
          <p className="lp-band-note">
            The agents service is a separate FastAPI app with its own queue, Redis
            locks, and retry policy — the CRM talks to it over HTTP. AI is a
            component, not a coupler.
          </p>
        </section>

        <section className="lp-features" id="features">
          <p className="mono">SPEC SHEET</p>
          <h2>EVERYTHING IN THE BOX</h2>
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
          <p className="mono">WALK THE LINE</p>
          <h2>TEN STEPS, ONE PIPELINE</h2>
          <p className="lp-pipeline-sub">
            Each step is a real endpoint in this codebase — scroll to walk it.
          </p>
          <PipelineWalkthrough />
        </section>

        <section className="lp-stack" id="stack">
          <p className="mono">TOOLING</p>
          <h2>BUILT FROM PARTS YOU KNOW</h2>
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
            <Button asChild>
              <Link href="/login">Open the app</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href="#pipeline">Re-read the pipeline</Link>
            </Button>
          </div>
          <div className="lp-cta-logins">
            <Badge variant="outline" className="mono">admin@acme.test · admin1234</Badge>
            <Badge variant="outline" className="mono">manager@acme.test · manager1234</Badge>
            <Badge variant="outline" className="mono">rep@acme.test · rep1234</Badge>
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
