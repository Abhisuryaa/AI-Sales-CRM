import { z } from "zod";

export const emailSchema = z.string().email().toLowerCase().trim();

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(8),
  name: z.string().min(1).max(120),
  role: z.enum(["ADMIN", "MANAGER", "SALES_REP", "VIEWER"]).default("SALES_REP"),
});

export const companyCreateSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(200).optional().nullable(),
  website: z.string().max(400).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  employeeCount: z.coerce.number().int().min(0).optional().nullable(),
  hqLocation: z.string().max(200).optional().nullable(),
  linkedinUrl: z.string().max(400).optional().nullable(),
  description: z.string().max(5000).optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
});

export const companyUpdateSchema = companyCreateSchema.partial();

export const contactCreateSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  title: z.string().max(120).optional().nullable(),
  linkedinUrl: z.string().max(400).optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
});

export const contactUpdateSchema = contactCreateSchema.partial();

export const dealCreateSchema = z.object({
  title: z.string().min(1).max(200),
  companyId: z.string().uuid(),
  contactId: z.string().uuid().optional().nullable(),
  value: z.coerce.number().min(0).default(0),
  currency: z.string().length(3).default("USD"),
  stage: z
    .enum(["NEW", "QUALIFIED", "DISCOVERY", "PROPOSAL", "NEGOTIATION", "WON", "LOST"])
    .default("NEW"),
  probability: z.coerce.number().int().min(0).max(100).optional().nullable(),
  expectedCloseDate: z.coerce.date().optional().nullable(),
  ownerId: z.string().uuid().optional().nullable(),
});

export const dealUpdateSchema = dealCreateSchema.partial().extend({
  stage: z
    .enum(["NEW", "QUALIFIED", "DISCOVERY", "PROPOSAL", "NEGOTIATION", "WON", "LOST"])
    .optional(),
});

export const taskCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  dueDate: z.coerce.date().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  assigneeId: z.string().uuid().optional().nullable(),
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]).optional(),
});

export const noteCreateSchema = z.object({
  body: z.string().min(1).max(10000),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
});

export const activityCreateSchema = z.object({
  type: z.enum([
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
  ]),
  subject: z.string().min(1).max(300),
  body: z.string().max(10000).optional().nullable(),
  companyId: z.string().uuid().optional().nullable(),
  contactId: z.string().uuid().optional().nullable(),
  dealId: z.string().uuid().optional().nullable(),
});

export const leadCreateSchema = z.object({
  companyName: z.string().min(1).max(200),
  domain: z.string().max(200).optional().nullable(),
  website: z.string().max(400).optional().nullable(),
  contactFirstName: z.string().max(100).optional().nullable(),
  contactLastName: z.string().max(100).optional().nullable(),
  contactEmail: z.string().email().optional().nullable(),
  contactTitle: z.string().max(120).optional().nullable(),
  source: z.string().max(40).default("manual"),
  notes: z.string().max(10000).optional().nullable(),
});

export const emailDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected", "edited"]),
  editedSubject: z.string().max(300).optional(),
  editedBody: z.string().max(20000).optional(),
  feedback: z.string().max(5000).optional(),
});

export const adminUserUpdateSchema = z.object({
  role: z.enum(["ADMIN", "MANAGER", "SALES_REP", "VIEWER"]).optional(),
  isActive: z.boolean().optional(),
  name: z.string().min(1).max(120).optional(),
});

export const webhookEndpointCreateSchema = z.object({
  url: z.string().url().max(500),
  events: z.array(z.string().max(80)).min(1),
  secret: z.string().min(8).max(200),
  isActive: z.boolean().default(true),
});
