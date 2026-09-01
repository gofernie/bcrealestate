import type { APIRoute } from "astro";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import QRCode from "qrcode";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const clean = (value: unknown, fallback = "") =>
  String(value ?? fallback).trim();

const first = (row: Record<string, any> | null, names: string[], fallback = "") => {
  for (const name of names) {
    const value = clean(row?.[name]);
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

const fetchBytes = async (url: string) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
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

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const floorplans = Array.from(
      new Set((Array.isArray(body?.floorplans) ? body.floorplans : []).map(safeUrl).filter(Boolean))
    ) as string[];

    if (!floorplans.length) {
      return new Response(JSON.stringify({ error: "No floorplans were supplied." }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const siteId = clean(body?.siteId);
    const city = clean(body?.city).toLowerCase();
    let siteRow: Record<string, any> | null = null;

    if (import.meta.env.PUBLIC_SUPABASE_URL && import.meta.env.SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(
        import.meta.env.PUBLIC_SUPABASE_URL,
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY
      );
      let query = supabase.from("sites").select("*").limit(1);
      query = siteId ? query.eq("id", siteId) : query.eq("city", city);
      const { data } = await query.maybeSingle();
      siteRow = data || null;
    }

    const accentHex = first(siteRow, ["accent_color", "brand_color"], "#167d4f");
    const accentMatch = accentHex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    const accent = accentMatch
      ? rgb(
          parseInt(accentMatch[1], 16) / 255,
          parseInt(accentMatch[2], 16) / 255,
          parseInt(accentMatch[3], 16) / 255
        )
      : rgb(0.086, 0.49, 0.31);

    const agentName = first(siteRow, ["agent_name", "realtor_name", "owner_name"], "Chris Crump");
    const brokerage = first(siteRow, ["brokerage", "brokerage_name", "company_name"], "eXp Realty");
    const phone = first(siteRow, ["agent_phone", "phone", "contact_phone"]);
    const email = first(siteRow, ["agent_email", "email", "contact_email"]);
    const agentPhotoUrl = safeUrl(first(siteRow, ["agent_photo", "agent_photo_url", "headshot", "headshot_url"]));
    const logoUrl = safeUrl(first(siteRow, ["brand_logo", "brand_logo_url", "logo", "logo_url"]));
    const siteName = first(siteRow, ["site_name"], city ? `${city} real estate` : "BC Real Estate");

    const address = clean(body?.address, "Property floorplan");
    const price = clean(body?.price);
    const beds = clean(body?.beds);
    const baths = clean(body?.baths);
    const sqft = clean(body?.sqft);
    const mls = clean(body?.mls);
    const listingUrl = safeUrl(body?.listingUrl);

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const qrDataUrl = await QRCode.toDataURL(listingUrl || request.headers.get("origin") || "https://bc.realestate", {
      width: 360,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#102333", light: "#FFFFFF" },
    });
    const qr = await pdf.embedPng(qrDataUrl);

    let agentPhoto: any = null;
    let logo: any = null;
    try { if (agentPhotoUrl) agentPhoto = await embedRaster(pdf, agentPhotoUrl); } catch {}
    try { if (logoUrl) logo = await embedRaster(pdf, logoUrl); } catch {}

    for (let index = 0; index < floorplans.length; index += 1) {
      const floorplan = await embedRaster(pdf, floorplans[index]);
      const page = pdf.addPage([792, 612]); // US Letter landscape, 72 points/inch
      const { width, height } = page.getSize();
      const margin = 25;
      const headerHeight = 67;
      const footerHeight = 82;
      const imageTop = height - margin - headerHeight;
      const imageBottom = margin + footerHeight;
      const availableHeight = imageTop - imageBottom;
      const availableWidth = width - margin * 2;
      const imageSize = fit(floorplan.width, floorplan.height, availableWidth, availableHeight);

      page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });
      page.drawRectangle({ x: 0, y: height - 7, width, height: 7, color: accent });
      page.drawText(address, { x: margin, y: height - 39, size: 21, font: bold, color: rgb(0.055, 0.13, 0.19) });
      const details = [price, beds && `${beds} bed`, baths && `${baths} bath`, sqft && `${sqft} sq ft`, mls && `MLS ${mls}`]
        .filter(Boolean)
        .join("  |  ");
      page.drawText(details, { x: margin, y: height - 58, size: 10.5, font: regular, color: rgb(0.26, 0.32, 0.36) });
      if (floorplans.length > 1) {
        const label = `Floorplan ${index + 1} of ${floorplans.length}`;
        page.drawText(label, { x: width - margin - bold.widthOfTextAtSize(label, 10), y: height - 40, size: 10, font: bold, color: accent });
      }

      page.drawImage(floorplan, {
        x: (width - imageSize.width) / 2,
        y: imageBottom + (availableHeight - imageSize.height) / 2,
        width: imageSize.width,
        height: imageSize.height,
      });

      page.drawLine({ start: { x: margin, y: 92 }, end: { x: width - margin, y: 92 }, thickness: 0.7, color: rgb(0.82, 0.85, 0.86) });
      let brandX = margin;
      if (agentPhoto) {
        const photoSize = fit(agentPhoto.width, agentPhoto.height, 48, 48);
        page.drawImage(agentPhoto, { x: margin, y: 31, width: photoSize.width, height: photoSize.height });
        brandX = margin + 58;
      } else if (logo) {
        const logoSize = fit(logo.width, logo.height, 78, 43);
        page.drawImage(logo, { x: margin, y: 33, width: logoSize.width, height: logoSize.height });
        brandX = margin + 88;
      }
      page.drawText(agentName, { x: brandX, y: 66, size: 12, font: bold, color: rgb(0.055, 0.13, 0.19) });
      page.drawText(brokerage, { x: brandX, y: 51, size: 9.5, font: regular, color: rgb(0.28, 0.33, 0.36) });
      const contact = [phone, email].filter(Boolean).join("  |  ") || siteName;
      page.drawText(contact, { x: brandX, y: 36, size: 8.5, font: regular, color: rgb(0.28, 0.33, 0.36) });

      page.drawImage(qr, { x: width - margin - 58, y: 26, width: 58, height: 58 });
      const qrLabel = "SCAN FOR LISTING";
      page.drawText(qrLabel, {
        x: width - margin - 68 - bold.widthOfTextAtSize(qrLabel, 8),
        y: 55,
        size: 8,
        font: bold,
        color: accent,
      });
      page.drawText("Photos, details and current status", {
        x: width - margin - 68 - regular.widthOfTextAtSize("Photos, details and current status", 7.5),
        y: 41,
        size: 7.5,
        font: regular,
        color: rgb(0.35, 0.39, 0.41),
      });
    }

    pdf.setTitle(`${address} floorplans`);
    pdf.setAuthor(`${agentName} - ${brokerage}`);
    pdf.setSubject("Property floorplans");
    const bytes = await pdf.save();
    const slug = address.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "property";

    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${slug}-floorplans.pdf"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    console.error("floorplan PDF failed:", error);
    return new Response(JSON.stringify({ error: error?.message || "Could not create the floorplan PDF." }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};