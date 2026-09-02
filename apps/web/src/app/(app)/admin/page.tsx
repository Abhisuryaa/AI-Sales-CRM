"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import { ROLES, formatDateTime } from "@/lib/types";
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

interface UserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: string;
}

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

interface EndpointRow {
  id: string;
  url: string;
  events: string[];
  isActive: boolean;
}

interface TabProps {
  users: UserRow[];
  onRoleChange: (u: UserRow, role: string) => void;
  onToggleActive: (u: UserRow) => void;
}

function UsersTab({ users, onRoleChange, onToggleActive }: TabProps) {
  return (
    <div className="rounded-lg border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="font-medium">{u.name}</TableCell>
              <TableCell className="text-muted-foreground">{u.email}</TableCell>
              <TableCell>
                <select
                  className="h-8 rounded-md border bg-background px-2 text-xs"
                  value={u.role}
                  onChange={(e) => onRoleChange(u, e.target.value)}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </TableCell>
              <TableCell>
                <button onClick={() => onToggleActive(u)} title="Toggle active">
                  <Badge variant={u.isActive ? "success" : "destructive"}>{u.isActive ? "active" : "disabled"}</Badge>
                </button>
              </TableCell>
              <TableCell className="text-muted-foreground">{formatDateTime(u.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [audit, setAudit] = useState<AuditRow[] | null>(null);
  const [endpoints, setEndpoints] = useState<EndpointRow[] | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", name: "", role: "SALES_REP" });
  const [endpointForm, setEndpointForm] = useState({ url: "", secret: "", events: "lead.created" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [u, a, e] = await Promise.all([
        apiGet<{ data: UserRow[] }>("/api/admin/users"),
        apiGet<{ data: AuditRow[] }>("/api/admin/audit-logs?limit=100"),
        apiGet<{ data: EndpointRow[] }>("/api/admin/webhook-endpoints"),
      ]);
      setUsers(u.data);
      setAudit(a.data);
      setEndpoints(e.data);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function patchUser(u: UserRow, body: Record<string, unknown>) {
    try {
      await apiPatch(`/api/admin/users/${u.id}`, body);
      toast.success("User updated");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function createUser(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/admin/users", form);
      toast.success("User created");
      setCreateOpen(false);
      setForm({ email: "", password: "", name: "", role: "SALES_REP" });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addEndpoint(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/admin/webhook-endpoints", {
        url: endpointForm.url,
        secret: endpointForm.secret,
        events: endpointForm.events.split(",").map((s) => s.trim()).filter(Boolean),
      });
      toast.success("Endpoint added");
      setEndpointForm({ url: "", secret: "", events: "lead.created" });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Admin</h1>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-4" /> New user
        </Button>
      </div>

      {/* Users */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Users</h2>
        {users === null ? <Skeleton className="h-40" /> : <UsersTab users={users} onRoleChange={(u, role) => patchUser(u, { role })} onToggleActive={(u) => patchUser(u, { isActive: !u.isActive })} />}
      </section>

      {/* Webhook endpoints */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Outgoing webhook endpoints</h2>
        <div className="rounded-lg border bg-card p-4">
          {endpoints !== null && endpoints.length === 0 && (
            <p className="mb-3 text-sm text-muted-foreground">No endpoints registered.</p>
          )}
          {endpoints?.map((e) => (
            <div key={e.id} className="mb-2 flex items-center justify-between rounded-md border p-2 text-sm">
              <span className="font-medium">{e.url}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {e.events.join(", ")}
                <Badge variant={e.isActive ? "success" : "destructive"}>{e.isActive ? "active" : "off"}</Badge>
              </span>
            </div>
          ))}
          <form onSubmit={addEndpoint} className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <Input placeholder="https://your-service/hook" required value={endpointForm.url} onChange={(e) => setEndpointForm({ ...endpointForm, url: e.target.value })} />
            <Input placeholder="Signing secret (8+ chars)" required minLength={8} value={endpointForm.secret} onChange={(e) => setEndpointForm({ ...endpointForm, secret: e.target.value })} />
            <Input placeholder="events (comma-separated)" value={endpointForm.events} onChange={(e) => setEndpointForm({ ...endpointForm, events: e.target.value })} />
            <Button type="submit" disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
              Add
            </Button>
          </form>
        </div>
      </section>

      {/* Audit log */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold uppercase text-muted-foreground">Audit log</h2>
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {audit === null && (
                <TableRow>
                  <TableCell colSpan={4}>
                    <Skeleton className="h-8 w-full" />
                  </TableCell>
                </TableRow>
              )}
              {audit?.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(a.createdAt)}</TableCell>
                  <TableCell>{a.actor?.name ?? "system"}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{a.action}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.entityType}
                    {a.entityId ? ` · ${a.entityId.slice(0, 8)}…` : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </section>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create user</DialogTitle>
            <DialogDescription>Users sign in with email + password.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createUser} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="auname">Name</Label>
              <Input id="auname" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="auemail">Email</Label>
              <Input id="auemail" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aupass">Password (8+ chars)</Label>
              <Input id="aupass" type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aurole">Role</Label>
              <select
                id="aurole"
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
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
