import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });

const clean = (value: unknown) => String(value || "").trim();

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();

    const id = clean(body?.id);
    const agent = {
      name: clean(body?.name),
      email: clean(body?.email) || null,
      phone: clean(body?.phone) || null,
      brokerage: clean(body?.brokerage) || null,
    };

    if (!agent.name) {
      return json({ ok: false, error: "Agent name is required." }, 400);
    }

    const query = id
      ? supabase.from("agents").update(agent).eq("id", id)
      : supabase.from("agents").insert(agent);

    const { error } = await query;

    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (error: any) {
    return json(
      { ok: false, error: error?.message || "Could not save agent." },
      500
    );
  }
};

export const DELETE: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const id = clean(body?.id);

    if (!id) {
      return json({ ok: false, error: "Agent ID is required." }, 400);
    }

    const { error } = await supabase
      .from("agents")
      .delete()
      .eq("id", id);

    if (error) {
      return json({ ok: false, error: error.message }, 500);
    }

    return json({ ok: true });
  } catch (error: any) {
    return json(
      { ok: false, error: error?.message || "Could not remove agent." },
      500
    );
  }
};