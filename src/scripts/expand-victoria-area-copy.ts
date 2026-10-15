import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const areas = [
  ["burnside-neighbourhood", "Burnside is a central, practical Victoria neighbourhood with a mix of older detached homes, apartments, townhomes and commercial activity. It suits buyers who want a close-in location without paying a downtown premium, with straightforward access to major routes, local services and the Galloping Goose Trail. Housing is varied, so the appeal can range from first-time ownership and investment condos to established family homes."],
  ["central-park-neighbourhood", "Central Park is a compact central Victoria neighbourhood with established residential streets and a useful mix of detached homes, apartments and townhomes. It is a sensible option for buyers who want to stay close to downtown and everyday services while keeping a quieter home base. The varied housing stock creates options at several price points, from older character properties to more recent multi-family homes."],
  ["downtown-neighbourhood", "Downtown Victoria is the city's most urban neighbourhood, combining high-rise condos, character conversions and newer multi-family homes. It is the place for buyers who want restaurants, independent shops, entertainment and workplaces close by, with the Inner Harbour and waterfront part of daily life. Inventory is largely condo-led, so building age, parking, views, amenities and strata rules can make a meaningful difference from one property to the next."],
  ["fairfield-east-neighbourhood", "Fairfield East is an established residential area with tree-lined streets, older homes and a mix of apartments and multi-family options. Buyers like the balance: it feels residential and settled, but remains close to downtown, local shopping and waterfront parks. Character houses are a key part of the neighbourhood's appeal, alongside smaller condo and townhome choices for buyers who want a central address with less upkeep."],
  ["fairfield-west-neighbourhood", "Fairfield West offers a close-in residential setting with mature streets, character homes and a mix of apartment and townhome choices. It appeals to buyers who want the feel of an established neighbourhood while staying near downtown Victoria, local shops and parks. Homes vary considerably in age and condition, which makes it a good area to compare renovated character properties against lower-maintenance multi-family options."],
  ["fernwood-neighbourhood", "Fernwood is one of Victoria's best-known close-in neighbourhoods, with character homes, mature streets and a lively local village atmosphere. Housing includes older detached homes, suites, duplexes, townhomes and apartments, giving buyers more variety than many nearby areas. It works well for people who value independent shops, cafés, parks and community activity while keeping downtown within easy reach."],
  ["hillside-neighbourhood", "Hillside is a central, well-connected Victoria neighbourhood with a broad housing mix and practical access to shopping, schools, transit and services. Buyers will find detached homes alongside apartments and townhomes, often at a more approachable entry point than some nearby character districts. It is a useful area for people who want day-to-day convenience and short trips across the city rather than a destination-style waterfront setting."],
  ["jubilee-neighbourhood", "Jubilee is an established central Victoria neighbourhood centred around residential streets, the Royal Jubilee Hospital and nearby services. The housing mix includes character homes, apartments and townhomes, making it relevant to a wide range of buyers from first-time owners to downsizers. Its value is largely about location: parks, Oak Bay Avenue amenities and downtown Victoria are all within a short trip, while the neighbourhood itself remains primarily residential."],
  ["james-bay-neighbourhood", "James Bay sits beside Victoria's Inner Harbour and waterfront, giving it one of the most distinctive settings in the city. Buyers will find character homes, low- and mid-rise condos and apartment-style living, with Beacon Hill Park, the Legislature and downtown close by. It is particularly appealing to people who want a walkable daily routine and access to the water, though inventory and building style can vary sharply from block to block."],
  ["mayfair-neighbourhood", "Mayfair is a central Victoria neighbourhood where convenience is the main draw: shopping, services, transit and major routes are all close at hand. The housing mix includes apartments, townhomes and detached homes, creating choices for buyers at different stages and budgets. It is a practical location for anyone who wants an easy commute to downtown or neighbouring municipalities without needing a highly tourist-oriented or waterfront address."],
  ["oaklands-neighbourhood", "Oaklands is a central residential neighbourhood with character homes, townhomes and apartments spread around established streets and local parks. It has a more relaxed, community-oriented feel than downtown while still keeping shops, schools and transit close by. Buyers often look here for a balance of location and liveability, with a mix of renovated older homes and lower-maintenance options to compare."],
  ["rock-bay-neighbourhood", "Rock Bay is an evolving inner-city area with a mix of residential, commercial and industrial uses near downtown and the harbour. It is less conventional than Victoria's established character districts, but its central location and ongoing change make it worth watching for buyers who value access and potential. Housing choices tend to be more urban and varied, with proximity to downtown often outweighing a quiet residential-street feel."],
  ["rockland-neighbourhood", "Rockland is one of Victoria's most established central neighbourhoods, recognized for mature streets, heritage homes and a quieter residential character. The area includes substantial older homes as well as apartments and multi-family options, all close to downtown, parks and services. Buyers tend to value its architectural character and calm setting, with the trade-off that homes can vary widely in age, scale and renovation needs."],
];

for (const [area_slug, intro_copy] of areas) {
  const { error } = await supabase
    .from("area_boundaries")
    .update({ intro_copy, updated_at: new Date().toISOString() })
    .eq("city", "victoria")
    .eq("area_slug", area_slug);

  if (error) throw new Error(`${area_slug}: ${error.message}`);
  console.log(`Updated ${area_slug}`);
}

console.log(`\nExpanded copy for ${areas.length} Victoria neighbourhoods.`);
