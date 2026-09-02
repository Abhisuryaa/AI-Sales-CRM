"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/fetcher";
import { ACTIVITY_TYPES, formatDateTime } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityRow {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  occurredAt: string;
  deal: { id: string; title: string } | null;
  contact: { id: string; firstName: string; lastName: string } | null;
  company: { id: string; name: string } | null;
  actor: { id: string; name: string } | null;
}

function typeVariant(type: string): "success" | "default" | "secondary" | "destructive" | "outline" {
  if (type === "APPROVAL") return "success";
  if (type === "AGENT_RUN" || type === "ENRICHMENT" || type === "QUALIFICATION") return "default";
  if (type === "STAGE_CHANGE") return "secondary";
  if (type === "WEBHOOK") return "outline";
  return "secondary";
}

export default function ActivityPage() {
  const [rows, setRows] = useState<ActivityRow[] | null>(null);
  const [typeFilter, setTypeFilter] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: ActivityRow[] }>(`/api/activities?limit=100${typeFilter ? `&type=${typeFilter}` : ""}`);
      setRows(res.data);
    } catch {
      setRows([]);
    }
  }, [typeFilter]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Activity timeline</h1>
        <select
          className="h-9 rounded-md border bg-background px-3 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {ACTIVITY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border bg-card p-4">
        {rows === null && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </div>
        )}
        {rows !== null && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
        )}
        <ol className="relative space-y-4 border-l pl-4">
          {rows?.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-primary" />
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={typeVariant(a.type)}>{a.type.replaceAll("_", " ")}</Badge>
                <span className="text-sm font-medium">{a.subject}</span>
              </div>
              {a.body && <p className="mt-0.5 whitespace-pre-wrap text-xs text-muted-foreground">{a.body}</p>}
              <div className="mt-0.5 text-xs text-muted-foreground">
                {a.actor?.name ?? "system"}
                {a.deal ? ` · ${a.deal.title}` : ""}
                {a.company ? ` · ${a.company.name}` : ""}
                {` · ${formatDateTime(a.occurredAt)}`}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
