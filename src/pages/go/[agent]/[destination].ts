import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const destinations: Record<string, string> = {
  homes: "/nanaimo/",
  explore: "/explore?city=nanaimo",
  contact: "/",
};

export const GET: APIRoute = async ({
  params,
  request,
  redirect,
}) => {
  const agent = String(params.agent || "").toLowerCase();
  const destination = String(params.destination || "").toLowerCase();

  if (agent !== "chris") {
    return redirect("/", 302);
  }

  const target = destinations[destination];

  if (!target) {
    return redirect("/", 302);
  }

  const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
  const serviceRoleKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceRoleKey) {
    const supabase = createClient(
      supabaseUrl,
      serviceRoleKey
    );

    try {
      await supabase.from("signature_clicks").insert({
        agent_slug: agent,
        destination,
        referrer: request.headers.get("referer"),
        user_agent: request.headers.get("user-agent"),
      });
    } catch (error) {
      console.error("Signature click tracking failed:", error);
    }
  }

  return redirect(target, 302);
};