import "dotenv/config";
import * as turf from "@turf/turf";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

// Builds Nelson area outlines from listing locations. Default: preview map only. --save writes to area_boundaries.
const CITY = "nelson";
const save = process.argv.includes("--save");
const supabase = createClient(process.env.PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: rows, error } = await supabase.from("listing_rows").select("lat,lng,normalized_area").eq("normalized_city", CITY).range(0, 4999);
if (error) throw error;
const groups: Record<string, [number, number][]> = {};
for (const r of rows || []) {
  const lat = Number(r.lat), lng = Number(r.lng), a = String(r.normalized_area || "").trim();
  if (!a || a === "unknown" || !(lat > 49 && lat < 50 && lng > -118 && lng < -116.5)) continue;
  (groups[a] ||= []).push([lng, lat]);
}

const { data: existing } = await supabase.from("area_boundaries").select("area_slug").eq("city", CITY);
const slugs = new Set((existing || []).map((r: any) => r.area_slug));
const out: { area: string; slug: string; points: number; geometry: any }[] = [];
for (const [area, pts] of Object.entries(groups)) {
  const fc = turf.featureCollection(pts.map((p) => turf.point(p)));
  let shape: any = pts.length >= 4 ? turf.concave(fc, { maxEdge: 4, units: "kilometers" }) : null;
  if (!shape && pts.length >= 3) shape = turf.convex(fc);
  shape = shape ? turf.buffer(shape, 0.3, { units: "kilometers" }) : turf.buffer(fc, 1, { units: "kilometers" });
  if (shape?.type === "FeatureCollection") shape = shape.features.reduce((acc: any, f: any) => (acc ? turf.union(turf.featureCollection([acc, f])) : f), null);
  const slug = area.replace(/\s+/g, "-");
  out.push({ area, slug, points: pts.length, geometry: shape.geometry });
}

for (const o of out) console.log(`${String(o.points).padStart(4)} listings  ${o.slug}${slugs.has(o.slug) ? "" : "  (no matching boundary row - will be added)"}`);

const cols = ["#c0392b", "#2471a3", "#229954", "#d68910", "#7d3c98", "#17a589"];
const html = `<!doctype html><html><head><meta charset="utf-8"><title>Nelson generated areas</title>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"><style>html,body,#m{height:100%;margin:0;font:13px system-ui}</style></head>
<body><div id="m"></div><script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script><script>
const data = ${JSON.stringify(out.map((o) => ({ ...o, pts: groups[o.area] })))};
const cols = ${JSON.stringify(cols)};
const m = L.map('m'); L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 19 }).addTo(m);
const g = L.featureGroup().addTo(m);
data.forEach((o, i) => { const c = cols[i % cols.length];
  L.geoJSON(o.geometry, { style: { color: c, weight: 2, fillOpacity: .12 } }).bindTooltip(o.slug + ' (' + o.points + ')').addTo(g);
  o.pts.forEach(p => L.circleMarker([p[1], p[0]], { radius: 4, color: '#fff', weight: 1, fillColor: c, fillOpacity: .9 }).addTo(g)); });
m.fitBounds(g.getBounds().pad(.05));
</script></body></html>`;
const file = path.join(os.homedir(), "Desktop", "nelson-generated-areas.html");
fs.writeFileSync(file, html, "utf8");
console.log(`Preview: ${file}`);

if (!save) { console.log("Preview only - nothing saved. Re-run with --save to write the outlines."); process.exit(0); }
for (const o of out) {
  const q = slugs.has(o.slug)
    ? supabase.from("area_boundaries").update({ polygon_geojson: o.geometry }).eq("city", CITY).eq("area_slug", o.slug)
    : supabase.from("area_boundaries").insert({ city: CITY, area_slug: o.slug, polygon_geojson: o.geometry });
  const { error: e } = await q;
  console.log(e ? `FAIL  ${o.slug}: ${e.message}` : `saved ${o.slug}`);
}
