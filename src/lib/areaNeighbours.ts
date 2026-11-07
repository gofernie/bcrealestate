// Which areas border each other (boundaries within ~0.5 km), from drawn area polygons.
// Keys are lowercase area names with spaces (and the slug form as an alias).
export function computeAreaNeighbours(rows: any[]): Record<string, Array<{ value: string; label: string }>> {
  try {
    const norm = (v: unknown) => String(v || "").replace(/-/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    const title = (v: string) => v.replace(/^pq\s+/i, "").replace(/\b\w/g, (ch) => ch.toUpperCase());
    const ringsOf = (raw: any) => {
      let g: any = raw;
      if (typeof g === "string") { try { g = JSON.parse(g); } catch { return []; } }
      const geoms = g?.type === "FeatureCollection" ? (g.features || []).map((ft: any) => ft?.geometry) : g?.type === "Feature" ? [g.geometry] : [g];
      const rings: any[] = [];
      for (const geom of geoms) {
        if (geom?.type === "Polygon") rings.push(...(geom.coordinates || []));
        else if (geom?.type === "MultiPolygon") for (const poly of geom.coordinates || []) rings.push(...poly);
      }
      return rings.filter((r: any) => Array.isArray(r) && r.length > 1);
    };
    const items: any[] = (rows || []).map((r: any) => {
      const value = norm(r?.area_name || r?.area_slug);
      const alias = norm(r?.area_slug || r?.area_name);
      const rings = ringsOf(r?.polygon_geojson);
      const pts = rings.flat();
      if (!pts.length || !value) return null;
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const p of pts) { if (p[0] < minLng) minLng = p[0]; if (p[0] > maxLng) maxLng = p[0]; if (p[1] < minLat) minLat = p[1]; if (p[1] > maxLat) maxLat = p[1]; }
      return { value, alias, label: title(value), rings, minLng, maxLng, minLat, maxLat };
    }).filter(Boolean);
    const KM = 0.5, PAD = 0.01;
    const segKm = (p: any, a: any, b: any) => {
      const kx = 111.32 * Math.cos((p[1] * Math.PI) / 180), ky = 110.57;
      const px = p[0] * kx, py = p[1] * ky, ax = a[0] * kx, ay = a[1] * ky, bx = b[0] * kx, by = b[1] * ky;
      const dx = bx - ax, dy = by - ay, len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
    };
    const near = (A: any, B: any) => {
      for (const ring of A.rings) for (const p of ring) {
        if (p[0] < B.minLng - PAD || p[0] > B.maxLng + PAD || p[1] < B.minLat - PAD || p[1] > B.maxLat + PAD) continue;
        for (const rb of B.rings) for (let i = 0; i < rb.length - 1; i++) if (segKm(p, rb[i], rb[i + 1]) <= KM) return true;
      }
      return false;
    };
    const out: Record<string, Array<{ value: string; label: string }>> = {};
    const add = (a: any, b: any) => {
      const list = (out[a.value] ||= []);
      if (!list.some((n) => n.value === b.value)) list.push({ value: b.value, label: b.label });
      if (a.alias && a.alias !== a.value) out[a.alias] = list;
    };
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.value === b.value) continue;
      if (a.maxLng + PAD < b.minLng || b.maxLng + PAD < a.minLng || a.maxLat + PAD < b.minLat || b.maxLat + PAD < a.minLat) continue;
      if (near(a, b) || near(b, a)) { add(a, b); add(b, a); }
    }
    return out;
  } catch { return {}; }
}