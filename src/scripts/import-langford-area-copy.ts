import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const areas = [
  [
    "atkins",
    "Atkins",
    "Atkins is a residential Langford neighbourhood near Millstream Village, the Galloping Goose Trail and routes toward the West Shore’s major shopping areas. The housing mix includes detached homes, townhomes and some newer infill, giving buyers a practical range of price points and layouts. Buyers often compare renovation level, outdoor space and access to nearby services when weighing homes in the area."
  ],
  [
    "bear-mountain",
    "Bear Mountain",
    "Bear Mountain is a well-known Langford community with golf, trails, resort amenities and a broad mix of condos, townhomes and detached homes. It appeals to buyers who want newer construction, access to outdoor recreation and a neighbourhood with a distinct hillside setting. Strata fees, views, parking, building age and the drive to everyday services are useful points of comparison between listings."
  ],
  [
    "fairway",
    "Fairway",
    "Fairway is a residential Langford neighbourhood close to central services, recreation and key routes through the West Shore. Buyers will find a mix of detached homes, townhomes and apartment-style options, with location and property condition varying from street to street. Proximity to schools, shopping and transit often matters as much as interior size when comparing homes here."
  ],
  [
    "florence-lake",
    "Florence Lake",
    "Florence Lake is a popular Langford neighbourhood centred around the lake, nearby trails and straightforward access to shopping and commuter routes. Housing includes established detached homes alongside townhomes, condos and newer development, creating options for a range of budgets. Buyers often value the outdoor setting while comparing walkability, strata details and the amount of usable living space."
  ],
  [
    "glen-lake",
    "Glen Lake",
    "Glen Lake is a residential Langford area valued for its lake access, parks and convenient connection to the city centre. The neighbourhood includes detached homes, townhomes and condos, with some properties benefiting from quieter streets or proximity to green space. Lot size, updates and access to the lake or nearby amenities can make a meaningful difference in value."
  ],
  [
    "goldstream",
    "Goldstream",
    "Goldstream sits on Langford’s western side near Goldstream Provincial Park, regional trails and the Trans-Canada Highway. The area offers a mix of established homes and multi-family options for buyers who want quick access to outdoor recreation and westbound commuting routes. Buyers often weigh highway proximity, topography and home condition alongside the convenience of nearby Langford services."
  ],
  [
    "happy-valley",
    "Happy Valley",
    "Happy Valley is a growing Langford neighbourhood with a mix of newer family homes, townhomes and established properties. It offers practical access to schools, parks, the Galloping Goose Trail and shopping in central Langford. Buyers often compare lot size, newer-home features and the trade-off between a quieter setting and commute time."
  ],
  [
    "humpback",
    "Humpback",
    "Humpback is a more rural-feeling Langford neighbourhood with larger parcels, wooded surroundings and access to the western hills. Housing is generally less urban in character than central Langford, with buyers often looking for privacy, outdoor space and room for hobbies or storage. Road access, servicing and distance to everyday amenities are important considerations when comparing properties."
  ],
  [
    "jacklin",
    "Jacklin",
    "Jacklin is a central Langford neighbourhood with easy access to major shopping, restaurants, services and transit. The housing mix includes condos, townhomes and detached homes, making it a practical choice for buyers who value convenience and lower-maintenance options. Building age, parking, strata rules and walkability are common comparison points in this area."
  ],
  [
    "langford-lake",
    "Langford Lake",
    "Langford Lake is a residential neighbourhood built around one of the West Shore’s best-known recreation lakes. Buyers will find detached homes, townhomes and condos, with the lake, parks and trail connections adding to the area’s appeal. Water proximity, views, outdoor space and access to central Langford help shape value from one property to the next."
  ],
  [
    "langford-proper",
    "Langford Proper",
    "Langford Proper is the city’s central urban neighbourhood, close to shopping, restaurants, transit, community facilities and everyday services. It has one of Langford’s broadest housing mixes, from condos and townhomes to detached homes and newer multi-family development. Buyers often prioritize walkability, building quality, parking and easy access to the rest of the West Shore."
  ],
  [
    "luxton",
    "Luxton",
    "Luxton is a lower-density Langford neighbourhood with a more established and semi-rural character than the city centre. Properties can include larger lots, detached homes and space that appeals to buyers looking for more privacy or flexibility. Servicing, road access, lot usability and proximity to shops or schools are important factors when comparing homes here."
  ],
  [
    "mill-hill",
    "Mill Hill",
    "Mill Hill is a Langford neighbourhood near Mill Hill Regional Park, local trails and convenient routes toward central Langford and Victoria. The area includes established detached homes, townhomes and some multi-family housing, offering a practical blend of green space and daily convenience. Buyers often compare updates, terrain, yard usability and access to nearby parks and schools."
  ],
  [
    "olympic-view",
    "Olympic View",
    "Olympic View is a Langford neighbourhood with newer residential development, access to parks and a location that connects easily toward Colwood and the West Shore. Housing includes detached homes, townhomes and multi-family options, often with more contemporary layouts than older parts of the city. Buyers commonly compare strata details, outdoor space, parking and commute routes."
  ],
  [
    "thetis-heights",
    "Thetis Heights",
    "Thetis Heights is a residential Langford area near Thetis Lake, the Galloping Goose Trail and extensive forested recreation space. The housing mix includes detached homes, townhomes and condos, with buyers drawn to its outdoor access and connection to Victoria. Terrain, privacy, strata rules and proximity to main commuter routes can vary considerably within the neighbourhood."
  ],
  [
    "walfred",
    "Walfred",
    "Walfred is an established Langford neighbourhood close to schools, parks, shopping and the city’s central services. Buyers will find a varied mix of detached homes, townhomes and apartments, with many properties offering practical access to daily amenities. Renovation quality, lot configuration and walkability are useful factors when comparing homes in the area."
  ],
  [
    "westhills",
    "Westhills",
    "Westhills is a master-planned Langford community with newer homes, townhomes, parks, schools and an extensive trail network. It appeals to buyers seeking contemporary layouts and a neighbourhood designed around everyday recreation and community amenities. Buyers often compare strata fees, newer-home warranties, lot size, parking and access to the rest of Langford."
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
      seo_title: `${area_name} Real Estate & Homes for Sale | Langford, BC`,
      meta_description: `Explore ${area_name} homes for sale, current listings and local market information in Langford, BC.`,
      updated_at: new Date().toISOString(),
    })
    .eq("city", "langford")
    .eq("area_slug", area_slug);

  if (error) throw new Error(`${area_name}: ${error.message}`);
  console.log(`Updated ${area_name}`);
}

console.log(`\nLangford area copy complete: ${areas.length} neighbourhoods updated.`);