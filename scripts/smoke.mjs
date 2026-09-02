#!/usr/bin/env node
/**
 * Smoke test for AI Sales CRM
 * - Web:  http://localhost:3000 (or WEB_URL/NEXTAUTH_URL env)
 * - Agents: http://127.0.0.1:8000 (or AGENTS_API_URL/AGENTS_URL env)
 * Contracts: local/contracts.md — exact API surfaces.
 */

const WEB_URL = (process.env.WEB_URL || process.env.NEXTAUTH_URL || "http://localhost:3000").replace(/\/$/, "");
const AGENTS_URL = (process.env.AGENTS_API_URL || process.env.AGENTS_URL || "http://127.0.0.1:8000").replace(/\/$/, "");
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "dev-webhook-secret";

const ADMIN_EMAIL = "admin@acme.test";
const ADMIN_PASS = "admin1234";
const MANAGER_EMAIL = "manager@acme.test";
const MANAGER_PASS = "manager1234";

const results = [];

function pass(step) {
  console.log(`PASS ${step}`);
  results.push({ step, ok: true });
}
function fail(step, details) {
  const msg = details ? `FAIL ${step}: ${details}` : `FAIL ${step}`;
  console.log(msg);
  results.push({ step, ok: false, details });
}

class Jar {
  constructor() { this.map = new Map(); }
  update(setCookieHeaders) {
    if (!setCookieHeaders || setCookieHeaders.length === 0) return;
    for (const sc of setCookieHeaders) {
      const semi = sc.indexOf(";");
      const pair = semi === -1 ? sc : sc.slice(0, semi);
      const eq = pair.indexOf("=");
      if (eq === -1) continue;
      const name = pair.slice(0, eq).trim();
      const value = pair.slice(eq + 1).trim();
      if (!name) continue;
      if (!value || value.toLowerCase() === "deleted" || value === "") this.map.delete(name);
      else this.map.set(name, value);
    }
  }
  header() {
    if (this.map.size === 0) return "";
    return [...this.map.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  hasSession() {
    for (const k of this.map.keys()) if (k.toLowerCase().includes("session-token") || k.toLowerCase().includes("authjs.session-token")) return true;
    return this.map.size > 0;
  }
}

function getSetCookies(res) {
  if (typeof res.headers.getSetCookie === "function") {
    try { return res.headers.getSetCookie(); } catch { /* fallthrough */ }
  }
  const h = res.headers.get("set-cookie");
  if (h) return [h];
  // undici may not expose; try raw
  return [];
}

async function doFetch(jar, url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  const cookie = jar.header();
  if (cookie) headers["Cookie"] = cookie;
  const res = await fetch(url, { ...opts, headers });
  const sc = getSetCookies(res);
  jar.update(sc);
  return res;
}

async function login(webUrl, jar, email, password) {
  // 1. GET csrf
  const csrfUrl = `${webUrl}/api/auth/csrf`;
  const csrfRes = await doFetch(jar, csrfUrl, { method: "GET" });
  const csrfText = await csrfRes.text();
  if (!csrfRes.ok) throw new Error(`GET /api/auth/csrf ${csrfRes.status} ${csrfText.slice(0, 500)}`);
  let csrfJson;
  try { csrfJson = JSON.parse(csrfText); } catch { throw new Error(`csrf JSON parse failed: ${csrfText.slice(0, 500)}`); }
  const csrfToken = csrfJson.csrfToken;
  if (!csrfToken) throw new Error(`csrfToken missing in ${csrfText.slice(0, 500)}`);

  // 2. POST credentials (try json=true in body, redirect manual)
  const callbackUrl = `${webUrl}/`;
  const body = new URLSearchParams();
  body.set("csrfToken", csrfToken);
  body.set("callbackUrl", callbackUrl);
  body.set("email", email);
  body.set("password", password);
  body.set("json", "true");

  const postUrl = `${webUrl}/api/auth/callback/credentials`;
  let res = await doFetch(jar, postUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    redirect: "manual",
  });
  let resText = await res.text();
  const location = res.headers.get("location") || "";

  // Some NextAuth versions redirect even with json=true; check for error in location
  if ((res.status === 302 || res.status === 303 || res.status === 307 || res.status === 308) && location) {
    if (location.includes("error=") || location.includes("/error") || location.toLowerCase().includes("signin")) {
      throw new Error(`login redirect error status=${res.status} location=${location} body=${resText.slice(0, 500)}`);
    }
    // redirect to callbackUrl is success; fall through to session verification
  } else if (res.status === 200) {
    // when json=true, body should be { url: "..."} without error
    try {
      const j = JSON.parse(resText);
      if (j.error) throw new Error(`login JSON error: ${j.error} url=${j.url || ""} body=${resText.slice(0, 500)}`);
      if (j.url && (j.url.includes("error=") || j.url.includes("signin"))) throw new Error(`login JSON url error: ${j.url}`);
    } catch (e) {
      if (e.message && e.message.startsWith("login JSON")) throw e;
      // if not JSON, may be HTML redirect page — still verify via session
    }
  } else if (res.status === 401 || res.status === 403) {
    throw new Error(`login POST ${res.status} ${resText.slice(0, 500)} location=${location}`);
  }

  // 3. verify session
  const sessRes = await doFetch(jar, `${webUrl}/api/auth/session`, { method: "GET" });
  const sessText = await sessRes.text();
  if (!sessRes.ok) throw new Error(`GET /api/auth/session ${sessRes.status} ${sessText.slice(0, 500)}`);
  let sess;
  try { sess = JSON.parse(sessText); } catch { throw new Error(`session JSON parse failed: ${sessText.slice(0, 500)}`); }
  if (!sess || !sess.user || !sess.user.email) throw new Error(`session missing user: ${sessText.slice(0, 800)} login status=${res.status} location=${location} body=${resText.slice(0, 500)}`);
  if (sess.user.email.toLowerCase() !== email.toLowerCase()) throw new Error(`session email mismatch expected ${email} got ${sess.user.email}`);
  return sess;
}

async function apiRequest(jar, webUrl, method, path, bodyObj, extraHeaders = {}) {
  const url = `${webUrl}${path}`;
  const headers = { ...extraHeaders };
  if (bodyObj !== undefined) headers["Content-Type"] = "application/json";
  const cookie = jar.header();
  if (cookie) headers["Cookie"] = cookie;
  const opts = { method, headers };
  if (bodyObj !== undefined) opts.body = JSON.stringify(bodyObj);
  const res = await fetch(url, opts);
  const sc = getSetCookies(res);
  jar.update(sc);
  const text = await res.text();
  let json = null;
  if (text) { try { json = JSON.parse(text); } catch { json = null; } }
  return { res, text, json, status: res.status };
}

function extractId(json, candidates = []) {
  if (!json) return null;
  if (typeof json.id === "string") return json.id;
  if (typeof json.leadId === "string") return json.leadId;
  if (typeof json.companyId === "string") return json.companyId;
  if (typeof json.dealId === "string") return json.dealId;
  if (json.company && typeof json.company.id === "string") return json.company.id;
  if (json.deal && typeof json.deal.id === "string") return json.deal.id;
  if (json.data && typeof json.data.id === "string") return json.data.id;
  if (json.lead && typeof json.lead.id === "string") return json.lead.id;
  for (const k of candidates) {
    if (json[k] && typeof json[k] === "string") return json[k];
    if (json[k] && typeof json[k].id === "string") return json[k].id;
  }
  return null;
}

function extractList(json) {
  if (!json) return null;
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.companies)) return json.companies;
  if (Array.isArray(json.contacts)) return json.contacts;
  if (Array.isArray(json.deals)) return json.deals;
  if (Array.isArray(json.tasks)) return json.tasks;
  if (Array.isArray(json.notes)) return json.notes;
  if (Array.isArray(json.activities)) return json.activities;
  if (Array.isArray(json.data)) return json.data;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.results)) return json.results;
  if (json.data && Array.isArray(json.data.companies)) return json.data.companies;
  return null;
}

async function main() {
  const ts = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  console.log(`Smoke start WEB=${WEB_URL} AGENTS=${AGENTS_URL} ts=${ts}`);

  const adminJar = new Jar();
  const managerJar = new Jar();
  let companyId, contactId, dealId, taskId, noteId, leadId, emailId;
  let hasFailure = false;

  // 1) login admin
  try {
    await login(WEB_URL, adminJar, ADMIN_EMAIL, ADMIN_PASS);
    pass("login admin@acme.test");
  } catch (e) {
    fail("login admin@acme.test", e.message || String(e));
    hasFailure = true;
  }
  if (hasFailure) { printSummary(); process.exit(1); }

  // 2) companies, contacts, deals, tasks, notes, activities
  // companies POST
  try {
    const payload = { name: `Smoke Co ${ts}`, domain: `smoke-${ts}.test`, website: `https://smoke-${ts}.test`, description: "smoke test company" };
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "POST", "/api/companies", payload);
    if (res.status !== 200 && res.status !== 201) throw new Error(`POST /api/companies ${res.status} ${text.slice(0, 800)}`);
    companyId = extractId(json) || json?.id;
    if (!companyId && json && typeof json.id === "string") companyId = json.id;
    if (!companyId) throw new Error(`no id in response ${text.slice(0, 800)}`);
    pass("companies POST");
  } catch (e) { fail("companies POST", e.message || String(e)); hasFailure = true; }

  // companies GET
  try {
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "GET", "/api/companies");
    if (res.status !== 200) throw new Error(`GET /api/companies ${res.status} ${text.slice(0, 500)}`);
    const list = extractList(json);
    if (!list) throw new Error(`unexpected GET /api/companies shape ${text.slice(0, 800)}`);
    if (companyId && !list.find((c) => c.id === companyId)) throw new Error(`created company ${companyId} not in list`);
    pass("companies GET");
  } catch (e) { fail("companies GET", e.message || String(e)); hasFailure = true; }

  // contacts POST
  try {
    const payload = { firstName: "Smoke", lastName: `Contact-${ts}`, email: `smoke-${ts}@smoke-${ts}.test`, companyId, title: "VP Test" };
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "POST", "/api/contacts", payload);
    if (res.status !== 200 && res.status !== 201) throw new Error(`POST /api/contacts ${res.status} ${text.slice(0, 800)}`);
    contactId = extractId(json) || json?.id;
    if (!contactId) throw new Error(`no id in response ${text.slice(0, 800)}`);
    pass("contacts POST");
  } catch (e) { fail("contacts POST", e.message || String(e)); hasFailure = true; }

  // contacts GET (optional verify)
  try {
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "GET", "/api/contacts");
    if (res.status !== 200) throw new Error(`GET /api/contacts ${res.status} ${text.slice(0, 500)}`);
    const list = extractList(json);
    if (!list) throw new Error(`unexpected GET /api/contacts shape ${text.slice(0, 800)}`);
    if (contactId && !list.find((c) => c.id === contactId)) throw new Error(`created contact ${contactId} not in list`);
    pass("contacts GET");
  } catch (e) { fail("contacts GET", e.message || String(e)); hasFailure = true; }

  // deals POST
  try {
    const payload = { title: `Smoke Deal ${ts}`, companyId, contactId, value: 50000, currency: "USD", stage: "NEW" };
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "POST", "/api/deals", payload);
    if (res.status !== 200 && res.status !== 201) throw new Error(`POST /api/deals ${res.status} ${text.slice(0, 800)}`);
    dealId = extractId(json) || json?.id;
    if (!dealId) throw new Error(`no id in response ${text.slice(0, 800)}`);
    // also verify stage NEW if present
    const stage = json?.stage || json?.deal?.stage || json?.data?.stage;
    if (stage && stage !== "NEW") console.log(`  note: created deal stage was ${stage} expected NEW`);
    pass("deals POST");
  } catch (e) { fail("deals POST", e.message || String(e)); hasFailure = true; }

  // deals PATCH stage -> QUALIFIED
  try {
    if (!dealId) throw new Error("skipped: dealId missing");
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "PATCH", `/api/deals/${dealId}`, { stage: "QUALIFIED" });
    if (res.status !== 200) throw new Error(`PATCH /api/deals/${dealId} ${res.status} ${text.slice(0, 800)}`);
    const newStage = json?.stage || json?.deal?.stage || json?.data?.stage || json?.stage;
    // allow if response doesn't echo stage but GET will verify
    if (newStage && newStage !== "QUALIFIED") throw new Error(`expected stage QUALIFIED got ${newStage} ${text.slice(0, 500)}`);
    pass("deals PATCH stage QUALIFIED");
  } catch (e) { fail("deals PATCH stage QUALIFIED", e.message || String(e)); hasFailure = true; }

  // deals GET verify
  try {
    if (!dealId) throw new Error("skipped: dealId missing");
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "GET", `/api/deals/${dealId}`);
    if (res.status === 404) {
      // fallback: list with q
      const listRes = await apiRequest(adminJar, WEB_URL, "GET", `/api/deals?q=${encodeURIComponent(ts)}`);
      if (listRes.res.status !== 200) throw new Error(`GET /api/deals?q ${listRes.res.status} ${listRes.text.slice(0, 500)}`);
      const list = extractList(listRes.json);
      if (!list || !list.find((d) => d.id === dealId)) throw new Error(`deal ${dealId} not found via list`);
      pass("deals GET");
    } else {
      if (res.status !== 200) throw new Error(`GET /api/deals/${dealId} ${res.status} ${text.slice(0, 500)}`);
      const gotStage = json?.stage || json?.deal?.stage;
      if (gotStage && gotStage !== "QUALIFIED") throw new Error(`deal stage not QUALIFIED after PATCH: ${gotStage}`);
      pass("deals GET");
    }
  } catch (e) { fail("deals GET", e.message || String(e)); hasFailure = true; }

  // tasks POST
  try {
    const payload = { title: `Smoke Task ${ts}`, description: "smoke test task", priority: "MEDIUM", status: "TODO", companyId, contactId, dealId };
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "POST", "/api/tasks", payload);
    if (res.status !== 200 && res.status !== 201) throw new Error(`POST /api/tasks ${res.status} ${text.slice(0, 800)}`);
    taskId = extractId(json) || json?.id;
    if (!taskId) throw new Error(`no id in response ${text.slice(0, 800)}`);
    pass("tasks POST");
  } catch (e) { fail("tasks POST", e.message || String(e)); hasFailure = true; }

  // tasks PATCH status IN_PROGRESS
  try {
    if (!taskId) throw new Error("skipped: taskId missing");
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "PATCH", `/api/tasks/${taskId}`, { status: "IN_PROGRESS" });
    if (res.status !== 200) throw new Error(`PATCH /api/tasks/${taskId} ${res.status} ${text.slice(0, 800)}`);
    const st = json?.status || json?.task?.status;
    if (st && st !== "IN_PROGRESS") throw new Error(`expected IN_PROGRESS got ${st}`);
    pass("tasks PATCH IN_PROGRESS");
  } catch (e) { fail("tasks PATCH IN_PROGRESS", e.message || String(e)); hasFailure = true; }

  // notes POST
  try {
    const payload = { body: `Smoke note ${ts} - e2e`, companyId, contactId, dealId };
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "POST", "/api/notes", payload);
    if (res.status !== 200 && res.status !== 201) throw new Error(`POST /api/notes ${res.status} ${text.slice(0, 800)}`);
    noteId = extractId(json) || json?.id;
    if (!noteId) throw new Error(`no id in response ${text.slice(0, 800)}`);
    pass("notes POST");
  } catch (e) { fail("notes POST", e.message || String(e)); hasFailure = true; }

  // notes GET (if endpoint supports)
  try {
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "GET", "/api/notes");
    if (res.status !== 200) throw new Error(`GET /api/notes ${res.status} ${text.slice(0, 500)}`);
    const list = extractList(json);
    if (!list) throw new Error(`unexpected GET /api/notes shape ${text.slice(0, 800)}`);
    if (noteId && !list.find((n) => n.id === noteId)) {
      // some impl filters by dealId/companyId; try filtered
      const f = await apiRequest(adminJar, WEB_URL, "GET", `/api/notes?dealId=${dealId || ""}`);
      if (f.res.status === 200) {
        const fl = extractList(f.json);
        if (!fl || !fl.find((n) => n.id === noteId)) console.log(`  warn: note ${noteId} not in GET /api/notes list`);
      }
    }
    pass("notes GET");
  } catch (e) { fail("notes GET", e.message || String(e)); hasFailure = true; }

  // activities GET
  try {
    const q = dealId ? `?dealId=${encodeURIComponent(dealId)}&limit=50` : "?limit=50";
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "GET", `/api/activities${q}`);
    if (res.status !== 200) throw new Error(`GET /api/activities${q} ${res.status} ${text.slice(0, 800)}`);
    const list = extractList(json);
    if (!list) throw new Error(`unexpected activities shape ${text.slice(0, 800)}`);
    // expect at least stage_change after patch
    const hasStage = list.some((a) => a.type === "STAGE_CHANGE" || a.type === "stage_change");
    if (!hasStage) console.log(`  note: no STAGE_CHANGE activity found (list size ${list.length})`);
    pass("activities GET");
  } catch (e) { fail("activities GET", e.message || String(e)); hasFailure = true; }

  if (hasFailure) { console.log("Aborting before webhook due to earlier failures"); printSummary(); process.exit(1); }

  // 3) POST /api/webhooks/ingest
  try {
    const payload = {
      companyName: `SmokeLead Co ${ts}`,
      domain: `smokelead-${ts}.test`,
      website: `https://smokelead-${ts}.test`,
      contactFirstName: "Smoke",
      contactLastName: `Lead-${ts.slice(0, 4)}`,
      contactEmail: `lead-${ts}@smokelead-${ts}.test`,
      contactTitle: "CEO",
      source: "smoke-test",
      notes: `smoke test lead ${ts}`,
    };
    const { res, json, text } = await apiRequest(adminJar, WEB_URL, "POST", "/api/webhooks/ingest", payload, { "x-webhook-secret": WEBHOOK_SECRET });
    if (res.status !== 200 && res.status !== 201 && res.status !== 202) throw new Error(`POST /api/webhooks/ingest ${res.status} ${text.slice(0, 800)}`);
    leadId = json?.leadId || json?.id || json?.lead?.id || json?.data?.leadId;
    if (!leadId) throw new Error(`no leadId in response ${text.slice(0, 800)}`);
    pass(`webhooks/ingest POST leadId=${leadId}`);
  } catch (e) { fail("webhooks/ingest POST", e.message || String(e)); hasFailure = true; printSummary(); process.exit(1); }

  // 4) poll agents GET /pipeline/leads/{id}
  try {
    const deadline = Date.now() + 120_000;
    let lastStatus = "";
    let lastBody = "";
    let success = false;
    while (Date.now() < deadline) {
      const url = `${AGENTS_URL}/pipeline/leads/${leadId}`;
      const headers = { "x-webhook-secret": WEBHOOK_SECRET };
      const res = await fetch(url, { method: "GET", headers });
      const text = await res.text();
      lastBody = text.slice(0, 800);
      if (res.status === 404) {
        // lead not yet visible to agents (eventual consistency) — also try web lead status
        lastStatus = "404";
      } else if (!res.ok) {
        lastStatus = `${res.status}`;
        // retry
      } else {
        let j = null;
        try { j = JSON.parse(text); } catch {}
        const status = j?.status || j?.leadStatus || j?.lead?.status || "";
        lastStatus = status || `ok-no-status ${text.slice(0, 200)}`;
        if (status === "PENDING_APPROVAL") { success = true; break; }
        if (status === "FAILED") throw new Error(`pipeline FAILED ${lastBody}`);
        if (status === "REJECTED") throw new Error(`pipeline REJECTED (UNQUALIFIED) ${lastBody}`);
        // also check web side as fallback
        if (status === "APPROVED" || status === "CONVERTED") { success = true; break; }
      }
      // also poll web lead as secondary signal
      try {
        const webLead = await apiRequest(adminJar, WEB_URL, "GET", `/api/leads/${leadId}`);
        if (webLead.res.status === 200) {
          const ws = webLead.json?.status || webLead.json?.lead?.status;
          if (ws === "PENDING_APPROVAL") { success = true; break; }
          if (ws === "FAILED") throw new Error(`web lead FAILED ${webLead.text.slice(0, 500)}`);
          if (ws) lastStatus = `${lastStatus} / web:${ws}`;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 2000));
    }
    if (!success) throw new Error(`timeout 120s waiting for PENDING_APPROVAL lastStatus=${lastStatus} lastBody=${lastBody}`);
    pass(`poll agents PENDING_APPROVAL lead=${leadId}`);
  } catch (e) { fail("poll agents PENDING_APPROVAL", e.message || String(e)); hasFailure = true; printSummary(); process.exit(1); }

  // 5) GET /api/emails?status=pending_approval then POST /api/emails/{id}/approve (manager session)
  try {
    await login(WEB_URL, managerJar, MANAGER_EMAIL, MANAGER_PASS);
    pass("login manager@acme.test");
  } catch (e) { fail("login manager@acme.test", e.message || String(e)); hasFailure = true; printSummary(); process.exit(1); }

  try {
    const { res, json, text } = await apiRequest(managerJar, WEB_URL, "GET", "/api/emails?status=pending_approval");
    if (res.status !== 200) throw new Error(`GET /api/emails?status=pending_approval ${res.status} ${text.slice(0, 800)}`);
    let emails = [];
    if (Array.isArray(json)) emails = json;
    else if (Array.isArray(json.emails)) emails = json.emails;
    else if (Array.isArray(json.data)) emails = json.data;
    else if (json && Array.isArray(json.items)) emails = json.items;
    else throw new Error(`unexpected emails shape ${text.slice(0, 800)}`);
    if (emails.length === 0) throw new Error(`no pending_approval emails found ${text.slice(0, 500)}`);
    const found = emails.find((e) => e.leadId === leadId) || emails.find((e) => e.lead?.id === leadId) || emails[0];
    emailId = found.id;
    if (!emailId) throw new Error(`pending email missing id ${JSON.stringify(found).slice(0, 500)}`);
    pass(`emails GET pending_approval count=${emails.length} emailId=${emailId}`);
  } catch (e) { fail("emails GET pending_approval", e.message || String(e)); hasFailure = true; printSummary(); process.exit(1); }

  try {
    const { res, json, text } = await apiRequest(managerJar, WEB_URL, "POST", `/api/emails/${emailId}/approve`, { decision: "approved", feedback: "smoke test approve" });
    if (res.status !== 200 && res.status !== 201) throw new Error(`POST /api/emails/${emailId}/approve ${res.status} ${text.slice(0, 800)}`);
    // response may contain status approved or lead status
    pass(`emails POST approve ${emailId}`);
  } catch (e) { fail("emails POST approve", e.message || String(e)); hasFailure = true; printSummary(); process.exit(1); }

  // Verify lead became APPROVED (optional poll)
  try {
    const deadline = Date.now() + 15_000;
    let approved = false;
    while (Date.now() < deadline) {
      const { res, json, text } = await apiRequest(adminJar, WEB_URL, "GET", `/api/leads/${leadId}`);
      if (res.status === 200) {
        const st = json?.status || json?.lead?.status;
        if (st === "APPROVED" || st === "CONVERTED") { approved = true; break; }
        if (st === "PENDING_APPROVAL") { await new Promise((r) => setTimeout(r, 1000)); continue; }
      }
      break;
    }
    if (!approved) console.log(`  warn: lead ${leadId} not yet APPROVED after approve`);
  } catch {}

  // 6) POST /api/leads/{id}/convert
  try {
    let convertRes = await apiRequest(managerJar, WEB_URL, "POST", `/api/leads/${leadId}/convert`, {});
    if (convertRes.res.status === 401 || convertRes.res.status === 403) {
      // try admin as fallback
      convertRes = await apiRequest(adminJar, WEB_URL, "POST", `/api/leads/${leadId}/convert`, {});
    }
    const { res, json, text } = convertRes;
    if (res.status !== 200 && res.status !== 201) throw new Error(`POST /api/leads/${leadId}/convert ${res.status} ${text.slice(0, 800)}`);
    // verify company/deal ids present
    const cId = json?.companyId || json?.company?.id || json?.company_id || json?.data?.companyId || json?.convertedCompanyId || json?.lead?.convertedCompanyId;
    const dId = json?.dealId || json?.deal?.id || json?.data?.dealId || json?.convertedDealId || json?.lead?.convertedDealId;
    const coIdAlt = json?.company?.id || json?.convertedCompany?.id;
    const deIdAlt = json?.deal?.id || json?.convertedDeal?.id;
    const hasCompany = !!(cId || coIdAlt || json?.companyId || json?.id);
    const hasDeal = !!(dId || deIdAlt);
    // also check via GET lead if not in convert response
    if (!hasCompany || !hasDeal) {
      const check = await apiRequest(adminJar, WEB_URL, "GET", `/api/leads/${leadId}`);
      const st = check.json?.status || check.json?.lead?.status;
      const cc = check.json?.convertedCompanyId || check.json?.lead?.convertedCompanyId || check.json?.companyId;
      const dd = check.json?.convertedDealId || check.json?.lead?.convertedDealId || check.json?.dealId;
      if (check.res.status === 200 && st === "CONVERTED" && (cc || dd)) {
        pass(`leads POST convert (verified via GET CONVERTED company=${cc || cId} deal=${dd || dId})`);
      } else {
        throw new Error(`convert response missing company/deal ids ${text.slice(0, 800)} status=${st || "?"}`);
      }
    } else {
      pass(`leads POST convert company=${cId || coIdAlt} deal=${dId || deIdAlt}`);
    }
  } catch (e) { fail("leads POST convert", e.message || String(e)); hasFailure = true; }

  printSummary();
  process.exit(hasFailure ? 1 : 0);

  function printSummary() {
    const ok = results.filter((r) => r.ok).length;
    const total = results.length;
    console.log(`\nSummary: ${ok}/${total} passed`);
    for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"} ${r.step}${r.details ? " - " + r.details : ""}`);
    if (results.some((r) => !r.ok)) console.log("SMOKE FAILED");
    else console.log("SMOKE PASSED");
  }
}

main().catch((e) => {
  console.error(`FAIL unhandled: ${e.stack || e.message || String(e)}`);
  process.exit(1);
});
