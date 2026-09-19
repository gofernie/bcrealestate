import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const page = (
  title: string,
  message: string,
  status = 200
) =>
  new Response(
    `<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta
          name="viewport"
          content="width=device-width"
        />
        <title>${title}</title>
      </head>
      <body style="
        margin:0;
        padding:40px 20px;
        background:#f4f1eb;
        color:#181614;
        font-family:Arial,Helvetica,sans-serif;
      ">
        <main style="
          max-width:560px;
          margin:60px auto;
          padding:32px;
          border:1px solid #ddd8cf;
          border-radius:18px;
          background:#ffffff;
          text-align:center;
        ">
          <h1 style="margin-top:0;">${title}</h1>
          <p style="
            color:#706b64;
            line-height:1.6;
          ">
            ${message}
          </p>
        </main>
      </body>
    </html>`,
    {
      status,
      headers: {
        "content-type":
          "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );

export const GET: APIRoute = async ({ url }) => {
  const token =
    String(
      url.searchParams.get("token") || ""
    ).trim();

  if (!token) {
    return page(
      "Invalid unsubscribe link",
      "This unsubscribe link is incomplete.",
      400
    );
  }

  const { data: subscriber, error } =
    await supabase
      .from("digest_subscribers")
      .select("id, status")
      .eq("unsubscribe_token", token)
      .maybeSingle();

  if (error || !subscriber) {
    return page(
      "Link not found",
      "This unsubscribe link is no longer valid.",
      404
    );
  }

  if (subscriber.status !== "unsubscribed") {
    const { error: updateError } =
      await supabase
        .from("digest_subscribers")
        .update({
          status: "unsubscribed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", subscriber.id);

    if (updateError) {
      return page(
        "Something went wrong",
        "We could not update your subscription. Please try again.",
        500
      );
    }
  }

  return page(
    "You’re unsubscribed",
    "You will no longer receive this weekly real estate digest."
  );
};
