import { InngestProcessingError } from "@mavenagi/apps-core/knowledge/inngest";
import type { ConvertChunkResult } from "@mavenagi/apps-core/knowledge/inngest";
import { convert } from "@mavenagi/knowledge-converter";
import { MavenAGI } from "mavenagi";

import { fetchArticleById, fetchArticlesPage } from "@/lib/api";
import {
  ENGLISH_LANGUAGE_IDS,
  KNOWLEDGE_BASE_ID,
  KNOWLEDGE_BASE_NAME,
} from "@/lib/constants";
import type { ElevioArticleDetail } from "@/lib/knowledge";
import { buildArticleUrl } from "@/lib/url";

// ── Hook execution order ──────────────────────────────────────────────
// validateInputs → fetchMetadataAndSetup → createMavenKBIds
//   → [fetchData → convertToMavenDocuments → getMavenKBId]* (loops until fetchData returns empty)

interface ElevioMetadata {
  page: number;
  totalPages: number;
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
 * The returned object is cached in Redis and passed to subsequent hooks.
 */
export async function fetchMetadataAndSetup(
  eventData: any,
): Promise<Record<string, any>> {
  const { settings } = eventData;
  const firstPage = await fetchArticlesPage(settings, 1);

  return {
    page: 1,
    totalPages: firstPage.total_pages,
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
 * Step 4 (Extract) — Fetch one page of articles with full detail.
 * Called in a loop by the framework. Returns empty result to stop.
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
  const articlesResponse = await fetchArticlesPage(settings, meta.page);

  // Fetch full detail for each article to get translations with body content
  const fullArticles: ElevioArticleDetail[] = [];
  for (const article of articlesResponse.articles) {
    const detail = await fetchArticleById(settings, article.id);
    fullArticles.push(detail.article);
  }

  const hasMore = meta.page < articlesResponse.total_pages;

  return {
    result: fullArticles as unknown as Record<string, any>[],
    updatedMetadata: {
      page: hasMore ? meta.page + 1 : meta.page,
      totalPages: articlesResponse.total_pages,
      done: !hasMore,
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
