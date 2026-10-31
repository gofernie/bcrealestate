import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const WRITE = process.argv.includes("--write");
const MIN = Number((process.argv.find((a) => a.startsWith("--min=")) || "--min=2048").slice(6));
const FILES = ["src/pages/[city]/index.astro", "src/pages/[city]/[slug].astro"];
const OUT_DIR = "public/js/inline";
const SKIP_ATTR = /\bsrc\s*=|set:html|define:vars|application\/json|ld\+json|text\/template|text\/html/i;

if (WRITE) fs.mkdirSync(OUT_DIR, { recursive: true });
let grandMoved = 0, grandBytes = 0;

for (const file of FILES) {
  const src = fs.readFileSync(file, "utf8");
  const fm = src.match(/^\uFEFF?---\r?\n[\s\S]*?\r?\n---\r?\n/);
  const head = fm ? fm[0] : "";
  const base = path.basename(file, ".astro").replace(/[^a-z0-9]/gi, "") + "-" + path.basename(path.dirname(file)).replace(/[^a-z0-9]/gi, "");
  let moved = 0, bytes = 0, kept = 0, keptBytes = 0, skipped = 0;

  const body = src.slice(head.length).replace(/<script(\s[^>]*)?>([\s\S]*?)<\/script>/g, (whole, attrs = "", code) => {
    if (!/\bis:inline\b/.test(attrs)) return whole;
    if (SKIP_ATTR.test(attrs) || /<script/i.test(code)) { skipped++; return whole; }
    const size = Buffer.byteLength(code, "utf8");
    if (size < MIN || !code.trim()) { kept++; keptBytes += size; return whole; }
    const hash = crypto.createHash("sha1").update(code).digest("hex").slice(0, 10);
    const name = `${base}-${hash}.js`;
    if (WRITE) fs.writeFileSync(path.join(OUT_DIR, name), code, "utf8");
    moved++; bytes += size;
    return `<script${attrs} src="/js/inline/${name}"></script>`;
  });

  console.log(`${file}\n  move:  ${moved} scripts, ${(bytes / 1024).toFixed(0)} KB\n  keep:  ${kept} small scripts, ${(keptBytes / 1024).toFixed(0)} KB\n  skip:  ${skipped} (define:vars/set:html/json/etc)`);
  grandMoved += moved; grandBytes += bytes;

  if (WRITE && moved) {
    fs.writeFileSync(file + ".bak", src, "utf8");
    fs.writeFileSync(file, head + body, "utf8");
  }
}
console.log(`\nTotal: ${grandMoved} scripts, ${(grandBytes / 1024).toFixed(0)} KB ${WRITE ? "moved (backups: *.astro.bak)" : "would move. Dry run - add --write"}`);
