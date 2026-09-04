import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const BASE_URL = "https://bc.realestate";

const slugify = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^pq[\s-]+/i, "")
    .replace(/&/g, "and")
    .replace(/\//g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const escapeXml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

async function fetchListingRows(
  supabase: any,
  statuses: string[],
  updatedAfter?: string
) {
  const batchSize = 1000;

  const makeCountQuery = () => {
    let query = supabase
      .from("listing_rows")
      .select("id", {
        count: "exact",
        head: true,
      })
      .in("status", statuses);

    if (updatedAfter) {
      query = query.gte(
        "updated_at",
        updatedAfter
      );
    }

    return query;
  };

  const countResult = await makeCountQuery();

  if (countResult.error) {
    console.error(
      "Sitemap listing count failed:",
      countResult.error
    );
    return [];
  }

  const count = Number(countResult.count || 0);
  const pageCount = Math.ceil(count / batchSize);

  const pageRequests = Array.from(
    { length: pageCount },
    (_, pageIndex) => {
      const from = pageIndex * batchSize;

      let query = supabase
        .from("listing_rows")
        .select(`
          id,
          mls_number,
          normalized_city,
          status,
          updated_at,
          address,
          image_url
        `)
        .in("status", statuses)
        .order("id", { ascending: true })
        .range(
          from,
          from + batchSize - 1
        );

      if (updatedAfter) {
        query = query.gte(
          "updated_at",
          updatedAfter
        );
      }

      return query;
    }
  );

  const results = await Promise.all(
    pageRequests
  );

  const rows: any[] = [];

  for (const result of results) {
    if (result.error) {
      console.error(
        "Sitemap listing page failed:",
        result.error
      );
      continue;
    }

    rows.push(...(result.data || []));
  }

  return rows;
}

export const GET: APIRoute = async () => {
  const supabase = createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const [sitesResult, pagesResult, areasResult] = await Promise.all([
    supabase
      .from("sites")
      .select("city")
      .not("city", "is", null),

    supabase
      .from("intent_pages")
      .select("city,slug")
      .eq("is_published", true),

    supabase
      .from("area_boundaries")
      .select("city,area_slug,area_name"),
  ]);

  const inactiveCutoff = new Date(
    Date.now() - 180 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    activeListingRows,
    recentInactiveListingRows,
  ] = await Promise.all([
    fetchListingRows(
      supabase,
      ["A", "I"]
    ),
    fetchListingRows(
      supabase,
      ["inactive"],
      inactiveCutoff
    ),
  ]);

  const listingRows = [
    ...activeListingRows,
    ...recentInactiveListingRows,
  ];

  if (sitesResult.error) {
    console.error("Sitemap sites query failed:", sitesResult.error);
  }

  if (pagesResult.error) {
    console.error("Sitemap intent pages query failed:", pagesResult.error);
  }

  if (areasResult.error) {
    console.error("Sitemap areas query failed:", areasResult.error);
  }

  const urls = new Set<string>([`${BASE_URL}/`]);

  const cities = Array.from(
    new Set(
      (sitesResult.data || [])
        .map((row: any) => slugify(row.city))
        .filter(Boolean)
    )
  );

  const corePages = [
    "",
    "areas",
    "homes",
    "condos",
    "townhomes",
    "mobile-homes",
    "land",
  ];

  for (const city of cities) {
    for (const page of corePages) {
      urls.add(
        page
          ? `${BASE_URL}/${city}/${page}`
          : `${BASE_URL}/${city}/`
      );
    }
  }

  for (const page of pagesResult.data || []) {
    const city = slugify(page.city);
    const slug = slugify(page.slug);

    if (city && slug && cities.includes(city)) {
      urls.add(`${BASE_URL}/${city}/${slug}`);
    }
  }

  for (const area of areasResult.data || []) {
    const city = slugify(area.city);
    const slug = slugify(area.area_slug || area.area_name);

    if (city && slug && cities.includes(city)) {
      urls.add(`${BASE_URL}/${city}/${slug}`);
    }
  }

  for (const listing of listingRows) {
    const city = slugify(
      listing.normalized_city
    );

    const listingId = String(
      listing.mls_number ||
      listing.id ||
      ""
    ).trim();

    const address = String(
      listing.address ||
      ""
    ).trim();

    /*
     * Keep sitemap generation lightweight.
     * The listing page itself performs the stricter
     * description and image indexing check.
     */
    const isCompleteEnough =
      city &&
      listingId &&
      address.length >= 5 &&
      Boolean(listing.image_url);

    if (
      isCompleteEnough &&
      cities.includes(city)
    ) {
      urls.add(
        `${BASE_URL}/${city}/listing/${encodeURIComponent(
          listingId
        )}`
      );
    }
  }

  const entries = Array.from(urls)
    .sort()
    .map((url) => `  <url><loc>${escapeXml(url)}</loc></url>`)
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control":
        "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
};