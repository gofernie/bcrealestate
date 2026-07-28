import "dotenv/config";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error("ANTHROPIC_API_KEY is missing");
}

const LIMIT = Number(process.argv[2] || 10);

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
    .replace(/\s*```.*$/s, "")
    .trim();

  const start = cleaned.indexOf("{");

  if (start === -1) {
    throw new Error("Claude response contained no JSON object");
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < cleaned.length; i++) {
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
        return cleaned.slice(start, i + 1);
      }
    }
  }

  throw new Error("Claude returned incomplete JSON");
}
async function makeCheapThumbnail(url: string) {
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
async function detectFloorplans(images: string[]) {
  const content: any[] = [];

  console.log(
    `  Building ${images.length} cheap thumbnails...`
  );

  for (let index = 0; index < images.length; index++) {
    try {
      const base64 =
        await makeCheapThumbnail(images[index]);

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
        `  Could not thumbnail image ${index + 1}:`,
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
- maps
- neighbourhood maps
- subdivision maps
- site plans
- property boundary drawings
- artist impressions
- architectural exterior renderings
- feature sheets
- advertisements
- virtual staging

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

  const message = await anthropic.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 250,

    messages: [
      {
        role: "user",
        content,
      },
    ],
  });

  const result = message.content
    .filter((block: any) => block.type === "text")
    .map((block: any) => block.text)
    .join("\n")
    .trim();

  const parsed = JSON.parse(
    cleanJson(result)
  );

  return Array.isArray(parsed.floorplans)
    ? parsed.floorplans
    : [];
}

async function saveFloorplans(
  listingId: string,
  images: string[],
  floorplans: any[]
) {
  if (!floorplans.length) {
    return;
  }

  const rows = floorplans
    .map((floorplan: any) => {
      const imageNumber =
        Number(floorplan.image_number);

      const confidence =
        Number(floorplan.confidence);

      const imageUrl =
        images[imageNumber - 1];

      if (!imageUrl) return null;

      return {
        listing_id: String(listingId),
        image_number: imageNumber,
        image_url: imageUrl,
        confidence,
        analyzed_at: new Date().toISOString(),
      };
    })
    .filter(Boolean);

  if (!rows.length) return;

  const { error } = await supabase
    .from("listing_floorplans")
    .upsert(rows, {
      onConflict: "listing_id,image_number",
    });

  if (error) {
    throw new Error(
      `Floorplan save failed: ${error.message}`
    );
  }
}

async function main() {
  console.log(
    `Loading ${LIMIT} Nanaimo listings with images...\n`
  );

const { data: listings, error } = await supabase
  .from("listing_rows")
  .select(
    "id, address, image_url, images, normalized_city, status, listed_at"
  )
  .eq("normalized_city", "nanaimo")
  .eq("status", "A")
  .not("images", "is", null)
  .not("listed_at", "is", null)
  .gte(
    "listed_at",
    new Date(
      Date.now() - 120 * 24 * 60 * 60 * 1000
    ).toISOString()
  )
  .order("listed_at", { ascending: false })
  .limit(Math.max(LIMIT * 10, 100));

if (error) {
  throw new Error(
    `Supabase error: ${error.message}`
  );
}

if (!listings?.length) {
  console.log("No listings found.");
  return;
}
  const listingIds = listings.map((listing) =>
  String(listing.id)
);

const { data: scannedRows, error: scannedError } =
  await supabase
    .from("listing_floorplan_scans")
    .select("listing_id")
    .in("listing_id", listingIds);

if (scannedError) {
  throw new Error(
    `Scan history fetch failed: ${scannedError.message}`
  );
}

const scannedIds = new Set(
  (scannedRows || []).map((row: any) =>
    String(row.listing_id)
  )
);

const unscannedListings = listings
  .filter(
    (listing) =>
      !scannedIds.has(String(listing.id))
  )
  .slice(0, LIMIT);

console.log(
  `${unscannedListings.length} of ${listings.length} listings are new/unscanned.\n`
);

for (
  let i = 0;
  i < unscannedListings.length;
  i++
) {
  const listing = unscannedListings[i];
    const images = buildImages(listing);

   console.log(
  `[${i + 1}/${unscannedListings.length}] MLS ${listing.id} — ${images.length} images`
);

    if (!images.length) {
      console.log("  - No images");
      continue;
    }

    try {
     const floorplans =
  await detectFloorplans(images);

const { error: scanSaveError } = await supabase
  .from("listing_floorplan_scans")
  .upsert({
    listing_id: String(listing.id),
    image_count: images.length,
    floorplan_count: floorplans.length,
    model: "claude-haiku-4-5-20251001",
    analyzed_at: new Date().toISOString(),
  });

if (scanSaveError) {
  throw new Error(
    `Scan history save failed: ${scanSaveError.message}`
  );
}

if (!floorplans.length) {
  console.log("  - No floorplan");
  continue;
}

      await saveFloorplans(
        listing.id,
        images,
        floorplans
      );

      const numbers =
        floorplans.map(
          (item: any) =>
            item.image_number
        );

      console.log(
        `  ✓ Saved floorplan: ${numbers.join(", ")}`
      );
    } catch (error: any) {
      console.error(
        `  ✗ Failed: ${error?.message || error}`
      );
    }
  }

  console.log("\nDone.");
}

main().catch((error) => {
  console.error(
    "\nFloorplan batch failed:"
  );

  console.error(error);

  process.exit(1);
});