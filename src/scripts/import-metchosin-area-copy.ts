import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const areas = [
  [
    "albert-head",
    "Albert Head",
    "Albert Head is a coastal Metchosin neighbourhood near the Strait of Juan de Fuca, beach access and open rural scenery. Homes are generally detached and often sit on larger lots, with buyers drawn to privacy, views and the slower pace of the district. Lot usability, servicing, water access and the condition of individual homes are important comparison points."
  ],
  [
    "kangaroo",
    "Kangaroo",
    "Kangaroo is a rural Metchosin neighbourhood with larger properties, wooded surroundings and a strong small-acreage character. The area appeals to buyers looking for space, privacy and flexibility for gardens, animals, workshops or outdoor hobbies. Driveway access, well and septic systems, terrain and distance to services can vary considerably between properties."
  ],
  [
    "metchosin",
    "Metchosin",
    "Metchosin is the district's central rural-residential area, close to community facilities, local trails, farm land and the village setting around Happy Valley Road. Housing is primarily detached, with properties ranging from established homes to acreage and newer custom construction. Buyers often compare usable land, home updates, servicing and access to nearby Langford or Colwood amenities."
  ],
  [
    "neild",
    "Neild",
    "Neild is a residential Metchosin neighbourhood with a quiet rural feel and convenient connections toward Colwood and the West Shore. Properties are generally detached homes on larger lots, with buyers valuing privacy, mature landscaping and room for outdoor living. Road access, topography, well and septic details and renovation quality can shape value from one property to the next."
  ],
  [
    "olympic-view",
    "Olympic View",
    "Olympic View is a Metchosin neighbourhood near the district's eastern edge, with access toward Colwood, golf, parks and the West Shore. The setting combines rural-residential properties with convenient connections to shopping, schools and commuter routes. Buyers often weigh lot size, privacy, home condition and proximity to everyday services."
  ],
  [
    "pedder-bay",
    "Pedder Bay",
    "Pedder Bay is a coastal Metchosin neighbourhood known for its marina, ocean access, forested surroundings and direct connection to the Juan de Fuca shoreline. Housing is limited and varied, ranging from waterfront-oriented properties to rural homes set back from the water. Water access, road conditions, servicing and exposure to the coastal environment are key considerations."
  ],
  [
    "rocky-point",
    "Rocky Point",
    "Rocky Point is a Metchosin neighbourhood with a mix of rural homes, coastal access and proximity to parks, trails and the East Sooke side of the region. Buyers are often drawn to larger lots, privacy and the area's outdoor recreation opportunities. Property access, terrain, water and septic systems and the condition of older homes can be important factors."
  ],
  [
    "william-head",
    "William Head",
    "William Head is a scenic Metchosin neighbourhood on the district's southern coastline, with ocean outlooks, rural properties and nearby park land. Homes are generally detached and can offer a greater sense of privacy and space than more urban West Shore locations. Buyers often compare views, lot usability, access, servicing and travel time to shops and schools."
  ],
] as const;

for (const [area_slug, area_name, intro_copy] of areas) {
  const { error } = await supabase
    .from("area_boundaries")
    .update({
      short_description: intro_copy.split(". ").slice(0, 2).join(". ") + ".",
      intro_copy,
      hero_heading: `Living in ${area_name}`,
      seo_heading: `${area_name} real estate`,
      seo_title: `${area_name} Real Estate & Homes for Sale | Metchosin, BC`,
      meta_description: `Explore ${area_name} homes for sale, current listings and local market information in Metchosin, BC.`,
      updated_at: new Date().toISOString(),
    })
    .eq("city", "metchosin")
    .eq("area_slug", area_slug);

  if (error) throw new Error(`${area_name}: ${error.message}`);
  console.log(`Updated ${area_name}`);
}

console.log(`\nMetchosin area copy complete: ${areas.length} neighbourhoods updated.`);