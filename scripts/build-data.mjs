import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import xlsx from "xlsx";
import fetch from "node-fetch";
import * as cheerio from "cheerio";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const INPUT_XLSX = path.join(repoRoot, "luxembourg_companies.xlsx");
const OUTPUT_JSON = path.join(repoRoot, "docs", "data.json");

const KEYWORDS = /(job|career|vacanc|opening|position|apply|intern|graduate|stage|talent)/i;
const SALARY_PATTERN = /(€\s?\d+[\d,\.\s]*(?:k|K)?|\d+[\d,\.\s]*\s?€)/;

const readCompanies = () => {
  const workbook = xlsx.readFile(INPUT_XLSX);
  const firstSheet = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheet];
  const rows = xlsx.utils.sheet_to_json(sheet, { defval: "" });

  return rows
    .map((row) => ({
      name: String(row["Company Name"] || "").trim(),
      website: String(row["Website"] || "").trim(),
    }))
    .filter((company) => company.name && company.website);
};

const normalizeUrl = (url) => {
  if (!url) {
    return "";
  }

  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  return `https://${url}`;
};

const domainFromUrl = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const loadPreviousLinks = () => {
  if (!fs.existsSync(OUTPUT_JSON)) {
    return new Set();
  }

  const previous = JSON.parse(fs.readFileSync(OUTPUT_JSON, "utf-8"));
  const links = new Set();
  previous.companies?.forEach((company) => {
    company.jobs?.forEach((job) => links.add(job.url));
  });
  return links;
};

const extractJobs = (baseUrl, html) => {
  const $ = cheerio.load(html);
  const jobs = [];
  const seen = new Set();

  $("a").each((_, anchor) => {
    const href = $(anchor).attr("href");
    const text = $(anchor).text().replace(/\s+/g, " ").trim();

    if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
      return;
    }

    if (!KEYWORDS.test(href) && !KEYWORDS.test(text)) {
      return;
    }

    let absoluteUrl = "";
    try {
      absoluteUrl = new URL(href, baseUrl).toString();
    } catch {
      return;
    }

    if (seen.has(absoluteUrl)) {
      return;
    }

    const salaryMatch = text.match(SALARY_PATTERN);
    jobs.push({
      title: text || absoluteUrl,
      url: absoluteUrl,
      salary: salaryMatch ? salaryMatch[0] : "",
    });
    seen.add(absoluteUrl);
  });

  return jobs.slice(0, 20);
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      return "";
    }
    return await response.text();
  } catch {
    return "";
  } finally {
    clearTimeout(timer);
  }
};

const buildData = async () => {
  const companies = readCompanies();
  const previousLinks = loadPreviousLinks();

  const companyData = [];

  for (const company of companies) {
    const website = normalizeUrl(company.website);
    const html = await fetchWithTimeout(website);
    const jobs = html ? extractJobs(website, html) : [];

    const domain = domainFromUrl(website);

    const jobsWithFlags = jobs.map((job) => ({
      ...job,
      isNew: !previousLinks.has(job.url),
    }));

    companyData.push({
      name: company.name,
      website,
      domain,
      jobs: jobsWithFlags,
      totalJobs: jobsWithFlags.length,
    });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    totalCompanies: companyData.length,
    totalJobs: companyData.reduce((sum, company) => sum + company.totalJobs, 0),
    companies: companyData,
  };

  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
};

await buildData();
