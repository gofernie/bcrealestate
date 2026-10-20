// Runs automatically after every successful Netlify deploy: warms the CDN cache.
const BASE = "https://bc.realestate";
const PATHS = [
  "/greater-victoria", "/greater-victoria/areas",
  "/view-royal", "/victoria", "/saanich-east", "/saanich-west", "/oak-bay", "/langford",
  "/fernie", "/fernie/areas", "/nanaimo", "/nanaimo/areas", "/tofino", "/parksville", "/sparwood", "/whistler",
];

export const handler = async () => {
  const started = Date.now();
  const results = await Promise.allSettled(
    PATHS.map(async (path) => {
      const t = Date.now();
      const res = await fetch(BASE + path, { headers: { "user-agent": "cache-warmer" } });
      await res.arrayBuffer();
      return `${res.status} ${Date.now() - t}ms ${path}`;
    })
  );
  const lines = results.map((r) => (r.status === "fulfilled" ? r.value : `ERR ${String(r.reason)}`));
  console.log(`cache warm ${Date.now() - started}ms\n` + lines.join("\n"));
  return { statusCode: 200, body: lines.join("\n") };
};
