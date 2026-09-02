"use client";

import { useEffect, useRef, useState } from "react";

const BOOT_LINES = [
  "agents.boot — 8 stations armed",
  "queue.poll — redis lock acquired",
  "research.northwindtraders.com — 4 buying signals",
  "qualify — score 87 → HOT · awaiting human",
  "approval.granted — morgan@acme.test",
  "crm.write — company · contact · deal",
  "queue.idle — workers sleeping",
] as const;

export function AgentTicker() {
  const [lines, setLines] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const t = window.setInterval(() => {
      setIdx((i) => i + 1);
      setLines((prev) => {
        const next = [...prev, BOOT_LINES[idx % BOOT_LINES.length]];
        return next.length > 5 ? next.slice(next.length - 5) : next;
      });
    }, 1400);
    return () => window.clearInterval(t);
  }, [visible, idx]);

  return (
    <div className="lp-ticker" ref={ref} aria-label="Agent service log (simulated)">
      <div className="lp-ticker-head mono">
        <span>services/agents</span>
        <span className="lp-ticker-dot" aria-hidden />
        <span>running</span>
      </div>
      <div className="lp-ticker-body mono" aria-live="off">
        {lines.map((l, i) => (
          <p key={`${l}-${i}`} className={i === lines.length - 1 ? "is-new" : undefined}>
            {l}
          </p>
        ))}
      </div>
    </div>
  );
}
