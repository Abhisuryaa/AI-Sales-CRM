"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, RefreshCw, X } from "lucide-react";

import { apiGet, apiPost } from "@/lib/fetcher";
import { useUser } from "@/lib/user-context";
import { formatDateTime } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

interface PendingEmail {
  id: string;
  leadId: string | null;
  lead: { id: string; companyName: string } | null;
  contact: { id: string; firstName: string; lastName: string; email: string } | null;
  subject: string;
  body: string;
  createdAt: string;
}

export default function ApprovalsPage() {
  const user = useUser();
  const [emails, setEmails] = useState<PendingEmail[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, { subject: string; body: string; feedback: string }>>({});

  const load = useCallback(async () => {
    try {
      const res = await apiGet<{ data: PendingEmail[] }>("/api/emails?status=pending_approval");
      setEmails(res.data);
    } catch (e) {
      toast.error((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function editState(em: PendingEmail) {
    return (
      edits[em.id] ?? {
        subject: em.subject,
        body: em.body,
        feedback: "",
      }
    );
  }

  async function decide(em: PendingEmail, decision: "approved" | "rejected" | "edited") {
    setBusy(em.id);
    try {
      const state = editState(em);
      await apiPost(`/api/emails/${em.id}/approve`, {
        decision,
        ...(decision !== "rejected"
          ? { editedSubject: state.subject !== em.subject ? state.subject : undefined, editedBody: state.body !== em.body ? state.body : undefined }
          : {}),
        feedback: state.feedback || undefined,
      });
      toast.success(decision === "rejected" ? "Rejected — lead marked rejected" : decision === "edited" ? "Edits saved and approved" : "Approved");
      await load();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return (
      <div className="rounded-md border bg-muted/40 p-6 text-sm text-muted-foreground">
        Approvals are restricted to managers and admins.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Approvals</h1>
        <Button size="sm" variant="outline" onClick={load}>
          <RefreshCw className="size-4" /> Refresh
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        AI-drafted outreach emails awaiting human review. Approve, edit, or reject — the lead pipeline moves with your decision.
      </p>

      {emails === null && <Skeleton className="h-40" />}
      {emails !== null && emails.length === 0 && (
        <div className="rounded-lg border bg-card p-10 text-center text-sm text-muted-foreground">
          Nothing pending. Run the AI pipeline on a lead to generate a draft.
        </div>
      )}

      <div className="grid gap-4">
        {emails?.map((em) => {
          const state = editState(em);
          const dirty = state.subject !== em.subject || state.body !== em.body;
          return (
            <Card key={em.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="text-base">{em.subject}</CardTitle>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {em.lead && <Badge variant="outline">{em.lead.companyName}</Badge>}
                    {em.contact && <span>to {em.contact.firstName} {em.contact.lastName}</span>}
                    <span>{formatDateTime(em.createdAt)}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`subj-${em.id}`} className="text-xs text-muted-foreground">
                    Subject
                  </Label>
                  <Textarea
                    id={`subj-${em.id}`}
                    rows={1}
                    value={state.subject}
                    onChange={(e) => setEdits({ ...edits, [em.id]: { ...state, subject: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`body-${em.id}`} className="text-xs text-muted-foreground">
                    Body
                  </Label>
                  <Textarea
                    id={`body-${em.id}`}
                    rows={8}
                    value={state.body}
                    onChange={(e) => setEdits({ ...edits, [em.id]: { ...state, body: e.target.value } })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`fb-${em.id}`} className="text-xs text-muted-foreground">
                    Feedback (optional, stored on the approval record)
                  </Label>
                  <Textarea
                    id={`fb-${em.id}`}
                    rows={2}
                    placeholder="Why you edited or rejected…"
                    value={state.feedback}
                    onChange={(e) => setEdits({ ...edits, [em.id]: { ...state, feedback: e.target.value } })}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" disabled={busy === em.id} onClick={() => decide(em, dirty ? "edited" : "approved")}>
                    {busy === em.id ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                    {dirty ? "Save & approve" : "Approve"}
                  </Button>
                  <Button size="sm" variant="destructive" disabled={busy === em.id} onClick={() => decide(em, "rejected")}>
                    <X className="size-4" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
