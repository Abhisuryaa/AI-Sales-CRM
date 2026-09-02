"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Building2, Users, KanbanSquare, DollarSign, Percent, Clock, Target } from "lucide-react";

import { apiGet } from "@/lib/fetcher";
import { formatDate, formatDateTime, formatMoney } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface DashboardData {
  counts: {
    companies: number;
    contacts: number;
    openDeals: number;
    pipelineValue: number;
    winRate: number;
    tasksDueSoon: number;
  };
  dealsByStage: Record<string, { count: number; value: number }>;
  leadsByStatus: Record<string, number>;
  recentActivities: {
    id: string;
    type: string;
    subject: string;
    occurredAt: string;
    deal: { id: string; title: string } | null;
    actor: { id: string; name: string } | null;
  }[];
}

const STAGE_LABELS: Record<string, string> = {
  NEW: "New",
  QUALIFIED: "Qualified",
  DISCOVERY: "Discovery",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
};

function StatCard({
  title,
  value,
  icon: Icon,
  hint,
}: {
  title: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="size-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<DashboardData>("/api/dashboard").then(setData).catch((e) => setError(e.message));
  }, []);

  if (error) {
    return <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">Failed to load dashboard: {error}</div>;
  }
  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  const chartData = Object.entries(data.dealsByStage).map(([stage, v]) => ({
    stage: STAGE_LABELS[stage] ?? stage,
    value: v.value,
    count: v.count,
  }));

  const leadEntries = Object.entries(data.leadsByStatus).filter(([, n]) => n > 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Companies" value={data.counts.companies} icon={Building2} />
        <StatCard title="Contacts" value={data.counts.contacts} icon={Users} />
        <StatCard title="Open deals" value={data.counts.openDeals} icon={KanbanSquare} />
        <StatCard title="Pipeline value" value={formatMoney(data.counts.pipelineValue)} icon={DollarSign} />
        <StatCard title="Win rate" value={`${data.counts.winRate}%`} icon={Percent} hint="closed-won vs closed-lost" />
        <StatCard title="Tasks due (7d)" value={data.counts.tasksDueSoon} icon={Clock} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Open pipeline by stage</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="stage" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v: number) => `$${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value) => [formatMoney(Number(value)), "Value"]}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="value" fill="var(--primary)" radius={4} maxBarSize={56} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Target className="size-4" /> Leads by status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              {leadEntries.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No leads yet.{" "}
                  <Link className="underline" href="/leads">
                    Create one
                  </Link>{" "}
                  and run the AI pipeline.
                </p>
              )}
              {leadEntries.map(([status, n]) => (
                <div key={status} className="flex items-center justify-between text-sm">
                  <Link href={`/leads?status=${status}`} className="hover:underline">
                    {status.replaceAll("_", " ").toLowerCase()}
                  </Link>
                  <Badge variant={status === "FAILED" || status === "REJECTED" ? "destructive" : "secondary"}>
                    {n}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {data.recentActivities.map((a) => (
                <div key={a.id} className="text-sm">
                  <div className="font-medium leading-tight">{a.subject}</div>
                  <div className="text-xs text-muted-foreground">
                    {a.type.replaceAll("_", " ").toLowerCase()} · {a.actor?.name ?? "system"} · {formatDateTime(a.occurredAt)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
