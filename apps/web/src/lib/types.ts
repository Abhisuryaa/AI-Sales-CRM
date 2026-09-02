export type Role = "ADMIN" | "MANAGER" | "SALES_REP" | "VIEWER";

export const ROLES: Role[] = ["ADMIN", "MANAGER", "SALES_REP", "VIEWER"];

export const DEAL_STAGES = [
  "NEW",
  "QUALIFIED",
  "DISCOVERY",
  "PROPOSAL",
  "NEGOTIATION",
  "WON",
  "LOST",
] as const;

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const TASK_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const LEAD_STATUSES = [
  "NEW",
  "RESEARCHING",
  "ENRICHING",
  "IDENTIFYING",
  "QUALIFYING",
  "DRAFTING",
  "PENDING_APPROVAL",
  "APPROVED",
  "CONVERTED",
  "REJECTED",
  "FAILED",
] as const;

export const ACTIVITY_TYPES = [
  "NOTE",
  "CALL",
  "MEETING",
  "EMAIL_SENT",
  "EMAIL_RECEIVED",
  "STAGE_CHANGE",
  "ENRICHMENT",
  "QUALIFICATION",
  "APPROVAL",
  "WEBHOOK",
  "AGENT_RUN",
  "SYSTEM",
] as const;

export const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

export function formatMoney(value: number | string | null | undefined, currency = "USD") {
  const n = typeof value === "string" ? parseFloat(value) : value;
  if (n == null || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export function formatDate(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(value: string | Date | null | undefined) {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
