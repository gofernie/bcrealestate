import { createClient } from "@supabase/supabase-js";
import * as turf from "@turf/turf";

export const regionDistricts = [
  ["victoria", "Victoria"], ["saanich-east", "Saanich East"],
  ["saanich-west", "Saanich West"], ["oak-bay", "Oak Bay"],
  ["esquimalt", "Esquimalt"], ["view-royal", "View Royal"],
  ["colwood", "Colwood"], ["langford", "Langford"],
  ["highlands", "Highlands"], ["metchosin", "Metchosin"],
  ["sooke", "Sooke"], ["central-saanich", "Central Saanich"],
  ["north-saanich", "North Saanich"], ["sidney", "Sidney"],
].map(([slug, name]) => ({ slug, name }));
export const regionCityKeys = [...new Set([
  ...regionDistricts.flatMap(({slug}) => [slug, slug.replace(/-/g, " ")]), "saanich",
])];
export const regionSlug = (value: unknown) => String(value || "").trim().toLowerCase()
  .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const areaKey = (value: unknown) => regionSlug(value).replace(/-neighbou?rhood$/, "");

export function regionPolygons(value: any): any[] {
  if (typeof value === "string") { try { value = JSON.parse(value); } catch { return []; } }
  if (!value) return [];
  if (value.type === "FeatureCollection") return (value.features || []).flatMap(regionPolygons);
  if (value.type === "Feature") return regionPolygons(value.geometry);
  if (["Polygon", "MultiPolygon"].includes(value.type)) return [turf.feature(value)];
  return [];
}
export function regionContains(geometry: any, lat: unknown, lng: unknown) {
  const x = Number(lng), y = Number(lat);
  if (!Number.isFinite(x) || !Number.isFinite(y) || !x || !y) return false;
  return regionPolygons(geometry).some((polygon) => {
    try { return turf.booleanPointInPolygon([x,y], polygon); } catch { return false; }
  });
}
function districtExterior(feature: any) {
  if (!feature?.geometry) return feature;
  // Close narrow seams in the display shape, keeping source boundaries intact.
  try {
    const expanded = turf.buffer(feature, 0.025, { units: "kilometers", steps: 8 });
    const closed = expanded
      ? turf.buffer(expanded, -0.025, { units: "kilometers", steps: 8 })
      : null;
    if (closed?.geometry) feature = closed;
  } catch {
    // Keep the original outline if buffering fails.
  }
  const geometry = feature.geometry;
  if (geometry.type === "Polygon") {
    return {
      ...feature,
      geometry: { ...geometry, coordinates: [geometry.coordinates[0]] }
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      ...feature,
      geometry: {
        ...geometry,
        coordinates: geometry.coordinates.map((polygon: any) => [polygon[0]])
      }
    };
  }
  return feature;
}

function dissolve(rows: any[]) {
  const polygons = rows.flatMap((row) => regionPolygons(row.polygon_geojson ?? row.geometry));
  if (!polygons.length) return null;
  if (polygons.length === 1) return polygons[0];
  try { return (turf.union as any)(turf.featureCollection(polygons)); }
  catch {
    try { return polygons.slice(1).reduce((merged, next) => (turf.union as any)(merged,next),polygons[0]); }
    catch { return null; }
  }
}
let cache: { expires: number; data: any } | undefined;
let pending: Promise<any> | undefined;
export async function loadGreaterVictoriaData() {
  if (cache && cache.expires > Date.now()) return cache.data;
  if (pending) return pending;
  pending = (async () => {
    const db = createClient(import.meta.env.PUBLIC_SUPABASE_URL, import.meta.env.SUPABASE_SERVICE_ROLE_KEY);
    async function readAll(table: string, columns: string, column: string, keys: string[], active = false) {
      const rows: any[] = [];
      for (let from = 0; ; from += 500) {
        let query = db.from(table).select(columns).in(column,keys).order("id").range(from,from+499);
        if (active) query = query.eq("status","A");
        const {data,error} = await query;
        if (error) throw new Error(`${table}: ${error.message}`);
        rows.push(...(data || []));
        if (!data || data.length < 500) return rows;
      }
    }
    const [rawListings, boundaries] = await Promise.all([
      readAll("listing_rows","*","normalized_city",regionCityKeys,true),
      readAll("area_boundaries","id,city,area_slug,area_name,polygon_geojson,short_description","city",regionCityKeys),
    ]);
    const byMls = new Map<string,any>();
    for (const row of rawListings) {
      const type = String(row.normalized_type || row.property_type || "").toLowerCase();
      if (/\b(commercial|business|lease|industrial|office|retail)\b/.test(type)) continue;
      const price = Number(row.price || 0);
      if (price > 0 && price < 50000) continue;
      const key = String(row.mls_number || row.repliers_listing_id || row.id);
      const old = byMls.get(key);
      if (!old || (Date.parse(row.updated_at || row.created_at || "") || 0) >=
          (Date.parse(old.updated_at || old.created_at || "") || 0)) byMls.set(key,row);
    }
    const districts = regionDistricts.map((district) => {
      const areas = boundaries.filter((row) => regionSlug(row.city) === district.slug &&
        !regionDistricts.some((d) => d.slug === regionSlug(row.area_slug)));
      const parent = boundaries.find((row) => regionSlug(row.area_slug) === district.slug && row.polygon_geojson);
      return {...district, areas, outline: districtExterior(dissolve(areas) ?? (parent ? regionPolygons(parent.polygon_geojson)[0] : null)), count:0};
    });
    const listings = [...byMls.values()].map((row) => {
      let slug = regionSlug(row.normalized_city);
      if (slug === "saanich") {
        slug = districts.find((d) => ["saanich-east","saanich-west"].includes(d.slug) &&
          d.areas.some((a) => regionContains(a.polygon_geojson,row.lat,row.lng)))?.slug || "";
      }
      const district = districts.find((d) => d.slug === slug);
      const area = district?.areas.find((a) => areaKey(a.area_slug) === areaKey(row.normalized_area)) ||
        district?.areas.find((a) => regionContains(a.polygon_geojson,row.lat,row.lng));
      if (district) district.count++;
      return {...row, __gvDistrict: district?.slug || "", __gvArea: area?.area_slug || ""};
    });
    for (const district of districts) {
      district.areas = district.areas.map((area) => ({...area,
        count: listings.filter((row) => row.__gvDistrict === district.slug && row.__gvArea === area.area_slug).length,
      })).sort((a,b) => b.count-a.count || a.area_name.localeCompare(b.area_name));
    }
    const available = districts.filter((d) => d.count > 0 || d.areas.length > 0);
    const result = {listings, boundaries, districts:available,
      unassigned: listings.filter((row) => !row.__gvDistrict).length};
    cache = {expires:Date.now()+30000,data:result};
    return result;
  })();
  try { return await pending; } finally { pending = undefined; }
}
