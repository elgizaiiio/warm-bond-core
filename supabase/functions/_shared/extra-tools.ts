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
