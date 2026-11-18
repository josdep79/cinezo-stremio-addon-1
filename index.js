const { addonBuilder, serveHTTP } = require("stremio-addon-sdk");
const axios = require("axios");
const cheerio = require("cheerio");

const BASE = (process.env.CINEZO_BASE_URL || "https://cinezo.gd").replace(/\/+$/, "");
const PORT = Number(process.env.PORT || 7000);
const ADDON_ID = "community.cinezo.catalog";
const UA = "Mozilla/5.0 (compatible; CinezoStremioCatalog/1.0)";

const manifest = {
  id: ADDON_ID,
  version: "1.0.0",
  name: "Cinezo Catalog",
  description: "Browse Cinezo movie and TV catalogs in Stremio. Opens title pages on Cinezo; does not provide video streams.",
  resources: ["catalog", "meta", "stream"],
  types: ["movie", "series"],
  idPrefixes: ["cinezo:"],
  catalogs: [
    { type: "movie", id: "cinezo-movies", name: "Cinezo Movies" },
    { type: "series", id: "cinezo-series", name: "Cinezo Series" }
  ],
  behaviorHints: { configurable: false, configurationRequired: false }
};

const builder = new addonBuilder(manifest);

function absUrl(href) {
  try { return new URL(href, BASE).href; } catch { return null; }
}

function parseYear(text) {
  const m = String(text || "").match(/\b(19|20)\d{2}\b/);
  return m ? Number(m[0]) : undefined;
}

function cleanTitle(text) {
  return String(text || "")
    .replace(/\bHD\b/gi, "")
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\b(Movie|TV|Series)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function pageForType(type, skip = 0) {
  const page = Math.floor(skip / 20) + 1;
  return `${BASE}/${type === "movie" ? "movies" : "series"}${page > 1 ? `?page=${page}` : ""}`;
}

async function fetchHtml(url) {
  const response = await axios.get(url, {
    timeout: 18000,
    headers: { "User-Agent": UA, "Accept": "text/html,application/xhtml+xml" },
    maxRedirects: 5
  });
  return cheerio.load(response.data);
}

function extractItems($, requestedType) {
  const found = new Map();
  $("a[href]").each((_, element) => {
    const a = $(element);
    const href = a.attr("href") || "";
    const match = href.match(/^\/(movie|tv)\/(\d+)(?:[/?#].*)?$/i);
    if (!match) return;

    const type = match[1].toLowerCase() === "movie" ? "movie" : "series";
    if (type !== requestedType) return;

    const id = match[2];
    const img = a.find("img").first();
    const rawTitle = [
      a.attr("title"),
      img.attr("alt"),
      a.text()
    ].find(v => v && v.trim()) || "";
    const title = cleanTitle(rawTitle);
    if (!title) return;

    const poster = img.attr("data-src") || img.attr("data-lazy-src") ||
      img.attr("src") || img.attr("data-original");
    const year = parseYear(rawTitle) || parseYear(a.text());
    const meta = {
      id: `cinezo:${type}:${id}`,
      type,
      name: title,
      poster: poster ? absUrl(poster) : undefined,
      posterShape: "poster",
      year
    };
    found.set(meta.id, meta);
  });
  return [...found.values()];
}

async function catalog(type, extra = {}) {
  let url;
  if (extra.search) {
    // Cinezo's search form is client-rendered; try its common query route.
    const q = encodeURIComponent(extra.search);
    url = `${BASE}/search?query=${q}`;
  } else {
    url = pageForType(type, Number(extra.skip || 0));
  }
  const $ = await fetchHtml(url);
  let metas = extractItems($, type);

  // If Cinezo changes its search URL, return an empty result rather than
  // silently showing unrelated titles.
  const skip = Math.max(0, Number(extra.skip || 0));
  metas = metas.slice(skip % 20, (skip % 20) + 20);
  return { metas };
}

builder.defineCatalogHandler(async ({ type, id, extra }) => {
  if (id === "cinezo-movies" && type === "movie") return catalog("movie", extra || {});
  if (id === "cinezo-series" && type === "series") return catalog("series", extra || {});
  return { metas: [] };
});

builder.defineMetaHandler(async ({ type, id }) => {
  const match = String(id || "").match(/^cinezo:(movie|series):(\d+)$/);
  if (!match) return { meta: null };

  const cinezoType = match[1] === "movie" ? "movie" : "tv";
  const url = `${BASE}/${cinezoType}/${match[2]}`;
  const $ = await fetchHtml(url);

  const title = $("h1").first().text().trim() || $("meta[property='og:title']").attr("content") || "Cinezo title";
  const poster = $("meta[property='og:image']").attr("content") ||
    $("main img").first().attr("src") || $("img").first().attr("src");
  const description = $("meta[name='description']").attr("content") ||
    $("meta[property='og:description']").attr("content") || "";

  const meta = {
    id,
    type: match[1],
    name: title,
    poster: poster ? absUrl(poster) : undefined,
    description,
    website: url,
    links: [{ name: "Open on Cinezo", category: " เว็บไซต์", url }]
  };
  return { meta };
});

builder.defineStreamHandler(async ({ type, id }) => {
  const match = String(id || "").match(/^cinezo:(movie|series):(\d+)$/);
  if (!match) return { streams: [] };
  const pathType = match[1] === "movie" ? "movie" : "tv";
  const url = `${BASE}/${pathType}/${match[2]}`;
  return {
    streams: [{
      name: "Open on Cinezo",
      title: "Open Cinezo page in browser",
      externalUrl: url
    }]
  };
});

const addonInterface = builder.getInterface();
serveHTTP(addonInterface, { port: PORT });
console.log(`Cinezo Catalog add-on listening on port ${PORT}`);
console.log(`Manifest: http://localhost:${PORT}/manifest.json`);
