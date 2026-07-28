import type {
  SupabaseClient,
} from "@supabase/supabase-js";

import {
  Resend,
} from "resend";

import twilio from "twilio";

type SavedSearch = {
  id: string;
  city: string;
  channel: "sms" | "email";
  frequency: "update" | "daily";
  phone?: string | null;
  email?: string | null;
  filters?: Record<string, any>;
};

type Env = {
  RESEND_API_KEY: string;
  TWILIO_ACCOUNT_SID: string;
  TWILIO_AUTH_TOKEN: string;
  TWILIO_FROM_NUMBER: string;
  PUBLIC_SITE_URL?: string;
};

export async function sendSavedSearchNotifications(
  supabase: SupabaseClient,
  savedSearch: SavedSearch,
  env: Env
) {
  const {
    data: pendingRows,
    error: pendingError,
  } = await supabase
    .from(
      "saved_search_notifications"
    )
    .select(
      `
        id,
        mls_number,
        discovered_at
      `
    )
    .eq(
      "saved_search_id",
      savedSearch.id
    )
    .is("sent_at", null)
    .order(
      "discovered_at",
      {
        ascending: true,
      }
    );

  if (pendingError) {
    throw pendingError;
  }

  if (!pendingRows?.length) {
    return {
      sent: 0,
    };
  }

  const mlsNumbers =
    pendingRows.map(
      (row) =>
        String(
          row.mls_number
        )
    );

  const {
    data: listings,
    error: listingsError,
  } = await supabase
    .from("listing_rows")
    .select(
      `
        mls_number,
        price,
        beds,
        baths,
        address,
        image_url
      `
    )
    .in(
      "mls_number",
      mlsNumbers
    );

  if (listingsError) {
    throw listingsError;
  }

  const listingMap =
    new Map(
      (listings || []).map(
        (listing) => [
          String(
            listing.mls_number
          ),
          listing,
        ]
      )
    );

  const orderedListings =
    mlsNumbers
      .map(
        (mlsNumber) =>
          listingMap.get(
            mlsNumber
          )
      )
      .filter(Boolean);

  if (!orderedListings.length) {
    return {
      sent: 0,
    };
  }

  const siteUrl =
    String(
      env.PUBLIC_SITE_URL ||
      ""
    ).replace(/\/$/, "");

  const cityLabel =
    savedSearch.city
      .replace(/-/g, " ")
      .replace(
        /\b\w/g,
        (letter) =>
          letter.toUpperCase()
      );

  const count =
    orderedListings.length;

  if (
    savedSearch.channel ===
      "email" &&
    savedSearch.email
  ) {
    const resend =
      new Resend(
        env.RESEND_API_KEY
      );

    const listingHtml =
      orderedListings
        .map(
          (listing: any) => {
            const price =
              listing.price
                ? `$${Number(
                    listing.price
                  ).toLocaleString()}`
                : "Price unavailable";

            const href =
              siteUrl
                ? `${siteUrl}/${savedSearch.city}?listing=${encodeURIComponent(
                    listing.mls_number
                  )}`
                : "#";

            return `
              <div
                style="
                  padding:16px 0;
                  border-bottom:1px solid #e7e7e7;
                "
              >
                <strong>
                  ${price}
                </strong>

                <div>
                  ${listing.address || ""}
                </div>

                <div
                  style="
                    color:#65716c;
                    font-size:13px;
                  "
                >
                  ${listing.beds ?? "-"} beds ·
                  ${listing.baths ?? "-"} baths
                </div>

                ${
                  href !== "#"
                    ? `
                      <div
                        style="
                          margin-top:8px;
                        "
                      >
                        <a
                          href="${href}"
                        >
                          View home
                        </a>
                      </div>
                    `
                    : ""
                }
              </div>
            `;
          }
        )
        .join("");

    const emailResult =
      await resend
        .emails
        .send({
          from:
            "Locus <onboarding@resend.dev>",

          to: [
            savedSearch.email,
          ],

          subject:
            `${count} new ${
              count === 1
                ? "home"
                : "homes"
            } match your ${cityLabel} search`,

          html: `
            <div
              style="
                font-family:Arial,sans-serif;
                max-width:600px;
                margin:0 auto;
                color:#14201c;
                line-height:1.5;
              "
            >
              <h2>
                ${
                  count === 1
                    ? "A new home matches your search."
                    : `${count} new homes match your search.`
                }
              </h2>

              ${listingHtml}
            </div>
          `,
        });

    if (emailResult.error) {
      throw new Error(
        emailResult.error.message
      );
    }
  }

  if (
    savedSearch.channel ===
      "sms" &&
    savedSearch.phone
  ) {
    const twilioClient =
      twilio(
        env.TWILIO_ACCOUNT_SID,
        env.TWILIO_AUTH_TOKEN
      );

    const firstListing =
      orderedListings[0] as any;

    const firstPrice =
      firstListing?.price
        ? `$${Number(
            firstListing.price
          ).toLocaleString()}`
        : "";

const searchParams =
  new URLSearchParams();

Object.entries(
  savedSearch.filters || {}
).forEach(
  ([key, value]) => {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(
        (item) => {
          searchParams.append(
            key,
            String(item)
          );
        }
      );

      return;
    }

    searchParams.set(
      key,
      String(value)
    );
  }
);

const newMlsNumbers =
  orderedListings
    .map((listing: any) =>
      String(
        listing.mls_number ||
        ""
      )
    )
    .filter(Boolean);

if (newMlsNumbers.length > 1) {
  searchParams.set(
    "new",
    newMlsNumbers.join(",")
  );
}

const searchQuery =
  searchParams.toString();

const searchUrl =
  siteUrl
    ? `${siteUrl}/${savedSearch.city}${
        searchQuery
          ? `?${searchQuery}`
          : ""
      }`
    : "";

const listingUrl =
  siteUrl &&
  firstListing?.mls_number
    ? `${siteUrl}/${savedSearch.city}/homes?listing_id=${encodeURIComponent(
        firstListing.mls_number
      )}`
    : "";

const body =
  count === 1
    ? `1 new ${cityLabel} home matches your search${firstPrice ? ` at ${firstPrice}` : ""}.${listingUrl ? ` ${listingUrl}` : ""}`
    : `${count} new ${cityLabel} homes match your search.${searchUrl ? ` ${searchUrl}` : ""}`;

    await twilioClient
      .messages
      .create({
        from:
          env.TWILIO_FROM_NUMBER,

        to:
          savedSearch.phone,

        body,
      });
  }

  const sentAt =
    new Date().toISOString();

  const notificationIds =
    pendingRows.map(
      (row) => row.id
    );

  const {
    error: updateError,
  } = await supabase
    .from(
      "saved_search_notifications"
    )
    .update({
      sent_at: sentAt,
    })
    .in(
      "id",
      notificationIds
    );

  if (updateError) {
    throw updateError;
  }

  return {
    sent:
      notificationIds.length,
  };
}