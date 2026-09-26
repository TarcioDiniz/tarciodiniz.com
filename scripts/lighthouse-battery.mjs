// Lighthouse battery: runs Lighthouse against every page, on mobile and/or desktop, and gates on
// the site's own targets, because PSI only checks one page at a time and does not fail a build.
// Usage:
//   npm run lighthouse                                    all pages, mobile and desktop
//   npm run lighthouse -- --form mobile / /privacidade/    one form, some pages
// Options: --base http://127.0.0.1:8811  --out test-results/lighthouse  --form mobile|desktop|both
//          --runs 1 (with more than one, uses the median score and metrics)
// Exit code 1 when a hard target fails, so it can gate a publish.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import lighthouse, { desktopConfig } from "lighthouse";
import * as chromeLauncher from "chrome-launcher";

const CHROME = process.env.CHROME ?? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const SITE_PAGES = ["/", "/sobre/", "/como-funciona/", "/site-no-google-e-nas-ias/", "/privacidade/"];
const DEMO_PAGES = ["/demos/cardapio/", "/demos/bar/", "/demos/cafe/", "/demos/fisioterapia/", "/demos/veterinaria/", "/demos/pousada/", "/demos/hotel/", "/demos/barbearia/", "/demos/planejados/", "/demos/estetica-automotiva/"];
const A11Y_ONLY_PAGES = ["/404.html"];
const DEFAULT_PAGES = [...SITE_PAGES, ...DEMO_PAGES, ...A11Y_ONLY_PAGES];
const A11Y_ONLY = new Set(A11Y_ONLY_PAGES);

// Demos carry a deliberate noindex, so is-crawlable is the one SEO audit allowed to fail there.
const SEO_EXEMPT_AUDITS = { "is-crawlable": new Set(DEMO_PAGES) };

const CATEGORIES = ["performance", "accessibility", "best-practices", "seo", "agentic-browsing"];
const A11Y_ONLY_CATEGORIES = ["accessibility", "best-practices"];
const FORMS = { mobile: ["mobile"], desktop: ["desktop"], both: ["mobile", "desktop"] };
const AUDIT_FAIL_THRESHOLD = 0.9;

const TARGETS = {
  accessibility: 100,
  bestPractices: 100,
  clsMax: 0.1,
  performanceMobileMin: 90,
  performanceDesktopMin: 95,
  lcpMobileMaxMs: 2500,
  tbtMobileMaxMs: 200,
};

function parseArgs(argv) {
  const options = { base: "http://127.0.0.1:8811", out: "test-results/lighthouse", form: "both", runs: 1, pages: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--base") options.base = argv[++i];
    else if (argv[i] === "--out") options.out = argv[++i];
    else if (argv[i] === "--form") options.form = argv[++i];
    else if (argv[i] === "--runs") options.runs = Number(argv[++i]);
    else options.pages.push(argv[i]);
  }
  if (!options.pages.length) options.pages = DEFAULT_PAGES;
  if (!FORMS[options.form]) throw new Error(`--form invalido: ${options.form} (use mobile, desktop ou both)`);
  return options;
}

const slug = (pagePath) => pagePath.replace(/^\/|\/$/g, "").replace(/\//g, "-").replace(/\.html$/, "") || "home";
const isLocalBase = (base) => /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function categoryScore(lhr, id) {
  const category = lhr.categories[id];
  return category && category.score !== null ? category.score * 100 : null;
}

function metricValue(lhr, id) {
  const audit = lhr.audits[id];
  return audit && audit.numericValue !== undefined ? audit.numericValue : null;
}

// All SEO audits must pass except is-crawlable on a demo, which is noindex on purpose.
function seoPasses(lhr, pagePath) {
  const category = lhr.categories.seo;
  if (!category) return true;
  for (const ref of category.auditRefs) {
    const audit = lhr.audits[ref.id];
    if (!audit || audit.score === null) continue;
    if (ref.id === "is-crawlable" && SEO_EXEMPT_AUDITS["is-crawlable"].has(pagePath)) continue;
    if (audit.score < 1) return false;
  }
  return true;
}

async function runOnce(chrome, url, form) {
  const flags = {
    port: chrome.port,
    onlyCategories: A11Y_ONLY.has(new URL(url).pathname) ? A11Y_ONLY_CATEGORIES : CATEGORIES,
    logLevel: "silent",
  };
  const config = form === "desktop" ? desktopConfig : undefined;
  const result = await lighthouse(url, flags, config);
  return result.lhr;
}

function extractRow(lhr, pagePath, form, a11yOnly) {
  return {
    pagePath,
    form,
    performance: categoryScore(lhr, "performance"),
    accessibility: categoryScore(lhr, "accessibility"),
    bestPractices: categoryScore(lhr, "best-practices"),
    seo: categoryScore(lhr, "seo"),
    agentic: categoryScore(lhr, "agentic-browsing"),
    fcp: metricValue(lhr, "first-contentful-paint"),
    lcp: metricValue(lhr, "largest-contentful-paint"),
    tbt: metricValue(lhr, "total-blocking-time"),
    cls: metricValue(lhr, "cumulative-layout-shift"),
    si: metricValue(lhr, "speed-index"),
    seoPass: a11yOnly ? true : seoPasses(lhr, pagePath),
  };
}

const ROW_FIELDS = ["performance", "accessibility", "bestPractices", "seo", "agentic", "fcp", "lcp", "tbt", "cls", "si"];

function medianRow(rows) {
  const { pagePath, form } = rows[0];
  const out = { pagePath, form };
  for (const key of ROW_FIELDS) {
    const values = rows.map((r) => r[key]).filter((v) => v !== null);
    out[key] = values.length ? median(values) : null;
  }
  out.seoPass = rows.every((r) => r.seoPass);
  return out;
}

// Picks the run closest to the median performance (or accessibility, for a11y-only pages) score
// so the failing-audit detail below the table matches the numbers shown in it.
function representativeRun(runs) {
  if (runs.length === 1) return runs[0];
  const scoreOf = (lhr) => categoryScore(lhr, "performance") ?? categoryScore(lhr, "accessibility") ?? 0;
  return [...runs].sort((a, b) => scoreOf(a) - scoreOf(b))[Math.floor(runs.length / 2)];
}

function primaryItemHint(audit) {
  const item = audit.details?.items?.[0];
  if (!item) return null;
  return item.node?.selector ?? item.url ?? item.source?.url ?? null;
}

function collectFailingAudits(lhr, pagePath, categories) {
  const failing = new Map();
  for (const categoryId of categories) {
    const category = lhr.categories[categoryId];
    if (!category) continue;
    for (const ref of category.auditRefs) {
      const audit = lhr.audits[ref.id];
      if (!audit || audit.score === null || failing.has(ref.id)) continue;
      if (audit.score >= AUDIT_FAIL_THRESHOLD) continue;
      const exempt = SEO_EXEMPT_AUDITS[ref.id]?.has(pagePath) ?? false;
      failing.set(ref.id, { id: ref.id, title: audit.title, score: audit.score, hint: primaryItemHint(audit), exempt });
    }
  }
  return [...failing.values()].filter((f) => !f.exempt);
}

// Perf, LCP and TBT only mean something against production compression and CDN, so a local
// server only warns on them; accessibility, best practices, SEO and CLS always gate.
function evaluateTargets(row, { local, a11yOnly }) {
  const problems = [];
  if (row.accessibility !== null && row.accessibility !== TARGETS.accessibility) problems.push({ key: "accessibility", hard: true });
  if (row.bestPractices !== null && row.bestPractices !== TARGETS.bestPractices) problems.push({ key: "bestPractices", hard: true });
  if (a11yOnly) return problems;
  if (!row.seoPass) problems.push({ key: "seo", hard: true });
  if (row.cls !== null && row.cls >= TARGETS.clsMax) problems.push({ key: "cls", hard: true });
  if (row.form === "mobile") {
    if (row.performance !== null && row.performance < TARGETS.performanceMobileMin) problems.push({ key: "performance", hard: !local });
    if (row.lcp !== null && row.lcp > TARGETS.lcpMobileMaxMs) problems.push({ key: "lcp", hard: !local });
    if (row.tbt !== null && row.tbt > TARGETS.tbtMobileMaxMs) problems.push({ key: "tbt", hard: !local });
  } else if (row.performance !== null && row.performance < TARGETS.performanceDesktopMin) {
    problems.push({ key: "performance", hard: !local });
  }
  return problems;
}

async function auditPage(chrome, options, pagePath, form, local) {
  const a11yOnly = A11Y_ONLY.has(pagePath);
  const runs = [];
  for (let i = 0; i < options.runs; i++) runs.push(await runOnce(chrome, options.base + pagePath, form));

  const row = medianRow(runs.map((lhr) => extractRow(lhr, pagePath, form, a11yOnly)));
  const problems = evaluateTargets(row, { local, a11yOnly });
  row.marks = new Map(problems.map((p) => [p.key, p.hard ? "!" : "~"]));

  const categories = a11yOnly ? A11Y_ONLY_CATEGORIES : CATEGORIES;
  const failedAudits = collectFailingAudits(representativeRun(runs), pagePath, categories);

  return { row, failedAudits, hardFailures: problems.filter((p) => p.hard).length, raw: runs.length === 1 ? runs[0] : runs };
}

const COLUMNS = [
  { key: "pagePath", label: "pagina", width: 30 },
  { key: "form", label: "forma", width: 8 },
  { key: "performance", label: "desemp", width: 8 },
  { key: "accessibility", label: "a11y", width: 6 },
  { key: "bestPractices", label: "prat", width: 6 },
  { key: "seo", label: "seo", width: 6 },
  { key: "agentic", label: "agente", width: 8 },
  { key: "fcp", label: "fcp", width: 8, unit: "ms" },
  { key: "lcp", label: "lcp", width: 8, unit: "ms" },
  { key: "tbt", label: "tbt", width: 8, unit: "ms" },
  { key: "cls", label: "cls", width: 7 },
  { key: "si", label: "si", width: 8, unit: "ms" },
];

function fmtCell(row, col) {
  if (col.key === "pagePath" || col.key === "form") return row[col.key];
  const value = row[col.key];
  if (value === null || value === undefined) return "-";
  const number = col.key === "cls" ? value.toFixed(3) : Math.round(value);
  const mark = row.marks?.get(col.key) ?? "";
  return `${number}${col.unit ?? ""}${mark}`;
}

function tableText(rows) {
  const header = COLUMNS.map((c) => c.label.padEnd(c.width)).join(" ");
  const lines = rows.map((row) => COLUMNS.map((c) => fmtCell(row, c).padEnd(c.width)).join(" "));
  return [header, ...lines, "", "! meta fora do combinado   ~ meta so aviso (servidor local nao comprime)"].join("\n");
}

function resumoMd(rows, failuresByRow, options, local) {
  const header = `| ${COLUMNS.map((c) => c.label).join(" | ")} |`;
  const sep = `|${COLUMNS.map(() => "---").join("|")}|`;
  const body = rows.map((row) => `| ${COLUMNS.map((c) => fmtCell(row, c)).join(" | ")} |`).join("\n");
  const detail = failuresByRow
    .filter(({ failedAudits }) => failedAudits.length)
    .map(({ row, failedAudits }) => {
      const items = failedAudits.map((f) => `- ${f.title} (${f.score.toFixed(2)})${f.hint ? `: \`${f.hint}\`` : ""}`).join("\n");
      return `### ${row.pagePath} (${row.form})\n\n${items}`;
    })
    .join("\n\n");
  return `# Bateria Lighthouse\n\nBase: ${options.base}${local ? " (servidor local, desempenho so aviso)" : ""}\nData: ${new Date().toISOString()}\n\n${header}\n${sep}\n${body}\n\n## Auditorias abaixo de 0,9\n\n${detail || "Nenhuma."}\n`;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const outDir = path.resolve(options.out);
  await mkdir(outDir, { recursive: true });
  const local = isLocalBase(options.base);
  const forms = FORMS[options.form];

  const chrome = await chromeLauncher.launch({ chromePath: CHROME, chromeFlags: ["--headless=new"] });
  const results = [];
  try {
    for (const pagePath of options.pages) {
      for (const form of forms) {
        const result = await auditPage(chrome, options, pagePath, form, local);
        results.push(result);
        await writeFile(path.join(outDir, `${slug(pagePath)}-${form}.json`), JSON.stringify(result.raw, null, 2));
        console.log(`${pagePath}  ${form}  ${result.hardFailures ? `${result.hardFailures} meta(s) fora` : "ok"}`);
      }
    }
  } finally {
    await chrome.kill();
  }

  const rows = results.map((r) => r.row);
  console.log(`\n${tableText(rows)}`);
  for (const { row, failedAudits } of results) {
    if (!failedAudits.length) continue;
    console.log(`\n${row.pagePath} (${row.form}):`);
    for (const f of failedAudits) console.log(`  ${f.title} (${f.score.toFixed(2)})${f.hint ? `  ${f.hint}` : ""}`);
  }

  await writeFile(path.join(outDir, "resumo.md"), resumoMd(rows, results, options, local));
  const hardFailures = results.reduce((sum, r) => sum + r.hardFailures, 0);
  process.exit(hardFailures ? 1 : 0);
}

main();
