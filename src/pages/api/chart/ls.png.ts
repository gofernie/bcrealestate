// email-chart v1: PNG line chart for email intel blocks (pure JS, no deps). Data rides in the URL, so each image is a fixed snapshot.
import type { APIRoute } from "astro";
import { deflateSync } from "node:zlib";
export const prerender = false;
const nums = (s: string | null) => String(s || "").split(",").filter((x) => x !== "").slice(0, 24).map((x) => Math.max(0, Math.min(1e5, Number(x) || 0)));
const W = 1016, H = 640, TOP = 20, BOT = 12;
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc = (b: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
  dv.setUint32(0, data.length); out.set([...type].map((ch) => ch.charCodeAt(0)), 4); out.set(data, 8);
  dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
  return out;
}
function encode(px: Uint8ClampedArray) {
  const row = W * 3 + 1, raw = new Uint8Array(H * row);
  for (let y = 0; y < H; y++) raw.set(px.subarray(y * W * 3, (y + 1) * W * 3), y * row + 1);
  const ihdr = new Uint8Array(13), dv = new DataView(ihdr.buffer);
  dv.setUint32(0, W); dv.setUint32(4, H); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", new Uint8Array(deflateSync(raw, { level: 9 }))), chunk("IEND", new Uint8Array(0))];
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
type S = { v: number[]; c: string; w: number; dash?: boolean; dot?: boolean };
function render(series: S[], cols: number) {
  const px = new Uint8ClampedArray(W * H * 3), bg = hex("#faf9f6");
  for (let i = 0; i < W * H; i++) px.set(bg, i * 3);
  const paint = (cov: Float32Array, c: number[]) => { for (let i = 0; i < W * H; i++) { const a = cov[i]; if (a > 0) for (let j = 0; j < 3; j++) px[i * 3 + j] += (c[j] - px[i * 3 + j]) * a; } };
  const max = Math.max(1, ...series.flatMap((s) => s.v.slice(0, cols))) * 1.08;
  const X = (i: number) => ((i + 0.5) * W) / cols, Y = (v: number) => TOP + (1 - v / max) * (H - TOP - BOT);
  const grid = new Float32Array(W * H);
  for (const f of [0, 1 / 3, 2 / 3, 1]) { const y = Math.min(H - 1, Math.round(TOP + f * (H - TOP - BOT))); for (let x = 0; x < W; x++) grid[y * W + x] = 1; }
  paint(grid, hex("#e6e2d8"));
  for (const s of series) {
    const v = s.v.slice(0, cols); if (v.length < 2) continue;
    const cov = new Float32Array(W * H), hw = s.w / 2, pts = v.map((y, i) => [X(i), Y(y)]);
    let run = 0;
    for (let k = 0; k < pts.length - 1; k++) {
      const [x0, y0] = pts[k], [x1, y1] = pts[k + 1], dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1;
      const xa = Math.max(0, Math.floor(Math.min(x0, x1) - hw - 2)), xb = Math.min(W - 1, Math.ceil(Math.max(x0, x1) + hw + 2));
      const ya = Math.max(0, Math.floor(Math.min(y0, y1) - hw - 2)), yb = Math.min(H - 1, Math.ceil(Math.max(y0, y1) + hw + 2));
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
        const qx = x + 0.5, qy = y + 0.5, t = Math.max(0, Math.min(1, ((qx - x0) * dx + (qy - y0) * dy) / (L * L)));
        if (s.dash && (run + t * L) % 24 > 13) continue;
        const a = Math.min(1, hw + 0.5 - Math.hypot(qx - x0 - t * dx, qy - y0 - t * dy));
        if (a > cov[y * W + x]) cov[y * W + x] = a;
      }
      run += L;
    }
    if (s.dot) {
      const [cx, cy] = pts[pts.length - 1], r = s.w * 1.3;
      for (let y = Math.max(0, Math.floor(cy - r - 2)); y <= Math.min(H - 1, Math.ceil(cy + r + 2)); y++) for (let x = Math.max(0, Math.floor(cx - r - 2)); x <= Math.min(W - 1, Math.ceil(cx + r + 2)); x++) {
        const a = Math.min(1, r + 0.5 - Math.hypot(x + 0.5 - cx, y + 0.5 - cy)); if (a > cov[y * W + x]) cov[y * W + x] = a;
      }
    }
    paint(cov, hex(s.c));
  }
  return px;
}
export const GET: APIRoute = async ({ url }) => {
  const q = (k: string) => nums(url.searchParams.get(k));
  const n = q("n"), s = q("s"), cols = Math.max(n.length, s.length);
  if (cols < 2) return new Response("bad data", { status: 400 });
  const png = encode(render([
    { v: q("pn"), c: "#bcc6d3", w: 3, dash: true },
    { v: q("ps"), c: "#e8cfae", w: 3, dash: true },
    { v: n, c: "#2f4a68", w: 5, dot: true },
    { v: s, c: "#c07a35", w: 5, dot: true },
  ], cols));
  return new Response(png, { headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable", "netlify-cdn-cache-control": "public, durable, max-age=31536000, immutable" } });
};
