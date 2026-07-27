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

const LIMIT = Number(process.argv[2] || 20);

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

async function main() {
  console.log(
    `Loading ${LIMIT} Nanaimo listings with images...\n`
  );

  const { data: listings, error } = await supabase
    .from("listing_rows")
    .select(
      "id, address, image_url, images, normalized_city"
    )
    .eq("normalized_city", "nanaimo")
    .not("images", "is", null)
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

  const results: any[] = [];

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
      results.push({
        mls: listing.id,
        photos: 0,
        floorplans: "-",
        confidence: "-",
        urls: [],
      });

      continue;
    }

    try {
      const floorplans =
        await detectFloorplans(images);

      const detectedNumbers =
        floorplans.map(
          (item: any) =>
            Number(item.image_number)
        );

      const confidences =
        floorplans.map(
          (item: any) =>
            `${Math.round(
              Number(item.confidence) * 100
            )}%`
        );

      const urls =
        floorplans
          .map((item: any) => {
            const index =
              Number(item.image_number) - 1;

            return images[index] || "";
          })
          .filter(Boolean);

      console.log(
        floorplans.length
          ? `  ✓ Floorplan: ${detectedNumbers.join(", ")}`
          : "  - No floorplan"
      );

      results.push({
        mls: listing.id,
        photos: images.length,
        floorplans:
          detectedNumbers.length
            ? detectedNumbers.join(",")
            : "-",
        confidence:
          confidences.length
            ? confidences.join(",")
            : "-",
        urls,
      });
    } catch (error: any) {
      console.error(
        `  ✗ Failed: ${error?.message || error}`
      );

      results.push({
        mls: listing.id,
        photos: images.length,
        floorplans: "ERROR",
        confidence: "-",
        urls: [],
      });
    }
  }

  console.log("\n\nRESULTS\n");

  console.table(
    results.map((row) => ({
      MLS: row.mls,
      Photos: row.photos,
      Floorplans: row.floorplans,
      Confidence: row.confidence,
    }))
  );

  console.log(
    "\nDETECTED FLOORPLAN URLS\n"
  );

  for (const row of results) {
    if (!row.urls.length) continue;

    console.log(`MLS ${row.mls}`);

    row.urls.forEach(
      (url: string, index: number) => {
        console.log(
          `  ${index + 1}. ${url}`
        );
      }
    );

    console.log("");
  }

  const detectedCount =
    results.filter(
      (row) =>
        row.floorplans !== "-" &&
        row.floorplans !== "ERROR"
    ).length;

  console.log(
    `${detectedCount} of ${results.length} listings had floorplans detected.`
  );
}

main().catch((error) => {
  console.error(
    "\nBatch floorplan test failed:"
  );

  console.error(error);

  process.exit(1);
});