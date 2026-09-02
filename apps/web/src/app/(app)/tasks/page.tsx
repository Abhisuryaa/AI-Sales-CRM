"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import { apiGet, apiPatch, apiPost } from "@/lib/fetcher";
import { TASK_PRIORITIES, TASK_STATUSES, formatDate } from "@/lib/types";
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

interface TaskRow {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  completedAt: string | null;
  deal: { id: string; title: string } | null;
  assignee: { id: string; name: string } | null;
}

function priorityVariant(p: string): "destructive" | "default" | "secondary" | "outline" {
  if (p === "URGENT") return "destructive";
  if (p === "HIGH") return "default";
  if (p === "MEDIUM") return "secondary";
  return "outline";
}

const EMPTY_FORM = { title: "", description: "", priority: "MEDIUM", dueDate: "" };

export default function TasksPage() {
  const [rows, setRows] = useState<TaskRow[] | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: TaskRow[] }>("/api/tasks");
      setRows(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await apiPost("/api/tasks", {
        title: form.title,
        description: form.description || null,
        priority: form.priority,
        dueDate: form.dueDate || null,
      });
      toast.success("Task created");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cycleStatus(row: TaskRow) {
    const next = row.status === "TODO" ? "IN_PROGRESS" : row.status === "IN_PROGRESS" ? "DONE" : "TODO";
    try {
      await apiPatch(`/api/tasks/${row.id}`, { status: next });
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4" /> New task
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Deal</TableHead>
              <TableHead>Assignee</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Skeleton className="h-8 w-full" />
                </TableCell>
              </TableRow>
            )}
            {rows !== null && rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                  No tasks yet.
                </TableCell>
              </TableRow>
            )}
            {rows?.map((t) => (
              <TableRow key={t.id}>
                <TableCell>
                  <div className="font-medium leading-tight">{t.title}</div>
                  {t.description && <div className="text-xs text-muted-foreground">{t.description}</div>}
                </TableCell>
                <TableCell>
                  <button
                    className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    onClick={() => cycleStatus(t)}
                    title="Click to cycle status"
                  >
                    <Badge variant={t.status === "DONE" ? "success" : t.status === "IN_PROGRESS" ? "default" : "outline"}>
                      {t.status.replaceAll("_", " ")}
                    </Badge>
                  </button>
                </TableCell>
                <TableCell>
                  <Badge variant={priorityVariant(t.priority)}>{t.priority}</Badge>
                </TableCell>
                <TableCell className={t.dueDate && new Date(t.dueDate) < new Date() && t.status !== "DONE" ? "font-medium text-destructive" : ""}>
                  {formatDate(t.dueDate)}
                </TableCell>
                <TableCell className="max-w-40 truncate text-muted-foreground">{t.deal?.title ?? "—"}</TableCell>
                <TableCell>{t.assignee?.name ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New task</DialogTitle>
            <DialogDescription>Follow-ups, to-dos, and reminders.</DialogDescription>
          </DialogHeader>
          <form onSubmit={create} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="ttitle">Title *</Label>
              <Input id="ttitle" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tdesc">Description</Label>
              <Textarea id="tdesc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="tprio">Priority</Label>
                <select
                  id="tprio"
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: e.target.value })}
                >
                  {TASK_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tdue">Due date</Label>
                <Input id="tdue" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
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
