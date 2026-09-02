"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Rocket } from "lucide-react";

import { apiGet, apiPost } from "@/lib/fetcher";
import { LEAD_STATUSES, formatDateTime } from "@/lib/types";
import { useUser } from "@/lib/user-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";

interface LeadRow {
  id: string;
  companyName: string;
  domain: string | null;
  contactFirstName: string | null;
  contactLastName: string | null;
  contactEmail: string | null;
  contactTitle: string | null;
  status: string;
  tier: string | null;
  score: number | null;
  source: string;
  createdAt: string;
}

interface AgentStep {
  step: string;
  status: string;
  detail?: string;
  at?: string;
}

interface LeadDetail extends LeadRow {
  notes: string | null;
  research: Record<string, unknown> | null;
  enrichment: Record<string, unknown> | null;
  decisionMakers: Record<string, unknown> | null;
  qualification: Record<string, unknown> | null;
  error: string | null;
  emails: { id: string; subject: string; body: string; status: string; createdAt: string }[];
  agentRuns: {
    id: string;
    status: string;
    currentStep: string | null;
    steps: AgentStep[] | null;
    error: string | null;
    provider: string | null;
    tokensUsed: number | null;
  }[];
  convertedCompany: { id: string; name: string } | null;
  convertedDeal: { id: string; title: string } | null;
}

function tierVariant(tier: string | null): "success" | "secondary" | "destructive" | "outline" {
  if (tier === "HOT") return "success";
  if (tier === "WARM") return "secondary";
  if (tier === "UNQUALIFIED") return "destructive";
  return "outline";
}

function statusVariant(status: string): "success" | "secondary" | "destructive" | "outline" | "default" {
  if (status === "APPROVED" || status === "CONVERTED") return "success";
  if (status === "PENDING_APPROVAL") return "default";
  if (status === "REJECTED" || status === "FAILED") return "destructive";
  if (status === "NEW") return "outline";
  return "secondary";
}

const PIPELINE_ACTIVE: Record<string, true> = { RESEARCHING: true, ENRICHING: true, IDENTIFYING: true, QUALIFYING: true, DRAFTING: true };

const EMPTY_FORM = {
  companyName: "",
  domain: "",
  contactFirstName: "",
  contactLastName: "",
  contactEmail: "",
  contactTitle: "",
  notes: "",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<LeadRow[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [selected, setSelected] = useState<LeadDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: LeadRow[] }>(`/api/leads${statusFilter ? `?status=${statusFilter}` : ""}`);
      setLeads(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while any lead is mid-pipeline so statuses update live.
  useEffect(() => {
    const anyActive = (leads ?? []).some((l) => PIPELINE_ACTIVE[l.status]);
    if (anyActive && !pollRef.current) {
      pollRef.current = window.setInterval(load, 4000);
    } else if (!anyActive && pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [leads, load]);

  async function openDetail(id: string) {
    try {
      const d = await apiGet<LeadDetail>(`/api/leads/${id}`);
      setSelected(d);
      setDetailOpen(true);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function runPipeline(id: string) {
    setBusy(id);
    try {
      await apiPost(`/api/leads/${id}/run`);
      toast.success("AI pipeline started");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function convert(id: string) {
    setBusy(id);
    try {
      await apiPost(`/api/leads/${id}/convert`);
      toast.success("Converted to company, contact, and deal");
      setDetailOpen(false);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function createLead(e: React.FormEvent) {
    e.preventDefault();
    setBusy("create");
    try {
      const payload = Object.fromEntries(
        Object.entries(form).map(([k, v]) => [k, v.trim() === "" ? null : v.trim()]),
      );
      await apiPost("/api/leads", payload);
      toast.success("Lead created");
      setCreateOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
        <div className="flex items-center gap-2">
          <select
            className="h-9 rounded-md border bg-background px-3 text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            {LEAD_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-4" /> New lead
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Company</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leads === null && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {leads !== null && leads.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  No leads yet — create one and run the AI pipeline.
                </TableCell>
              </TableRow>
            )}
            {leads?.map((l) => (
              <TableRow key={l.id} className="cursor-pointer" onClick={() => openDetail(l.id)}>
                <TableCell className="font-medium">{l.companyName}</TableCell>
                <TableCell>
                  {l.contactFirstName || l.contactLastName
                    ? `${l.contactFirstName ?? ""} ${l.contactLastName ?? ""}`.trim()
                    : "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(l.status)}>
                    {PIPELINE_ACTIVE[l.status] && <Loader2 className="mr-1 size-3 animate-spin" />}
                    {l.status.replaceAll("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell>{l.tier ? <Badge variant={tierVariant(l.tier)}>{l.tier}</Badge> : "—"}</TableCell>
                <TableCell className="text-right">{l.score ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{l.source}</TableCell>
                <TableCell className="text-muted-foreground">{formatDateTime(l.createdAt)}</TableCell>
                <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={PIPELINE_ACTIVE[l.status] || busy === l.id || l.status === "CONVERTED"}
                    onClick={() => runPipeline(l.id)}
                  >
                    {busy === l.id ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                    Run AI
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create lead */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>New lead</DialogTitle>
            <DialogDescription>Create a lead, then run the AI pipeline on it.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createLead} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="companyName">Company name *</Label>
              <Input id="companyName" required value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="domain">Domain</Label>
              <Input id="domain" placeholder="acme.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctitle">Contact title</Label>
              <Input id="ctitle" value={form.contactTitle} onChange={(e) => setForm({ ...form, contactTitle: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cfirst">First name</Label>
              <Input id="cfirst" value={form.contactFirstName} onChange={(e) => setForm({ ...form, contactFirstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clast">Last name</Label>
              <Input id="clast" value={form.contactLastName} onChange={(e) => setForm({ ...form, contactLastName: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cemail">Contact email</Label>
              <Input id="cemail" type="email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy === "create"}>
                {busy === "create" && <Loader2 className="size-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Lead detail */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.companyName}
                  <Badge variant={statusVariant(selected.status)}>{selected.status.replaceAll("_", " ")}</Badge>
                  {selected.tier && <Badge variant={tierVariant(selected.tier)}>{selected.tier}</Badge>}
                  {selected.score != null && <span className="text-sm font-normal text-muted-foreground">score {selected.score}</span>}
                </DialogTitle>
                <DialogDescription>
                  {selected.domain ?? "no domain"} · source {selected.source} · created {formatDateTime(selected.createdAt)}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                {selected.error && (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                    {selected.error}
                  </div>
                )}

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <InfoBlock title="Research" data={selected.research} />
                  <InfoBlock title="Enrichment" data={selected.enrichment} />
                  <InfoBlock title="Decision makers" data={selected.decisionMakers} />
                  <InfoBlock title="Qualification" data={selected.qualification} />
                </div>

                {selected.agentRuns.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Agent runs</h4>
                    {selected.agentRuns.map((r) => (
                      <div key={r.id} className="mb-2 rounded-md border p-2 text-xs">
                        <div className="mb-1 flex items-center gap-2">
                          <Badge variant={r.status === "succeeded" ? "success" : r.status === "failed" ? "destructive" : "secondary"}>
                            {r.status}
                          </Badge>
                          <span className="text-muted-foreground">
                            {r.provider ?? "—"} · {r.tokensUsed ?? 0} tokens
                          </span>
                        </div>
                        <ol className="ml-1 space-y-0.5 border-l pl-3">
                          {(r.steps ?? []).map((s, i) => (
                            <li key={i} className="text-muted-foreground">
                              <span className="font-medium text-foreground">{s.step}</span> — {s.status}
                              {s.at ? ` · ${formatDateTime(s.at)}` : ""}
                            </li>
                          ))}
                        </ol>
                        {r.error && <p className="mt-1 text-destructive">{r.error}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {selected.emails.length > 0 && (
                  <div>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Draft emails</h4>
                    {selected.emails.map((em) => (
                      <div key={em.id} className="mb-2 rounded-md border p-3">
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="text-sm font-medium">{em.subject}</span>
                          <Badge variant={em.status === "approved" ? "success" : em.status === "pending_approval" ? "default" : "destructive"}>
                            {em.status.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <p className="whitespace-pre-wrap text-xs text-muted-foreground">{em.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {selected.convertedCompany && (
                  <div className="rounded-md border border-success/40 bg-success/10 p-3 text-sm">
                    Converted → company <span className="font-medium">{selected.convertedCompany.name}</span>
                    {selected.convertedDeal ? ` · deal ${selected.convertedDeal.title}` : ""}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  disabled={PIPELINE_ACTIVE[selected.status] || busy === selected.id || selected.status === "CONVERTED"}
                  onClick={() => runPipeline(selected.id)}
                >
                  {busy === selected.id ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                  Run AI pipeline
                </Button>
                {selected.status === "APPROVED" && (
                  <Button disabled={busy === selected.id} onClick={() => convert(selected.id)}>
                    {busy === selected.id ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
                    Convert to CRM
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoBlock({ title, data }: { title: string; data: Record<string, unknown> | null }) {
  return (
    <div className="rounded-md border p-2">
      <h4 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{title}</h4>
      {data ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words text-[11px] leading-relaxed">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-xs text-muted-foreground">Not run yet</p>
      )}
    </div>
  );
}
