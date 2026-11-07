export function cardArea(l: any): string {
  const raw = l?.normalized_area || l?.area || l?.neighborhood || l?.neighbourhood || l?.addressObj?.neighborhood || l?.address?.neighborhood || l?.details?.area || l?.area_name || l?.raw?.address?.neighborhood || "";
  const s = String(raw).replace(/\u2713/g, "").replace(/^(feru|fe|se|sw|pq|na|ob)\s*-\s*/i, "").replace(/-(neighbourhood|neighborhood|area)$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s || s.toLowerCase() === "unknown") return "";
  const cities = [l?.city, l?.normalized_city].map((c) => String(c || "").toLowerCase().trim());
  if (cities.includes(s.toLowerCase())) return "";
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
