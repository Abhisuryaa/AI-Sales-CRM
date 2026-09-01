import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const TIER_CO = "Acme Manufacturing";

async function main() {
  console.log("seeding…");

  const admin = await prisma.user.upsert({
    where: { email: "admin@acme.test" },
    update: {},
    create: {
      email: "admin@acme.test",
      passwordHash: await bcrypt.hash("admin1234", 10),
      name: "Ada Admin",
      role: "ADMIN",
    },
  });

  const rep = await prisma.user.upsert({
    where: { email: "rep@acme.test" },
    update: {},
    create: {
      email: "rep@acme.test",
      passwordHash: await bcrypt.hash("rep1234", 10),
      name: "Sam Rep",
      role: "SALES_REP",
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: "manager@acme.test" },
    update: {},
    create: {
      email: "manager@acme.test",
      passwordHash: await bcrypt.hash("manager1234", 10),
      name: "Morgan Manager",
      role: "MANAGER",
    },
  });

  const co = await prisma.company.upsert({
    where: { domain: "acmemanufacturing.test" },
    update: {},
    create: {
      name: TIER_CO,
      domain: "acmemanufacturing.test",
      website: "https://acmemanufacturing.test",
      industry: "Industrial Manufacturing",
      employeeCount: 1200,
      hqLocation: "Cleveland, OH",
      description: "Mid-market industrial manufacturer with legacy CRM and expanding dealer network.",
      ownerId: admin.id,
    },
  });

  const contact = await prisma.contact.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      companyId: co.id,
      firstName: "Priya",
      lastName: "Natarajan",
      email: "priya@acmemanufacturing.test",
      title: "VP Sales Operations",
      isDecisionMaker: true,
      decisionScore: 82,
      ownerId: rep.id,
    },
  });

  const deal = await prisma.deal.upsert({
    where: { id: "00000000-0000-0000-0000-000000000002" },
    update: {},
    create: {
      id: "00000000-0000-0000-0000-000000000002",
      title: "Acme Manufacturing — CRM Consolidation",
      companyId: co.id,
      contactId: contact.id,
      stage: "PROPOSAL",
      status: "OPEN",
      value: 85000,
      currency: "USD",
      probability: 60,
      ownerId: rep.id,
    },
  });

  const existingActivities = await prisma.activity.count({ where: { dealId: deal.id } });
  if (existingActivities === 0) {
    await prisma.activity.createMany({
      data: [
        { type: "CALL", subject: "Intro call with Priya", body: "Discussed dealer-network pain points; wants reporting by region.", companyId: co.id, contactId: contact.id, dealId: deal.id, actorId: rep.id },
        { type: "MEETING", subject: "Demo #1 — pipeline + reporting", body: "Strong interest; asked about SSO and audit logs.", companyId: co.id, contactId: contact.id, dealId: deal.id, actorId: rep.id },
        { type: "NOTE", subject: "Internal note", body: "Budget cycle closes end of quarter; champion is VP Sales Ops.", companyId: co.id, dealId: deal.id, actorId: manager.id },
      ],
    });
  }

  const leads = [
    {
      companyName: "Northwind Traders",
      domain: "northwindtraders.com",
      contactFirstName: "Elena",
      contactLastName: "Rodriguez",
      contactEmail: "elena.rodriguez@northwindtraders.com",
      contactTitle: "COO",
      source: "webhook",
      notes: "Inbound from website form; expanding to 3 new regions.",
    },
    {
      companyName: "Globex Corporation",
      domain: "globex.com",
      contactFirstName: "Katherine",
      contactLastName: "Avery",
      contactEmail: "katherine.avery@globex.com",
      contactTitle: "Head of Revenue Ops",
      source: "n8n",
      notes: "Referral from Acme; evaluating consolidating 4 tools.",
    },
    {
      companyName: "Initech Solutions",
      domain: "initech.io",
      contactFirstName: "Bill",
      contactLastName: "Lumbergh",
      contactEmail: "bill@initech.io",
      contactTitle: "CTO",
      source: "manual",
      notes: "Met at SaaSConf; piloting AI outreach tools.",
    },
  ];

  for (const l of leads) {
    const exists = await prisma.lead.findFirst({ where: { companyName: l.companyName } });
    if (exists) continue;
    await prisma.lead.create({ data: { ...l, status: "NEW", createdById: admin.id } });
  }

  console.log("seed complete");
  console.log("logins: admin@acme.test / admin1234 · manager@acme.test / manager1234 · rep@acme.test / rep1234");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
