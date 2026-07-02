import centroid from "@turf/centroid";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";

function getDaUid(feature: any) {
  return (
    feature.properties?.DAUID ||
    feature.properties?.DAUID_2021 ||
    feature.properties?.da_uid ||
    feature.properties?.DA_UID
  );
}

export function matchDaToNeighbourhood(daBoundaries: any, neighbourhoods: any[]) {
  const matches: any[] = [];
  const unmatched: any[] = [];

  for (const da of daBoundaries.features ?? []) {
    const daCentroid = centroid(da);
    const daUid = getDaUid(da);

    const matchedNeighbourhood = neighbourhoods.find((n) => {
      if (!n.polygon_geojson) return false;

      const polygon =
        typeof n.polygon_geojson === "string"
          ? JSON.parse(n.polygon_geojson)
          : n.polygon_geojson;

      const geometry = polygon.type === "Feature" ? polygon.geometry : polygon;

      if (!geometry?.coordinates?.length) return false;

      try {
        return booleanPointInPolygon(daCentroid, {
          type: "Feature",
          properties: {},
          geometry,
        });
      } catch {
        return false;
      }
    });

    if (matchedNeighbourhood) {
      matches.push({
        da_uid: daUid,
        city: matchedNeighbourhood.city,
        area_slug: matchedNeighbourhood.area_slug,
        area_name: matchedNeighbourhood.area_name,
        match_method: "centroid",
        centroid_lng: daCentroid.geometry.coordinates[0],
        centroid_lat: daCentroid.geometry.coordinates[1],
      });
    } else {
      unmatched.push({ da_uid: daUid });
    }
  }

  return { matches, unmatched };
}