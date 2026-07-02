export function aggregateNeighbourhoodStats(
  matches: any[],
  rows2016: any[],
  rows2021: any[]
) {
  const pop2016ByDa = new Map(
    rows2016.map((row) => [row.da_uid, Number(row.population || 0)])
  );

  const pop2021ByDa = new Map(
    rows2021.map((row) => [row.da_uid, Number(row.population || 0)])
  );

  const byArea = new Map<string, any>();

  for (const match of matches) {
    const key = `${match.city}|${match.area_slug}`;

    if (!byArea.has(key)) {
      byArea.set(key, {
        city: match.city,
        area_slug: match.area_slug,
        area_name: match.area_name,
        population_2016: 0,
        population_2021: 0,
      });
    }

    const area = byArea.get(key);

    area.population_2016 += pop2016ByDa.get(match.da_uid) ?? 0;
    area.population_2021 += pop2021ByDa.get(match.da_uid) ?? 0;
  }

  return [...byArea.values()].map((area) => ({
    ...area,
    pop_change_pct:
      area.population_2016 > 0
        ? Number(
            (
              ((area.population_2021 - area.population_2016) /
                area.population_2016) *
              100
            ).toFixed(2)
          )
        : null,
  }));
}