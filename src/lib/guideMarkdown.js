function escHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function mdInline(s) {
  let t = escHtml(s);
  t = t.replace(/`([^`]+)`/g, "<code>$1</code>");
  t = t.replace(/\[([^\]]+)\]\(((?:https?:\/\/|\/)[^\s)]*)\)/g, '<a href="$2">$1</a>');
  t = t.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  t = t.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, "$1<em>$2</em>");
  return t;
}
export function renderGuideMd(src) {
  const lines = String(src || "").replace(/\r\n?/g, "\n").split("\n");
  const out = [];
  const isTable = (l) => /^\s*\|/.test(l);
  const isUl = (l) => /^\s*[-*]\s+/.test(l);
  const isOl = (l) => /^\s*\d+[.)]\s+/.test(l);
  const isHead = (l) => /^#{2,4}\s+/.test(l);
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (isHead(line)) {
      const m = line.match(/^(#{2,4})\s+(.*)$/);
      const lvl = Math.min(m[1].length + 1, 4);
      out.push(`<h${lvl}>${mdInline(m[2].trim())}</h${lvl}>`);
      i++; continue;
    }
    if (isTable(line)) {
      const rows = [];
      while (i < lines.length && isTable(lines[i])) { rows.push(lines[i]); i++; }
      const cells = (r) => r.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
      const data = rows.filter((r) => !/^[\s|:-]+$/.test(r));
      if (!data.length) continue;
      const head = cells(data[0]).map((c) => `<th>${mdInline(c)}</th>`).join("");
      const body = data.slice(1).map((r) => `<tr>${cells(r).map((c) => `<td>${mdInline(c)}</td>`).join("")}</tr>`).join("");
      out.push(`<div class="guide-table"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`);
      continue;
    }
    if (isUl(line) || isOl(line)) {
      const ordered = isOl(line);
      const test = ordered ? isOl : isUl;
      const items = [];
      while (i < lines.length && test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\s*\d+[.)]\s+/ : /^\s*[-*]\s+/, ""));
        i++;
      }
      const tag = ordered ? "ol" : "ul";
      out.push(`<${tag}>${items.map((it) => `<li>${mdInline(it)}</li>`).join("")}</${tag}>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !isHead(lines[i]) && !isTable(lines[i]) && !isUl(lines[i]) && !isOl(lines[i])) {
      para.push(mdInline(lines[i].trim()));
      i++;
    }
    out.push(`<p>${para.join("<br>")}</p>`);
  }
  return out.join("\n");
}