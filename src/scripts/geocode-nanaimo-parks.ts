import { writeFile } from "node:fs/promises";

type ParkInput = {
  name: string;
  slug: string;
  address: string;
};

type SearchResult = {
  lat: string;
  lon: string;
  display_name: string;
};

type GeocodedPark = ParkInput & {
  lat: number | null;
  lng: number | null;
  matchedAddress: string | null;
};

const parks: ParkInput[] = [
  {
    name: "Cedar Ridge Manufactured Home Park",
    slug: "cedar-ridge",
    address: "2161 Walsh Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Sunnyslope Manufactured Home Park",
    slug: "sunnyslope",
    address: "1359 Cranberry Ave, Nanaimo, BC, Canada",
  },
  {
    name: "Brookdale Manufactured Home Park",
    slug: "brookdale",
    address: "61 Twelfth St, Nanaimo, BC, Canada",
  },
  {
    name: "Sea Breeze Manufactured Home Park",
    slug: "sea-breeze",
    address: "25 Maki Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Chase River Manufactured Home Park",
    slug: "chase-river",
    address: "1074 Old Victoria Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Ed’s Manufactured Home Park",
    slug: "eds",
    address: "Honey Dr, Nanaimo, BC, Canada",
  },
  {
    name: "Mountain View Manufactured Home Park",
    slug: "mountain-view",
    address: "80 Fifth St, Nanaimo, BC, Canada",
  },
  {
    name: "Willow Manufactured Home Park",
    slug: "willow",
    address: "1177 Morrell Circle, Nanaimo, BC, Canada",
  },
  {
    name: "Wish-Sha Manufactured Home Park",
    slug: "wish-sha",
    address: "2301 Arbot Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Dogwood Manufactured Home Park",
    slug: "dogwood",
    address: "2501 Labieux Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Deerwood Place Estates",
    slug: "deerwood-place-estates",
    address: "Deerwood Blvd, Nanaimo, BC, Canada",
  },
  {
    name: "Woodgrove Estates Manufactured Home Park",
    slug: "woodgrove-estates",
    address: "5854 Turner Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Pleasant Valley Manufactured Home Park",
    slug: "pleasant-valley",
    address: "5931 Island Hwy N, Nanaimo, BC, Canada",
  },
  {
    name: "Crest I Manufactured Home Park",
    slug: "crest-one",
    address: "6245 Metral Dr, Nanaimo, BC, Canada",
  },
  {
    name: "Crest II Manufactured Home Park",
    slug: "crest-two",
    address: "Metral Dr, Nanaimo, BC, Canada",
  },
  {
    name: "Sharman Manufactured Home Park",
    slug: "sharman",
    address: "6325 Metral Dr, Nanaimo, BC, Canada",
  },
  {
    name: "Valley Oak Estates",
    slug: "valley-oak-estates",
    address: "Valley Oak Dr, Nanaimo, BC, Canada",
  },
  {
    name: "Petroglyph Manufactured Home Park",
    slug: "petroglyph",
    address: "1000 Chase River Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Forest Glade Manufactured Home Park",
    slug: "forest-glade",
    address: "1310 Spruston Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Meadow Ridge Estates",
    slug: "meadow-ridge-estates",
    address: "328 Myrtle Cres, Nanaimo, BC, Canada",
  },
  {
    name: "Park Lane Manufactured Home Park",
    slug: "park-lane",
    address: "971 Douglas Ave, Nanaimo, BC, Canada",
  },
  {
    name: "Seabird Manufactured Home Park",
    slug: "seabird",
    address: "3449 Hallberg Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Southgate Manufactured Home Park",
    slug: "southgate",
    address: "1226 Lawlor Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Cedar Meadow Manufactured Home Park",
    slug: "cedar-meadow",
    address: "1385 MacMillan Rd, Nanaimo, BC, Canada",
  },
  {
    name: "Zuiderzee Manufactured Home Park",
    slug: "zuiderzee",
    address: "2575 Enefer Rd, Nanaimo, BC, Canada",
  },
];

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) =>
    setTimeout(resolve, milliseconds)
  );

async function searchLocation(
  searchText: string
): Promise<SearchResult | null> {
  const url = new URL(
    "https://nominatim.openstreetmap.org/search"
  );

  url.searchParams.set("q", searchText);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "ca");
  url.searchParams.set("addressdetails", "1");

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "NanaimoMobileHomes/1.0 contact@chriscrump.com",
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Geocoding request failed: ${response.status}`
    );
  }

  const results =
    (await response.json()) as SearchResult[];

  return results[0] ?? null;
}

async function geocodePark(
  park: ParkInput
): Promise<GeocodedPark> {
  const searches = [
    park.address,
    `${park.name}, Nanaimo, BC, Canada`,
    `${park.address.replace(
      ", BC, Canada",
      ""
    )}, British Columbia, Canada`,
  ];

  for (const searchText of searches) {
    console.log(`  Trying: ${searchText}`);

    const match = await searchLocation(searchText);

    if (match) {
      return {
        ...park,
        lat: Number(match.lat),
        lng: Number(match.lon),
        matchedAddress: match.display_name,
      };
    }

    await wait(1200);
  }

  return {
    ...park,
    lat: null,
    lng: null,
    matchedAddress: null,
  };
}

async function main() {
  const results: GeocodedPark[] = [];

  for (const park of parks) {
    console.log(`Geocoding: ${park.name}`);

    try {
      const result = await geocodePark(park);
      results.push(result);

      if (
        result.lat !== null &&
        result.lng !== null
      ) {
        console.log(
          `  Found: ${result.lat}, ${result.lng}`
        );
        console.log(
          `  Match: ${result.matchedAddress}`
        );
      } else {
        console.log("  No result");
      }
    } catch (error) {
      console.error(
        `  Failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );

      results.push({
        ...park,
        lat: null,
        lng: null,
        matchedAddress: null,
      });
    }

    await wait(1200);
  }

  await writeFile(
    "nanaimo-park-coordinates.json",
    JSON.stringify(results, null, 2),
    "utf8"
  );

  const matchedCount = results.filter(
    (park) =>
      park.lat !== null && park.lng !== null
  ).length;

  console.log(
    `\nMatched ${matchedCount} of ${results.length} parks.`
  );

  console.log(
    "Saved results to nanaimo-park-coordinates.json"
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});