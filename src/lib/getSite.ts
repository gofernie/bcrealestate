import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function getSite(hostname: string, city?: string) {
  const host = hostname.replace(/^www\./, "");

  // Local dev default
  if (host === "localhost" || host.startsWith("localhost:")) {
    const { data: fallback } = await supabase
      .from("sites")
      .select("*")
      .eq("city", city || "nanaimo")
      .maybeSingle();

    return fallback;
  }

  // Try city-specific record first
  if (city) {
    const { data: cityData } = await supabase
      .from("sites")
      .select("*")
      .or(`domain.eq.${host},domain.eq.www.${host}`)
      .eq("city", city)
      .maybeSingle();

    if (cityData) return cityData;
  }

  // Fall back to domain-only match
  const { data, error } = await supabase
    .from("sites")
    .select("*")
    .or(`domain.eq.${host},domain.eq.www.${host}`)
    .maybeSingle();

  if (!error && data) return data;

  console.error("Site lookup failed:", error);
  return null;
}