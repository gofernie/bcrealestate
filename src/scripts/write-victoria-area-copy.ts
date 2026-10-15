import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const city = "victoria";

const areas = [
  {
    slug: "burnside-neighbourhood",
    name: "Burnside Neighbourhood",
    short: "Burnside is a central Victoria neighbourhood with a practical mix of homes, local services and easy connections across the city.",
    intro: "Burnside offers a broad mix of housing, from established detached homes to apartments and townhomes. Its central setting keeps downtown, major routes and everyday errands within easy reach.",
  },
  {
    slug: "central-park-neighbourhood",
    name: "Central Park Neighbourhood",
    short: "Central Park is a centrally located Victoria neighbourhood with established homes, multi-family options and convenient access to daily amenities.",
    intro: "Central Park suits buyers looking for a central location and a varied housing mix. The area combines residential streets with straightforward access to shops, services and transit routes.",
  },
  {
    slug: "downtown-neighbourhood",
    name: "Downtown Neighbourhood",
    short: "Downtown Victoria puts homes, restaurants, shops, workplaces and the Inner Harbour within a compact, walkable setting.",
    intro: "Downtown Victoria is the city's most urban neighbourhood, with condos, character conversions and newer multi-family homes. It appeals to buyers who want everyday amenities, waterfront access and city life close at hand.",
  },
  {
    slug: "fairfield-east-neighbourhood",
    name: "Fairfield East Neighbourhood",
    short: "Fairfield East is an established residential area known for tree-lined streets, a mix of home styles and easy access to central Victoria.",
    intro: "Fairfield East blends older character homes, apartments and newer housing choices on established residential streets. Its location offers a quieter home base while keeping downtown, parks and local services nearby.",
  },
  {
    slug: "fairfield-west-neighbourhood",
    name: "Fairfield West Neighbourhood",
    short: "Fairfield West is a well-established Victoria neighbourhood with character homes, mature streets and a close-in residential feel.",
    intro: "Fairfield West offers a mix of heritage-era homes, apartments and updated properties in a central residential setting. Buyers value its established streets and convenient access to downtown, parks and everyday amenities.",
  },
  {
    slug: "fernwood-neighbourhood",
    name: "Fernwood Neighbourhood",
    short: "Fernwood is a central Victoria neighbourhood with character homes, local gathering places and a strong residential feel.",
    intro: "Fernwood combines older homes, duplexes, townhomes and apartments around an established village-like centre. It is a popular choice for buyers looking for a close-in neighbourhood with parks, local shops and community activity nearby.",
  },
  {
    slug: "hillside-neighbourhood",
    name: "Hillside Neighbourhood",
    short: "Hillside is a central Victoria neighbourhood with a varied housing mix and practical access to shopping, transit and downtown.",
    intro: "Hillside includes detached homes, apartments and townhomes across a central, well-connected part of Victoria. The neighbourhood works well for buyers who value nearby shopping, services and short trips across the city.",
  },
  {
    slug: "jubilee-neighbourhood",
    name: "Jubilee Neighbourhood",
    short: "Jubilee is an established central Victoria neighbourhood with a mix of homes, mature streets and access to local services.",
    intro: "Jubilee offers a range of character homes, apartments and townhomes in a central residential setting. Its location near the Royal Jubilee Hospital and major routes keeps services, parks and downtown Victoria accessible.",
  },
  {
    slug: "james-bay-neighbourhood",
    name: "James Bay Neighbourhood",
    short: "James Bay is a waterfront-adjacent Victoria neighbourhood beside the Inner Harbour, with homes, parks and city amenities close together.",
    intro: "James Bay is one of Victoria's most established close-in neighbourhoods, with a mix of condos, apartments and character homes. Buyers are drawn to its walkable streets, waterfront parks and proximity to the Inner Harbour and downtown.",
  },
  {
    slug: "mayfair-neighbourhood",
    name: "Mayfair Neighbourhood",
    short: "Mayfair is a central Victoria neighbourhood with housing options close to major shopping, services and transportation routes.",
    intro: "Mayfair offers a mix of apartments, townhomes and detached homes in a practical central location. It is well suited to buyers who want access to shopping, services and straightforward trips to downtown and neighbouring areas.",
  },
  {
    slug: "oaklands-neighbourhood",
    name: "Oaklands Neighbourhood",
    short: "Oaklands is a central residential Victoria neighbourhood with established streets, a varied housing mix and nearby parks.",
    intro: "Oaklands includes character homes, townhomes and apartments in a central part of Victoria. The neighbourhood has a relaxed residential feel while remaining close to local parks, schools, shops and transit.",
  },
  {
    slug: "rock-bay-neighbourhood",
    name: "Rock Bay Neighbourhood",
    short: "Rock Bay is an evolving inner-city Victoria area with a mix of residential, commercial and industrial uses near downtown.",
    intro: "Rock Bay is a central Victoria area with a changing mix of housing, businesses and employment space. Its proximity to downtown and the harbour makes it a practical choice for buyers who value an urban, close-in location.",
  },
  {
    slug: "rockland-neighbourhood",
    name: "Rockland Neighbourhood",
    short: "Rockland is an established central Victoria neighbourhood known for mature streets, heritage homes and a quiet residential character.",
    intro: "Rockland features a mix of heritage homes, apartments and larger residential properties on mature, tree-lined streets. It offers a quieter setting while remaining close to downtown Victoria, parks and local amenities.",
  },
];

for (const area of areas) {
  const { error } = await supabase
    .from("area_boundaries")
    .update({
      short_description: area.short,
      intro_copy: area.intro,
      hero_heading: `Living in ${area.name}`,
      seo_heading: `${area.name} real estate`,
      seo_title: `${area.name} Real Estate & Homes for Sale | Victoria, BC`,
      meta_description: `Explore ${area.name} homes for sale, current listings and local market information in Victoria, BC.`,
      updated_at: new Date().toISOString(),
    })
    .eq("city", city)
    .eq("area_slug", area.slug);

  if (error) throw new Error(`${area.name}: ${error.message}`);
  console.log(`Updated ${area.name}`);
}

console.log(`\nVictoria area copy complete: ${areas.length} neighbourhoods updated.`);
