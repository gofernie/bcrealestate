import "dotenv/config";

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

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
  return result
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

async function detectFloorplans(images: string[]) {
  const content: any[] = [];

  images.forEach((url, index) => {
    content.push({
      type: "text",
      text: `Image ${index + 1}:`,
    });

    content.push({
      type: "image",
      source: {
        type: "url",
        url,
      },
    });
  });

  content.push({
    type: "text",
    text: `
Look through the real-estate listing images above.

Your ONLY job is to identify floorplan images.

A floorplan is an architectural overhead drawing or diagram showing
the arrangement of interior rooms, walls, doors, stairs, dimensions,
or labelled spaces.

Count as floorplans:
- traditional 2D floorplans
- coloured floorplans
- black-and-white floorplans
- floorplans showing one level of a house
- floorplans showing multiple levels

Do NOT count:
- interior photographs
- exterior photographs
- aerial photographs
- maps
- neighbourhood maps
- site/location maps
- property boundary diagrams
- feature sheets
- listing advertisements
- virtual staging
- ordinary architectural renderings

Return ONLY valid JSON.

Use exactly:

{
  "floorplans": [
    {
      "image_number": 12,
      "confidence": 0.98
    }
  ]
}

If there are no floorplans:

{
  "floorplans": []
}
`.trim(),
  });

  const message = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 500,

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

  const parsed = JSON.parse(cleanJson(result));

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
    "id, address, image_url, images, normalized_city, status"
  )
  .eq("normalized_city", "nanaimo")
  .eq("status", "A")
  .not("images", "is", null)
  .order("id", { ascending: false })
  .limit(LIMIT);

  if (error) {
    throw new Error(
      `Supabase error: ${error.message}`
    );
  }

  if (!listings?.length) {
    console.log("No listings found.");
    return;
  }

  for (
    let i = 0;
    i < listings.length;
    i++
  ) {
    const listing = listings[i];
    const images = buildImages(listing);

    console.log(
      `[${i + 1}/${listings.length}] MLS ${listing.id} — ${images.length} images`
    );

    if (!images.length) {
      console.log("  - No images");
      continue;
    }

    try {
      const floorplans =
        await detectFloorplans(images);

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