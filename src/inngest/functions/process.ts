import { convert } from "@mavenagi/knowledge-converter";
import { MavenAGIClient } from "mavenagi";

import { inngest } from "@/inngest/client";
import { fetchArticleById, fetchArticlesPage } from "@/lib/api";
import {
  ARTICLES_PER_BATCH,
  ARTICLES_PER_STEP,
  ENGLISH_LANGUAGE_IDS,
  FINALIZATION_DELAY_MS,
  KNOWLEDGE_BASE_ID,
  KNOWLEDGE_BASE_NAME,
  MAVEN_API_RATE_LIMIT,
} from "@/lib/constants";
import type { ElevioArticleSummary } from "@/lib/knowledge";
import { buildArticleUrl } from "@/lib/url";

// ── Rate limiter ────────────────────────────────────────────────────────
// Simple throttle: ensures minimum interval between Maven API calls.
const RATE_LIMIT_INTERVAL_MS = 1000 / MAVEN_API_RATE_LIMIT;

class RateLimiter {
  private lastCall = 0;

  async throttle(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastCall;
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await new Promise((resolve) =>
        setTimeout(resolve, RATE_LIMIT_INTERVAL_MS - elapsed),
      );
    }
    this.lastCall = Date.now();
  }
}

// ── Process function ────────────────────────────────────────────────────

export const processFunction = inngest.createFunction(
  {
    id: "process",
    concurrency: [
      { key: "event.data.agentId", limit: 50 },
    ],
    retries: 10,
  },
  { event: "app/elevio/process" },
  async ({ event, step }) => {
    const { organizationId, agentId, settings } = event.data as {
      organizationId: string;
      agentId: string;
      settings: AppSettings;
    };

    const platform = new MavenAGIClient({
      organizationId,
      agentId,
    });

    // Step 1 — Create or update the knowledge base
    await step.run("create-knowledge-base", async () => {
      await platform.knowledge.createOrUpdateKnowledgeBase({
        name: KNOWLEDGE_BASE_NAME,
        knowledgeBaseId: { referenceId: KNOWLEDGE_BASE_ID },
      });
    });

    // Step 2 — Create a new FULL knowledge revision
    await step.run("create-knowledge-revision", async () => {
      // Finalize any stale in-progress version (swallow errors)
      try {
        await platform.knowledge.finalizeKnowledgeBaseVersion(
          KNOWLEDGE_BASE_ID,
          {},
        );
      } catch {
        // No stale version or already finalized — safe to ignore
      }

      await platform.knowledge.createKnowledgeBaseVersion(KNOWLEDGE_BASE_ID, {
        type: "FULL",
      });
    });

    // Step 3 — Fetch all article summaries (paginate)
    const allArticles = await step.run(
      "fetch-article-list",
      async (): Promise<ElevioArticleSummary[]> => {
        const articles: ElevioArticleSummary[] = [];
        const firstPage = await fetchArticlesPage(settings, 1);
        articles.push(...firstPage.articles);

        for (let page = 2; page <= firstPage.total_pages; page++) {
          const nextPage = await fetchArticlesPage(settings, page);
          articles.push(...nextPage.articles);
        }

        return articles;
      },
    );

    // Steps 4..N — Process articles in chunks of ARTICLES_PER_STEP
    const totalChunks = Math.ceil(allArticles.length / ARTICLES_PER_STEP);

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      const chunkStart = chunkIndex * ARTICLES_PER_STEP;
      const chunk = allArticles.slice(
        chunkStart,
        chunkStart + ARTICLES_PER_STEP,
      );

      await step.run(`process-articles-step-${chunkIndex}`, async () => {
        const rateLimiter = new RateLimiter();
        const stepSummary = { uploaded: 0, skipped: 0, failed: 0, errors: [] as string[] };

        // Process in mini-batches of ARTICLES_PER_BATCH
        for (
          let batchStart = 0;
          batchStart < chunk.length;
          batchStart += ARTICLES_PER_BATCH
        ) {
          const batch = chunk.slice(batchStart, batchStart + ARTICLES_PER_BATCH);

          const results = await Promise.allSettled(
            batch.map(async (summary) => {
              // 1. Fetch full article detail
              const detailResponse = await fetchArticleById(
                settings,
                summary.id,
              );
              const article = detailResponse.article;

              // 2. Find English translation
              const englishTranslation = article.translations.find((t) =>
                ENGLISH_LANGUAGE_IDS.includes(
                  t.language_id as (typeof ENGLISH_LANGUAGE_IDS)[number],
                ),
              );

              if (!englishTranslation) {
                stepSummary.skipped++;
                return { id: article.id, status: "skipped" as const };
              }

              // 3. Convert HTML to Markdown
              const [_title, markdownContent] = await convert(
                englishTranslation.body,
              );

              if (!markdownContent) {
                stepSummary.skipped++;
                return { id: article.id, status: "skipped" as const };
              }

              // 4. Build article URL
              const url = buildArticleUrl(
                settings.helpCenterUrl,
                article.id,
                article.tags,
              );

              // 5. Upload to Maven with rate limiting
              await rateLimiter.throttle();
              await platform.knowledge.createKnowledgeDocument(
                KNOWLEDGE_BASE_ID,
                {
                  knowledgeDocumentId: { referenceId: `${article.id}` },
                  title: englishTranslation.title,
                  content: markdownContent,
                  contentType: "MARKDOWN",
                  language: "en",
                  url,
                },
              );

              stepSummary.uploaded++;
              return { id: article.id, status: "uploaded" as const };
            }),
          );

          for (const r of results) {
            if (r.status === "rejected") {
              stepSummary.failed++;
              const errMsg = r.reason instanceof Error ? r.reason.message : String(r.reason);
              stepSummary.errors.push(errMsg);
            }
          }
        }

        return stepSummary;
      });
    }

    // Final step — Finalize knowledge revision (fire-and-forget pattern)
    const result = await step.run(
      "finalize-knowledge-revision",
      async () => {
        // Start finalization without awaiting completion
        const finalizationPromise = Promise.resolve(
          platform.knowledge.finalizeKnowledgeBaseVersion(KNOWLEDGE_BASE_ID, {}),
        );

        // Suppress unhandled rejection
        finalizationPromise.catch(() => {});

        // Wait briefly to allow the request to be sent
        await new Promise((resolve) =>
          setTimeout(resolve, FINALIZATION_DELAY_MS),
        );

        return { success: true, status: "INITIATED" as const };
      },
    );

    return result;
  },
);
