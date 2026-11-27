// crm-plans v1: signed unsubscribe links
import { createHmac } from "node:crypto";
const env = (k: string) => String((import.meta.env as any)[k] || (globalThis as any).process?.env?.[k] || "").trim();
const secret = () => env("DRIP_SECRET") || env("SUPABASE_SERVICE_ROLE_KEY") || "locus";
export const unsubToken = (siteId: string, key: string) => createHmac("sha256", secret()).update(`${siteId}|${key}`).digest("hex").slice(0, 32);
export const unsubOk = (siteId: string, key: string, t: string) => !!t && t === unsubToken(siteId, key);
export const unsubUrl = (base: string, siteId: string, key: string) => {
  let o = "https://bc.realestate";
  try { if (base) o = new URL(base).origin; } catch {}
  return `${o}/api/unsubscribe?s=${encodeURIComponent(siteId)}&k=${encodeURIComponent(key)}&t=${unsubToken(siteId, key)}`;
};
// email-tracking v1: replies go to the agent AND a capture address the CRM receives (INBOUND_DOMAIN, e.g. abc123.resend.app)
export const replyTo = (siteId: string, agentEmail: string) => { const d = env("INBOUND_DOMAIN"); const cap = d ? `r-${String(siteId).replace(/-/g, "")}@${d}` : ""; return [agentEmail, cap].filter(Boolean); };