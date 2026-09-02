"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";

import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import { formatDate } from "@/lib/types";
import { useUser } from "@/lib/user-context";
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

interface CompanyRow {
  id: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employeeCount: number | null;
  hqLocation: string | null;
  description: string | null;
  owner: { id: string; name: string } | null;
  createdAt: string;
}

const EMPTY_FORM = {
  name: "",
  domain: "",
  website: "",
  industry: "",
  employeeCount: "",
  hqLocation: "",
  description: "",
};

export default function CompaniesPage() {
  const user = useUser();
  const [rows, setRows] = useState<CompanyRow[] | null>(null);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CompanyRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: CompanyRow[] }>(`/api/companies${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setRows(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(row: CompanyRow) {
    setEditing(row);
    setForm({
      name: row.name,
      domain: row.domain ?? "",
      website: row.website ?? "",
      industry: row.industry ?? "",
      employeeCount: row.employeeCount?.toString() ?? "",
      hqLocation: row.hqLocation ?? "",
      description: row.description ?? "",
    });
    setDialogOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {
      name: form.name,
      domain: form.domain || null,
      website: form.website || null,
      industry: form.industry || null,
      hqLocation: form.hqLocation || null,
      description: form.description || null,
      employeeCount: form.employeeCount === "" ? null : Number(form.employeeCount),
    };
    try {
      if (editing) {
        await apiPatch(`/api/companies/${editing.id}`, payload);
        toast.success("Company updated");
      } else {
        await apiPost("/api/companies", payload);
        toast.success("Company created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: CompanyRow) {
    if (!window.confirm(`Delete ${row.name}?`)) return;
    try {
      await apiDelete(`/api/companies/${row.id}`);
      toast.success("Company deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const canMutate = user.role !== "VIEWER";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Companies</h1>
        {canMutate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> New company
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Search companies…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Domain</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead className="text-right">Employees</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Created</TableHead>
              {canMutate && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow>
                <TableCell colSpan={8}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {rows !== null && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                  {emptyStateText(q)}
                </TableCell>
              </TableRow>
            )}
            {rows?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell className="text-muted-foreground">{c.domain ?? "—"}</TableCell>
                <TableCell>{c.industry ?? "—"}</TableCell>
                <TableCell className="text-right">{c.employeeCount ?? "—"}</TableCell>
                <TableCell>{c.hqLocation ?? "—"}</TableCell>
                <TableCell>{c.owner?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(c.createdAt)}</TableCell>
                {canMutate && (
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(c)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => remove(c)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit company" : "New company"}</DialogTitle>
            <DialogDescription>Track target accounts and their enrichment.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cname">Name *</Label>
              <Input id="cname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cdomain">Domain</Label>
              <Input id="cdomain" placeholder="acme.com" value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cwebsite">Website</Label>
              <Input id="cwebsite" placeholder="https://…" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cindustry">Industry</Label>
              <Input id="cindustry" value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cemp">Employees</Label>
              <Input id="cemp" type="number" min="0" value={form.employeeCount} onChange={(e) => setForm({ ...form, employeeCount: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="chq">HQ location</Label>
              <Input id="chq" value={form.hqLocation} onChange={(e) => setForm({ ...form, hqLocation: e.target.value })} />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="cdesc">Description</Label>
              <Textarea id="cdesc" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                {editing ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyStateText(q: string) {
  return q === "" ? "No companies yet — add your first target account." : `No companies match "${q}".`;
}
