import "dotenv/config";
import { refreshListingMarket } from "./src/lib/listings/refreshListingMarket.ts";

refreshListingMarket({
  city: "victoria",
  trigger: "manual",
  env: process.env,
})
  .then(console.log)
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
