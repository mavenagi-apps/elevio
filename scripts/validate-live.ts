/**
 * Live validation script — tests the Elevio connector against real API credentials.
 *
 * Usage:
 *   pnpm tsx scripts/validate-live.ts
 *
 * Reads credentials from .env.local (key, token, helpCenterUrl).
 * Validates: auth, article fetching, English filtering, HTML→Markdown, URL construction.
 */

import { config } from "dotenv";
config({ path: ".env.local" });

const ELEVIO_API_BASE = "https://api.elev.io/v1";

// ── Credentials ──────────────────────────────────────────────────────
// Reads ELEVIO_KEY, ELEVIO_TOKEN, and optionally ELEVIO_HELP_CENTER_URL from .env.local
const key = process.env.ELEVIO_KEY;
const token = process.env.ELEVIO_TOKEN;

if (!key || !token) {
  console.error(
    "Missing ELEVIO_KEY or ELEVIO_TOKEN in .env.local. Add them and retry.",
  );
  process.exit(1);
}

const settings = {
  key,
  token,
  helpCenterUrl:
    process.env.ELEVIO_HELP_CENTER_URL ??
    "https://www.tripadvisorsupport.com/en-US/hc",
};

const headers = {
  Authorization: `Bearer ${settings.token}`,
  "x-api-key": settings.key,
  "Content-Type": "application/json",
};

// ── Helpers ──────────────────────────────────────────────────────────

/** Extract section from ct_ prefixed tags (e.g. ct_traveler → traveler) */
function extractSection(tags: string[]): string | undefined {
  const tag = tags.find((t) => t.startsWith("ct_"));
  return tag?.slice(3);
}

function buildArticleUrl(
  helpCenterUrl: string | undefined,
  articleId: number,
  slug: string,
  tags: string[],
): string {
  if (!helpCenterUrl) return "";
  const section = extractSection(tags);
  if (!section) return "";
  const baseUrl = helpCenterUrl.replace(/\/$/, "");
  return `${baseUrl}/${section}/articles/${articleId}-${slug}`;
}

const ENGLISH_LANGUAGE_IDS = ["en", "en-us"];

function passed(label: string, detail?: string) {
  console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
}

function failed(label: string, detail: string) {
  console.error(`  ❌ ${label} — ${detail}`);
}

function info(label: string, detail: string) {
  console.log(`  ℹ️  ${label}: ${detail}`);
}

// ── Step 1: Validate Credentials ─────────────────────────────────────

async function validateCredentials() {
  console.log("\n─── Step 1: Validate Credentials ───");
  const res = await fetch(`${ELEVIO_API_BASE}/categories`, { headers });
  if (res.ok) {
    passed("Auth", `${res.status} ${res.statusText}`);
  } else {
    const body = await res.text();
    failed("Auth", `${res.status} ${res.statusText} — ${body}`);
    process.exit(1);
  }
}

// ── Step 2: Fetch Articles List ──────────────────────────────────────

interface ArticlesResponse {
  articles: { id: number; title: string; status: string }[];
  page_number: number;
  total_pages: number;
  total_entries: number;
}

async function fetchArticlesList(): Promise<ArticlesResponse> {
  console.log("\n─── Step 2: Fetch Articles List (page 1) ───");
  const res = await fetch(
    `${ELEVIO_API_BASE}/articles?status=published&page=1`,
    { headers },
  );
  if (!res.ok) {
    failed("Fetch articles", `${res.status} ${res.statusText}`);
    process.exit(1);
  }
  const data = (await res.json()) as ArticlesResponse;
  passed(
    "Fetch articles",
    `${data.total_entries} total articles across ${data.total_pages} pages`,
  );
  info(
    "Page 1 articles",
    data.articles.map((a) => `${a.id} "${a.title}"`).join(", "),
  );
  return data;
}

// ── Step 3: Fetch Article Detail + English Filter ────────────────────

interface ArticleDetail {
  article: {
    id: number;
    title: string;
    slug: string;
    translations: {
      id: number;
      title: string;
      body: string;
      language_id: string;
    }[];
    keywords: string[];
    tags: string[];
  };
}

async function fetchAndValidateArticle(articleId: number) {
  console.log(`\n─── Step 3: Fetch Article Detail (id=${articleId}) ───`);
  const res = await fetch(`${ELEVIO_API_BASE}/articles/${articleId}`, {
    headers,
  });
  if (!res.ok) {
    failed("Fetch detail", `${res.status} ${res.statusText}`);
    return null;
  }
  const data = (await res.json()) as ArticleDetail;
  const article = data.article;

  passed("Fetch detail", `"${article.title}"`);
  info(
    "Translations",
    article.translations
      .map((t) => `${t.language_id}: "${t.title}" (${t.body.length} chars)`)
      .join(", "),
  );

  // English filter
  const english = article.translations.find((t) =>
    ENGLISH_LANGUAGE_IDS.includes(t.language_id),
  );
  if (english) {
    passed(
      "English filter",
      `Found language_id="${english.language_id}", title="${english.title}"`,
    );
  } else {
    info(
      "English filter",
      `No English translation found — this article would be SKIPPED`,
    );
    return null;
  }

  // HTML body preview
  const bodyPreview = english.body.slice(0, 200).replace(/\n/g, " ");
  info("HTML body preview", bodyPreview + "...");

  return { article, english };
}

// ── Step 4: HTML → Markdown Conversion ───────────────────────────────

async function testConversion(htmlBody: string) {
  console.log("\n─── Step 4: HTML → Markdown Conversion ───");
  try {
    const { convert } = await import("@mavenagi/knowledge-converter");
    const [extractedTitle, markdown] = await convert({ data: htmlBody });
    passed("convert()", `Extracted title: "${extractedTitle ?? "(none)"}"`);
    const preview = (markdown ?? "").slice(0, 300).replace(/\n/g, "\\n");
    info("Markdown preview", preview + "...");
    return markdown;
  } catch (err) {
    failed("convert()", String(err));
    return null;
  }
}

// ── Step 5: URL Construction ─────────────────────────────────────────

function testUrlConstruction(
  articleId: number,
  slug: string,
  tags: string[],
) {
  console.log("\n─── Step 5: URL Construction (SOLN-63) ───");
  info("Slug", slug);
  info("Tags", tags.join(", ") || "(none)");

  const url = buildArticleUrl(settings.helpCenterUrl, articleId, slug, tags);
  if (url) {
    passed("buildArticleUrl", url);
  } else {
    failed("buildArticleUrl", "returned empty string (no ct_ tag?)");
  }

  // Also test without helpCenterUrl
  const noUrl = buildArticleUrl(undefined, articleId, slug, tags);
  if (noUrl === "") {
    passed("No helpCenterUrl", "correctly returns empty string");
  } else {
    failed("No helpCenterUrl", `expected empty, got "${noUrl}"`);
  }

  return url;
}

// ── Step 6: Final Document Shape ─────────────────────────────────────

function showDocumentShape(
  articleId: number,
  title: string,
  markdown: string | null,
  url: string,
) {
  console.log("\n─── Step 6: Final Maven Knowledge Document ───");
  const doc = {
    knowledgeDocumentId: { referenceId: `${articleId}` },
    title,
    content: markdown ? `${markdown.slice(0, 100)}...` : "(conversion failed)",
    contentType: "MARKDOWN",
    url,
  };
  console.log(JSON.stringify(doc, null, 2));
}

// ── Run ──────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════════╗");
  console.log("║  Elevio Connector — Live Validation          ║");
  console.log("╚══════════════════════════════════════════════╝");
  info("API Key", `${settings.key.slice(0, 8)}...`);
  info("Help Center URL", settings.helpCenterUrl ?? "(not set)");

  await validateCredentials();
  const list = await fetchArticlesList();

  if (list.articles.length === 0) {
    console.log("\n⚠️  No published articles found. Nothing more to validate.");
    return;
  }

  // Pick the first article for detailed validation
  const firstArticle = list.articles[0];
  const detail = await fetchAndValidateArticle(firstArticle.id);

  if (!detail) {
    console.log("\n⚠️  First article had no English translation. Trying next...");
    // Try a few more
    for (let i = 1; i < Math.min(list.articles.length, 5); i++) {
      const alt = await fetchAndValidateArticle(list.articles[i].id);
      if (alt) {
        const md = await testConversion(alt.english.body);
        const url = testUrlConstruction(
          alt.article.id,
          alt.article.slug,
          alt.article.tags,
        );
        showDocumentShape(alt.article.id, alt.english.title, md, url);
        break;
      }
    }
  } else {
    const md = await testConversion(detail.english.body);
    const url = testUrlConstruction(
      detail.article.id,
      detail.article.slug,
      detail.article.tags,
    );
    showDocumentShape(detail.article.id, detail.english.title, md, url);
  }

  console.log("\n─── Summary ───");
  console.log(
    `  Total articles: ${list.total_entries} across ${list.total_pages} pages`,
  );
  console.log(
    `  Help center URL pattern: ${settings.helpCenterUrl}/{section}/articles/{id}-{slug}`,
  );
  console.log("  Done.\n");
}

main().catch((err) => {
  console.error("\n💥 Unexpected error:", err);
  process.exit(1);
});
