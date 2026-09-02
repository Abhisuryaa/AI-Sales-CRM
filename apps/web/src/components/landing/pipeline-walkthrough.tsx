"use client";

import { useEffect, useRef, useState } from "react";

const STEPS = [
  {
    n: "01",
    name: "Lead lands",
    body: "A form, a webhook, or an n8n workflow drops a company into the queue. The lead is created with a single POST.",
    api: "POST /api/webhooks/ingest → 202",
  },
  {
    n: "02",
    name: "Research agent",
    body: "The service reads the domain and notes, then asks the model for buying signals — industry, size, pain points, triggers.",
    api: "research → { signals[], painPoints[] }",
  },
  {
    n: "03",
    name: "Company enrichment",
    body: "Firmographics are merged onto the record: employee range, HQ, tech stack, funding. Every fact lands in a JSON column you can query.",
    api: "enrich → { employeeRange, techStack[] }",
  },
  {
    n: "04",
    name: "Decision makers",
    body: "The agent names the people who sign: titles, seniority, likelihood. Your contact is scored against them.",
    api: "identify → { makers[] }",
  },
  {
    n: "05",
    name: "Qualification",
    body: "A 0–100 score with tier and reasons. UNQUALIFIED leads are rejected here — before any human spends a minute on them.",
    api: "qualify → { score, tier, reasons[] }",
  },
  {
    n: "06",
    name: "Personalization",
    body: "The email draft quotes the lead's own signals — their words, their stack, their timing. No template merge tags.",
    api: "personalize → { subject, body }",
  },
  {
    n: "07",
    name: "Human approval",
    body: "The draft sits in an approval queue. A manager reads it, edits if needed, and signs off. AI never sends alone.",
    api: "POST /api/emails/{id}/approve",
  },
  {
    n: "08",
    name: "CRM update",
    body: "One click converts the approved lead into Company, Contact, and Deal records — owned, staged, and ready to work.",
    api: "POST /api/leads/{id}/convert",
  },
  {
    n: "09",
    name: "Follow-up automation",
    body: "Quiet for 24 hours? The scheduler drafts the follow-up, and it waits in the same approval queue.",
    api: "n8n → /automations/n8n/trigger-followups",
  },
  {
    n: "10",
    name: "Everything is auditable",
    body: "Every agent run, approval, and stage change writes an activity and an audit-log row. You can replay any deal's history.",
    api: "GET /api/admin/audit-logs",
  },
] as const;

export function PipelineWalkthrough() {
  const [current, setCurrent] = useState(0);

  const refs = useRef<(HTMLElement | null)[]>([]);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const i = refs.current.indexOf(entry.target as HTMLElement);
            if (i >= 0) setCurrent(i);
          }
        }
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="lp-walk" ref={rootRef}>
      <div className="lp-walk-rail" aria-hidden>
        <span className="lp-walk-rail-fill" style={{ height: `${((current + 1) / STEPS.length) * 100}%` }} />
        {STEPS.map((s, i) => (
          <span key={s.n} className={["lp-walk-node", i <= current ? "is-past" : "", i === current ? "is-current" : ""].join(" ")} />
        ))}
      </div>
      <ol className="lp-walk-list">
        {STEPS.map((s, i) => (
          <li
            key={s.n}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={i === current ? "is-current" : undefined}
          >
            <span className="lp-walk-num mono">{s.n}</span>
            <h3>{s.name}</h3>
            <p>{s.body}</p>
            <code className="mono">{s.api}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}
