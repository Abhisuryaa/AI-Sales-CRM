"use client";

import { useEffect, useRef, useState } from "react";

const STATIONS = [
  "Research",
  "Enrich",
  "Makers",
  "Qualify",
  "Draft",
  "Approve",
  "Convert",
  "Follow-up",
] as const;

interface SimLead {
  company: string;
  domain: string;
  contact: string;
  signals: number;
  score: number;
  tier: "HOT" | "WARM" | "UNQUALIFIED";
  outcome: "approved" | "rejected";
}

const LEADS: SimLead[] = [
  { company: "Northwind Traders", domain: "northwindtraders.com", contact: "Elena Rodriguez · COO", signals: 4, score: 87, tier: "HOT", outcome: "approved" },
  { company: "Globex Corporation", domain: "globex.com", contact: "Katherine Avery · RevOps", signals: 3, score: 64, tier: "WARM", outcome: "approved" },
  { company: "Workerloop Co", domain: "workerloop.co", contact: "Dana Vey · Founder", signals: 1, score: 18, tier: "UNQUALIFIED", outcome: "rejected" },
];

function logFor(station: number, lead: SimLead): string {
  switch (station) {
    case 0:
      return `research · ${lead.domain} — ${lead.signals} buying signals found`;
    case 1:
      return `enrich · ${lead.domain} — firmographics merged`;
    case 2:
      return `makers · ${lead.contact.split(" · ")[0]} flagged as signer`;
    case 3:
      return `qualify · score ${lead.score} → ${lead.tier}`;
    case 4:
      return `draft · email cites their own words`;
    case 5:
      return lead.outcome === "rejected" ? "draft withheld — lead rejected" : `waiting for a human yes…`;
    case 6:
      return `convert · company + contact + deal created`;
    case 7:
      return `follow-up · scheduled if quiet 24h`;
    default:
      return "";
  }
}

export function PipelineHero() {
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(true);
  const [leadIdx, setLeadIdx] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [tier, setTier] = useState<SimLead["tier"] | null>(null);
  const [stamp, setStamp] = useState<"approved" | "rejected" | null>(null);
  const [converted, setConverted] = useState(false);
  const [followups, setFollowups] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (reduced || !visible) return;
    let cancelled = false;
    const timers: number[] = [];
    const wait = (ms: number) =>
      new Promise<void>((resolve) => {
        const t = window.setTimeout(resolve, ms);
        timers.push(t);
      });

    async function countTo(target: number) {
      const steps = 24;
      for (let i = 1; i <= steps; i++) {
        if (cancelled) return;
        setScore(Math.round((target * i) / steps));
        await wait(32);
      }
    }

    (async () => {
      while (!cancelled) {
        for (let li = 0; li < LEADS.length; li++) {
          if (cancelled) return;
          const lead = LEADS[li];
          setLeadIdx(li);
          setActive(null);
          setScore(0);
          setTier(null);
          setStamp(null);
          setConverted(false);
          setFollowups(false);
          await wait(600);
          for (let s = 0; s < STATIONS.length; s++) {
            if (cancelled) return;
            setActive(s);
            if (s === 3) {
              await countTo(lead.score);
              setTier(lead.tier);
              if (lead.outcome === "rejected") {
                await wait(500);
                if (cancelled) return;
                setStamp("rejected");
                await wait(1900);
                break;
              }
            }
            if (s === 5) setStamp("approved");
            if (s === 6) setConverted(true);
            if (s === 7) {
              setFollowups(true);
              await wait(1000);
            }
            await wait(s === 5 ? 1250 : 900);
          }
          await wait(1400);
        }
      }
    })();

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [reduced, visible]);

  const lead = LEADS[leadIdx];
  const done = reduced ? STATIONS.length - 1 : active;
  const tokenLeft = `calc((${(active ?? 0) + 0.5}) * 12.5%)`;

  return (
    <div className="lp-sim" ref={rootRef} aria-label="Simulated AI pipeline run">
      <div className="lp-sim-head">
        <span className="lp-sim-label">
          LIVE PIPELINE — SIMULATION
          <span className="lp-caret" aria-hidden />
        </span>
        <span className="lp-sim-src">synthetic data</span>
      </div>

      <div className="lp-track" role="img" aria-label={`Stations: ${STATIONS.join(", ")}`}>
        {STATIONS.map((label, i) => (
          <div className="lp-station" key={label}>
            <span
              className={[
                "lp-node",
                i === 5 ? "lp-node-human" : "lp-node-agent",
                done !== null && i < done ? "is-done" : "",
                active === i ? "is-active" : "",
              ].join(" ")}
            />
            <span className={["lp-node-label", active === i ? "is-active" : ""].join(" ")}>{label}</span>
          </div>
        ))}
        <span className="lp-token" style={{ left: tokenLeft }} aria-hidden />
      </div>

      <div className="lp-sim-body">
        <div className="lp-lead-card">
          {converted ? (
            <div className="lp-converted">
              <span className="lp-conv-kicker mono">CRM UPDATE</span>
              <span className="lp-conv-name">{lead.company}</span>
              <span className="lp-conv-meta mono">deal created · owner assigned</span>
              <span className={["lp-conv-emails", followups ? "is-in" : ""].join(" ")} aria-hidden>
                <span className="lp-email-chip">follow-up 1 · +24h</span>
                <span className="lp-email-chip">follow-up 2 · +72h</span>
              </span>
            </div>
          ) : (
            <>
              <span className="lp-lead-name">{lead.company}</span>
              <span className="lp-lead-meta">{lead.contact}</span>
              <span className="lp-lead-meta mono">{lead.domain}</span>
            </>
          )}
          {stamp && !converted && (
            <span className={["lp-stamp", stamp === "rejected" ? "lp-stamp-reject" : ""].join(" ")}>
              {stamp === "approved" ? "APPROVED" : "REJECTED"}
              <small>{stamp === "approved" ? "by a human" : "by the AI"}</small>
            </span>
          )}
        </div>

        <div className="lp-readout">
          <p className="lp-log mono">{active !== null ? logFor(active, lead) : "idle — waiting for lead…"}</p>
          <div className="lp-score-row">
            <span className="lp-score mono">
              {String(score).padStart(2, "0")}
              <small>/100</small>
            </span>
            <span className={["lp-tier", tier ? `lp-tier-${tier.toLowerCase()}` : "", tier ? "is-in" : ""].join(" ")}>
              {tier ?? "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
