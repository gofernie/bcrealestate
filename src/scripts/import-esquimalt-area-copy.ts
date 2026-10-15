import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const areas = [
  [
    "esquimalt",
    "Esquimalt",
    "Central Esquimalt offers an established, close-in setting with a mix of detached homes, apartments and townhomes near village services, recreation and the waterfront. It suits buyers who want practical access to downtown Victoria while keeping everyday errands, parks and community amenities nearby. Housing varies widely in age, layout and condition, so buyers often compare renovation quality, walkability and the trade-off between character homes and lower-maintenance options."
  ],
  [
    "gorge-vale",
    "Gorge Vale",
    "Gorge Vale is a residential Esquimalt neighbourhood near the Gorge Waterway, with parks, schools and straightforward connections to both Esquimalt and Victoria. The housing mix includes established detached homes alongside apartments, townhomes and smaller multi-family properties. Buyers often value the practical location and nearby green space, while lot size, updates and access to major routes can shape value from one street to the next."
  ],
  [
    "kinsmen-park",
    "Kinsmen Park",
    "Kinsmen Park is a central Esquimalt neighbourhood with an urban-residential feel, close to local shops, community facilities, parks and routes into downtown Victoria. Buyers will find a mix of detached homes, condos and townhomes, making it a useful option for different budgets and ownership styles. Proximity to amenities and the condition of individual homes tend to matter as much as size when comparing listings here."
  ],
  [
    "old-esquimalt",
    "Old Esquimalt",
    "Old Esquimalt is one of the district's most established neighbourhoods, with character homes, mature streets and easy access to Esquimalt Village, the waterfront and local parks. The area has a strong mix of older detached homes and multi-family options, giving buyers a choice between space, character and lower-maintenance living. Walkability, renovation level and proximity to village services are key considerations when comparing properties."
  ],
  [
    "rockheights",
    "Rockheights",
    "Rockheights is a residential Esquimalt neighbourhood known for its mix of established homes, parks and convenient access to the Gorge, Tillicum and central Victoria. Housing includes detached homes, townhomes and apartments, offering more variety than many single-format neighbourhoods. Buyers often look at usable outdoor space, updates and the convenience of nearby schools, shops and transit when comparing homes in the area."
  ],
  [
    "saxe-point",
    "Saxe Point",
    "Saxe Point is a coastal Esquimalt neighbourhood valued for its shoreline parks, ocean outlooks and easy access to the village and downtown Victoria. The area includes character homes, newer renovations and a selection of condos or townhomes, with location and water proximity playing an important role in value. It appeals to buyers who want a quieter residential setting with beaches, walking routes and everyday amenities close by."
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
      seo_title: `${area_name} Real Estate & Homes for Sale | Esquimalt, BC`,
      meta_description: `Explore ${area_name} homes for sale, current listings and local market information in Esquimalt, BC.`,
      updated_at: new Date().toISOString(),
    })
    .eq("city", "esquimalt")
    .eq("area_slug", area_slug);

  if (error) throw new Error(`${area_name}: ${error.message}`);
  console.log(`Updated ${area_name}`);
}

console.log(`\nEsquimalt area copy complete: ${areas.length} neighbourhoods updated.`);