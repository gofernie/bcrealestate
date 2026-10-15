import "dotenv/config";
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const east = [
  ["arbutus",
   "Arbutus combines an established residential setting with access to the university area and Saanich's eastern coastline.",
   "Arbutus offers an established residential setting in eastern Saanich, with detached homes and mature properties forming much of its character. The university area and coastal parks add to its appeal for buyers who want a residential home base with outdoor space nearby. When comparing homes, the individual street, lot layout and renovation history matter as much as the address, particularly where older houses sit alongside substantially updated properties."],

  ["blenkinsop",
   "Blenkinsop brings a rural landscape and agricultural character to a location within Saanich East.",
   "Blenkinsop stands apart from Saanich East's more suburban neighbourhoods through its agricultural landscape, open space and rural residential character. Buyers looking here are often comparing land and setting as closely as the house itself. Property size, access and the balance between usable grounds and ongoing maintenance can vary considerably. It is an area to consider when more space and a less urban outlook are priorities."],

  ["broadmead",
   "Broadmead offers established residential streets, mature landscaping and convenient access to shopping and regional routes.",
   "Broadmead is an established Saanich East neighbourhood with landscaped residential streets and a mix of detached homes and strata properties. Its appeal lies in the balance between a settled home environment and access to everyday services. Buyers can compare larger houses with lower-maintenance options, with meaningful differences in layout and outdoor space. Sloping sites, driveway access and the amount of updating already completed are useful points to assess."],

  ["cadboro-bay",
   "Cadboro Bay pairs a coastal setting with a local village centre and established residential streets.",
   "Cadboro Bay offers a coastal neighbourhood setting with a village centre and established homes close to the bay. Buyers are drawn to the combination of local services, beach access and a residential atmosphere. Detached houses are an important part of the area's identity, while individual properties vary in age, scale and upkeep. The relationship between the home, village and waterfront is worth comparing carefully from one location to another."],

  ["camosun",
   "Camosun offers a close-in residential setting with established homes and connections to the surrounding Victoria and Saanich neighbourhoods.",
   "Camosun is a close-in Saanich East neighbourhood where established streets and older homes create a residential setting connected to the surrounding city. It is worth considering for buyers who prefer an existing neighbourhood to a newer subdivision. Property condition, interior layout and available outdoor space can differ substantially. Comparing the exact location and the work already completed helps distinguish a convenient move-in option from a home requiring further investment."],

  ["cedar-hill",
   "Cedar Hill combines established residential streets with access to recreation, shopping and the wider Saanich area.",
   "Cedar Hill offers a varied residential setting in Saanich East, with established detached homes and multi-family choices to compare. Its appeal is the balance of local recreation and practical access to everyday services. Buyers can find different approaches to space and maintenance within the same neighbourhood, from older houses to strata living. Street setting, building condition and proximity to the routes used each day are useful starting points for a search."],

  ["cordova-bay",
   "Cordova Bay offers coastal surroundings and a range of homes across established streets and hillside settings.",
   "Cordova Bay combines a coastal setting with established residential areas and a range of detached and strata homes. The beach and surrounding landscape give the neighbourhood a distinct identity within Saanich East. Buyers should compare individual locations carefully, as elevation, road access and outlook can change the experience of a property. A water view, a manageable yard and convenient access to services do not necessarily come together in every listing."],

  ["gordon-head",
   "Gordon Head offers established residential streets in eastern Saanich, with access to the university area and coastal surroundings.",
   "Gordon Head is an established Saanich East neighbourhood where detached homes are a prominent part of the housing mix. Its eastern location connects residential streets with the university area and coastal surroundings. Buyers often have several generations of housing to compare, including older layouts and extensively renovated properties. The practical differences are in usable floor area, outdoor space and the location of each home within the broader neighbourhood."],

  ["high-quadra",
   "High Quadra offers an established Saanich East setting with residential streets and access to the surrounding urban area.",
   "High Quadra provides an established residential setting for buyers searching in Saanich East. Homes can differ in age, layout and site characteristics, making it useful to compare more than bedroom counts and asking prices. The neighbourhood is worth considering when access to the wider Saanich area matters alongside a residential home base. Outdoor space, driveway arrangements and the relationship to nearby roads can be important differences between otherwise similar properties."],

  ["lake-hill",
   "Lake Hill offers established homes and a residential setting within Saanich East's connected urban neighbourhoods.",
   "Lake Hill is an established Saanich East neighbourhood that suits a search focused on residential living within the wider urban area. Buyers can compare homes with different renovation histories, lot arrangements and interior layouts. For an older property, the condition of the major building systems deserves attention alongside the presentation. The individual street and access to the places used regularly help determine whether a particular home fits the daily routine."],

  ["lambrick-park",
   "Lambrick Park offers a residential Saanich East setting where established homes and recreation are part of the neighbourhood's appeal.",
   "Lambrick Park offers an established residential setting in Saanich East, with local recreation contributing to the neighbourhood's identity. Buyers looking here can compare older homes, updated properties and the options available in current inventory. The most useful differences often involve floor plans, outdoor space and the amount of work a home needs. A practical search should also consider the exact street and how the location fits regular trips across Saanich."],

  ["maplewood",
   "Maplewood offers established residential streets and a varied property landscape within Saanich East.",
   "Maplewood is an established Saanich East neighbourhood where the individual property can make a substantial difference to the buying decision. Older houses, updated homes and varied sites create a useful range to compare. Buyers who value an existing residential setting may find it appealing, but should look closely at layout, access and upkeep. The balance between interior space, yard usability and renovation needs is often more informative than the headline square footage."],

  ["mt-doug",
   "Mt Doug offers residential living associated with one of Saanich East's best-known natural landmarks.",
   "Mt Doug offers a Saanich East residential setting associated with the surrounding natural landscape and established neighbourhood streets. Buyers looking here are often weighing outdoor surroundings alongside the house and lot. Properties can vary in elevation, access and the amount of usable yard, so the site deserves a close look. Comparing renovation history and everyday routes helps establish whether a particular home offers the right balance of setting and convenience."],

  ["mt-tolmie",
   "Mt Tolmie offers an established Saanich East location with residential homes and access to the surrounding university and urban areas.",
   "Mt Tolmie offers an established residential setting in Saanich East, with the surrounding hill and university area helping define its location. Buyers can compare different home styles and levels of upkeep rather than expect one uniform housing type. The specific property matters: floor plan, outdoor space and proximity to busier routes can all affect daily use. It is a useful area to explore when an existing neighbourhood and connected location are priorities."],

  ["quadra",
   "Quadra offers a connected Saanich East setting with a mix of residential properties and access to everyday services.",
   "Quadra is a practical Saanich East area for buyers who value connections across the urban region. Residential side streets and properties nearer major routes can offer quite different experiences, so exact location matters. Current listings may provide a choice between house ownership and strata living, each with different maintenance responsibilities. Compare the building, layout and surrounding activity together to understand how a home would fit the way you want to live."],

  ["queenswood",
   "Queenswood offers an established residential setting within the broader Cadboro Bay area of Saanich East.",
   "Queenswood forms part of the broader Cadboro Bay area and offers a distinct residential setting for buyers searching in eastern Saanich. The appeal centres on the property and surroundings rather than a dense urban housing mix. Homes can differ substantially in scale, age and the demands of maintaining the grounds. Buyers should compare usable space, access and renovation history carefully when deciding whether a particular property meets their needs."],

  ["sunnymead",
   "Sunnymead offers an established residential neighbourhood for buyers exploring the northern part of Saanich East.",
   "Sunnymead offers an established residential setting in the northern part of Saanich East. It is an area to compare when a neighbourhood home base and outdoor space are important parts of the search. Individual properties vary in layout, updating and the way the lot can be used. Buyers should consider the balance between house size and maintenance, along with the routes they expect to use for shopping, work and other regular activities."],

  ["swan-lake",
   "Swan Lake combines an urban Saanich East location with a neighbourhood identity shaped by its natural surroundings.",
   "Swan Lake offers a Saanich East location where the surrounding natural landscape provides a distinctive counterpoint to urban living. Buyers can compare established residential properties while considering connections to the wider city. The exact address matters for access, street activity and the relationship to nearby open space. House condition and layout remain important, particularly when choosing between an updated older home and a property that leaves room for further improvement."],

  ["ten-mile-point",
   "Ten Mile Point offers a coastal residential setting within the broader Cadboro Bay area of Saanich East.",
   "Ten Mile Point offers a coastal residential setting within the broader Cadboro Bay area. Buyers tend to focus closely on the relationship between the house, land and surroundings, with considerable variation from one property to the next. A coastal address does not guarantee a view or direct water access. Compare the actual outlook, usable grounds, driveway and maintenance requirements to understand what each listing offers beyond its neighbourhood name."],
];

const west = [
  ["beaver-lake-neighbourhood",
   "Beaver Lake offers a Saanich West search area associated with lake surroundings and a less urban residential setting.",
   "Beaver Lake offers a Saanich West setting associated with the surrounding lake landscape and outdoor space. Buyers searching here may place more emphasis on the land and property setting than on a uniform neighbourhood housing style. Compare each home's access, usable grounds and maintenance needs carefully. The distance to everyday services and the practical route used to reach them can matter as much as the house itself."],

  ["elk-lake-neighbourhood",
   "Elk Lake offers a Saanich West location shaped by lake surroundings, outdoor recreation and individual residential properties.",
   "Elk Lake offers a Saanich West setting where the surrounding landscape is a significant part of the appeal. Buyers interested in outdoor space can compare properties with quite different relationships to the lake and nearby routes. A neighbourhood address alone does not establish water access or views. Look closely at the actual site, house condition and regular travel needs when assessing whether a listing provides the right balance of surroundings and convenience."],

  ["gateway-neighbourhood",
   "Gateway offers a practical Saanich West location for buyers comparing residential properties and regional connections.",
   "Gateway is a Saanich West search area to consider when convenient connections are an important part of the buying decision. The exact location can make a meaningful difference to road activity and the feel of a property. Buyers should compare interior layout, outdoor space and condition alongside asking price. Looking at the home in the context of regular trips helps clarify whether the address works as well in practice as it does on a map."],

  ["glanford-neighbourhood",
   "Glanford offers an established Saanich West residential setting with connections to the surrounding urban area.",
   "Glanford offers established residential living in Saanich West, with individual streets and properties providing different choices for buyers. Older homes and updated layouts can offer contrasting approaches to space, outdoor use and maintenance. The neighbourhood is worth exploring when a connected location is important alongside a residential home base. Compare the work already completed, the usability of the lot and the routes needed for daily activities before narrowing the search."],

  ["gorge-neighbourhood",
   "Gorge offers an established Saanich West setting associated with the Gorge Waterway and surrounding residential neighbourhoods.",
   "Gorge offers an established Saanich West setting associated with the nearby waterway and surrounding urban neighbourhoods. Buyers can compare properties with different relationships to the water, local roads and residential side streets. A home in the area does not necessarily have a waterfront outlook. The useful distinctions are in the exact setting, building condition and available space, along with how the location fits everyday travel and activities."],

  ["granville-neighbourhood",
   "Granville offers a residential Saanich West search area where individual property settings and outdoor space deserve attention.",
   "Granville offers a Saanich West location for buyers comparing the setting of a property as closely as its interior. Homes can differ in their relationship to surrounding roads, neighbouring uses and outdoor space. Rather than assume every listing offers the same experience, assess access, grounds and condition individually. The amount of upkeep and the route to regular services are useful considerations when deciding how well a property fits the intended lifestyle."],

  ["interurban-neighbourhood",
   "Interurban offers a Saanich West setting that connects residential properties with the area's broader rural and urban surroundings.",
   "Interurban offers a Saanich West location where residential properties sit within a broader mix of developed and more open surroundings. Buyers searching here should compare the exact setting rather than expect a single, consistent neighbourhood character. Land usability, access and the condition of older improvements can be important. It is worth considering how the home balances space and upkeep with the practical trips needed for work, shopping and other daily activities."],

  ["layritz-neighbourhood",
   "Layritz offers a residential Saanich West setting with a neighbourhood identity associated with local outdoor space.",
   "Layritz offers a Saanich West residential setting for buyers who want to compare neighbourhood living and outdoor space. Individual homes can provide different layouts, yard arrangements and levels of updating, making the property itself central to the decision. Look at how the available space functions rather than relying on room counts alone. Street setting, access and expected maintenance help distinguish the choices available within the current market."],

  ["marigold-neighbourhood",
   "Marigold offers established residential streets and a practical home base within Saanich West.",
   "Marigold offers an established Saanich West residential setting where buyers can compare homes with different ages, layouts and renovation histories. It is an area to consider when an existing neighbourhood is part of the appeal. Outdoor space and the work needed after purchase can vary considerably between listings. Assess the exact street, the condition of the main building systems and the daily routes needed to decide whether a property fits the search."],

  ["northridge-neighbourhood",
   "Northridge offers an established residential setting for buyers exploring homes in Saanich West.",
   "Northridge offers a residential home base within Saanich West, with individual properties creating different options for space and upkeep. Buyers should compare the layout and usability of both the house and grounds, especially when looking at older homes with varying levels of renovation. The amount of updating already completed can change the overall value proposition. Exact location and the routes used regularly are also important when assessing a potential move."],

  ["portage-inlet-neighbourhood",
   "Portage Inlet offers a Saanich West setting associated with sheltered water and established residential surroundings.",
   "Portage Inlet offers a distinctive Saanich West setting associated with the inlet and surrounding residential areas. Buyers should distinguish between a home near the water and one with an actual view or waterfront position. The relationship between the house, lot and shoreline can vary substantially. Compare access, outdoor space and maintenance alongside the interior to understand whether the property's particular setting supports the way you want to use it."],

  ["prospect-lake-neighbourhood",
   "Prospect Lake offers a Saanich West setting where lake surroundings and rural residential properties shape the search.",
   "Prospect Lake offers a Saanich West setting where the surrounding landscape and rural residential character are central to the appeal. Buyers often compare the land and its usability alongside the home. Properties can differ considerably in access, improvements and the amount of ongoing upkeep required. A location in the area does not guarantee lake access, so assess the actual site and its relationship to the water before drawing conclusions from the address."],

  ["royal-oak-neighbourhood",
   "Royal Oak combines established residential areas with shopping, transit connections and a varied range of housing choices.",
   "Royal Oak offers an established Saanich setting with access to shopping and transit connections, including the Royal Oak exchange. Buyers can compare different approaches to ownership and maintenance across the homes available. A larger house and a lower-maintenance strata property may serve quite different needs despite sharing the same neighbourhood. The building, outdoor space and precise location should be considered together when deciding which option fits the intended daily routine."],

  ["rudd-park-neighbourhood",
   "Rudd Park offers a compact residential search area within the wider Saanich West urban setting.",
   "Rudd Park offers a residential search area in Saanich West for buyers considering a home within the wider urban setting. Individual properties can differ in age, layout and the balance between interior and outdoor space. Compare the exact street and surrounding activity alongside the condition of the home. For an older property, understanding the work already completed and what remains to be done helps make a more useful comparison between listings."],

  ["strawberry-vale-neighbourhood",
   "Strawberry Vale offers established residential surroundings and varied property settings in Saanich West.",
   "Strawberry Vale offers an established Saanich West setting where the individual street and property can strongly influence the buying decision. Buyers can compare different home layouts, outdoor spaces and levels of updating within the area. It is worth looking beyond the listing's room counts to assess how the house and grounds function together. Access, upkeep and the route to everyday destinations help determine whether a particular home offers the right fit."],

  ["tillicum-neighbourhood",
   "Tillicum offers a connected Saanich West location with residential streets and access to the surrounding urban area.",
   "Tillicum offers a connected Saanich West setting where established residential streets sit alongside more active urban routes. Buyers should compare the exact location, as a side-street house and a property near a major road can provide different day-to-day experiences. Current listings may offer different levels of space and maintenance responsibility. Building condition, layout and nearby activity are useful factors when deciding which home best fits the search."],

  ["west-saanich-neighbourhood",
   "West Saanich offers a broader rural residential setting where land, access and property upkeep are important buying considerations.",
   "West Saanich offers a broader rural residential setting for buyers who place particular value on land and outdoor space. The property's actual characteristics matter more than a general neighbourhood description: usable grounds, access and existing improvements can vary considerably. Compare the house and land together, including the time and expense involved in maintaining them. Regular travel to services is also worth considering when weighing space against everyday convenience."],
];

const entries = [
  ...east.map(([slug, short, intro]) => ({
    city: "saanich east", cityLabel: "Saanich East", slug, short, intro,
  })),
  ...west.map(([slug, short, intro]) => ({
    city: "saanich west", cityLabel: "Saanich West", slug, short, intro,
  })),
];

const fields = [
  "city", "area_slug", "area_name", "short_description", "intro_copy",
  "hero_heading", "seo_heading", "seo_title", "meta_description", "updated_at",
].join(",");

const { data: existing, error: readError } = await supabase
  .from("area_boundaries")
  .select(fields)
  .in("city", ["saanich east", "saanich west"]);

if (readError) throw readError;

const matched = entries.map((entry) => {
  const rows = (existing || []).filter(
    (row) => row.city === entry.city && row.area_slug === entry.slug
  );
  if (rows.length !== 1) {
    throw new Error(
      `Expected one boundary for ${entry.city}/${entry.slug}; found ${rows.length}. Nothing updated.`
    );
  }
  return { ...entry, name: rows[0].area_name };
});

const backupPath =
  `src/scripts/saanich-area-copy-backup-${Date.now()}.json`;
fs.writeFileSync(backupPath, JSON.stringify(existing, null, 2), "utf8");
console.log(`Existing copy backed up to ${backupPath}`);

for (const area of matched) {
  const { data, error } = await supabase
    .from("area_boundaries")
    .update({
      short_description: area.short,
      intro_copy: area.intro,
      hero_heading: `Living in ${area.name}`,
      seo_heading: `${area.name} real estate`,
      seo_title: `${area.name} Real Estate & Homes for Sale | ${area.cityLabel}, BC`,
      meta_description:
        `Explore ${area.name} homes for sale, current listings and local market information in ${area.cityLabel}, BC.`,
      updated_at: new Date().toISOString(),
    })
    .eq("city", area.city)
    .eq("area_slug", area.slug)
    .select("area_slug");

  if (error) throw new Error(`${area.name}: ${error.message}`);
  if (data?.length !== 1) {
    throw new Error(`${area.name}: update did not return exactly one row.`);
  }
  console.log(`Updated ${area.cityLabel}: ${area.name}`);
}

console.log("\nComplete: 19 Saanich East and 17 Saanich West areas updated.");
