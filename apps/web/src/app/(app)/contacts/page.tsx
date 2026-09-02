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

interface ContactRow {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  title: string | null;
  isDecisionMaker: boolean;
  decisionScore: number | null;
  company: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  createdAt: string;
}

interface CompanyOption {
  id: string;
  name: string;
}

const EMPTY_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  title: "",
  companyId: "",
  isDecisionMaker: false,
  decisionScore: "",
};

export default function ContactsPage() {
  const user = useUser();
  const [rows, setRows] = useState<ContactRow[] | null>(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [q, setQ] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ContactRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: ContactRow[] }>(`/api/contacts${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setRows(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  async function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
    try {
      const res = await apiGet<{ data: CompanyOption[] }>("/api/companies");
      setCompanies(res.data);
    } catch {
      // select just won't have options
    }
  }

  async function openEdit(row: ContactRow) {
    setEditing(row);
    setForm({
      firstName: row.firstName,
      lastName: row.lastName,
      email: row.email ?? "",
      phone: row.phone ?? "",
      title: row.title ?? "",
      companyId: row.company?.id ?? "",
      isDecisionMaker: row.isDecisionMaker,
      decisionScore: row.decisionScore?.toString() ?? "",
    });
    setDialogOpen(true);
    try {
      const res = await apiGet<{ data: CompanyOption[] }>("/api/companies");
      setCompanies(res.data);
    } catch {
      // select just won't have options
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const payload: Record<string, unknown> = {
      firstName: form.firstName,
      lastName: form.lastName,
      email: form.email || null,
      phone: form.phone || null,
      title: form.title || null,
      companyId: form.companyId || null,
      isDecisionMaker: form.isDecisionMaker,
      decisionScore: form.decisionScore === "" ? null : Number(form.decisionScore),
    };
    try {
      if (editing) {
        await apiPatch(`/api/contacts/${editing.id}`, payload);
        toast.success("Contact updated");
      } else {
        await apiPost("/api/contacts", payload);
        toast.success("Contact created");
      }
      setDialogOpen(false);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(row: ContactRow) {
    if (!window.confirm(`Delete ${row.firstName} ${row.lastName}?`)) return;
    try {
      await apiDelete(`/api/contacts/${row.id}`);
      toast.success("Contact deleted");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const canMutate = user.role !== "VIEWER";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Contacts</h1>
        {canMutate && (
          <Button size="sm" onClick={openCreate}>
            <Plus className="size-4" /> New contact
          </Button>
        )}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Search contacts…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Decision maker</TableHead>
              <TableHead>Owner</TableHead>
              {canMutate && <TableHead className="w-24 text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow>
                <TableCell colSpan={canMutate ? 7 : 6}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {rows !== null && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={canMutate ? 7 : 6} className="py-10 text-center text-sm text-muted-foreground">
                  No contacts yet.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">
                  {c.firstName} {c.lastName}
                </TableCell>
                <TableCell>{c.title ?? "—"}</TableCell>
                <TableCell>{c.company?.name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                <TableCell>{c.isDecisionMaker ? `Yes${c.decisionScore != null ? ` (${c.decisionScore})` : ""}` : "—"}</TableCell>
                <TableCell>{c.owner?.name ?? "—"}</TableCell>
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
            <DialogTitle>{editing ? "Edit contact" : "New contact"}</DialogTitle>
            <DialogDescription>People at your target accounts.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cfirst">First name *</Label>
              <Input id="cfirst" required value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="clast">Last name *</Label>
              <Input id="clast" required value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cemail">Email</Label>
              <Input id="cemail" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cphone">Phone</Label>
              <Input id="cphone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ctitle">Title</Label>
              <Input id="ctitle" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ccompany">Company</Label>
              <select
                id="ccompany"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.companyId}
                onChange={(e) => setForm({ ...form, companyId: e.target.value })}
              >
                <option value="">No company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="cdm"
                type="checkbox"
                className="size-4 rounded border-input"
                checked={form.isDecisionMaker}
                onChange={(e) => setForm({ ...form, isDecisionMaker: e.target.checked })}
              />
              <Label htmlFor="cdm" className="font-normal">
                Decision maker
              </Label>
              {form.isDecisionMaker && (
                <Input
                  className="ml-2 h-8 w-24"
                  type="number"
                  min="0"
                  max="100"
                  placeholder="Score"
                  value={form.decisionScore}
                  onChange={(e) => setForm({ ...form, decisionScore: e.target.value })}
                />
              )}
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
