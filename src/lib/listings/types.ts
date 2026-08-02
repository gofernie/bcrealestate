export type ListingSort =
  | "newest"
  | "price-low"
  | "price-high";

export interface ListingFilters {
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

primaryOnMain?: boolean;
bedsTogether?: boolean;
fourBedsTogether?: boolean;

hasFloorplan?: boolean;
hasUpdatedKitchen?: boolean;
hasDetachedShop?: boolean;

  sort?: ListingSort;

  page?: number;
  pageSize?: number;
}