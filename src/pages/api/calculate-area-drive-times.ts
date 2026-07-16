import type { APIRoute } from "astro";
import { createClient } from "@supabase/supabase-js";

export const prerender = false;

const supabase = createClient(
  import.meta.env.PUBLIC_SUPABASE_URL,
  import.meta.env.SUPABASE_SERVICE_ROLE_KEY
);

const GOOGLE_ROUTES_URL =
  "https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });

const cleanCity = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase();

const validCoordinate = (value: unknown) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseDurationSeconds = (value: unknown) => {
  const match = String(value || "").match(/^([\d.]+)s$/);

  if (!match) {
    return null;
  }

  const seconds = Number(match[1]);

  return Number.isFinite(seconds) ? Math.round(seconds) : null;
};

const formatDuration = (seconds: number | null) => {
  if (seconds === null) {
    return null;
  }

  const minutes = Math.max(1, Math.round(seconds / 60));

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (!remainingMinutes) {
    return `${hours} hr`;
  }

  return `${hours} hr ${remainingMinutes} min`;
};

const formatDistance = (metres: number | null) => {
  if (metres === null) {
    return null;
  }

  if (metres < 1000) {
    return `${Math.round(metres)} m`;
  }

  const kilometres = metres / 1000;

  return `${kilometres.toFixed(kilometres < 10 ? 1 : 0)} km`;
};

type MatrixElement = {
  originIndex?: number;
  destinationIndex?: number;
  status?: {
    code?: number;
    message?: string;
  };
  condition?: string;
  distanceMeters?: number;
  duration?: string;
};

export const POST: APIRoute = async ({ request }) => {
  try {
    const authorization = request.headers.get("authorization");
    const expectedSecret = import.meta.env.CRON_SECRET;

    if (
      expectedSecret &&
      authorization !== `Bearer ${expectedSecret}`
    ) {
      return json(
        {
          ok: false,
          error: "Unauthorized.",
        },
        401
      );
    }

    const body = await request.json().catch(() => ({}));
    const city = cleanCity(body.city);

    if (!city) {
      return json(
        {
          ok: false,
          error: "A city is required.",
        },
        400
      );
    }

    const apiKey =
  import.meta.env.GOOGLE_MAPS_API_KEY ||
  import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY;

    if (!apiKey) {
      return json(
        {
          ok: false,
          error:
  "GOOGLE_MAPS_API_KEY or PUBLIC_GOOGLE_MAPS_API_KEY is not configured.",
        },
        500
      );
    }

    const { data: areas = [], error: areasError } =
      await supabase
        .from("area_boundaries")
        .select("id, city, area_name, area_slug, center_lat, center_lng")
        .ilike("city", city)
        .not("center_lat", "is", null)
        .not("center_lng", "is", null)
        .order("area_name", { ascending: true });

    if (areasError) {
      return json(
        {
          ok: false,
          error: areasError.message,
        },
        500
      );
    }

    const { data: destinations = [], error: destinationsError } =
      await supabase
        .from("city_destinations")
        .select(
          "id, city, name, category, icon, latitude, longitude, sort_order"
        )
        .ilike("city", city)
        .eq("is_active", true)
        .eq("travel_mode", "drive")
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });

    if (destinationsError) {
      return json(
        {
          ok: false,
          error: destinationsError.message,
        },
        500
      );
    }

    const validAreas = areas.filter(
      (area) =>
        validCoordinate(area.center_lat) !== null &&
        validCoordinate(area.center_lng) !== null
    );

    const validDestinations = destinations.filter(
      (destination) =>
        validCoordinate(destination.latitude) !== null &&
        validCoordinate(destination.longitude) !== null
    );

    if (!validAreas.length) {
      return json(
        {
          ok: false,
          error: `No area centre coordinates were found for ${city}.`,
        },
        400
      );
    }

    if (!validDestinations.length) {
      return json(
        {
          ok: false,
          error: `No active drive destinations were found for ${city}.`,
        },
        400
      );
    }

    /*
     * Compute Route Matrix has an element limit.
     * One origin × every destination is a small, predictable batch.
     */
    const savedRows: Array<Record<string, unknown>> = [];
    const failedRows: Array<Record<string, unknown>> = [];

    for (const area of validAreas) {
      const originLatitude = validCoordinate(area.center_lat);
      const originLongitude = validCoordinate(area.center_lng);

      if (
        originLatitude === null ||
        originLongitude === null
      ) {
        continue;
      }

      const requestBody = {
        origins: [
          {
            waypoint: {
              location: {
                latLng: {
                  latitude: originLatitude,
                  longitude: originLongitude,
                },
              },
            },
          },
        ],

        destinations: validDestinations.map((destination) => ({
          waypoint: {
            location: {
              latLng: {
                latitude: Number(destination.latitude),
                longitude: Number(destination.longitude),
              },
            },
          },
        })),

        travelMode: "DRIVE",
        routingPreference: "TRAFFIC_UNAWARE",
      };

      const googleResponse = await fetch(GOOGLE_ROUTES_URL, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": apiKey,
          "x-goog-fieldmask":
            "originIndex,destinationIndex,status,condition,distanceMeters,duration",
        },
        body: JSON.stringify(requestBody),
      });

      const responseText = await googleResponse.text();

      if (!googleResponse.ok) {
        failedRows.push({
          area: area.area_name,
          status: googleResponse.status,
          error: responseText,
        });

        continue;
      }

      let elements: MatrixElement[];

      try {
        elements = JSON.parse(responseText);
      } catch {
        failedRows.push({
          area: area.area_name,
          error: "Google returned invalid JSON.",
          response: responseText,
        });

        continue;
      }

      if (!Array.isArray(elements)) {
        failedRows.push({
          area: area.area_name,
          error: "Google did not return a route matrix array.",
          response: elements,
        });

        continue;
      }

      const rows = elements
        .map((element) => {
          const destinationIndex = Number(
            element.destinationIndex
          );

          const destination =
            validDestinations[destinationIndex];

          if (!destination) {
            return null;
          }

          const successful =
            (!element.status ||
              element.status.code === undefined ||
              element.status.code === 0) &&
            element.condition !== "ROUTE_NOT_FOUND";

          if (!successful) {
            failedRows.push({
              area: area.area_name,
              destination: destination.name,
              condition: element.condition,
              status: element.status,
            });

            return null;
          }

          const durationSeconds = parseDurationSeconds(
            element.duration
          );

          const distanceMetres = Number.isFinite(
            Number(element.distanceMeters)
          )
            ? Math.round(Number(element.distanceMeters))
            : null;

          return {
            area_boundary_id: area.id,
            destination_id: destination.id,
            duration_seconds: durationSeconds,
            distance_metres: distanceMetres,
            duration_text: formatDuration(durationSeconds),
            distance_text: formatDistance(distanceMetres),
            calculated_at: new Date().toISOString(),
          };
        })
        .filter(
          (
            row
          ): row is {
            area_boundary_id: string;
            destination_id: string;
            duration_seconds: number | null;
            distance_metres: number | null;
            duration_text: string | null;
            distance_text: string | null;
            calculated_at: string;
          } => row !== null
        );

      if (!rows.length) {
        continue;
      }

      const { error: upsertError } = await supabase
        .from("area_drive_times")
        .upsert(rows, {
          onConflict: "area_boundary_id,destination_id",
        });

      if (upsertError) {
        failedRows.push({
          area: area.area_name,
          error: upsertError.message,
        });

        continue;
      }

      savedRows.push(
        ...rows.map((row) => ({
          area: area.area_name,
          destination:
            validDestinations.find(
              (destination) =>
                destination.id === row.destination_id
            )?.name || row.destination_id,
          duration: row.duration_text,
          distance: row.distance_text,
        }))
      );
    }

    return json({
      ok: failedRows.length === 0,
      city,
      areasFound: validAreas.length,
      destinationsFound: validDestinations.length,
      routesSaved: savedRows.length,
      failures: failedRows.length,
      saved: savedRows,
      failed: failedRows,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error.",
      },
      500
    );
  }
};