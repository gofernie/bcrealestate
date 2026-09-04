import {
  Fragment,
  render as $$render,
  createAstro as $$createAstro,
  createComponent as $$createComponent,
  renderComponent as $$renderComponent,
  renderHead as $$renderHead,
  maybeRenderHead as $$maybeRenderHead,
  unescapeHTML as $$unescapeHTML,
  renderSlot as $$renderSlot,
  mergeSlots as $$mergeSlots,
  addAttribute as $$addAttribute,
  spreadAttributes as $$spreadAttributes,
  defineStyleVars as $$defineStyleVars,
  defineScriptVars as $$defineScriptVars,
  renderTransition as $$renderTransition,
  createTransitionScope as $$createTransitionScope,
  renderScript as $$renderScript,
  createMetadata as $$createMetadata
} from "astro/runtime/server/index.js";
import { createClient } from "@supabase/supabase-js";
import Layout from "../../layouts/Layout.astro";
import SiteNav from "../../components/SiteNav.astro";
import { getSite } from "../../lib/getSite";
import { getNavIntentPages } from "../../lib/getNavIntentPages";
import "./src/pages/[city]/market-intelligence.astro?astro&type=style&index=0&lang.css";

import * as $$module1 from '@supabase/supabase-js';
import * as $$module2 from '../../layouts/Layout.astro';
import * as $$module3 from '../../components/SiteNav.astro';
import * as $$module4 from '../../lib/getSite';
import * as $$module5 from '../../lib/getNavIntentPages';

export const $$metadata = $$createMetadata("./src/pages/[city]/market-intelligence.astro", { modules: [{ module: $$module1, specifier: '@supabase/supabase-js', assert: {} }, { module: $$module2, specifier: '../../layouts/Layout.astro', assert: {} }, { module: $$module3, specifier: '../../components/SiteNav.astro', assert: {} }, { module: $$module4, specifier: '../../lib/getSite', assert: {} }, { module: $$module5, specifier: '../../lib/getNavIntentPages', assert: {} }], hydratedComponents: [], clientOnlyComponents: [], hydrationDirectives: new Set([]), hoisted: [] });

const $$Astro = $$createAstro();
const Astro = $$Astro;
export const prerender = false;
const $$MarketIntelligence = $$createComponent(async ($$result, $$props, $$slots) => {
const Astro = $$result.createAstro($$Astro, $$props, $$slots);
Astro.self = $$MarketIntelligence;


export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const city = String(Astro.params.city || "nanaimo")
  .toLowerCase()
  .trim();

const cityLabel = city
  .replace(/-/g, " ")
  .replace(/\b\w/g, (character) => character.toUpperCase());

const site = await getSite(Astro.url.hostname, city);
const accent = site?.accent_color || "#633a98";

const { data: listings = [], error: listingsError } =
  await supabase
    .from("listing_rows")
    .select("price, normalized_area, normalized_type, listed_at, created_at")
    .eq("normalized_city", city)
    .eq("status", "A")
    .limit(1000);

if (listingsError) {
  console.error("Market intelligence query failed:", listingsError);
}

const navAreas = Array.from(
  new Set(
    listings
      .map((listing) => String(listing.normalized_area || "").trim())
      .filter(Boolean)
  )
).sort();

const navTypes = [
  "house",
  "condo",
  "townhouse",
  "mobile",
  "land",
];

const navIntentPages =
  await getNavIntentPages(supabase, site?.id);

const numericPrice = (listing) => {
  const value = Number(
    String(listing?.price ?? "")
      .replace(/[^0-9.-]/g, "")
  );

  return Number.isFinite(value) && value >= 50000
    ? value
    : 0;
};

const median = (values) => {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((a, b) => a - b);

  if (!sorted.length) return 0;

  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
};

const formatPrice = (value) =>
  value >= 1000000
    ? `$${(value / 1000000).toFixed(2).replace(/\.?0+$/, "")}M`
    : `$${Math.round(value / 1000).toLocaleString()}K`;

const titleCase = (value) =>
  String(value || "")
    .replace(/^pq[\s-]+/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) => character.toUpperCase());

const listingPrices = listings
  .map(numericPrice)
  .filter((price) => price > 0);

const activeListings = listings.length;
const medianPrice = median(listingPrices);

const sevenDaysAgo =
  Date.now() - 7 * 24 * 60 * 60 * 1000;

const newThisWeek = listings.filter((listing) => {
  const rawDate = listing.listed_at || listing.created_at;
  if (!rawDate) return false;

  const timestamp = new Date(rawDate).getTime();

  return Number.isFinite(timestamp) &&
    timestamp >= sevenDaysAgo;
}).length;

const priceBands = [
  {
    label: "Under $500K",
    href: `/${city}?maxPrice=500000`,
    count: listingPrices.filter((price) => price < 500000).length,
  },
  {
    label: "$500K–$700K",
    href: `/${city}?minPrice=500000&maxPrice=700000`,
    count: listingPrices.filter(
      (price) => price >= 500000 && price < 700000
    ).length,
  },
  {
    label: "$700K–$900K",
    href: `/${city}?minPrice=700000&maxPrice=900000`,
    count: listingPrices.filter(
      (price) => price >= 700000 && price < 900000
    ).length,
  },
  {
    label: "$900K–$1.2M",
    href: `/${city}?minPrice=900000&maxPrice=1200000`,
    count: listingPrices.filter(
      (price) => price >= 900000 && price < 1200000
    ).length,
  },
  {
    label: "$1.2M+",
    href: `/${city}?minPrice=1200000`,
    count: listingPrices.filter((price) => price >= 1200000).length,
  },
];

const maxPriceBandCount = Math.max(
  ...priceBands.map((band) => band.count),
  1
);

const typeLabels = {
  house: "Homes",
  condo: "Condos",
  townhouse: "Townhomes",
  mobile: "Mobile Homes",
  land: "Lots / Land",
};

const typeMap = listings.reduce((result, listing) => {
  const type = String(listing.normalized_type || "other")
    .toLowerCase()
    .trim();

  if (!result[type]) {
    result[type] = {
      type,
      count: 0,
      prices: [],
    };
  }

  result[type].count += 1;

  const price = numericPrice(listing);
  if (price) result[type].prices.push(price);

  return result;
}, {});

const typeStats = Object.values(typeMap)
  .map((item) => ({
    ...item,
    label: typeLabels[item.type] || titleCase(item.type),
    medianPrice: median(item.prices),
  }))
  .filter((item) => item.count > 0)
  .sort((a, b) => b.count - a.count)
  .slice(0, 6);

const areaMap = listings.reduce((result, listing) => {
  const area = String(listing.normalized_area || "").trim();
  if (!area) return result;

  if (!result[area]) {
    result[area] = {
      area,
      count: 0,
      prices: [],
    };
  }

  result[area].count += 1;

  const price = numericPrice(listing);
  if (price) result[area].prices.push(price);

  return result;
}, {});

const areaStats = Object.values(areaMap)
  .map((item) => ({
    ...item,
    name: titleCase(item.area),
    medianPrice: median(item.prices),
  }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 10);

const largestType = typeStats[0];
const largestBand = [...priceBands]
  .sort((a, b) => b.count - a.count)[0];

const marketSummary = [
  `${cityLabel} currently has ${activeListings.toLocaleString()} active residential listings.`,
  medianPrice
    ? `The median asking price across current inventory is ${formatPrice(medianPrice)}.`
    : "",
  largestType
    ? `${largestType.label} make up the largest property category, with ${largestType.count.toLocaleString()} active listings.`
    : "",
  largestBand
    ? `The largest share of available inventory is currently in the ${largestBand.label} price range.`
    : "",
]
  .filter(Boolean)
  .join(" ");

const updatedLabel = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  day: "numeric",
  year: "numeric",
}).format(new Date());


return $$render`${$$renderComponent($$result,'Layout',Layout,{"title":(`${cityLabel} Real Estate Market Intelligence`),"description":(`Explore active inventory, asking prices, property types, and neighbourhood trends in ${cityLabel}.`),"accentColor":(accent),"city":(city),"class":"astro-vgxk7ysm"},{"default": async () => $$render`
  ${$$renderComponent($$result,'SiteNav',SiteNav,{"city":(city),"site":(site),"areas":(navAreas),"types":(navTypes),"intentPages":(navIntentPages),"showAreaNav":(false),"class":"astro-vgxk7ysm"})}

  ${$$maybeRenderHead($$result)}<main class="market-page astro-vgxk7ysm">
    <section class="market-hero astro-vgxk7ysm">
      <div class="astro-vgxk7ysm">
        <p class="eyebrow astro-vgxk7ysm">Market intelligence</p>
        <h1 class="astro-vgxk7ysm">See the ${cityLabel} market more clearly.</h1>
        <p class="market-hero__copy astro-vgxk7ysm">
          A live view of active inventory, asking-price ranges,
          property types, and neighbourhood activity.
        </p>
      </div>

      <div class="market-hero__stamp astro-vgxk7ysm">
        <span class="astro-vgxk7ysm">Current snapshot</span>
        <strong class="astro-vgxk7ysm">${updatedLabel}</strong>
        <small class="astro-vgxk7ysm">Updated from active listing data</small>
      </div>
    </section>

    <section class="snapshot-grid astro-vgxk7ysm" aria-label="Market snapshot">
      <article class="astro-vgxk7ysm">
        <span class="astro-vgxk7ysm">Active listings</span>
        <strong class="astro-vgxk7ysm">${activeListings.toLocaleString()}</strong>
        <small class="astro-vgxk7ysm">Currently available</small>
      </article>

      <article class="astro-vgxk7ysm">
        <span class="astro-vgxk7ysm">New this week</span>
        <strong class="astro-vgxk7ysm">${newThisWeek.toLocaleString()}</strong>
        <small class="astro-vgxk7ysm">Listed in the last 7 days</small>
      </article>

      <article class="astro-vgxk7ysm">
        <span class="astro-vgxk7ysm">Median price</span>
        <strong class="astro-vgxk7ysm">${medianPrice ? formatPrice(medianPrice) : "—"}</strong>
        <small class="astro-vgxk7ysm">Median active asking price</small>
      </article>

      <article class="astro-vgxk7ysm">
        <span class="astro-vgxk7ysm">Neighbourhoods</span>
        <strong class="astro-vgxk7ysm">${Object.keys(areaMap).length.toLocaleString()}</strong>
        <small class="astro-vgxk7ysm">With active inventory</small>
      </article>
    </section>

    <section class="market-section market-overview astro-vgxk7ysm">
      <div class="astro-vgxk7ysm">
        <p class="eyebrow astro-vgxk7ysm">What the numbers say</p>
        <h2 class="astro-vgxk7ysm">The market at a glance</h2>
      </div>

      <p class="astro-vgxk7ysm">${marketSummary}</p>
    </section>

    <section class="market-section astro-vgxk7ysm">
      <div class="section-heading astro-vgxk7ysm">
        <div class="astro-vgxk7ysm">
          <p class="eyebrow astro-vgxk7ysm">Price distribution</p>
          <h2 class="astro-vgxk7ysm">Where current inventory sits</h2>
        </div>

        <a${$$addAttribute(`/${city}`, "href")} class="astro-vgxk7ysm">Browse all listings →</a>
      </div>

      <div class="price-chart astro-vgxk7ysm">
        ${priceBands.map((band) => (
          $$render`<a${$$addAttribute(band.href, "href")} class="price-row astro-vgxk7ysm">
            <span class="astro-vgxk7ysm">${band.label}</span>

            <div class="price-row__track astro-vgxk7ysm">
              <i${$$addAttribute(`--bar-width:${Math.max(
                  (band.count / maxPriceBandCount) * 100,
                  band.count ? 4 : 0
                )}%`, "style")} class="astro-vgxk7ysm"></i>
            </div>

            <strong class="astro-vgxk7ysm">${band.count.toLocaleString()}</strong>
          </a>`
        ))}
      </div>
    </section>

    <section class="market-section astro-vgxk7ysm">
      <div class="section-heading astro-vgxk7ysm">
        <div class="astro-vgxk7ysm">
          <p class="eyebrow astro-vgxk7ysm">Property types</p>
          <h2 class="astro-vgxk7ysm">Inventory by home type</h2>
        </div>
      </div>

      <div class="type-grid astro-vgxk7ysm">
        ${typeStats.map((item) => (
          $$render`<a class="type-card astro-vgxk7ysm"${$$addAttribute(`/${city}?type=${encodeURIComponent(item.type)}`, "href")}>
            <span class="astro-vgxk7ysm">${item.label}</span>
            <strong class="astro-vgxk7ysm">${item.count.toLocaleString()}</strong>
            <small class="astro-vgxk7ysm">
              ${item.medianPrice
                ? `${formatPrice(item.medianPrice)} median`
                : "Price data unavailable"}
            </small>
          </a>`
        ))}
      </div>
    </section>

    <section class="market-section astro-vgxk7ysm">
      <div class="section-heading astro-vgxk7ysm">
        <div class="astro-vgxk7ysm">
          <p class="eyebrow astro-vgxk7ysm">Neighbourhood activity</p>
          <h2 class="astro-vgxk7ysm">Where buyers have the most choice</h2>
        </div>

        <a${$$addAttribute(`/${city}/areas`, "href")} class="astro-vgxk7ysm">Explore all areas →</a>
      </div>

      <div class="area-table astro-vgxk7ysm">
        <div class="area-table__head astro-vgxk7ysm">
          <span class="astro-vgxk7ysm">Neighbourhood</span>
          <span class="astro-vgxk7ysm">Active listings</span>
          <span class="astro-vgxk7ysm">Median asking price</span>
          <span class="astro-vgxk7ysm"></span>
        </div>

        ${areaStats.map((area) => (
          $$render`<a class="area-table__row astro-vgxk7ysm"${$$addAttribute(`/${city}/${String(area.area)
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-+|-+$/g, "")}`, "href")}>
            <strong class="astro-vgxk7ysm">${area.name}</strong>
            <span class="astro-vgxk7ysm">${area.count.toLocaleString()}</span>
            <span class="astro-vgxk7ysm">
              ${area.medianPrice
                ? formatPrice(area.medianPrice)
                : "—"}
            </span>
            <span class="astro-vgxk7ysm">View area →</span>
          </a>`
        ))}
      </div>
    </section>

    <section class="market-note astro-vgxk7ysm">
      <div class="astro-vgxk7ysm">
        <p class="eyebrow astro-vgxk7ysm">About this data</p>
        <h2 class="astro-vgxk7ysm">A current-inventory view</h2>
      </div>

      <p class="astro-vgxk7ysm">
        These figures describe active listing inventory and asking
        prices. They are not sold-price statistics or a formal market
        appraisal. Contact a local REALTOR® for advice based on your
        property, timing, and neighbourhood.
      </p>
    </section>
  </main>
`,})}`;
}, './src/pages/[city]/market-intelligence.astro', undefined);
export default $$MarketIntelligence;
