// Free, no-API-key knowledge tools: Wikipedia, arXiv, GitHub, Reddit, StackOverflow, GDELT News, YouTube transcript
// Each handler takes args and returns a string suitable to feed back to the model.

export const EXTRA_TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "WIKIPEDIA",
      description: "Look up a topic on Wikipedia and return a concise summary. Best for definitions, history, biographies, concepts.",
      parameters: { type: "object", properties: { query: { type: "string" }, lang: { type: "string", description: "Language code (en, ar, fr...). Default: en" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "ARXIV",
      description: "Search recent academic papers on arXiv. Best for scientific research, ML/AI papers, physics, math.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", default: 5 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "GITHUB_SEARCH",
      description: "Search GitHub for repositories or code. Best for finding open-source libraries, code examples, projects.",
      parameters: { type: "object", properties: { query: { type: "string" }, type: { type: "string", enum: ["repositories", "code"], default: "repositories" }, limit: { type: "number", default: 5 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "REDDIT_SEARCH",
      description: "Search Reddit for discussions, opinions, recent community posts.",
      parameters: { type: "object", properties: { query: { type: "string" }, subreddit: { type: "string", description: "Optional subreddit name" }, limit: { type: "number", default: 5 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "STACKOVERFLOW",
      description: "Search Stack Overflow for programming questions and accepted answers.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", default: 5 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "NEWS_SEARCH",
      description: "Search recent global news (last 72h) via GDELT. Best for current events, breaking news.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", default: 8 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "MATH_SOLVER",
      description: "Evaluate a math expression or solve an equation. Use for arithmetic, algebra, calculus expressions.",
      parameters: { type: "object", properties: { expression: { type: "string", description: "e.g. '2+2', 'sqrt(16)+5', '(3*4)/2'" } }, required: ["expression"] },
    },
  },
  {
    type: "function",
    function: {
      name: "YOUTUBE_TRANSCRIPT",
      description: "Get the full transcript of a YouTube video. Use when user shares a YouTube URL or asks about video content.",
      parameters: { type: "object", properties: { url: { type: "string", description: "YouTube video URL or ID" }, lang: { type: "string", default: "en" } }, required: ["url"] },
    },
  },
  {
    type: "function",
    function: {
      name: "GOOGLE_SCHOLAR",
      description: "Search Google Scholar for academic papers and citations. Best for peer-reviewed research, scholarly articles.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", default: 5 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "HACKERNEWS",
      description: "Search Hacker News for tech industry discussions, startup news, programming debates.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", default: 5 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "DUCKDUCKGO_INSTANT",
      description: "Quick instant-answer lookup (definitions, calculations, simple facts) via DuckDuckGo. No API key.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "URL_FETCH",
      description: "Fetch and extract readable text content from any public URL. Use to read articles, docs, blog posts.",
      parameters: { type: "object", properties: { url: { type: "string" }, max_chars: { type: "number", default: 4000 } }, required: ["url"] },
    },
  },
  {
    type: "function",
    function: {
      name: "OPEN_LIBRARY",
      description: "Search Open Library for books (title, author, year, subjects). No API key.",
      parameters: { type: "object", properties: { query: { type: "string" }, limit: { type: "number", default: 5 } }, required: ["query"] },
    },
  },
  {
    type: "function",
    function: {
      name: "WORLD_BANK",
      description: "Fetch World Bank statistics for a country (GDP, population, etc). Use for economic/demographic data.",
      parameters: { type: "object", properties: { country: { type: "string", description: "ISO country code, e.g. EG, US" }, indicator: { type: "string", description: "e.g. NY.GDP.MKTP.CD (GDP), SP.POP.TOTL (population)" } }, required: ["country", "indicator"] },
    },
  },
  {
    type: "function",
    function: {
      name: "CURRENCY_CONVERT",
      description: "Convert between currencies using live exchange rates.",
      parameters: { type: "object", properties: { from: { type: "string" }, to: { type: "string" }, amount: { type: "number", default: 1 } }, required: ["from", "to"] },
    },
  },
  {
    type: "function",
    function: {
      name: "WEATHER",
      description: "Current weather and 3-day forecast for a city. Free, no API key.",
      parameters: { type: "object", properties: { location: { type: "string" } }, required: ["location"] },
    },
  },
];

export async function execExtraTool(name: string, args: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case "WIKIPEDIA": return await wikipediaSummary(args.query, args.lang || "en");
      case "ARXIV": return await arxivSearch(args.query, args.limit || 5);
      case "GITHUB_SEARCH": return await githubSearch(args.query, args.type || "repositories", args.limit || 5);
      case "REDDIT_SEARCH": return await redditSearch(args.query, args.subreddit, args.limit || 5);
      case "STACKOVERFLOW": return await stackOverflowSearch(args.query, args.limit || 5);
      case "NEWS_SEARCH": return await gdeltNews(args.query, args.limit || 8);
      case "MATH_SOLVER": return mathSolve(args.expression);
      case "YOUTUBE_TRANSCRIPT": return await youtubeTranscript(args.url, args.lang || "en");
      case "GOOGLE_SCHOLAR": return await googleScholar(args.query, args.limit || 5);
      case "HACKERNEWS": return await hackerNews(args.query, args.limit || 5);
      case "DUCKDUCKGO_INSTANT": return await ddgInstant(args.query);
      case "URL_FETCH": return await urlFetch(args.url, args.max_chars || 4000);
      case "OPEN_LIBRARY": return await openLibrary(args.query, args.limit || 5);
      case "WORLD_BANK": return await worldBank(args.country, args.indicator);
      case "CURRENCY_CONVERT": return await currencyConvert(args.from, args.to, args.amount || 1);
      case "WEATHER": return await weather(args.location);
      default: return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: (e as Error).message });
  }
}

async function wikipediaSummary(query: string, lang: string): Promise<string> {
  const searchUrl = `https://${lang}.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json&origin=*`;
  const sr = await fetch(searchUrl).then((r) => r.json());
  const title = sr?.[1]?.[0];
  if (!title) return JSON.stringify({ error: "No results" });
  const sumUrl = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
  const data = await fetch(sumUrl).then((r) => r.json());
  return JSON.stringify({
    title: data.title,
    extract: data.extract,
    url: data.content_urls?.desktop?.page,
    thumbnail: data.thumbnail?.source,
  });
}

async function arxivSearch(query: string, limit: number): Promise<string> {
  const url = `http://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&max_results=${limit}&sortBy=submittedDate&sortOrder=descending`;
  const xml = await fetch(url).then((r) => r.text());
  const entries = xml.split("<entry>").slice(1, limit + 1).map((entry) => {
    const m = (re: RegExp) => entry.match(re)?.[1]?.trim() ?? "";
    return {
      title: m(/<title>([\s\S]*?)<\/title>/)?.replace(/\s+/g, " "),
      summary: m(/<summary>([\s\S]*?)<\/summary>/)?.replace(/\s+/g, " ").slice(0, 400),
      published: m(/<published>([\s\S]*?)<\/published>/),
      url: m(/<id>([\s\S]*?)<\/id>/),
    };
  });
  return JSON.stringify({ results: entries });
}

async function githubSearch(query: string, type: string, limit: number): Promise<string> {
  const url = `https://api.github.com/search/${type}?q=${encodeURIComponent(query)}&per_page=${limit}`;
  const data = await fetch(url, { headers: { Accept: "application/vnd.github+json" } }).then((r) => r.json());
  const items = (data.items || []).slice(0, limit).map((it: any) => ({
    name: it.full_name || it.name,
    description: it.description,
    stars: it.stargazers_count,
    language: it.language,
    url: it.html_url,
  }));
  return JSON.stringify({ results: items });
}

async function redditSearch(query: string, subreddit: string | undefined, limit: number): Promise<string> {
  const base = subreddit ? `https://www.reddit.com/r/${subreddit}/search.json` : "https://www.reddit.com/search.json";
  const url = `${base}?q=${encodeURIComponent(query)}&limit=${limit}&sort=relevance${subreddit ? "&restrict_sr=1" : ""}`;
  const data = await fetch(url, { headers: { "User-Agent": "MegsyBot/1.0" } }).then((r) => r.json());
  const posts = (data.data?.children || []).map((c: any) => ({
    title: c.data.title,
    subreddit: c.data.subreddit,
    score: c.data.score,
    comments: c.data.num_comments,
    url: `https://reddit.com${c.data.permalink}`,
    text: (c.data.selftext || "").slice(0, 300),
  }));
  return JSON.stringify({ results: posts });
}

async function stackOverflowSearch(query: string, limit: number): Promise<string> {
  const url = `https://api.stackexchange.com/2.3/search/advanced?order=desc&sort=relevance&q=${encodeURIComponent(query)}&site=stackoverflow&pagesize=${limit}&filter=!nKzQURFm9X`;
  const data = await fetch(url).then((r) => r.json());
  const items = (data.items || []).map((it: any) => ({
    title: it.title,
    is_answered: it.is_answered,
    score: it.score,
    answer_count: it.answer_count,
    tags: it.tags,
    url: it.link,
    excerpt: (it.body_markdown || "").slice(0, 300),
  }));
  return JSON.stringify({ results: items });
}

async function gdeltNews(query: string, limit: number): Promise<string> {
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(query)}&mode=ArtList&maxrecords=${limit}&format=json&sort=DateDesc`;
  const data = await fetch(url).then((r) => r.json()).catch(() => ({ articles: [] }));
  const articles = (data.articles || []).map((a: any) => ({
    title: a.title,
    url: a.url,
    domain: a.domain,
    seendate: a.seendate,
    socialimage: a.socialimage,
  }));
  return JSON.stringify({ results: articles });
}

function mathSolve(expression: string): string {
  // Safe-ish evaluator using Function with whitelisted Math
  const safe = expression.replace(/[^0-9+\-*/().,\s%^a-zA-Z]/g, "");
  // map ^ to **, allow Math.* helpers
  const transformed = safe.replace(/\^/g, "**").replace(/\b(sqrt|sin|cos|tan|log|abs|floor|ceil|round|min|max|pow|exp|PI|E)\b/g, "Math.$1");
  try {
    const result = Function('"use strict"; return (' + transformed + ');')();
    return JSON.stringify({ expression, result });
  } catch (e) {
    return JSON.stringify({ error: "Could not evaluate", expression });
  }
}

// ── Phase 3 handlers ──

async function youtubeTranscript(url: string, lang: string): Promise<string> {
  const key = Deno.env.get("SUPADATA_API_KEY") || Deno.env.get("SUPADATA_API_KEY_2") || Deno.env.get("SUPADATA_API_KEY_3");
  if (!key) return JSON.stringify({ error: "transcript service not configured" });
  const api = `https://api.supadata.ai/v1/youtube/transcript?url=${encodeURIComponent(url)}&lang=${lang}&text=true`;
  const r = await fetch(api, { headers: { "x-api-key": key } });
  if (!r.ok) return JSON.stringify({ error: `transcript ${r.status}` });
  const data = await r.json();
  const text = (data?.content || data?.text || "").slice(0, 6000);
  return JSON.stringify({ url, lang: data?.lang || lang, transcript: text });
}

async function googleScholar(query: string, limit: number): Promise<string> {
  const key = Deno.env.get("SERPER_API_KEY");
  if (!key) return JSON.stringify({ error: "scholar service not configured" });
  const r = await fetch("https://google.serper.dev/scholar", {
    method: "POST",
    headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q: query, num: limit }),
  });
  if (!r.ok) return JSON.stringify({ error: `scholar ${r.status}` });
  const data = await r.json();
  const items = (data.organic || []).slice(0, limit).map((it: any) => ({
    title: it.title, link: it.link, snippet: it.snippet,
    publication: it.publicationInfo?.summary, citedBy: it.citedBy?.total, year: it.year,
  }));
  return JSON.stringify({ results: items });
}

async function hackerNews(query: string, limit: number): Promise<string> {
  const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&hitsPerPage=${limit}`;
  const data = await fetch(url).then((r) => r.json());
  const items = (data.hits || []).map((h: any) => ({
    title: h.title || h.story_title,
    url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
    points: h.points, author: h.author, comments: h.num_comments, created_at: h.created_at,
  }));
  return JSON.stringify({ results: items });
}

async function ddgInstant(query: string): Promise<string> {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
  const data = await fetch(url).then((r) => r.json());
  return JSON.stringify({
    abstract: data.AbstractText, source: data.AbstractSource, url: data.AbstractURL,
    answer: data.Answer, definition: data.Definition, heading: data.Heading,
    related: (data.RelatedTopics || []).slice(0, 5).map((t: any) => ({ text: t.Text, url: t.FirstURL })),
  });
}

async function urlFetch(url: string, maxChars: number): Promise<string> {
  const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 MegsyBot/1.0" } });
  if (!r.ok) return JSON.stringify({ error: `fetch ${r.status}`, url });
  const html = await r.text();
  // Strip scripts/styles/tags → readable text
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxChars);
  return JSON.stringify({ url, text });
}

async function openLibrary(query: string, limit: number): Promise<string> {
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=${limit}`;
  const data = await fetch(url).then((r) => r.json());
  const items = (data.docs || []).slice(0, limit).map((b: any) => ({
    title: b.title, author: (b.author_name || []).join(", "),
    year: b.first_publish_year, subjects: (b.subject || []).slice(0, 5),
    url: b.key ? `https://openlibrary.org${b.key}` : null,
  }));
  return JSON.stringify({ results: items });
}

async function worldBank(country: string, indicator: string): Promise<string> {
  const url = `https://api.worldbank.org/v2/country/${country}/indicator/${indicator}?format=json&per_page=5`;
  const data = await fetch(url).then((r) => r.json());
  const rows = Array.isArray(data) && data[1] ? data[1].slice(0, 5).map((d: any) => ({
    country: d.country?.value, indicator: d.indicator?.value, year: d.date, value: d.value,
  })) : [];
  return JSON.stringify({ results: rows });
}

async function currencyConvert(from: string, to: string, amount: number): Promise<string> {
  const url = `https://api.frankfurter.app/latest?amount=${amount}&from=${from.toUpperCase()}&to=${to.toUpperCase()}`;
  const data = await fetch(url).then((r) => r.json());
  return JSON.stringify({ from, to, amount, result: data?.rates?.[to.toUpperCase()], date: data?.date });
}

async function weather(location: string): Promise<string> {
  // Geocode
  const geo = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1`).then((r) => r.json());
  const place = geo?.results?.[0];
  if (!place) return JSON.stringify({ error: "location not found" });
  const wx = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weather_code&forecast_days=3&timezone=auto`).then((r) => r.json());
  return JSON.stringify({
    location: `${place.name}, ${place.country}`,
    current: wx.current,
    daily: wx.daily,
  });
}
