import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const MODEL = "claude-haiku-4-5-20251001";

function normalizeImageUrl(value: any): string {
  if (!value) return "";

  const raw =
    typeof value === "string"
      ? value
      : value.highRes ||
        value.mediumRes ||
        value.lowRes ||
        value.url ||
        value.src ||
        value.href ||
        value.path ||
        "";

  if (!raw) return "";

  if (
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  const cleaned = raw.startsWith("/")
    ? raw
    : `/${raw}`;

  return `https://cdn.repliers.io${cleaned}`;
}

function buildImages(listing: any): string[] {
  const imageUrls = [
    normalizeImageUrl(listing.image_url),

    ...(Array.isArray(listing.images)
      ? listing.images.map(normalizeImageUrl)
      : []),
  ].filter(Boolean);

  return [...new Set(imageUrls)];
}

function cleanJson(result: string) {
  const cleaned = result
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```[\s\S]*$/, "")
    .trim();

  const start = cleaned.indexOf("{");

  if (start === -1) {
    throw new Error(
      "Claude response contained no JSON object"
    );
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (
    let i = start;
    i < cleaned.length;
    i++
  ) {
    const char = cleaned[i];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      if (inString) escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth++;

    if (char === "}") {
      depth--;

      if (depth === 0) {
        return cleaned.slice(
          start,
          i + 1
        );
      }
    }
  }

  throw new Error(
    "Claude returned incomplete JSON"
  );
}

async function makeCheapThumbnail(
  url: string
) {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `Image download failed ${response.status}: ${url}`
    );
  }

  const source = Buffer.from(
    await response.arrayBuffer()
  );

  const thumbnail = await sharp(source)
    .resize({
      width: 280,
      height: 280,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({
      quality: 55,
      mozjpeg: true,
    })
    .toBuffer();

  return thumbnail.toString("base64");
}

async function detectFloorplans(
  anthropic: Anthropic,
  images: string[]
) {
  const content: any[] = [];

  console.log(
    `Building ${images.length} cheap thumbnails...`
  );

  for (
    let index = 0;
    index < images.length;
    index++
  ) {
    try {
      const base64 =
        await makeCheapThumbnail(
          images[index]
        );

      content.push({
        type: "text",
        text: `Image ${index + 1}:`,
      });

      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: "image/jpeg",
          data: base64,
        },
      });
    } catch (error: any) {
      console.warn(
        `Could not thumbnail image ${index + 1}:`,
        error?.message || error
      );
    }
  }

  if (!content.length) {
    return [];
  }

  content.push({
    type: "text",
    text: `
These are small thumbnails from a real-estate listing.

Identify which images are floorplans.

A floorplan is an overhead architectural drawing showing the
arrangement of rooms, walls, doors, stairs, dimensions, or
labelled interior spaces.

The thumbnails may be too small to read room labels. That is OK.
Use the visual structure of the image.

Count:
- traditional 2D floorplans
- coloured floorplans
- black-and-white floorplans
- individual floor levels
- multiple floor levels shown together

Do NOT count:
- room photographs
- exterior photographs
- aerial photographs
- drone photographs
- maps
- neighbourhood maps
- subdivision maps
- site plans
- survey plans
- property boundary drawings
- lot diagrams
- parcel outlines
- aerial images with highlighted property boundaries
- aerial images with building footprints
- aerial images with measurements, labels, or boundary lines
- landscaping plans
- artist impressions
- architectural exterior renderings
- feature sheets
- advertisements
- virtual staging

IMPORTANT:

A valid floorplan MUST primarily show the INTERNAL architectural
layout of a building.

A valid floorplan should visibly show multiple interior elements
such as rooms, interior walls, door openings, stairs, hallways,
labelled interior spaces, or room dimensions.

Do NOT classify an image as a floorplan merely because it contains
lines, measurements, outlines, labels, a building footprint,
property boundaries, or a top-down view.

If an image mainly shows the LOT, LAND, PARCEL, PROPERTY BOUNDARY,
BUILDING LOCATION, or SURROUNDING NEIGHBOURHOOD, it is NOT a
floorplan.

When uncertain whether an image is an interior floorplan or an
aerial/site/property plan, classify it as NOT a floorplan.

Return ONLY valid JSON:

{
  "floorplans": [
    {
      "image_number": 12,
      "confidence": 0.98
    }
  ]
}

If none:

{
  "floorplans": []
}
`.trim(),
  });

  const message =
    await anthropic.messages.create({
      model: MODEL,
      max_tokens: 250,

      messages: [
        {
          role: "user",
          content,
        },
      ],
    });

  const result = message.content
    .filter(
      (block: any) =>
        block.type === "text"
    )
    .map(
      (block: any) =>
        block.text
    )
    .join("\n")
    .trim();

  const parsed = JSON.parse(
    cleanJson(result)
  );

  return Array.isArray(
    parsed.floorplans
  )
    ? parsed.floorplans
    : [];
}

export async function scanNewFloorplans({
  city = "nanaimo",
  limit = 20,
}: {
  city?: string;
  limit?: number;
} = {}) {
  const supabaseUrl =
    process.env.PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  const anthropicKey =
    process.env.ANTHROPIC_API_KEY;

  if (
    !supabaseUrl ||
    !serviceRoleKey
  ) {
    throw new Error(
      "Missing Supabase environment variables"
    );
  }

  if (!anthropicKey) {
    throw new Error(
      "Missing ANTHROPIC_API_KEY"
    );
  }

  const supabase = createClient(
    supabaseUrl,
    serviceRoleKey
  );

  const anthropic = new Anthropic({
    apiKey: anthropicKey,
  });

  const cutoff = new Date(
    Date.now() -
      120 * 24 * 60 * 60 * 1000
  ).toISOString();

  const {
    data: listings,
    error,
  } = await supabase
    .from("listing_rows")
    .select(
      "id, address, image_url, images, normalized_city, status, listed_at"
    )
    .eq("normalized_city", city)
    .eq("status", "A")
    .not("images", "is", null)
    .not("listed_at", "is", null)
    .gte("listed_at", cutoff)
    .order(
      "listed_at",
      { ascending: false }
    )
    .limit(
      Math.max(
        limit * 10,
        100
      )
    );

  if (error) {
    throw new Error(
      `Listing fetch failed: ${error.message}`
    );
  }

  if (!listings?.length) {
    return {
      ok: true,
      city,
      scanned: 0,
      floorplansFound: 0,
    };
  }

  const listingIds =
    listings.map(
      (listing) =>
        String(listing.id)
    );

  const {
    data: scannedRows,
    error: scannedError,
  } = await supabase
    .from(
      "listing_floorplan_scans"
    )
    .select("listing_id")
    .in(
      "listing_id",
      listingIds
    );

  if (scannedError) {
    throw new Error(
      `Scan history fetch failed: ${scannedError.message}`
    );
  }

  const scannedIds =
    new Set(
      (scannedRows || []).map(
        (row: any) =>
          String(
            row.listing_id
          )
      )
    );

  const unscannedListings =
    listings
      .filter(
        (listing) =>
          !scannedIds.has(
            String(
              listing.id
            )
          )
      )
      .slice(
        0,
        limit
      );

  let scanned = 0;
  let floorplansFound = 0;
  const failures: any[] = [];

  for (
    const listing of unscannedListings
  ) {
    const images =
      buildImages(listing);

    if (!images.length) {
      continue;
    }

    try {
      console.log(
        `Scanning MLS ${listing.id} — ${images.length} images`
      );

      const floorplans =
        await detectFloorplans(
          anthropic,
          images
        );

      const {
        error: scanSaveError,
      } = await supabase
        .from(
          "listing_floorplan_scans"
        )
        .upsert({
          listing_id:
            String(listing.id),

          image_count:
            images.length,

          floorplan_count:
            floorplans.length,

          model: MODEL,

          analyzed_at:
            new Date().toISOString(),
        });

      if (scanSaveError) {
        throw new Error(
          `Scan history save failed: ${scanSaveError.message}`
        );
      }

      scanned += 1;

      if (!floorplans.length) {
        console.log(
          `MLS ${listing.id}: no floorplan`
        );

        continue;
      }

      const rows =
        floorplans
          .map(
            (
              floorplan: any
            ) => {
              const imageNumber =
                Number(
                  floorplan.image_number
                );

              const imageUrl =
                images[
                  imageNumber - 1
                ];

              if (!imageUrl) {
                return null;
              }

              return {
                listing_id:
                  String(
                    listing.id
                  ),

                image_number:
                  imageNumber,

                image_url:
                  imageUrl,

                confidence:
                  Number(
                    floorplan.confidence
                  ),

                analyzed_at:
                  new Date().toISOString(),
              };
            }
          )
          .filter(Boolean);

      if (rows.length) {
        const {
          error: saveError,
        } = await supabase
          .from(
            "listing_floorplans"
          )
          .upsert(
            rows,
            {
              onConflict:
                "listing_id,image_number",
            }
          );

        if (saveError) {
          throw new Error(
            `Floorplan save failed: ${saveError.message}`
          );
        }

        floorplansFound +=
          rows.length;

        console.log(
          `MLS ${listing.id}: saved ${rows.length} floorplan(s)`
        );
      }
    } catch (error: any) {
      console.error(
        `Floorplan scan failed for MLS ${listing.id}:`,
        error?.message || error
      );

      failures.push({
        listing_id:
          String(listing.id),

        error:
          error?.message ||
          String(error),
      });
    }
  }

  return {
    ok: true,
    city,
    scanned,
    floorplansFound,
    failures,
  };
}