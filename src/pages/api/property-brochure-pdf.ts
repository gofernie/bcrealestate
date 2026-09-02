import type { APIRoute } from "astro";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const clean = (value: unknown, fallback = "") =>
  String(value ?? fallback).trim();

const printable = (value: unknown, fallback = "") =>
  clean(value, fallback)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const first = (row: Record<string, any> | null, names: string[], fallback = "") => {
  for (const name of names) {
    const value = printable(row?.[name]);
    if (value) return value;
  }
  return fallback;
};

const safeUrl = (value: unknown) => {
  try {
    const url = new URL(clean(value));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
};

const uniqueUrls = (value: unknown) =>
  Array.from(
    new Set((Array.isArray(value) ? value : []).map(safeUrl).filter(Boolean))
  ) as string[];

const fetchBytes = async (url: string) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(18000) });
  if (!response.ok) throw new Error(`Could not retrieve image (${response.status}).`);
  const contentType = clean(response.headers.get("content-type")).toLowerCase();
  return { bytes: new Uint8Array(await response.arrayBuffer()), contentType };
};

const embedRaster = async (pdf: PDFDocument, url: string) => {
  const { bytes, contentType } = await fetchBytes(url);
  if (contentType.includes("png") || /\.png(?:\?|$)/i.test(url)) {
    return pdf.embedPng(bytes);
  }
  return pdf.embedJpg(bytes);
};

const fit = (width: number, height: number, maxWidth: number, maxHeight: number) => {
  const scale = Math.min(maxWidth / width, maxHeight / height);
  return { width: width * scale, height: height * scale };
};

const cover = (width: number, height: number, boxWidth: number, boxHeight: number) => {
  const scale = Math.max(boxWidth / width, boxHeight / height);
  return { width: width * scale, height: height * scale };
};

const hexColor = (value: string) => {
  const match = value.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return match
    ? rgb(
        parseInt(match[1], 16) / 255,
        parseInt(match[2], 16) / 255,
        parseInt(match[3], 16) / 255
      )
    : rgb(0.086, 0.49, 0.31);
};

const wrapLines = (text: string, font: any, size: number, maxWidth: number) => {
  const words = printable(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
};

// editorial-brochure-v2
const drawFitImage = (
  page: any,
  image: any,
  x: number,
  y: number,
  width: number,
  height: number,
  background = rgb(0.95, 0.96, 0.95)
) => {
  page.drawRectangle({ x, y, width, height, color: background });
  if (!image) return;
  const size = fit(image.width, image.height, width, height);
  page.drawImage(image, {
    x: x + (width - size.width) / 2,
    y: y + (height - size.height) / 2,
    width: size.width,
    height: size.height,
  });
};

// property-brochure-v3
const drawCoverImage = (
  page: any,
  image: any,
  x: number,
  y: number,
  width: number,
  height: number,
  background = rgb(0.95, 0.96, 0.95)
) => {
  page.drawRectangle({ x, y, width, height, color: background });
  if (!image) return;
  const size = cover(image.width, image.height, width, height);
  page.drawImage(image, {
    x: x + (width - size.width) / 2,
    y: y + (height - size.height) / 2,
    width: size.width,
    height: size.height,
  });
};

const titleCase = (value: unknown) =>
  printable(value)
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const radians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = radians(lat2 - lat1);
  const dLng = radians(lng2 - lng1);
  const value =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(lat1)) * Math.cos(radians(lat2)) *
    Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
};

const formatRoomDimension = (value: unknown) => {
  const text = printable(value);
  if (!text) return "";
  const spaced = text.match(/^(\d+)\s+(\d+)$/);
  if (spaced) return `${spaced[1]}' ${spaced[2]}\"`;
  if (/^\d+$/.test(text)) return `${text}'`;
  return text
    .replace(/\s*ft\s*/gi, "' ")
    .replace(/\s*in\s*/gi, '\"')
    .trim();
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const floorplans = uniqueUrls(body?.floorplans).slice(0, 4);
    const floorplanUrls = new Set(floorplans.map((url) => url.split("?")[0]));
    const images = uniqueUrls(body?.images)
      .filter((url) => !floorplanUrls.has(url.split("?")[0]))
      .slice(0, 14);
    const rooms = Array.isArray(body?.rooms) ? body.rooms.slice(0, 18) : [];

    if (!images.length) {
      return new Response(JSON.stringify({ error: "No listing photos were supplied." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const siteId = clean(body?.siteId);
    const city = printable(body?.city, "BC");
    const hostname = clean(body?.hostname)
      .toLowerCase()
      .replace(/^www\./, "");
    let siteRow: Record<string, any> | null = null;

    if (import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY
      );

      if (siteId) {
        const { data } = await supabase
          .from("sites")
          .select("*")
          .eq("id", siteId)
          .limit(1)
          .maybeSingle();
        siteRow = data || null;
      }

      if (!siteRow && hostname) {
        const { data } = await supabase
          .from("sites")
          .select("*")
          .eq("domain", hostname)
          .limit(1)
          .maybeSingle();
        siteRow = data || null;
      }

      if (!siteRow && city) {
        const { data } = await supabase
          .from("sites")
          .select("*")
          .eq("city", city.toLowerCase())
          .limit(1)
          .maybeSingle();
        siteRow = data || null;
      }
    }

    const accent = hexColor(first(siteRow, ["accent_color", "brand_color"], "#167d4f"));
    const ink = rgb(0.055, 0.13, 0.19);
    const muted = rgb(0.31, 0.36, 0.39);
    const pale = rgb(0.955, 0.965, 0.96);
    const white = rgb(1, 1, 1);

    const agentName = first(siteRow, ["agent_name", "realtor_name", "owner_name"], "Chris Crump");
    const brokerage = first(siteRow, ["brokerage", "brokerage_name", "company_name"], "eXp Realty");
    const phone = first(siteRow, ["agent_phone", "phone", "contact_phone"], "250-619-0390");
    const email = first(siteRow, ["agent_email", "email", "contact_email"], "chris@crump.ca");
    const siteName = siteId ? first(siteRow, ["site_name"], `${titleCase(city)} Homes`) : `${titleCase(city)} Homes`;
    const agentPhotoUrl = safeUrl(first(siteRow, ["agent_photo", "agent_photo_url", "headshot", "headshot_url"]));
    const logoUrl = safeUrl(first(siteRow, ["brand_logo", "brand_logo_url", "logo", "logo_url"]));

    const address = printable(body?.address, "Featured property");
    const price = printable(body?.price);
    const beds = printable(body?.beds);
    const baths = printable(body?.baths);
    const sqft = printable(body?.sqft);
    const year = printable(body?.year);
    const propertyType = printable(body?.propertyType, "Home");
    // brochure-friendly-labels-v1
    const propertyTypeKey = propertyType.toLowerCase().replace(/[_-]+/g, " ").trim();
    const propertyTypeLabel =
      propertyTypeKey === "house" ||
      propertyTypeKey === "home" ||
      propertyTypeKey === "single family residence" ||
      propertyTypeKey === "single family"
        ? "Single Family Home"
        : propertyTypeKey === "condo" ||
            propertyTypeKey === "apartment" ||
            propertyTypeKey === "condominium"
          ? "Condo"
          : propertyTypeKey === "townhouse" || propertyTypeKey === "townhome"
            ? "Townhome"
            : propertyTypeKey === "mobile" ||
                propertyTypeKey === "mobile home" ||
                propertyTypeKey === "manufactured" ||
                propertyTypeKey === "manufactured home"
              ? "Mobile Home"
              : propertyTypeKey === "land" || propertyTypeKey === "lot"
                ? "Land"
                : propertyTypeKey === "multi family" || propertyTypeKey === "multifamily"
                  ? "Multi-Family Home"
                  : titleCase(propertyType);
    const area = titleCase(body?.area);
    const mls = printable(body?.mls, "30166546");
    const description = printable(
      body?.description,
      "Contact us for full property details."
    ).replace(/\s*\(id:\s*\d+\)\s*$/i, "");
    const listingUrl = safeUrl(body?.listingUrl) || request.headers.get("origin") || "https://bc.realestate";
    const latitude = Number(body?.lat);
    const longitude = Number(body?.lng);
    let censusRow: Record<string, any> | null = null;
    let nearbyAmenities: Array<Record<string, any> & { distanceKm: number }> = [];

    if (import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.SUPABASE_SERVICE_ROLE_KEY) {
      const dataClient = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY
      );

      try {
        const { data } = await dataClient
          .from("neighbourhood_census_data")
          .select("*")
          .ilike("city", city)
          .limit(100);
        const normalizedArea = clean(area).toLowerCase();
        censusRow = (data || []).find((row: any) => {
          const candidate = clean(
            row.neighbourhood || row.area || row.name || row.normalized_area
          ).toLowerCase();
          return normalizedArea && candidate === normalizedArea;
        }) || null;
      } catch (error) {
        console.warn("Brochure census lookup failed:", error);
      }

      if (Number.isFinite(latitude) && Number.isFinite(longitude)) {
        try {
          const latitudeDelta = 0.025;
          const longitudeDelta = 0.035;
          const { data } = await dataClient
            .from("osm_amenities")
            .select("name,category,lat,lng")
            .gte("lat", latitude - latitudeDelta)
            .lte("lat", latitude + latitudeDelta)
            .gte("lng", longitude - longitudeDelta)
            .lte("lng", longitude + longitudeDelta)
            .limit(1000);

          nearbyAmenities = (data || [])
            .map((row: any) => ({
              ...row,
              distanceKm: haversineKm(latitude, longitude, Number(row.lat), Number(row.lng)),
            }))
            .filter((row: any) => Number.isFinite(row.distanceKm) && row.distanceKm <= 3)
            .sort((a: any, b: any) => a.distanceKm - b.distanceKm);
        } catch (error) {
          console.warn("Brochure OSM lookup failed:", error);
        }
      }
    }

    // enriched-map-area-story-v1
    let areaListingRows: Array<Record<string, any>> = [];
    if (
      import.meta.env.PUBLIC_SUPABASE_URL &&
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY &&
      clean(area)
    ) {
      try {
        const listingClient = createClient(
          import.meta.env.PUBLIC_SUPABASE_URL,
          import.meta.env.SUPABASE_SERVICE_ROLE_KEY
        );
        const { data, error } = await listingClient
          .from("listing_rows")
          .select("price,normalized_type")
          .eq("city", clean(city).toLowerCase())
          .eq("normalized_area", clean(area).toLowerCase())
          .in("status", ["I", "A"])
          .limit(1000);
        if (error) throw error;
        areaListingRows = data || [];
      } catch (error) {
        console.warn("Brochure neighbourhood listing stats failed:", error);
      }
    }

    // brochure-neighbourhood-map-v1
    const mapCategoryDefinitions = [
      { label: "School", keys: ["school"], color: "0xC62838" },
      { label: "Park or trail", keys: ["park", "trail", "playground"], color: "0xC62838" },
      { label: "Food or coffee", keys: ["restaurant", "cafe", "coffee"], color: "0xC62838" },
      { label: "Groceries or shops", keys: ["grocery", "supermarket", "shop"], color: "0xC62838" },
      { label: "Health or pharmacy", keys: ["medical", "doctor", "clinic", "pharmacy"], color: "0xC62838" },
    ];

    const mapAmenities = mapCategoryDefinitions
      .map((definition) => {
        const amenity = nearbyAmenities.find((item: any) => {
          const category = clean(item.category).toLowerCase();
          return definition.keys.some((key) => category.includes(key));
        });
        return amenity ? { ...definition, amenity } : null;
      })
      .filter(Boolean) as Array<{
        label: string;
        color: string;
        amenity: Record<string, any> & { distanceKm: number };
      }>;

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const serif = await pdf.embedFont(StandardFonts.TimesRoman);
    const serifBold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    const hero = await embedRaster(pdf, images[0]);

    const qrDataUrl = await QRCode.toDataURL(listingUrl, {
      width: 420,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#102333", light: "#FFFFFF" },
    });
    const qr = await pdf.embedPng(qrDataUrl);

    let agentPhoto: any = null;
    let logo: any = null;
    try { if (agentPhotoUrl) agentPhoto = await embedRaster(pdf, agentPhotoUrl); } catch {}
    try { if (logoUrl) logo = await embedRaster(pdf, logoUrl); } catch {}

    const embeddedImages: any[] = [];
    for (const url of images) {
      try { embeddedImages.push(await embedRaster(pdf, url)); } catch { embeddedImages.push(null); }
    }
    const galleryImages = embeddedImages
      .slice(1)
      .filter(Boolean)
      .sort((a: any, b: any) => {
        const aLandscape = a.width / a.height >= 1.18 ? 1 : 0;
        const bLandscape = b.width / b.height >= 1.18 ? 1 : 0;
        return bLandscape - aLandscape || (b.width / b.height) - (a.width / a.height);
      });

    const embeddedFloorplans: any[] = [];
    for (const url of floorplans) {
      try { embeddedFloorplans.push(await embedRaster(pdf, url)); } catch {}
    }

    let neighbourhoodMap: any = null;
    const staticMapsKey =
      import.meta.env.GOOGLE_MAPS_API_KEY ||
      import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY ||
      "";

    if (
      staticMapsKey &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude)
    ) {
      try {
        const params = new URLSearchParams({
          size: "640x315",
          scale: "2",
          maptype: "roadmap",
          key: staticMapsKey,
        });
        params.append("markers", `color:0x102333|label:H|${latitude},${longitude}`);
        // unified-map-markers-v1
        params.append("style", "feature:poi|visibility:off");
        params.append("style", "feature:transit|visibility:off");
        mapAmenities.forEach((item, index) => {
          params.append(
            "markers",
            `color:${item.color}|label:${index + 1}|${item.amenity.lat},${item.amenity.lng}`
          );
        });
        neighbourhoodMap = await embedRaster(
          pdf,
          `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
        );
      } catch (error) {
        console.warn("Brochure neighbourhood map failed:", error);
      }
    }

    const addPageNumber = (page: any, number: number) => {
      page.drawText(`${number}  |  ${printable(siteName).toUpperCase()}`, {
        x: 42,
        y: 24,
        size: 7.5,
        font: bold,
        color: muted,
      });
    };

    // 1. Cover
    {
      const page = pdf.addPage([612, 792]);
      const size = cover(hero.width, hero.height, 612, 792);
      page.drawImage(hero, {
        x: (612 - size.width) / 2,
        y: (792 - size.height) / 2,
        width: size.width,
        height: size.height,
      });
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 300, color: rgb(0.02, 0.07, 0.1), opacity: 0.78 });
      page.drawRectangle({ x: 0, y: 0, width: 10, height: 792, color: accent });
      page.drawText(printable(siteName).toUpperCase(), { x: 44, y: 254, size: 9, font: bold, color: white });
      const addressLines = wrapLines(address, bold, 31, 510).slice(0, 3);
      addressLines.forEach((line, index) => page.drawText(line, { x: 44, y: 210 - index * 37, size: 31, font: bold, color: white }));
      page.drawText(price, { x: 44, y: 78, size: 23, font: bold, color: white });
      const details = [beds && `${beds} bed`, baths && `${baths} bath`, sqft && `${sqft} sq ft`, mls && `MLS ${mls}`].filter(Boolean).join("  |  ");
      page.drawText(details, { x: 44, y: 52, size: 10.5, font: regular, color: white });
    }

    // 2. Overview
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: white });
      page.drawRectangle({ x: 0, y: 752, width: 612, height: 40, color: accent });
      page.drawText("PROPERTY OVERVIEW", { x: 42, y: 718, size: 10, font: bold, color: accent });
      page.drawText(address, { x: 42, y: 682, size: 24, font: bold, color: ink });

      const facts = [
        ["PRICE", price], ["TYPE", propertyTypeLabel], ["BEDROOMS", beds],
        ["BATHROOMS", baths], ["INTERIOR", sqft && `${sqft} sq ft`],
        ["YEAR BUILT", year], ["AREA", area || city], ["MLS", mls],
      ].filter(([, value]) => value);
      facts.forEach(([label, value], index) => {
        const column = index % 2;
        const row = Math.floor(index / 2);
        const x = 42 + column * 268;
        const y = 625 - row * 54;
        page.drawText(label, { x, y, size: 7.5, font: bold, color: muted });
        page.drawText(printable(value), { x, y: y - 20, size: 13, font: bold, color: ink });
      });

      page.drawLine({ start: { x: 42, y: 398 }, end: { x: 570, y: 398 }, thickness: 0.8, color: rgb(0.82, 0.85, 0.86) });
      page.drawText("THE PROPERTY", { x: 42, y: 370, size: 9, font: bold, color: accent });
      const lines = wrapLines(description, regular, 10.4, 528).slice(0, 14);
      lines.forEach((line, index) => page.drawText(line, { x: 42, y: 342 - index * 15, size: 10.4, font: regular, color: ink }));
      addPageNumber(page, 2);
    }

    // 3. Architecture and setting - premium editorial composition.
    // premium-photo-pages-v1
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: white });
      page.drawText("ARCHITECTURE & SETTING", { x: 52, y: 724, size: 7.5, font: bold, color: accent });
      page.drawText("A home shaped by its surroundings", { x: 52, y: 683, size: 25, font: serifBold, color: ink });
      page.drawLine({ start: { x: 52, y: 663 }, end: { x: 560, y: 663 }, thickness: 0.6, color: rgb(0.84, 0.86, 0.86) });

      // Every interior photograph is framed by the same 52-point page margins.
      drawCoverImage(page, galleryImages[0] || embeddedImages[1], 52, 382, 508, 258, pale);
      drawCoverImage(page, galleryImages[1] || galleryImages[0], 52, 124, 238, 230, pale);

      page.drawRectangle({ x: 310, y: 124, width: 250, height: 230, color: ink });
      page.drawRectangle({ x: 310, y: 124, width: 6, height: 230, color: accent });
      page.drawText("THE ARRIVAL", { x: 338, y: 318, size: 7.5, font: bold, color: accent });

      const architectureWords = printable(description).split(/\s+/).filter(Boolean);
      const architectureExcerpt =
        architectureWords.slice(0, 58).join(" ") +
        (architectureWords.length > 58 ? "..." : "");
      wrapLines(architectureExcerpt, regular, 8.9, 194).slice(0, 9).forEach((line, index) => {
        page.drawText(line, { x: 338, y: 288 - index * 13, size: 8.9, font: regular, color: white });
      });

      const locationLine = [area, city].filter(Boolean).map(titleCase).join("  |  ").toUpperCase();
      if (locationLine) {
        page.drawText(locationLine, { x: 338, y: 146, size: 6.5, font: bold, color: rgb(0.7, 0.76, 0.78) });
      }
      addPageNumber(page, 3);
    }
    // 4. Lifestyle editorial spread - landscape-first, edge-to-edge crops.
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: pale });
      page.drawRectangle({ x: 0, y: 0, width: 12, height: 792, color: accent });
      page.drawText("LIFE AT HOME", { x: 52, y: 724, size: 7.5, font: bold, color: accent });
      page.drawText("Space to gather. Room to retreat.", { x: 52, y: 683, size: 25, font: serifBold, color: ink });

      drawCoverImage(page, galleryImages[2] || galleryImages[0], 52, 392, 508, 258, white);
      drawCoverImage(page, galleryImages[3] || galleryImages[1], 52, 204, 238, 164, white);
      drawCoverImage(page, galleryImages[4] || galleryImages[2], 322, 204, 238, 164, white);

      page.drawRectangle({ x: 52, y: 52, width: 508, height: 124, color: ink });
      page.drawText("PROPERTY HIGHLIGHTS", { x: 66, y: 146, size: 8, font: bold, color: accent });
      const highlights = [
        sqft && `${sqft} sq ft of considered living space`,
        beds && baths && `${beds} bedrooms and ${baths} bathrooms`,
        area && `Set within ${titleCase(area)}`,
      ].filter(Boolean);
      highlights.forEach((line, index) => {
        page.drawText(`- ${printable(line)}`, { x: 66, y: 120 - index * 20, size: 9.5, font: regular, color: white });
      });
      addPageNumber(page, 4);
    }
    // 5. Rooms and floorplans - floorplans appear nowhere else.
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: pale });
      page.drawText("ROOMS & FLOORPLANS", { x: 42, y: 744, size: 9, font: bold, color: accent });
      page.drawText("Designed for everyday living", { x: 42, y: 710, size: 22, font: bold, color: ink });

      const planCount = embeddedFloorplans.length;
      const manyPlans = planCount >= 3;
      const roomLimit = manyPlans ? 8 : planCount ? 10 : 18;
      const roomColumns = planCount === 0 ? 2 : 1;
      const roomWidth = planCount === 0 ? 250 : manyPlans ? 528 : 238;

      rooms.slice(0, roomLimit).forEach((room: any, index: number) => {
        const column = roomColumns === 2 && index >= 9 ? 1 : 0;
        const row = roomColumns === 2 ? index % 9 : index;
        const x = 42 + column * 278;
        const y = 658 - row * (manyPlans ? 38 : 52);
        if (y < (manyPlans ? 425 : 112)) return;
        const label = printable(room?.label, "Room");
        const level = printable(room?.level);
        const length = formatRoomDimension(room?.length);
        const widthValue = formatRoomDimension(room?.width);
        const dimensions = [length, widthValue].filter(Boolean).join(" x ");
        page.drawText(label, { x, y, size: 9, font: bold, color: ink });
        if (level) page.drawText(level, { x, y: y - 13, size: 7.2, font: regular, color: muted });
        if (dimensions) {
          const textWidth = regular.widthOfTextAtSize(dimensions, 8.2);
          page.drawText(dimensions, { x: x + roomWidth - textWidth, y, size: 8.2, font: regular, color: ink });
        }
        page.drawLine({ start: { x, y: y - 22 }, end: { x: x + roomWidth, y: y - 22 }, thickness: 0.45, color: rgb(0.8, 0.83, 0.82) });
      });

      if (planCount === 1) {
        page.drawRectangle({ x: 304, y: 102, width: 266, height: 568, color: white });
        drawFitImage(page, embeddedFloorplans[0], 314, 112, 246, 548, white);
      } else if (planCount === 2) {
        page.drawRectangle({ x: 304, y: 102, width: 266, height: 568, color: white });
        drawFitImage(page, embeddedFloorplans[0], 314, 396, 246, 254, white);
        page.drawLine({ start: { x: 320, y: 386 }, end: { x: 554, y: 386 }, thickness: 0.6, color: rgb(0.82, 0.85, 0.86) });
        drawFitImage(page, embeddedFloorplans[1], 314, 112, 246, 254, white);
      } else if (planCount >= 3) {
        const planWidth = planCount === 3 ? 168 : 252;
        const planHeight = planCount === 3 ? 270 : 132;
        embeddedFloorplans.slice(0, 4).forEach((plan: any, index: number) => {
          const x = planCount === 3 ? 42 + index * 180 : 42 + (index % 2) * 276;
          const y = planCount === 3 ? 82 : 82 + Math.floor(index / 2) * 148;
          page.drawRectangle({ x, y, width: planWidth, height: planHeight, color: white });
          drawFitImage(page, plan, x + 8, y + 8, planWidth - 16, planHeight - 16, white);
        });
      } else {
        page.drawRectangle({ x: 42, y: 72, width: 528, height: 112, color: ink });
        page.drawText("ROOM MEASUREMENTS", { x: 66, y: 146, size: 8, font: bold, color: accent });
        page.drawText("A helpful guide to the home's proportions.", { x: 66, y: 116, size: 12, font: bold, color: white });
        page.drawText("Dimensions are approximate. Open the complete listing using the QR code.", { x: 66, y: 94, size: 8.5, font: regular, color: white });
      }
      addPageNumber(page, 5);
    }

    // 6. Editorial neighbourhood map, OSM context, census and current listings.
    {
      const page = pdf.addPage([612, 792]);
      const areaLabel = titleCase(area || city);
      const ownership = Number(censusRow?.pct_owned);
      const medianAge = Number(censusRow?.median_age);
      const income = Number(censusRow?.median_household_income);

      const areaPrices = areaListingRows
        .map((row: any) => Number(row.price))
        .filter((value: number) => Number.isFinite(value) && value > 0)
        .sort((a: number, b: number) => a - b);
      const activeCount = areaListingRows.length;
      const medianAsking = areaPrices.length
        ? areaPrices[Math.floor(areaPrices.length / 2)]
        : 0;
      const lowestAsking = areaPrices[0] || 0;
      const highestAsking = areaPrices[areaPrices.length - 1] || 0;
      const formatMarketPrice = (value: number) =>
        value >= 1000000
          ? `${(value / 1000000).toFixed(value % 1000000 === 0 ? 0 : 1)}M`
          : `${Math.round(value / 1000)}k`;

      const typeCounts: Record<string, number> = {};
      areaListingRows.forEach((row: any) => {
        const key = clean(row.normalized_type).toLowerCase();
        if (key) typeCounts[key] = (typeCounts[key] || 0) + 1;
      });
      const dominantTypes = Object.entries(typeCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([key]) =>
          key === "house" ? "single-family homes" :
          key === "condo" ? "condos" :
          key === "townhouse" ? "townhomes" :
          key === "mobile" ? "mobile homes" :
          key === "land" ? "land" : titleCase(key)
        );

      const countAmenities = (keys: string[]) =>
        nearbyAmenities.filter((item: any) => {
          const category = clean(item.category).toLowerCase();
          return keys.some((key) => category.includes(key));
        }).length;
      const schoolCount = countAmenities(["school"]);
      const greenCount = countAmenities(["park", "trail", "playground"]);
      const foodCount = countAmenities(["restaurant", "cafe", "coffee"]);
      const shoppingCount = countAmenities(["grocery", "supermarket", "shop"]);
      const recreationCount = countAmenities(["recreation", "golf", "beach", "marina"]);
      const healthCount = countAmenities(["medical", "doctor", "clinic", "pharmacy"]);

      const nearestSchool = mapAmenities.find((item) => item.label === "School");
      const nearestGreen = mapAmenities.find((item) => item.label === "Park or trail");
      const nearestFood = mapAmenities.find((item) => item.label === "Food or coffee");
      const nearestShop = mapAmenities.find((item) => item.label === "Groceries or shops");
      const nearestHealth = mapAmenities.find((item) => item.label === "Health or pharmacy");

      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: white });
      page.drawRectangle({ x: 0, y: 752, width: 612, height: 40, color: accent });
      page.drawText("LIFE IN THE NEIGHBOURHOOD", { x: 42, y: 718, size: 9, font: bold, color: accent });
      page.drawText(`Life around ${areaLabel}`, { x: 42, y: 681, size: 26, font: bold, color: ink });

      const osmHighlights = [
        schoolCount ? `${schoolCount} school${schoolCount === 1 ? "" : "s"}` : "",
        greenCount ? `${greenCount} parks, trails and play spaces` : "",
        shoppingCount ? `${shoppingCount} grocery or shopping options` : "",
        foodCount ? `${foodCount} food and coffee options` : "",
      ].filter(Boolean);
      const opening = osmHighlights.length
        ? `${areaLabel} pairs its residential setting with ${osmHighlights.slice(0, 3).join(", ")} mapped within roughly 3 km of this home. The map highlights the closest useful examples rather than every location.`
        : `${areaLabel} offers a residential setting with outdoor spaces and everyday services within reach. The map highlights the closest useful examples.`;
      wrapLines(opening, regular, 9.6, 528).slice(0, 3).forEach((line, index) => {
        page.drawText(line, { x: 42, y: 650 - index * 14, size: 9.6, font: regular, color: ink });
      });

      const mapX = 42;
      const mapY = 340;
      const mapWidth = 528;
      const mapHeight = 258;
      page.drawRectangle({ x: mapX, y: mapY, width: mapWidth, height: mapHeight, color: pale });
      if (neighbourhoodMap) {
        drawFitImage(page, neighbourhoodMap, mapX, mapY, mapWidth, mapHeight, pale);
      }
      // close-to-home-title-removed-v1
      mapAmenities.slice(0, 5).forEach((item, index) => {
        const column = index < 3 ? 0 : 1;
        const row = column === 0 ? index : index - 3;
        const x = 42 + column * 276;
        const y = 300 - row * 21; // complete-map-legend-v2
        page.drawCircle({ x: x + 8, y: y + 3, size: 8, color: accent });
        const number = String(index + 1);
        page.drawText(number, { x: x + 8 - bold.widthOfTextAtSize(number, 6.5) / 2, y: y + 0.5, size: 6.5, font: bold, color: white });
        const place = `${printable(item.amenity.name, item.label)} - ${item.amenity.distanceKm.toFixed(1)} km`;
        page.drawText(place, { x: x + 23, y, size: 7.7, font: regular, color: ink });
      });

      page.drawRectangle({ x: 42, y: 164, width: 528, height: 66, color: ink });
      const marketFacts = [
        activeCount ? [String(activeCount), "ACTIVE LISTINGS"] : null,
        medianAsking ? [formatMarketPrice(medianAsking), "MEDIAN ASKING"] : null,
        Number.isFinite(ownership) && ownership > 0 ? [`${Math.round(ownership)}%`, "OWNER OCCUPIED"] : null,
        Number.isFinite(medianAge) && medianAge > 0 ? [String(Math.round(medianAge)), "MEDIAN AGE"] : null,
      ].filter(Boolean) as string[][];
      marketFacts.slice(0, 4).forEach((fact, index) => {
        const x = 62 + index * 128;
        page.drawText(fact[0], { x, y: 195, size: 17, font: bold, color: white });
        page.drawText(fact[1], { x, y: 178, size: 6.2, font: bold, color: rgb(0.72, 0.78, 0.8) });
      });

      page.drawText("THE MARKET TODAY", { x: 42, y: 140, size: 7.8, font: bold, color: accent });
      const marketStory = activeCount
        ? `${areaLabel} currently has ${activeCount} active listing${activeCount === 1 ? "" : "s"}, ranging from ${formatMarketPrice(lowestAsking)} to ${formatMarketPrice(highestAsking)}, with a median asking price of ${formatMarketPrice(medianAsking)}${dominantTypes.length ? `. Most of the current selection is ${dominantTypes.join(" and ")}` : ""}.`
        : `Neighbourhood inventory changes quickly; the live listing provides the latest comparison set for ${areaLabel}.`;
      wrapLines(marketStory, regular, 8.3, 250).slice(0, 5).forEach((line, index) => {
        page.drawText(line, { x: 42, y: 120 - index * 12, size: 8.3, font: regular, color: ink });
      });

      page.drawText("HOW THE AREA MAY LIVE", { x: 320, y: 140, size: 7.8, font: bold, color: accent });
      const dailyPieces: string[] = [];
      if (nearestGreen) dailyPieces.push(`${printable(nearestGreen.amenity.name)} is ${nearestGreen.amenity.distanceKm.toFixed(1)} km away`);
      if (nearestSchool) dailyPieces.push(`${printable(nearestSchool.amenity.name)} is ${nearestSchool.amenity.distanceKm.toFixed(1)} km away`);
      if (nearestShop) dailyPieces.push(`${printable(nearestShop.amenity.name)} offers a nearby practical stop`);
      else if (nearestFood) dailyPieces.push(`${printable(nearestFood.amenity.name)} adds a local option`);
      const profilePiece = Number.isFinite(income) && income > 0
        ? `The closest census profile reports a median household income of ${Math.round(income / 1000)}k.`
        : "";
      const dailyStory = `${dailyPieces.join("; ")}. ${profilePiece}`.trim();
      wrapLines(dailyStory, regular, 8.3, 250).slice(0, 5).forEach((line, index) => {
        page.drawText(line, { x: 320, y: 120 - index * 12, size: 8.3, font: regular, color: ink });
      });

      const extraCounts = [
        recreationCount ? `${recreationCount} recreation` : "",
        healthCount ? `${healthCount} health services` : "",
        foodCount ? `${foodCount} food & coffee` : "",
        shoppingCount ? `${shoppingCount} shopping` : "",
      ].filter(Boolean).join("  |  ");
      if (extraCounts) page.drawText(extraCounts, { x: 42, y: 53, size: 7, font: bold, color: muted });
      page.drawText("OSM places are approximate and measured within roughly 3 km. Listing figures are current asking prices, not recorded sales. Census figures use the closest available profile.", { x: 42, y: 39, size: 6.2, font: regular, color: muted });
      addPageNumber(page, 6);
    }
    // 7. Contact and QR
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: ink });
      page.drawRectangle({ x: 0, y: 0, width: 12, height: 792, color: accent });
      page.drawText("YOUR NEXT MOVE", { x: 48, y: 706, size: 10, font: bold, color: accent });
      page.drawText("Experience this property", { x: 48, y: 650, size: 30, font: bold, color: white });
      page.drawText("in person.", { x: 48, y: 614, size: 30, font: bold, color: white });

      let brandX = 48;
      if (agentPhoto) {
        const size = fit(agentPhoto.width, agentPhoto.height, 120, 150);
        page.drawImage(agentPhoto, { x: 48, y: 370, width: size.width, height: size.height });
        brandX = 194;
      } else if (logo) {
        const size = fit(logo.width, logo.height, 120, 80);
        page.drawImage(logo, { x: 48, y: 430, width: size.width, height: size.height });
        brandX = 194;
      }

      page.drawText(agentName, { x: brandX, y: 493, size: 19, font: bold, color: white });
      page.drawText(brokerage, { x: brandX, y: 468, size: 11, font: regular, color: white });
      const contactLines = [phone, email, siteName].filter(Boolean);
      contactLines.forEach((line, index) => page.drawText(printable(line), { x: brandX, y: 432 - index * 21, size: 10, font: regular, color: white }));

      page.drawImage(qr, { x: 48, y: 152, width: 132, height: 132 });
      page.drawText("SCAN FOR LIVE LISTING", { x: 204, y: 244, size: 10, font: bold, color: accent });
      page.drawText("Current status, complete photo gallery,", { x: 204, y: 218, size: 10, font: regular, color: white });
      page.drawText("property details and showing requests.", { x: 204, y: 200, size: 10, font: regular, color: white });

      const disclaimer = "Information is believed to be accurate but should not be relied upon without independent verification. Measurements are approximate. Property availability and price may change.";
      const disclaimerLines = wrapLines(disclaimer, regular, 7, 510);
      disclaimerLines.forEach((line, index) => page.drawText(line, { x: 48, y: 78 - index * 10, size: 7, font: regular, color: rgb(0.7, 0.75, 0.77) }));
    }

    pdf.setTitle(`${address} property brochure`);
    pdf.setAuthor(`${agentName} - ${brokerage}`);
    pdf.setSubject(`Property brochure for MLS ${mls}`);
    pdf.setKeywords([city, propertyTypeLabel, mls, "property brochure"]);

    const bytes = await pdf.save();
    const slug = address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || `mls-${mls}`;

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-property-brochure.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("property brochure PDF failed:", error);
    return new Response(JSON.stringify({ error: error?.message || "Could not create the property brochure." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};