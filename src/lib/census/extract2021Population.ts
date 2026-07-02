import path from "node:path";
import { extract2021BcDaPopulation } from "./extract2021BcDaPopulation";

export async function extract2021Population() {
  const csvPath = path.join(
    process.cwd(),
    "data",
    "census",
    "2021",
    "bc_da_population_2021.csv"
  );

  return extract2021BcDaPopulation(csvPath);
}