// Tags the newest untagged active listings with a home style (AI, one photo each).
// Used by the rotating refresh worker; safe to call repeatedly (only touches home_style IS NULL).
import type { SupabaseClient } from "@supabase/supabase-js";

export const HOME_STYLES = [
  "West Coast contemporary", "Modern", "Craftsman", "Traditional", "Rancher", "Split level",
  "Modern farmhouse", "Log / timber frame", "Cottage / cabin", "Mid-century", "Heritage / character",
  "Mediterranean", "Townhouse", "Condo / apartment", "Manufactured / mobile", "Duplex / multi-family", "Other",
];

const SKIP_CITIES = ["calgary"];
const OK_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

type Env = {
  ANTHROPIC_API_KEY?: string;
  LOOK_SEARCH_MODEL?: string;
  REPLIERS_CDN?: string;
};

function photoUrl(u: string, cdn: string) {
  let url = /^https?:\/\//i.test(u) ? u : cdn + String(u).replace(/^\/+/, "");
  if (/cdn\.repliers\.io/i.test(url) && !/[?&]class=/.test(url)) {
    url += (url.includes("?") ? "&" : "?") + "class=medium";
  }
  return url;
}

export function normalizeHomeStyle(s: unknown): string {
  const v = String(s || "").trim().toLowerCase();
  if (!v) return "Other";
  const exact = HOME_STYLES.find((x) => x.toLowerCase() === v);
  if (exact) return exact;
  const rules: [RegExp, string][] = [
    [/west ?coast|contemporary/, "West Coast contemporary"], [/farm/, "Modern farmhouse"],
    [/mid.?century/, "Mid-century"], [/modern|minimal/, "Modern"], [/craftsman|arts/, "Craftsman"],
    [/ranch|bungalow|one.?stor/, "Rancher"], [/split/, "Split level"], [/log|timber|chalet/, "Log / timber frame"],
    [/cottage|cabin/, "Cottage / cabin"], [/heritage|character|victorian|tudor/, "Heritage / character"],
    [/mediterr|spanish/, "Mediterranean"], [/town/, "Townhouse"], [/condo|apartment/, "Condo / apartment"],
    [/manufact|mobile|modular/, "Manufactured / mobile"], [/duplex|triplex|multi/, "Duplex / multi-family"],
    [/traditional|colonial|two.?stor/, "Traditional"],
  ];
  for (const [re, style] of rules) if (re.test(v)) return style;
  return "Other";
}

const tool = {
  name: "tag",
  description: "Tag the home in the photo",
  input_schema: {
    type: "object",
    properties: {
      is_exterior: { type: "boolean" },
      style: { type: "string", enum: HOME_STYLES, description: "closest architectural style" },
      storeys: { type: "integer" },
      exterior: { type: "string", description: "main exterior materials" },
    },
    required: ["is_exterior", "style"],
  },
};

const PROMPT =
  "This is the main listing photo for a British Columbia home for sale. Pick the single closest architectural style from the list. " +
  "For townhouses, condos and duplexes, use that building type. " +
  "If the photo is not the building exterior, set is_exterior false and give your best style guess from what you can see.";

// Tell the model what the MLS says the building is, so a mobile isn't called a "Rancher".
function typeHint(mlsType: string) {
  const t = String(mlsType || "").toLowerCase();
  const map: Record<string, string> = {
    mobile: "Manufactured / mobile",
    condo: "Condo / apartment",
    townhouse: "Townhouse",
    "multi-family": "Duplex / multi-family",
  };
  if (map[t]) return ` The MLS lists this property as ${t}; answer "${map[t]}".`;
  if (t === "house") return " The MLS lists this property as a detached house; pick its architectural style (not a condo/townhouse/mobile type).";
  return "";
}

async function tagPhoto(raw: string, env: Env, model: string, mlsType = "") {
  const img = await fetch(photoUrl(raw, env.REPLIERS_CDN || "https://cdn.repliers.io/"));
  if (!img.ok) throw new Error("photo " + img.status);
  const type = (img.headers.get("content-type") || "image/jpeg").split(";")[0].trim();
  if (!OK_TYPES.includes(type)) throw new Error("photo type " + type);
  const data = Buffer.from(await img.arrayBuffer()).toString("base64");

  for (let i = 0; i < 3; i++) {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 300,
        tools: [tool],
        tool_choice: { type: "tool", name: "tag" },
        messages: [{ role: "user", content: [
          { type: "image", source: { type: "base64", media_type: type, data } },
          { type: "text", text: PROMPT + typeHint(mlsType) },
        ] }],
      }),
    });
    if (r.ok) {
      const o: any = await r.json();
      return (o.content || []).find((c: any) => c.type === "tool_use")?.input || null;
    }
    if (![429, 500, 502, 503, 529].includes(r.status)) throw new Error("ai " + r.status);
    await new Promise((s) => setTimeout(s, 1500 * (i + 1)));
  }
  throw new Error("ai busy after retries");
}

export async function tagUntaggedListings(
  db: SupabaseClient,
  env: Env,
  options: { limit?: number; concurrency?: number } = {}
) {
  const limit = options.limit ?? 60;
  const concurrency = options.concurrency ?? 4;
  const model = env.LOOK_SEARCH_MODEL || "claude-haiku-5-5";
  if (!env.ANTHROPIC_API_KEY) return { tagged: 0, failed: 0, skippedLandLease: 0, note: "no ANTHROPIC_API_KEY" };

  // Land and leases: nothing to style, mark Other without an AI call.
  const { count: skippedLandLease } = await db
    .from("listing_rows")
    .update(
      { home_style: "Other", home_style_meta: { recheck: { result: "skipped: land/lease" }, tagged_at: new Date().toISOString() } },
      { count: "exact" }
    )
    .eq("status", "A")
    .is("home_style", null)
    .or("normalized_type.eq.land,property_type.eq.Lease");

  const { data: rows, error } = await db
    .from("listing_rows")
    .select("id, image_url, normalized_type")
    .eq("status", "A")
    .is("home_style", null)
    .not("image_url", "is", null)
    .not("normalized_city", "in", `(${SKIP_CITIES.join(",")})`)
    .order("listed_at", { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;

  let tagged = 0, failed = 0;
  const queue = [...(rows || [])];
  const worker = async () => {
    while (queue.length) {
      const row: any = queue.shift();
      try {
        const t = await tagPhoto(row.image_url, env, model, row.normalized_type);
        if (!t) throw new Error("no answer");
        const { error: upErr } = await db.from("listing_rows").update({
          home_style: normalizeHomeStyle(t.style),
          home_style_meta: {
            storeys: Number.isInteger(t.storeys) ? t.storeys : null,
            exterior: t.exterior || null,
            is_exterior: !!t.is_exterior,
            model,
            tagged_at: new Date().toISOString(),
            source: "rotation",
          },
        }).eq("id", row.id);
        if (upErr) throw upErr;
        tagged++;
      } catch (e: any) {
        failed++; // stays untagged; a later run retries it
        console.error("home style tag skipped", row.id, e?.message || e);
      }
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return { tagged, failed, skippedLandLease: skippedLandLease ?? 0 };
}
