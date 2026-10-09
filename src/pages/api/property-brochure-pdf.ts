import type { APIRoute } from "astro";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";
import { getAgentForSite } from "../../lib/getAgentForSite";

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

    const agent = await getAgentForSite(siteRow);
    const agentName = first(siteRow, ["agent_name", "realtor_name", "owner_name"], "Chris Crump");
    const brokerage = first(
      agent,
      ["brokerage"],
      first(siteRow, ["brokerage", "brokerage_name", "company_name"])
    );
    const phone = first(siteRow, ["agent_phone", "phone", "contact_phone"], "250-619-0390");
    const email = first(siteRow, ["agent_email", "email", "contact_email"], "chris@crump.ca");
    const siteName = siteId ? first(siteRow, ["site_name"], `${titleCase(city)} Homes`) : `${titleCase(city)} Homes`;
    const agentPhotoUrl = safeUrl(
      first(
        agent,
        [
          "photo",
          "photo_url",
          "agent_photo",
          "agent_photo_url",
          "headshot",
          "headshot_url",
          "headshot_cutout_url",
          "cutout_url"
        ],
        first(siteRow, ["agent_photo", "agent_photo_url", "headshot", "headshot_url"])
      )
    );
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

    // 3. Architecture and setting.
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: white });
      page.drawText("ARCHITECTURE & SETTING", { x: 52, y: 724, size: 7.5, font: bold, color: accent });
      page.drawText("A home shaped by its surroundings.", { x: 52, y: 678, size: 24, font: bold, color: ink });
      page.drawText("Old City character, street-and-lane access, and a site with room to think ahead.", { x: 52, y: 654, size: 9.5, font: regular, color: muted });

      drawCoverImage(page, galleryImages[0] || embeddedImages[1], 52, 378, 508, 250, pale);
      drawCoverImage(page, galleryImages[1] || galleryImages[0], 52, 116, 238, 232, pale);

      page.drawRectangle({ x: 310, y: 116, width: 250, height: 232, color: ink });
      page.drawRectangle({ x: 310, y: 116, width: 6, height: 232, color: accent });
      page.drawText("THE ARRIVAL", { x: 332, y: 316, size: 7.5, font: bold, color: accent });
      page.drawText("AN OLD CITY OPPORTUNITY", { x: 332, y: 285, size: 13.5, font: bold, color: white });

      const architectureWords = printable(description).split(/\s+/).filter(Boolean);
      const architectureExcerpt =
        architectureWords.slice(0, 58).join(" ") +
        (architectureWords.length > 58 ? "..." : "");

      wrapLines(architectureExcerpt, regular, 9.2, 204).slice(0, 8).forEach((line, index) => {
        page.drawText(line, { x: 332, y: 254 - index * 14, size: 9.2, font: regular, color: white });
      });

      const locationLine = [area, city].filter(Boolean).map(titleCase).join("  |  ").toUpperCase();
      if (locationLine) {
        page.drawText(locationLine, { x: 332, y: 138, size: 6.5, font: bold, color: rgb(0.7, 0.76, 0.78) });
      }
      addPageNumber(page, 3);
    }

    // 4. Lifestyle editorial spread.
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: pale });
      page.drawRectangle({ x: 0, y: 0, width: 12, height: 792, color: accent });
      page.drawText("LIFE AT HOME", { x: 52, y: 724, size: 7.5, font: bold, color: accent });
      page.drawText("Space to gather. Room to retreat.", { x: 52, y: 678, size: 22, font: bold, color: ink });

      drawCoverImage(page, galleryImages[2] || galleryImages[0], 52, 380, 508, 240, white);
      drawCoverImage(page, galleryImages[3] || galleryImages[1], 52, 194, 238, 160, white);
      drawCoverImage(page, galleryImages[4] || galleryImages[2], 322, 194, 238, 160, white);

      page.drawRectangle({ x: 52, y: 52, width: 508, height: 118, color: ink });
      page.drawText("PROPERTY HIGHLIGHTS", { x: 66, y: 144, size: 8, font: bold, color: accent });

      const highlights = [
        sqft && `${sqft} sq ft of considered living space`,
        beds && baths && `${beds} bedrooms | ${baths} bathroom${baths === 1 ? "" : "s"}`,
        area && `Set within ${titleCase(area)}`,
      ].filter(Boolean);

      highlights.forEach((line, index) => {
        page.drawText(`- ${printable(line)}`, { x: 66, y: 118 - index * 20, size: 9.5, font: regular, color: white });
      });
      addPageNumber(page, 4);
    }
    const floorplanCount = embeddedFloorplans.length;

    const drawRoomMeasurements = (page: any) => {
      const maxRows = 9;
      const roomWidth = 250;

      rooms.slice(0, maxRows * 2).forEach((room: any, index: number) => {
        const column = index >= maxRows ? 1 : 0;
        const row = index % maxRows;
        const x = 42 + column * 278;
        const y = 658 - row * 44;

        const label = printable(room?.label, "Room");
        const level = printable(room?.level);
        const length = formatRoomDimension(room?.length);
        const widthValue = formatRoomDimension(room?.width);
        const dimensions = [length, widthValue]
          .filter(Boolean)
          .join(" x ");

        page.drawText(label, {
          x,
          y,
          size: 9,
          font: bold,
          color: ink,
        });

        if (level) {
          page.drawText(level, {
            x,
            y: y - 13,
            size: 7.2,
            font: regular,
            color: muted,
          });
        }

        if (dimensions) {
          const textWidth =
            regular.widthOfTextAtSize(dimensions, 8.2);

          page.drawText(dimensions, {
            x: x + roomWidth - textWidth,
            y,
            size: 8.2,
            font: regular,
            color: ink,
          });
        }

        page.drawLine({
          start: { x, y: y - 22 },
          end: { x: x + roomWidth, y: y - 22 },
          thickness: 0.45,
          color: rgb(0.8, 0.83, 0.82),
        });
      });
    };

    // 5. Room measurements always receive a dedicated page.
    {
      const page = pdf.addPage([612, 792]);

      page.drawRectangle({
        x: 0,
        y: 0,
        width: 612,
        height: 792,
        color: pale,
      });

      page.drawText("ROOM MEASUREMENTS", {
        x: 42,
        y: 744,
        size: 9,
        font: bold,
        color: accent,
      });

      page.drawText("A guide to the home's proportions", {
        x: 42,
        y: 710,
        size: 22,
        font: bold,
        color: ink,
      });

      drawRoomMeasurements(page);

      page.drawRectangle({
        x: 42,
        y: 72,
        width: 528,
        height: 88,
        color: ink,
      });

      page.drawText("Dimensions are approximate.", {
        x: 66,
        y: 124,
        size: 11,
        font: bold,
        color: white,
      });

      page.drawText(
        "Open the complete listing using the QR code for full property details.",
        {
          x: 66,
          y: 100,
          size: 8.5,
          font: regular,
          color: white,
        }
      );

      addPageNumber(page, 5);
    }

    // Each floorplan is given its own landscape page.
    embeddedFloorplans.forEach((plan: any, index: number) => {
      const page = pdf.addPage([792, 612]);
      const pageNumber = 6 + index;

      page.drawRectangle({
        x: 0,
        y: 0,
        width: 792,
        height: 612,
        color: white,
      });

      page.drawText(
        floorplanCount > 1
          ? `FLOORPLAN ${index + 1} OF ${floorplanCount}`
          : "FLOORPLAN",
        {
          x: 42,
          y: 566,
          size: 9,
          font: bold,
          color: accent,
        }
      );

      page.drawText("A clearer view of the layout", {
        x: 42,
        y: 532,
        size: 22,
        font: bold,
        color: ink,
      });

      page.drawLine({
        start: { x: 42, y: 512 },
        end: { x: 750, y: 512 },
        thickness: 0.6,
        color: rgb(0.82, 0.85, 0.86),
      });

      page.drawRectangle({
        x: 42,
        y: 64,
        width: 708,
        height: 424,
        color: pale,
      });

      drawFitImage(
        page,
        plan,
        54,
        76,
        684,
        400,
        pale
      );

      addPageNumber(page, pageNumber);
    });
    // 6. Neighbourhood map and local market context.
    {
      const page = pdf.addPage([612, 792]);
      const areaLabel = titleCase(area || city);
      const ownership = Number(censusRow?.pct_owned);
      const medianAge = Number(censusRow?.median_age);

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

      const nearestSchool = mapAmenities.find(
        (item) => item.label === "School"
      );
      const nearestGreen = mapAmenities.find(
        (item) => item.label === "Park or trail"
      );
      const nearestFood = mapAmenities.find(
        (item) => item.label === "Food or coffee"
      );
      const nearestShop = mapAmenities.find(
        (item) => item.label === "Groceries or shops"
      );

      page.drawRectangle({
        x: 0,
        y: 0,
        width: 612,
        height: 792,
        color: white,
      });

      page.drawRectangle({
        x: 0,
        y: 752,
        width: 612,
        height: 40,
        color: accent,
      });

      page.drawText("LIFE IN THE NEIGHBOURHOOD", {
        x: 42,
        y: 718,
        size: 9,
        font: bold,
        color: accent,
      });

      page.drawText(`Life around ${areaLabel}`, {
        x: 42,
        y: 681,
        size: 26,
        font: bold,
        color: ink,
      });

      const nearbyNames = mapAmenities
        .slice(0, 3)
        .map((item) => printable(item.amenity.name, item.label));

      const opening = nearbyNames.length
        ? `A residential setting with everyday stops nearby, including ${nearbyNames.join(", ")}.`
        : `A residential setting with green space and everyday services within reach.`;

      wrapLines(opening, regular, 10, 528)
        .slice(0, 2)
        .forEach((line, index) => {
          page.drawText(line, {
            x: 42,
            y: 650 - index * 14,
            size: 10,
            font: regular,
            color: muted,
          });
        });

      const mapX = 42;
      const mapY = 348;
      const mapWidth = 528;
      const mapHeight = 254;

      page.drawRectangle({
        x: mapX,
        y: mapY,
        width: mapWidth,
        height: mapHeight,
        color: pale,
      });

      if (neighbourhoodMap) {
        drawFitImage(
          page,
          neighbourhoodMap,
          mapX,
          mapY,
          mapWidth,
          mapHeight,
          pale
        );
      }

      page.drawText("CLOSE TO HOME", {
        x: 42,
        y: 324,
        size: 7.5,
        font: bold,
        color: accent,
      });

      mapAmenities.slice(0, 5).forEach((item, index) => {
        const column = index < 3 ? 0 : 1;
        const row = column === 0 ? index : index - 3;
        const x = 42 + column * 276;
        const y = 300 - row * 23;

        page.drawCircle({
          x: x + 8,
          y: y + 3,
          size: 8,
          color: accent,
        });

        const number = String(index + 1);

        page.drawText(number, {
          x: x + 8 - bold.widthOfTextAtSize(number, 6.5) / 2,
          y: y + 0.5,
          size: 6.5,
          font: bold,
          color: white,
        });

        const place =
          `${printable(item.amenity.name, item.label)}  ` +
          `${item.amenity.distanceKm.toFixed(1)} km`;

        page.drawText(place, {
          x: x + 23,
          y,
          size: 8.2,
          font: regular,
          color: ink,
        });
      });

      page.drawRectangle({
        x: 42,
        y: 170,
        width: 528,
        height: 60,
        color: ink,
      });

      const marketFacts = [
        activeCount ? [String(activeCount), "ACTIVE LISTINGS"] : null,
        medianAsking ? [formatMarketPrice(medianAsking), "MEDIAN ASKING"] : null,
        Number.isFinite(ownership) && ownership > 0
          ? [`${Math.round(ownership)}%`, "OWNER OCCUPIED"]
          : null,
        Number.isFinite(medianAge) && medianAge > 0
          ? [String(Math.round(medianAge)), "MEDIAN AGE"]
          : null,
      ].filter(Boolean) as string[][];

      marketFacts.slice(0, 4).forEach((fact, index) => {
        const x = 62 + index * 128;

        page.drawText(fact[0], {
          x,
          y: 199,
          size: 17,
          font: bold,
          color: white,
        });

        page.drawText(fact[1], {
          x,
          y: 182,
          size: 6.2,
          font: bold,
          color: rgb(0.72, 0.78, 0.8),
        });
      });

      page.drawText("MARKET SNAPSHOT", {
        x: 42,
        y: 142,
        size: 7.8,
        font: bold,
        color: accent,
      });

      const marketStory = activeCount
        ? `${areaLabel} currently has ${activeCount} active listing${activeCount === 1 ? "" : "s"}, with asking prices from ${formatMarketPrice(lowestAsking)} to ${formatMarketPrice(highestAsking)} and a median of ${formatMarketPrice(medianAsking)}${dominantTypes.length ? `. Current options are led by ${dominantTypes.join(" and ")}` : ""}.`
        : `Neighbourhood inventory changes quickly; the live listing provides the latest comparison set for ${areaLabel}.`;

      wrapLines(marketStory, regular, 8.5, 248)
        .slice(0, 5)
        .forEach((line, index) => {
          page.drawText(line, {
            x: 42,
            y: 121 - index * 12,
            size: 8.5,
            font: regular,
            color: ink,
          });
        });

      page.drawText("LOCAL RHYTHM", {
        x: 320,
        y: 142,
        size: 7.8,
        font: bold,
        color: accent,
      });

      const dailyPieces: string[] = [];

      if (nearestGreen) {
        dailyPieces.push(
          `${printable(nearestGreen.amenity.name)} is ${nearestGreen.amenity.distanceKm.toFixed(1)} km away`
        );
      }

      if (nearestSchool) {
        dailyPieces.push(
          `${printable(nearestSchool.amenity.name)} is ${nearestSchool.amenity.distanceKm.toFixed(1)} km away`
        );
      }

      if (nearestShop) {
        dailyPieces.push(
          `${printable(nearestShop.amenity.name)} provides a nearby practical stop`
        );
      } else if (nearestFood) {
        dailyPieces.push(
          `${printable(nearestFood.amenity.name)} adds a nearby coffee or food option`
        );
      }

      const dailyStory = dailyPieces.length
        ? `${dailyPieces.join(". ")}.`
        : `${areaLabel} offers a balanced residential setting with useful amenities close by.`;

      wrapLines(dailyStory, regular, 8.5, 248)
        .slice(0, 5)
        .forEach((line, index) => {
          page.drawText(line, {
            x: 320,
            y: 121 - index * 12,
            size: 8.5,
            font: regular,
            color: ink,
          });
        });

      page.drawText(
        "Amenity distances are approximate. Listing figures are current asking prices, not recorded sales. Census figures use the closest available profile.",
        {
          x: 42,
          y: 42,
          size: 6.2,
          font: regular,
          color: muted,
        }
      );

      addPageNumber(page, 6 + embeddedFloorplans.length);
    }
    // 7. Contact and QR
    {
      const page = pdf.addPage([612, 792]);
      page.drawRectangle({ x: 0, y: 0, width: 612, height: 792, color: ink });
      page.drawRectangle({ x: 0, y: 0, width: 12, height: 792, color: accent });
      page.drawText("YOUR NEXT MOVE", { x: 48, y: 706, size: 10, font: bold, color: accent });
      page.drawText("Experience this property", { x: 48, y: 650, size: 30, font: bold, color: white });
      page.drawText("in person.", { x: 48, y: 614, size: 30, font: bold, color: white });
      // Contained agent contact panel.
      page.drawRectangle({
        x: 36,
        y: 332,
        width: 540,
        height: 218,
        borderColor: accent,
        borderWidth: 1,
      });

      const contactX = 60;

      if (agentPhoto) {
        const size = fit(agentPhoto.width, agentPhoto.height, 210, 190);
        page.drawImage(agentPhoto, {
          x: 342,
          y: 342,
          width: size.width,
          height: size.height,
        });
      } else if (logo) {
        const size = fit(logo.width, logo.height, 150, 100);
        page.drawImage(logo, {
          x: 382,
          y: 402,
          width: size.width,
          height: size.height,
        });
      }

      page.drawText(agentName, { x: contactX, y: 493, size: 19, font: bold, color: white });
      page.drawText(brokerage, { x: contactX, y: 468, size: 11, font: regular, color: white });
      const contactLines = [phone, email, siteName].filter(Boolean);
      contactLines.forEach((line, index) =>
        page.drawText(printable(line), {
          x: contactX,
          y: 432 - index * 21,
          size: 10,
          font: regular,
          color: white,
        })
      );

      page.drawLine({
        start: { x: 36, y: 304 },
        end: { x: 576, y: 304 },
        thickness: 0.5,
        color: rgb(0.76, 0.79, 0.8),
      });

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