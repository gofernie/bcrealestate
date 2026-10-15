import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const areas = [
  [
    "glentana",
    "Glentana",
    "Glentana is an established View Royal neighbourhood with residential streets, access to everyday services and convenient routes toward Esquimalt, Victoria and the West Shore. Housing includes a mix of detached homes, townhomes and condo options, giving buyers a range of price points and maintenance levels. When comparing homes here, buyers tend to weigh condition, parking, outdoor space and proximity to parks, schools and commuter routes."
  ],
  [
    "hospital",
    "Hospital",
    "The Hospital area of View Royal is close to Victoria General Hospital and offers practical access to major services, schools and regional road connections. The neighbourhood includes established homes, townhomes and apartments, appealing to buyers who value convenience alongside a residential setting. Property values can vary with renovation quality, strata fees, parking and how easily a home connects to daily amenities."
  ],
  [
    "prior-lake",
    "Prior Lake",
    "Prior Lake offers a more natural View Royal setting, with established residential streets and easy access to parks, trails and outdoor recreation. Homes range from detached family properties to lower-maintenance townhome and condo choices nearby. Buyers often compare usable lot space, privacy, road access and the balance between a quieter setting and convenient connections to Victoria and the West Shore."
  ],
  [
    "six-mile",
    "Six Mile",
    "Six Mile is a View Royal area known for its access to local services, waterfront amenities and key routes between Victoria and the West Shore. The housing mix includes established homes and multi-family options, making it relevant to buyers seeking a practical location with a range of ownership styles. Condition, layout, parking and access to transit or nearby shopping can all influence value."
  ],
  [
    "view-royal",
    "View Royal",
    "View Royal combines established residential neighbourhoods, waterfront areas and convenient access to both Victoria and the West Shore. Buyers can find detached homes, townhomes, condos and mobile-home options, with location, strata structure and renovation level creating meaningful differences between listings. The community appeals to people looking for everyday convenience, nearby parks and a shorter commute without giving up a neighbourhood feel."
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
      seo_title: `${area_name} Real Estate & Homes for Sale | View Royal, BC`,
      meta_description: `Explore ${area_name} homes for sale, current listings and local market information in View Royal, BC.`,
      updated_at: new Date().toISOString(),
    })
    .eq("city", "view royal")
    .eq("area_slug", area_slug);

  if (error) throw new Error(`${area_name}: ${error.message}`);
  console.log(`Updated ${area_name}`);
}

console.log(`\nView Royal area copy complete: ${areas.length} neighbourhoods updated.`);