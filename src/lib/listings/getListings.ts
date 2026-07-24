import type {
  SupabaseClient,
} from "@supabase/supabase-js";

export type ListingSort =
  | "newest"
  | "price-low"
  | "price-high";

export interface GetListingsOptions {
  city?: string;
  cities?: string[];
  type?: string;
  areas?: string[];

beds?: number | null;
baths?: number | null;

minPrice?: number | null;
maxPrice?: number | null;

minSqft?: number | null;
maxSqft?: number | null;

  sort?: ListingSort | string;

  page?: number;
  pageSize?: number;

  paginate?: boolean;
  status?: string;
}

export interface GetListingsResult {
  listings: any[];
  totalCount: number;

  currentPage: number;
  totalPages: number;
  pageSize: number;

  paginationStart: number;
  paginationEnd: number;

  hasPreviousPage: boolean;
  hasNextPage: boolean;

  sort: ListingSort;
  error: any | null;
}

const listingSelect = `
  id,
  mls_number,
  normalized_city,
  normalized_type,
  property_type,
  area,
  normalized_area,
  price,
  beds,
  baths,
  sqft,
  address,
  description,
  image_url,
  images,
  listed_at,
  created_at,
  updated_at,
  status,
  lat,
  lng
`;

const allowedSortValues =
  new Set<ListingSort>([
    "newest",
    "price-low",
    "price-high",
  ]);

const normalizeText = (
  value: unknown
) =>
  String(value || "")
    .toLowerCase()
    .trim();

const normalizePositiveInteger = (
  value: unknown,
  fallback: number
) => {
  const parsed =
    Number.parseInt(
      String(value ?? fallback),
      10
    );

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return parsed;
};

const normalizeOptionalNumber = (
  value: unknown
) => {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 0
  ) {
    return null;
  }

  return parsed;
};

const normalizeSort = (
  value: unknown
): ListingSort => {
  const normalized =
    normalizeText(value) as ListingSort;

  return allowedSortValues.has(
    normalized
  )
    ? normalized
    : "newest";
};

const normalizeTextArray = (
  values: unknown
) => {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) =>
          normalizeText(value)
        )
        .filter(Boolean)
    ),
  ];
};

export async function getListings(
  supabase: SupabaseClient,
  options: GetListingsOptions = {}
): Promise<GetListingsResult> {
  const city =
    normalizeText(options.city);

  const cities =
    normalizeTextArray(
      options.cities
    );

  const type =
    normalizeText(options.type);

  const areas =
    normalizeTextArray(
      options.areas
    );

 const beds =
  normalizeOptionalNumber(
    options.beds
  );

const baths =
  normalizeOptionalNumber(
    options.baths
  );

const minPrice =
  normalizeOptionalNumber(
    options.minPrice
  );

const maxPrice =
  normalizeOptionalNumber(
    options.maxPrice
  );

const minSqft =
  normalizeOptionalNumber(
    options.minSqft
  );

const maxSqft =
  normalizeOptionalNumber(
    options.maxSqft
  );

  const sort =
    normalizeSort(options.sort);

  const requestedPage =
    normalizePositiveInteger(
      options.page,
      1
    );

  const pageSize =
    normalizePositiveInteger(
      options.pageSize,
      24
    );

  const paginate =
    options.paginate !== false;

  const status =
    String(options.status || "A")
      .trim();

  const runQuery = async (
    page: number
  ) => {
    let query = supabase
      .from("listing_rows")
      .select(listingSelect, {
        count: "exact",
      });

    if (status) {
      query = query.eq(
        "status",
        status
      );
    }

    if (city) {
      query = query.eq(
        "normalized_city",
        city
      );
    } else if (cities.length > 0) {
      query = query.in(
        "normalized_city",
        cities
      );
    }

    if (type) {
      query = query.eq(
        "normalized_type",
        type
      );
    }

    if (areas.length > 0) {
      query = query.in(
        "normalized_area",
        areas
      );
    }

if (beds !== null) {
  query = query.gte(
    "beds",
    beds
  );
}

if (baths !== null) {
  query = query.gte(
    "baths",
    baths
  );
}

if (minPrice !== null) {
  query = query.gte(
    "price",
    minPrice
  );
}

if (maxPrice !== null) {
  query = query.lte(
    "price",
    maxPrice
  );
}

if (minSqft !== null) {
  query = query.gte(
    "sqft",
    minSqft
  );
}

if (maxSqft !== null) {
  query = query.lte(
    "sqft",
    maxSqft
  );
}

    if (sort === "price-low") {
      query = query
        .order("price", {
          ascending: true,
          nullsFirst: false,
        })
        .order("listed_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
          nullsFirst: false,
        });
    } else if (
      sort === "price-high"
    ) {
      query = query
        .order("price", {
          ascending: false,
          nullsFirst: false,
        })
        .order("listed_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
          nullsFirst: false,
        });
    } else {
      query = query
        .order("listed_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
          nullsFirst: false,
        });
    }

    if (paginate) {
      const rangeStart =
        (page - 1) * pageSize;

      const rangeEnd =
        rangeStart +
        pageSize -
        1;

      query = query.range(
        rangeStart,
        rangeEnd
      );
    }

    return await query;
  };

let initialResult: any;

if (paginate) {
  initialResult =
    await runQuery(requestedPage);
} else {
  const batchSize = 1000;
  const allListings: any[] = [];
  let totalCount = 0;
  let batchError: any = null;

  for (
    let rangeStart = 0;
    ;
    rangeStart += batchSize
  ) {
    const rangeEnd =
      rangeStart + batchSize - 1;

    let query = supabase
      .from("listing_rows")
      .select(listingSelect, {
        count:
          rangeStart === 0
            ? "exact"
            : undefined,
      });

    if (status) {
      query = query.eq(
        "status",
        status
      );
    }

    if (city) {
      query = query.eq(
        "normalized_city",
        city
      );
    } else if (
      cities.length > 0
    ) {
      query = query.in(
        "normalized_city",
        cities
      );
    }

    if (type) {
      query = query.eq(
        "normalized_type",
        type
      );
    }

    if (areas.length > 0) {
      query = query.in(
        "normalized_area",
        areas
      );
    }

    if (beds !== null) {
      query = query.gte(
        "beds",
        beds
      );
    }

    if (baths !== null) {
      query = query.gte(
        "baths",
        baths
      );
    }

    if (minPrice !== null) {
      query = query.gte(
        "price",
        minPrice
      );
    }

    if (maxPrice !== null) {
      query = query.lte(
        "price",
        maxPrice
      );
    }

    if (minSqft !== null) {
      query = query.gte(
        "sqft",
        minSqft
      );
    }

    if (maxSqft !== null) {
      query = query.lte(
        "sqft",
        maxSqft
      );
    }

    if (
      sort === "price-low"
    ) {
      query = query
        .order("price", {
          ascending: true,
          nullsFirst: false,
        })
        .order("listed_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
          nullsFirst: false,
        });
    } else if (
      sort === "price-high"
    ) {
      query = query
        .order("price", {
          ascending: false,
          nullsFirst: false,
        })
        .order("listed_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
          nullsFirst: false,
        });
    } else {
      query = query
        .order("listed_at", {
          ascending: false,
          nullsFirst: false,
        })
        .order("created_at", {
          ascending: false,
          nullsFirst: false,
        });
    }

    const batchResult =
      await query.range(
        rangeStart,
        rangeEnd
      );

    if (batchResult.error) {
      batchError =
        batchResult.error;
      break;
    }

    const batch =
      batchResult.data || [];

    if (rangeStart === 0) {
      totalCount =
        batchResult.count ||
        batch.length;
    }

    allListings.push(
      ...batch
    );

    if (
      batch.length <
        batchSize ||
      allListings.length >=
        totalCount
    ) {
      break;
    }
  }

  initialResult = {
    data: allListings,
    count: totalCount,
    error: batchError,
  };
}

  if (initialResult.error) {
    return {
      listings: [],
      totalCount: 0,

      currentPage: 1,
      totalPages: 1,
      pageSize,

      paginationStart: 0,
      paginationEnd: 0,

      hasPreviousPage: false,
      hasNextPage: false,

      sort,
      error:
        initialResult.error,
    };
  }

  const totalCount =
    initialResult.count || 0;

  const totalPages =
    paginate
      ? Math.max(
          1,
          Math.ceil(
            totalCount / pageSize
          )
        )
      : 1;

  const currentPage =
    paginate
      ? Math.min(
          requestedPage,
          totalPages
        )
      : 1;

  let listings =
    initialResult.data || [];

  let finalError: any | null =
    null;

  if (
    paginate &&
    totalCount > 0 &&
    currentPage !== requestedPage
  ) {
    const correctedResult =
      await runQuery(currentPage);

    if (correctedResult.error) {
      listings = [];
      finalError =
        correctedResult.error;
    } else {
      listings =
        correctedResult.data || [];
    }
  }

  const paginationStart =
    totalCount === 0
      ? 0
      : paginate
        ? (currentPage - 1) *
            pageSize +
          1
        : 1;

  const paginationEnd =
    totalCount === 0
      ? 0
      : paginate
        ? Math.min(
            paginationStart +
              listings.length -
              1,
            totalCount
          )
        : totalCount;

  return {
    listings,
    totalCount,

    currentPage,
    totalPages,
    pageSize,

    paginationStart,
    paginationEnd,

    hasPreviousPage:
      paginate &&
      currentPage > 1,

    hasNextPage:
      paginate &&
      currentPage <
        totalPages,

    sort,
    error: finalError,
  };
}
