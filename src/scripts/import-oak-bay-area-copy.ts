import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const areas = [
  ["estevan-neighbourhood", "Estevan Neighbourhood", "Estevan is a coastal Oak Bay neighbourhood with a mix of character homes, smaller multi-family buildings and easy access to beaches, parks and local services. Buyers value the established streets and the ability to reach the waterfront, Oak Bay Avenue and nearby cafés without relying on a long commute. Inventory can range from older homes needing updates to renovated properties and lower-maintenance apartment or townhome options, so lot size, condition and proximity to the water all shape value."],
  ["gonzales-neighbourhood", "Gonzales Neighbourhood", "Gonzales is a close-in Oak Bay neighbourhood known for its residential streets, shoreline access and proximity to Gonzales Beach. Housing is primarily detached and character-focused, with a smaller selection of condos and multi-family homes than in central Victoria. It appeals to buyers who want a quieter coastal setting while remaining near Fairfield, Oak Bay Village and downtown Victoria."],
  ["henderson-neighbourhood", "Henderson Neighbourhood", "Henderson is a central Oak Bay neighbourhood with established residential streets, parks and convenient connections to schools, recreation and Oak Bay Avenue. The housing stock is largely detached homes, including older character properties and renovated family homes, with some multi-family choices nearby. Buyers often compare location, lot size and renovation scope here, since homes can vary considerably in age and layout."],
  ["north-oak-bay-neighbourhood", "North Oak Bay Neighbourhood", "North Oak Bay offers a settled residential setting with mature streets, parks and a broad collection of established homes. It is practical for buyers who want Oak Bay's neighbourhood feel while staying connected to shopping, schools and routes toward Victoria and Saanich. The area is mostly detached housing, so buyers tend to weigh home condition, usable outdoor space and access to everyday amenities when comparing listings."],
  ["south-oak-bay-neighbourhood", "South Oak Bay Neighbourhood", "South Oak Bay is one of the district's best-known residential areas, with character homes, mature trees and easy access to Oak Bay Village, the waterfront and local parks. The neighbourhood has a distinctly established feel, with many detached properties on quiet streets and a limited amount of multi-family inventory. Buyers are often drawn by walkability and the area's long-term appeal, while renovation level and proximity to village services can materially affect pricing."],
  ["uplands-neighbourhood", "Uplands Neighbourhood", "Uplands is a low-density Oak Bay neighbourhood known for larger properties, mature landscaping and a quiet residential setting near the coast. Homes are predominantly detached and often sit on larger lots than elsewhere in the district, creating a market where site characteristics and renovation quality matter as much as bedroom count or floor area. It suits buyers looking for privacy and space while remaining close to Oak Bay Village, beaches, golf and central Victoria."],
] as const;

for (const [area_slug, area_name, intro_copy] of areas) {
  const { error } = await supabase
    .from("area_boundaries")
    .update({
      short_description: intro_copy.split(". ").slice(0, 2).join(". ") + ".",
      intro_copy,
      hero_heading: `Living in ${area_name}`,
      seo_heading: `${area_name} real estate`,
      seo_title: `${area_name} Real Estate & Homes for Sale | Oak Bay, BC`,
      meta_description: `Explore ${area_name} homes for sale, current listings and local market information in Oak Bay, BC.`,
      updated_at: new Date().toISOString(),
    })
    .eq("city", "oak bay")
    .eq("area_slug", area_slug);
  if (error) throw new Error(`${area_name}: ${error.message}`);
  console.log(`Updated ${area_name}`);
}

console.log(`\nOak Bay area copy complete: ${areas.length} neighbourhoods updated.`);
