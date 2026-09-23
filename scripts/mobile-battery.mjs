// Mobile battery: checks the finish a client notices on a phone, fold by fold, and writes a
// review sheet with every fold side by side. Usage (site served locally):
//   npm run mobile                         all pages
//   npm run mobile -- /demos/pousada/      one page
// Options: --base http://127.0.0.1:8811  --out test-results/mobile
// Exit code 1 when any check fails, so it can gate a publish.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import puppeteer from "puppeteer-core";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const DEFAULT_PAGES = ["/", "/sobre/", "/demos/cardapio/", "/demos/bar/", "/demos/cafe/", "/demos/fisioterapia/", "/demos/veterinaria/", "/demos/pousada/", "/demos/hotel/", "/demos/barbearia/"];
const PHONES = [
  { name: "320x568", width: 320, height: 568 },
  { name: "360x740", width: 360, height: 740 },
  { name: "375x667", width: 375, height: 667 },
  { name: "390x844", width: 390, height: 844 },
  { name: "430x932", width: 430, height: 932 },
  { name: "deitado-667x375", width: 667, height: 375 },
];
const MAX_FOLDS = 40;
const SETTLE_MS = 250;

function parseArgs(argv) {
  const options = { base: "http://127.0.0.1:8811", out: "test-results/mobile", pages: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") options.base = argv[++i];
    else if (argv[i] === "--out") options.out = argv[++i];
    else options.pages.push(argv[i]);
  }
  if (!options.pages.length) options.pages = DEFAULT_PAGES;
  return options;
}

const slug = (pagePath) => pagePath.replace(/^\/|\/$/g, "").replace(/\//g, "-") || "home";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Runs inside the page. Every check returns plain findings: { check, detail, y }.
function auditInPage() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const findings = [];
  const add = (check, detail, el) => findings.push({ check, detail, y: el ? Math.round(el.getBoundingClientRect().top + window.scrollY) : null });

  const visible = (el) => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    const srOnly = r.width <= 2 || r.height <= 2 || cs.clip.startsWith("rect(0") || /inset\(50%\)/.test(cs.clipPath);
    return cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && r.width > 0 && r.height > 0 && !srOnly;
  };
  const inside = (el, test) => { for (let p = el; p && p !== document.body; p = p.parentElement) if (test(p, getComputedStyle(p))) return true; return false; };
  const inFixed = (el) => inside(el, (_, cs) => cs.position === "fixed");
  const inScroller = (el) => inside(el, (p, cs) => ["auto", "scroll", "hidden", "clip"].includes(cs.overflowX) && p.scrollWidth > p.clientWidth + 1);
  const decorative = (el) => el.closest('[aria-hidden="true"], .leaflet-container, .notice, [data-aviso]');
  const label = (el) => (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().replace(/\s+/g, " ").slice(0, 40);
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");

  const textEls = [...document.querySelectorAll("body *")].filter((el) => ownText(el).length > 1 && visible(el) && !decorative(el));

  // 1. Text glyphs closer than 12 px to the screen edge.
  for (const el of textEls) {
    if (inFixed(el) || inScroller(el)) continue;
    for (const node of [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim())) {
      const range = document.createRange();
      range.selectNodeContents(node);
      const boxes = [...range.getClientRects()].filter((b) => b.width > 0);
      const onScreen = boxes.filter((b) => b.right > 0 && b.left < vw);
      if (onScreen.length < boxes.length) continue;
      const hit = onScreen.find((b) => b.left < 12 || b.right > vw - 12);
      if (hit) { add("borda", `texto a ${Math.round(Math.min(hit.left, vw - hit.right))} px da borda: "${label(el)}"`, el); break; }
    }
  }

  // 2. A single word alone on the last line of a heading.
  for (const h of document.querySelectorAll("h1, h2, h3")) {
    if (!visible(h) || decorative(h)) continue;
    const words = [];
    const walker = document.createTreeWalker(h, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      for (const match of node.textContent.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(node, match.index);
        range.setEnd(node, match.index + match[0].length);
        const box = range.getBoundingClientRect();
        if (box.width) words.push({ word: match[0], top: Math.round(box.top) });
      }
    }
    if (words.length < 3) continue;
    const lines = [...new Set(words.map((w) => w.top))].sort((a, b) => a - b);
    const lastLine = words.filter((w) => Math.abs(w.top - lines[lines.length - 1]) < 4);
    if (lines.length > 1 && lastLine.length === 1 && lastLine[0].word.replace(/[.,!?:;]/g, "").length > 1) add("viuva", `palavra sozinha na última linha do título: "${label(h)}"`, h);
  }

  // 3. Running text too small or too tight to read on a phone.
  for (const el of document.querySelectorAll("p, li, dd, td, blockquote")) {
    if (!visible(el) || decorative(el) || inFixed(el)) continue;
    const text = el.textContent.trim();
    if (text.length < 60) continue;
    const cs = getComputedStyle(el);
    const size = parseFloat(cs.fontSize);
    const lineHeight = cs.lineHeight === "normal" ? size * 1.2 : parseFloat(cs.lineHeight);
    if (size < 15) add("texto-pequeno", `${size}px em texto corrido: "${label(el)}"`, el);
    if (size < 20 && lineHeight / size < 1.35) add("entrelinha", `entrelinha ${(lineHeight / size).toFixed(2)}: "${label(el)}"`, el);
  }

  // 4. Tap targets glued together (less than 8 px apart).
  const targets = [...document.querySelectorAll("a, button, summary, input, select, textarea, [role=button]")]
    .filter((el) => visible(el) && !decorative(el) && !el.closest("p") && !inFixed(el));
  const boxes = targets.map((el) => ({ el, r: el.getBoundingClientRect() }));
  const reported = new Set();
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const dx = Math.max(0, a.r.left - b.r.right, b.r.left - a.r.right);
    const dy = Math.max(0, a.r.top - b.r.bottom, b.r.top - a.r.bottom);
    const gap = Math.max(dx, dy);
    const listRows = dy <= 4 && dx === 0 && a.r.width > vw * 0.6 && b.r.width > vw * 0.6 && a.r.height >= 44 && b.r.height >= 44;
    if (listRows) continue;
    if (gap < 8 && !reported.has(a.el)) { reported.add(a.el); add("toques-colados", `${Math.round(gap)} px entre "${label(a.el)}" e "${label(b.el)}"`, a.el); }
  }

  // 5. Contrast against the real background (skipped over photos and gradients).
  const parse = (c) => { const m = c.match(/[\d.]+/g); return m ? { r: +m[0], g: +m[1], b: +m[2], a: m.length > 3 ? +m[3] : 1 } : null; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
  const backgroundOf = (el) => {
    const layers = [];
    for (let p = el; p; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.backgroundImage !== "none") return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    return layers.reverse().reduce((acc, c) => blend(c, acc), { r: 255, g: 255, b: 255, a: 1 });
  };
  for (const el of textEls) {
    if (el.closest("img, video, picture") || inside(el, (_, cs) => cs.position === "fixed" || cs.position === "sticky")) continue;
    // Text laid over a photo, video or map is judged on the review sheet, not by arithmetic.
    const overMedia = () => {
      el.scrollIntoView({ block: "center", behavior: "instant" });
      const box = el.getBoundingClientRect();
      const under = document.elementsFromPoint(Math.min(vw - 1, Math.max(0, box.left + box.width / 2)), Math.min(vh - 1, Math.max(0, box.top + box.height / 2)));
      return under.some((u) => ["IMG", "VIDEO", "CANVAS", "PICTURE"].includes(u.tagName) || u.closest(".leaflet-container"));
    };
    const bg = backgroundOf(el);
    if (!bg) continue;
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    if (!fg) continue;
    const color = fg.a < 1 ? blend(fg, bg) : fg;
    const [l1, l2] = [lum(color), lum(bg)].sort((a, b) => b - a);
    const ratio = (l1 + 0.05) / (l2 + 0.05);
    const size = parseFloat(cs.fontSize);
    const large = size >= 24 || (size >= 18.66 && Number(cs.fontWeight) >= 700);
    if (ratio < (large ? 3 : 4.5) && !overMedia()) add("contraste", `${ratio.toFixed(2)}:1 em "${label(el)}"`, el);
  }

  // The contrast check scrolls to each suspect; the first-screen checks below need the top again.
  window.scrollTo({ top: 0, behavior: "instant" });

  // 6. Stretched or squashed photos.
  for (const img of document.images) {
    if (!visible(img) || !img.naturalWidth || getComputedStyle(img).objectFit !== "fill") continue;
    const rendered = img.clientWidth / img.clientHeight, natural = img.naturalWidth / img.naturalHeight;
    if (Math.abs(rendered - natural) / natural > 0.03) add("foto-distorcida", `${img.src.split("/").pop().slice(0, 40)}`, img);
  }

  // 7. First screen: headline fully visible, a main action fully visible, no button cut by the fold.
  const h1 = document.querySelector("h1");
  if (h1 && visible(h1)) {
    const r = h1.getBoundingClientRect();
    if (r.top < 0 || r.bottom > vh) add("primeira-dobra", "o título principal não cabe inteiro na primeira tela", h1);
  }
  const actions = [...document.querySelectorAll("a, button")].filter((el) => visible(el) && !inFixed(el) && /whats|agend|reserv|pedi|emerg|convers|chamar|card[aá]pio|marcar/i.test(label(el)));
  const firstScreen = actions.filter((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= vh; });
  const fixedAction = [...document.querySelectorAll("a, button")].some((el) => visible(el) && inFixed(el) && /whats|agend|reserv|emerg|convers/i.test(label(el)) && el.getBoundingClientRect().bottom <= vh);
  if (!firstScreen.length && !fixedAction) add("primeira-dobra", "nenhuma ação principal inteira na primeira tela", null);
  for (const el of document.querySelectorAll("a, button")) {
    if (!visible(el) || inFixed(el)) continue;
    const r = el.getBoundingClientRect();
    if (r.top < vh && r.bottom > vh && r.height > 30) { add("cortado-na-dobra", `botão cortado pela primeira dobra: "${label(el)}"`, el); break; }
  }

  // 8. Big empty gaps between content blocks.
  const painted = [...document.querySelectorAll("body *")].filter((el) => getComputedStyle(el).backgroundImage.includes("url("));
  const media = [...document.querySelectorAll("img, figure, svg, canvas, input, select, video, iframe, .leaflet-container"), ...painted]
    .filter((el) => visible(el) && !inFixed(el) && el.getBoundingClientRect().width > vw * 0.2);
  const content = [...textEls.filter((el) => !inFixed(el)), ...media].map((el) => { const r = el.getBoundingClientRect(); return { top: r.top + window.scrollY, bottom: r.bottom + window.scrollY }; })
    .sort((a, b) => a.top - b.top);
  let reach = content.length ? content[0].bottom : 0;
  for (const block of content) {
    if (block.top - reach > vh * 0.6) add("vazio", `${Math.round(block.top - reach)} px sem conteúdo`, null), findings[findings.length - 1].y = Math.round(reach);
    reach = Math.max(reach, block.bottom);
  }

  // 9. Web fonts declared but not loaded.
  const loaded = new Set([...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replace(/["']/g, "")));
  const declared = new Set([...document.fonts].map((f) => f.family.replace(/["']/g, "")));
  for (const el of document.querySelectorAll("h1, h2, h3, p, button")) {
    if (!visible(el)) continue;
    const family = getComputedStyle(el).fontFamily.split(",")[0].trim().replace(/["']/g, "");
    if (declared.has(family) && !loaded.has(family)) { add("fonte", `"${family}" não carregou`, el); break; }
  }

  // 10. Text cut vertically by a hidden overflow.
  for (const el of textEls) {
    const cs = getComputedStyle(el);
    if (["hidden", "clip"].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 2 && cs.webkitLineClamp === "none") add("texto-cortado", `texto cortado na vertical: "${label(el)}"`, el);
  }

  if (document.documentElement.scrollWidth > vw) add("rolagem-lateral", `${document.documentElement.scrollWidth - vw} px`, null);
  return findings;
}

// Runs inside the page at the very bottom: a fixed bar must not sit over the last content.
function bottomCoverInPage() {
  const vh = window.innerHeight;
  const bars = [...document.querySelectorAll("body *")].filter((el) => {
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    return cs.position === "fixed" && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05 && r.height > 0 && r.height < 200 && r.bottom >= vh - 2 && r.top < vh;
  });
  if (!bars.length) return [];
  const barTop = Math.min(...bars.map((el) => el.getBoundingClientRect().top));
  const last = [...document.querySelectorAll("footer a, footer p, footer span, .credito-autor")].filter((el) => el.getBoundingClientRect().height > 0).pop();
  if (last && last.getBoundingClientRect().bottom > barTop + 2) return [{ check: "barra-fixa", detail: "a barra fixa de baixo cobre o fim da página", y: null }];
  return [];
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += Math.round(window.innerHeight * 0.7)) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, 0);
  });
  await wait(600);
}

async function auditPhone(browser, options, pagePath, phone, outDir) {
  const page = await browser.newPage();
  await page.setViewport({ width: phone.width, height: phone.height, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: "reduce" }]);
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error).slice(0, 120)));
  page.on("response", (response) => { if (response.status() >= 400 && !response.url().includes("favicon")) errors.push(`${response.status()} ${response.url().slice(-50)}`); });
  await page.goto(options.base + pagePath, { waitUntil: "networkidle0", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  await scrollThrough(page);

  const findings = await page.evaluate(auditInPage);
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await wait(SETTLE_MS * 2);
  findings.push(...(await page.evaluate(bottomCoverInPage)));
  for (const error of errors) findings.push({ check: "erro", detail: error, y: null });

  const folds = [];
  const count = Math.min(MAX_FOLDS, Math.ceil(height / phone.height));
  for (let i = 0; i < count; i++) {
    await page.evaluate((y) => window.scrollTo(0, y), i * phone.height);
    await wait(SETTLE_MS);
    const file = `${slug(pagePath)}-${phone.name}-${String(i + 1).padStart(2, "0")}.jpg`;
    await page.screenshot({ path: path.join(outDir, file), type: "jpeg", quality: 72 });
    folds.push(file);
  }
  await page.close();
  return { phone, findings, folds, height };
}

function sheetHtml(pagePath, results) {
  const rows = results.map(({ phone, findings, folds, height }) => `
    <section>
      <h2>${phone.name} <small>${folds.length} dobras, ${height}px, ${findings.length ? `${findings.length} problema(s)` : "sem problemas"}</small></h2>
      ${findings.length ? `<ul>${findings.map((f) => `<li><b>${f.check}</b> ${f.detail.replace(/</g, "&lt;")}${f.y !== null ? ` <i>(y ${f.y}, dobra ${Math.floor(f.y / phone.height) + 1})</i>` : ""}</li>`).join("")}</ul>` : ""}
      <div class="folds">${folds.map((file, i) => `<figure><img src="${file}" width="${phone.width}"><figcaption>${i + 1}</figcaption></figure>`).join("")}</div>
    </section>`).join("");
  return `<!doctype html><meta charset="utf-8"><title>Bateria mobile ${pagePath}</title>
<style>body{font:14px system-ui;margin:24px;background:#f2f2f2;color:#111}h1{margin:0 0 16px}h2{margin:28px 0 8px}small{font-weight:400;color:#666}
ul{background:#fff3f0;border:1px solid #f0c0b0;padding:10px 26px;border-radius:8px}li{margin:3px 0}b{color:#b3261e}
.folds{display:flex;gap:10px;overflow-x:auto;padding-bottom:8px}figure{margin:0;flex:none}img{display:block;height:auto;border-radius:10px;box-shadow:0 2px 10px rgba(0,0,0,.2)}
figcaption{text-align:center;color:#666;font-size:12px;margin-top:4px}</style>
<h1>Bateria mobile: ${pagePath}</h1>${rows}`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(options.out);
  await mkdir(outDir, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new" });
  let failures = 0;
  for (const pagePath of options.pages) {
    const results = [];
    for (const phone of PHONES) results.push(await auditPhone(browser, options, pagePath, phone, outDir));
    const sheet = path.join(outDir, `${slug(pagePath)}.html`);
    await writeFile(sheet, sheetHtml(pagePath, results));
    const total = results.reduce((sum, r) => sum + r.findings.length, 0);
    failures += total;
    console.log(`\n${pagePath}  ${total ? `${total} problema(s)` : "ok"}  (folha: ${path.relative(process.cwd(), sheet)})`);
    for (const { phone, findings } of results) for (const f of findings) console.log(`  ${phone.name.padEnd(16)} ${f.check.padEnd(16)} ${f.detail}`);
  }
  await browser.close();
  process.exit(failures ? 1 : 0);
}

main();
