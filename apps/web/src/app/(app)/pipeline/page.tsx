"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import { DEAL_STAGES, formatDate, formatMoney } from "@/lib/types";
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

interface DealRow {
  id: string;
  title: string;
  companyId: string;
  company: { id: string; name: string };
  stage: string;
  status: string;
  value: string | number;
  currency: string;
  owner: { id: string; name: string } | null;
  expectedCloseDate: string | null;
}

interface CompanyOption {
  id: string;
  name: string;
}

const VISIBLE_STAGES = DEAL_STAGES;

export default function PipelinePage() {
  const [deals, setDeals] = useState<DealRow[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ title: "", companyId: "", value: "", contactId: "" });

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: DealRow[] }>("/api/deals");
      setDeals(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = useCallback(async () => {
    setCreateOpen(true);
    try {
      const res = await apiGet<{ data: CompanyOption[] }>("/api/companies");
      setCompanies(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  async function onDrop(stage: string) {
    setDropStage(null);
    if (!dragId) return;
    const deal = deals?.find((d) => d.id === dragId);
    setDragId(null);
    if (!deal || deal.stage === stage) return;

    setDeals((prev) => prev?.map((d) => (d.id === deal.id ? { ...d, stage } : d)) ?? prev);
    try {
      await apiPatch(`/api/deals/${deal.id}`, { stage });
      toast.success(`Moved to ${stage.toLowerCase()}`);
      await load();
    } catch (e) {
      toast.error((e as Error).message);
      await load();
    }
  }

  async function createDeal(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/deals", {
        title: form.title,
        companyId: form.companyId,
        value: form.value === "" ? 0 : Number(form.value),
      });
      toast.success("Deal created");
      setCreateOpen(false);
      setForm({ title: "", companyId: "", value: "", contactId: "" });
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-full flex-col space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Pipeline</h1>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> New deal
        </Button>
      </div>

      <div className="grid flex-1 grid-flow-col auto-cols-[minmax(15rem,1fr)] gap-3 overflow-x-auto pb-4">
        {VISIBLE_STAGES.map((stage) => {
          const stageDeals = (deals ?? []).filter((d) => d.stage === stage);
          const total = stageDeals.reduce((sum, d) => sum + Number(d.value), 0);
          return (
            <div
              key={stage}
              className={`flex min-h-64 flex-col rounded-lg border p-2 transition-colors ${
                dropStage === stage ? "border-primary bg-primary/5" : "bg-muted/30"
              }`}
              onDragOver={(e) => {
                e.preventDefault();
                setDropStage(stage);
              }}
              onDragLeave={() => setDropStage((s) => (s === stage ? null : s))}
              onDrop={() => onDrop(stage)}
            >
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {stage.replaceAll("_", " ")}
                </span>
                <Badge variant="outline" className="text-[10px]">
                  {stageDeals.length} · {formatMoney(total)}
                </Badge>
              </div>
              <div className="flex-1 space-y-2">
                {deals === null && <Skeleton className="h-20" />}
                {stageDeals.map((d) => (
                  <div
                    key={d.id}
                    draggable
                    onDragStart={() => setDragId(d.id)}
                    onDragEnd={() => setDragId(null)}
                    className={`cursor-grab rounded-md border bg-card p-3 shadow-sm transition-opacity active:cursor-grabbing ${
                      dragId === d.id ? "opacity-50" : ""
                    }`}
                  >
                    <div className="text-sm font-medium leading-tight">{d.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{d.company.name}</div>
                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="font-semibold">{formatMoney(d.value, d.currency)}</span>
                      {d.status !== "OPEN" && (
                        <Badge variant={d.status === "WON" ? "success" : "destructive"}>{d.status}</Badge>
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {d.owner?.name ?? "unassigned"}
                      {d.expectedCloseDate ? ` · close ${formatDate(d.expectedCloseDate)}` : ""}
                    </div>
                  </div>
                ))}
                {deals !== null && stageDeals.length === 0 && (
                  <p className="px-1 py-4 text-center text-xs text-muted-foreground">Drop deals here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New deal</DialogTitle>
            <DialogDescription>Create a deal and drag it through the pipeline.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createDeal} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="dtitle">Title *</Label>
              <Input id="dtitle" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dcompany">Company *</Label>
              <select
                id="dcompany"
                required
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              >
                <option value="">Select company…</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dvalue">Value (USD)</Label>
              <Input id="dvalue" type="number" min="0" step="100" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
