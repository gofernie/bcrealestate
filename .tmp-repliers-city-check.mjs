const apiKey = process.env.REPLIERS_API_KEY;
const baseUrl = process.env.REPLIERS_BASE_URL || "https://api.repliers.io";

if (!apiKey) {
  throw new Error("REPLIERS_API_KEY is unavailable.");
}

async function check(city, includeStatus) {
  const params = new URLSearchParams({
    city,
    pageNum: "1",
    resultsPerPage: "10",
    include: "address"
  });

  if (includeStatus) {
    params.set("status", "A");
  }

  const response = await fetch(`${baseUrl}/listings?${params}`, {
    headers: {
      "REPLIERS-API-KEY": apiKey
    }
  });

  const body = await response.json();
  const listings = body?.listings || body?.results || [];

  console.log({
    requestedCity: city,
    includeStatus,
    httpStatus: response.status,
    countReturned: Array.isArray(listings) ? listings.length : null,
    total:
      body?.count ??
      body?.total ??
      body?.numResults ??
      body?.pagination?.total ??
      null,
    returnedCities: Array.isArray(listings)
      ? [...new Set(
          listings.map(item =>
            item?.address?.city ||
            item?.city ||
            "(missing)"
          )
        )]
      : [],
    responseKeys: Object.keys(body || {})
  });
}

await check("Parksville", false);
await check("Parksville", true);
await check("Nanoose Bay", false);
await check("Nanoose Bay", true);