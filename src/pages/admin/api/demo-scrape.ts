import type { APIRoute } from "astro";

export const prerender = false;

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const isMaster = (url: URL) => ["bc.realestate", "localhost", "127.0.0.1"].includes(url.hostname.replace(/^www\./, ""));
const decode = (s: string) => String(s || "").replace(/&amp;/g, "&").replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, " ").replace(/&#8211;|&#8212;/g, "-").trim();
const BROKERAGES = ["RE/MAX", "Royal LePage", "Coldwell Banker", "Century 21", "eXp Realty", "Real Broker", "Real Brokerage", "460 Realty", "Sutton", "Engel & V", "Macdonald Realty", "Oakwyn", "Rennie", "Sotheby", "Pemberton Holmes", "Newport Realty", "Stonehaus", "Unison", "Fair Realty", "Exit Realty", "HomeLife", "Remax"];

export const POST: APIRoute = async ({ request, url }) => {
  if (!isMaster(url)) return json({ error: "Not allowed here." }, 403);
  try {
    let target = String((await request.json()).url || "").trim();
    if (!/^https?:\/\//i.test(target)) target = "https://" + target;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(target, { headers: { "user-agent": "Mozilla/5.0 (compatible; LocusDemo/1.0)" }, signal: ctrl.signal, redirect: "follow" });
    clearTimeout(timer);
    if (!r.ok) return json({ error: `That site answered ${r.status}.` }, 502);
    const html = (await r.text()).slice(0, 800000);
    const base = r.url || target;
    const abs = (u: string) => { try { return new URL(decode(u), base).href; } catch { return ""; } };

    const meta = (p: string) => {
      const a = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)["']`, "i"));
      const b = html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${p}["']`, "i"));
      return decode((a || b || [])[1] || "");
    };
    const titleTag = decode((html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || "");
    let name = (meta("og:site_name") || titleTag).split(/\s[|\-\u2013\u2014:]\s/)[0];
    name = name.replace(/\b(personal real estate corporation|real estate|realtor|prec|homes)\b.*$/i, "").replace(/[,\-\s]+$/, "").trim();
    if (!name || name.split(/\s+/).length > 4 || /^(home|welcome)$/i.test(name)) name = "";

    const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const telRaw = (html.match(/href=["']tel:([^"']+)["']/i) || [])[1] || (text.match(/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/) || [])[0] || "";
    const digits = telRaw.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
    const phone = digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : "";
    const email = decode((html.match(/mailto:([^"'?\s>]+)/i) || [])[1] || (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [])[0] || "");
    const brokerage = BROKERAGES.find((bk) => text.toLowerCase().includes(bk.toLowerCase())) || "";

    let photo_url = "";
    const first = (name.split(/\s+/)[0] || "").replace(/[^a-z]/gi, "");
    if (first) {
      const tag = (html.match(new RegExp(`<img[^>]+alt=["'][^"']*${first}[^"']*["'][^>]*>`, "i")) || [])[0] || "";
      const src = (tag.match(/(?:data-src|src)=["']([^"']+)["']/i) || [])[1] || "";
      if (src && !/logo/i.test(src)) photo_url = abs(src);
    }
    if (!photo_url) { const og = meta("og:image"); if (og && !/logo/i.test(og)) photo_url = abs(og); }

    return json({ name, phone, email, brokerage, photo_url });
  } catch (e: any) {
    return json({ error: e?.name === "AbortError" ? "That site took too long to answer." : (e?.message || "Fetch failed") }, 500);
  }
};