import { InngestProcessingError } from "@mavenagi/apps-core/knowledge/inngest";
import type { ConvertChunkResult } from "@mavenagi/apps-core/knowledge/inngest";
import { convert } from "@mavenagi/knowledge-converter";
import { MavenAGI } from "mavenagi";

import { fetchArticleById, fetchArticlesPage } from "@/lib/api";
import {
  ELEVIO_CHUNK_SIZE,
  ENGLISH_LANGUAGE_IDS,
  KNOWLEDGE_BASE_ID,
  KNOWLEDGE_BASE_NAME,
} from "@/lib/constants";
import type {
  ElevioArticleDetail,
  ElevioArticleSummary,
} from "@/lib/knowledge";
import { buildArticleUrl } from "@/lib/url";

// ── Hook execution order ──────────────────────────────────────────────
// validateInputs → fetchMetadataAndSetup → createMavenKBIds
//   → [fetchData → convertToMavenDocuments → getMavenKBId]* (loops until fetchData returns empty)

interface ElevioMetadata {
  /** Current page in the Elevio articles list API */
  page: number;
  totalPages: number;
  /** Article summaries from the current page waiting to be fetched in detail */
  pendingArticles: ElevioArticleSummary[];
  done: boolean;
}

/**
 * Step 1 — Validate required settings early.
 * Throws InngestProcessingError if anything is missing.
 */
export async function validateInputs(eventData: any): Promise<void> {
  const { organizationId, agentId, settings } = eventData;

  if (!organizationId)
    throw new InngestProcessingError("Organization ID is required", []);
  if (!agentId)
    throw new InngestProcessingError("Agent ID is required", []);
  if (!settings)
    throw new InngestProcessingError("Settings are required", []);
  if (!settings.key)
    throw new InngestProcessingError("Elevio API key is required", []);
  if (!settings.token)
    throw new InngestProcessingError("Elevio API token is required", []);
}

/**
 * Step 2 — Fetch first page to initialize pagination metadata.
 * Stores the first page's article summaries in pendingArticles so
 * fetchData can drain them in small chunks without re-fetching.
 */
export async function fetchMetadataAndSetup(
  eventData: any,
): Promise<Record<string, any>> {
  const { settings } = eventData;
  const firstPage = await fetchArticlesPage(settings, 1);

  return {
    page: 1,
    totalPages: firstPage.total_pages,
    pendingArticles: firstPage.articles,
    done: firstPage.total_pages === 0,
  } satisfies ElevioMetadata;
}

/**
 * Step 3 — Define the single Elevio knowledge base.
 */
export function createMavenKBIds(
  _eventData: any,
  _metadata: Record<string, any>,
): any[] {
  return [
    {
      knowledgeBaseId: { referenceId: KNOWLEDGE_BASE_ID },
      name: KNOWLEDGE_BASE_NAME,
      type: MavenAGI.KnowledgeBaseType.Api,
    },
  ];
}

/**
 * Step 4 (Extract) — Fetch a small chunk of articles with full detail.
 *
 * Called in a loop by the framework. Each invocation takes at most
 * ELEVIO_CHUNK_SIZE articles from `pendingArticles`, fetches their
 * detail (concurrently via the rate limiter), and returns them.
 * When pendingArticles is drained, fetches the next page. Returns
 * empty result to signal completion.
 *
 * This keeps each Inngest step small enough to avoid 524 timeouts.
 */
export async function fetchData(
  metadata: Record<string, any>,
  eventData: any,
  _chunkSize: number,
): Promise<{
  result: Record<string, any>[];
  updatedMetadata?: Record<string, any>;
}> {
  const meta = metadata as ElevioMetadata;

  if (meta.done) {
    return { result: [], updatedMetadata: meta };
  }

  const { settings } = eventData;
  let { pendingArticles, page, totalPages } = meta;

  // If no pending articles, fetch the next page
  if (pendingArticles.length === 0) {
    const nextPage = page + 1;
    if (nextPage > totalPages) {
      return {
        result: [],
        updatedMetadata: { ...meta, done: true } satisfies ElevioMetadata,
      };
    }

    const articlesResponse = await fetchArticlesPage(settings, nextPage);
    pendingArticles = articlesResponse.articles;
    page = nextPage;
    totalPages = articlesResponse.total_pages;

    // Edge case: page returned no articles
    if (pendingArticles.length === 0) {
      return {
        result: [],
        updatedMetadata: {
          page,
          totalPages,
          pendingArticles: [],
          done: true,
        } satisfies ElevioMetadata,
      };
    }
  }

  // Take a small chunk from the pending queue
  const batch = pendingArticles.slice(0, ELEVIO_CHUNK_SIZE);
  const remaining = pendingArticles.slice(ELEVIO_CHUNK_SIZE);

  // Fetch full detail concurrently (bounded by Bottleneck rate limiter)
  const fullArticles = await Promise.all(
    batch.map(async (article) => {
      const detail = await fetchArticleById(settings, article.id);
      return detail.article;
    }),
  );

  const allDrained = remaining.length === 0;
  const noMorePages = page >= totalPages;

  return {
    result: fullArticles as unknown as Record<string, any>[],
    updatedMetadata: {
      page,
      totalPages,
      pendingArticles: remaining,
      done: allDrained && noMorePages,
    } satisfies ElevioMetadata,
  };
}

/**
 * Step 5 (Transform) — Convert raw Elevio articles to Maven knowledge documents.
 * Filters to English translations, converts HTML→Markdown, and builds URLs (SOLN-63 fix).
 */
export async function convertToMavenDocuments(
  fetchResult: Record<string, any>[],
  eventData: any,
  metadata: Record<string, any>,
): Promise<ConvertChunkResult> {
  const articles = fetchResult as unknown as ElevioArticleDetail[];
  const { settings } = eventData;
  const documents: MavenAGI.KnowledgeDocumentRequest[] = [];

  for (const article of articles) {
    const englishTranslation = article.translations.find((t) =>
      ENGLISH_LANGUAGE_IDS.includes(
        t.language_id as (typeof ENGLISH_LANGUAGE_IDS)[number],
      ),
    );

    // Skip articles without English translation
    if (!englishTranslation) {
      continue;
    }

    // Convert HTML body to Markdown
    const [_extractedTitle, markdownContent] = await convert({
      data: englishTranslation.body,
    });

    // Build public article URL using API-provided slug and tags (SOLN-63 fix)
    const url = buildArticleUrl(
      settings.helpCenterUrl,
      article.id,
      article.slug,
      article.tags,
    );

    documents.push({
      knowledgeDocumentId: { referenceId: `${article.id}` },
      title: englishTranslation.title,
      content: markdownContent ?? "",
      contentType: "MARKDOWN",
      url,
    });
  }

  return {
    documents,
    updatedMetadata: metadata,
  };
}

/**
 * Step 6 (Route) — All documents go to the single Elevio KB.
 */
export function getMavenKBId(
  _eventData: any,
  _metadata: Record<string, any>,
  _doc: MavenAGI.KnowledgeDocumentRequest,
): string {
  return KNOWLEDGE_BASE_ID;
}
