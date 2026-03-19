import { InngestTestEngine } from "@inngest/test";
import { processFunction } from "@mavenagi/apps-core/knowledge/inngest";
import fetchMock from "fetch-mock";
import { MavenAGIClient } from "mavenagi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Elevio Knowledge Base Integration", () => {
  process.env.MAVENAGI_APP_ID = "elevio";

  const mockSettings = {
    key: "test-api-key",
    token: "test-token",
    helpCenterUrl: "https://help.example.com",
  };

  beforeEach(async () => {
    const { setupMockCacheStore } = await import(
      "@mavenagi/apps-core-dev/caching"
    );
    setupMockCacheStore();
    fetchMock.removeRoutes();
    fetchMock.clearHistory();
    fetchMock.mockGlobal();
    fetchMock.catch({ status: 200, body: "{}" });
  });

  afterEach(() => {
    fetchMock.removeRoutes();
    fetchMock.clearHistory();
    fetchMock.unmockGlobal();
    vi.restoreAllMocks();
  });

  it(
    "should process an empty knowledge base",
    { timeout: 1000000 },
    async () => {
      fetchMock.get(
        "https://api.elev.io/v1/articles?status=published&page=1",
        {
          articles: [],
          page_number: 1,
          total_pages: 0,
          total_entries: 0,
        },
      );

      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "createOrUpdateKnowledgeBase",
      ).mockImplementation(vi.fn());
      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "createKnowledgeBaseVersion",
      ).mockImplementation(vi.fn());
      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "finalizeKnowledgeBaseVersion",
      ).mockImplementation(vi.fn());
      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "createKnowledgeDocument",
      ).mockImplementation(vi.fn());

      const t = new InngestTestEngine({ function: processFunction });
      const result = await t.execute({
        events: [
          {
            id: "test-empty-kb",
            name: `app/${process.env.MAVENAGI_APP_ID}/process`,
            data: {
              organizationId: "org1",
              agentId: "agent1",
              settings: mockSettings,
            },
          },
        ],
      });

      expect(result).toBeDefined();
    },
  );

  it(
    "should process articles with English translations and set URL",
    { timeout: 1000000 },
    async () => {
      fetchMock.get(
        "https://api.elev.io/v1/articles?status=published&page=1",
        {
          articles: [
            { id: 101, title: "Getting Started", status: "published" },
            { id: 102, title: "FAQ", status: "published" },
          ],
          page_number: 1,
          total_pages: 1,
          total_entries: 2,
        },
      );

      fetchMock.get("https://api.elev.io/v1/articles/101", {
        article: {
          id: 101,
          title: "Getting Started",
          slug: "getting-started",
          translations: [
            {
              id: 1,
              title: "Getting Started",
              body: "<h1>Welcome</h1><p>This is the getting started guide.</p>",
              language_id: "en",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          keywords: [],
          tags: ["ct_traveler"],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      // Article 102: no English translation — should be skipped
      fetchMock.get("https://api.elev.io/v1/articles/102", {
        article: {
          id: 102,
          title: "FAQ",
          slug: "faq",
          translations: [
            {
              id: 2,
              title: "Preguntas Frecuentes",
              body: "<p>FAQ en espanol</p>",
              language_id: "es",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          keywords: [],
          tags: ["ct_owner"],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "createOrUpdateKnowledgeBase",
      ).mockImplementation(vi.fn());
      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "createKnowledgeBaseVersion",
      ).mockImplementation(vi.fn());
      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "finalizeKnowledgeBaseVersion",
      ).mockImplementation(vi.fn());
      const createDocSpy = vi
        .spyOn(
          MavenAGIClient.prototype.knowledge,
          "createKnowledgeDocument",
        )
        .mockImplementation(vi.fn());

      const t = new InngestTestEngine({ function: processFunction });
      await t.execute({
        events: [
          {
            id: "test-with-articles",
            name: `app/${process.env.MAVENAGI_APP_ID}/process`,
            data: {
              organizationId: "org1",
              agentId: "agent1",
              settings: mockSettings,
            },
          },
        ],
      });

      // Only article 101 should be created (102 has no English translation)
      expect(createDocSpy).toHaveBeenCalledTimes(1);
      expect(createDocSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          title: "Getting Started",
          contentType: "MARKDOWN",
          url: "https://help.example.com/traveler/articles/101-getting-started",
          knowledgeDocumentId: { referenceId: "101" },
        }),
      );
    },
  );

  it(
    "should handle multi-page pagination",
    { timeout: 1000000 },
    async () => {
      fetchMock.get(
        "https://api.elev.io/v1/articles?status=published&page=1",
        {
          articles: [
            { id: 201, title: "Page 1 Article", status: "published" },
          ],
          page_number: 1,
          total_pages: 2,
          total_entries: 2,
        },
      );

      fetchMock.get(
        "https://api.elev.io/v1/articles?status=published&page=2",
        {
          articles: [
            { id: 202, title: "Page 2 Article", status: "published" },
          ],
          page_number: 2,
          total_pages: 2,
          total_entries: 2,
        },
      );

      fetchMock.get("https://api.elev.io/v1/articles/201", {
        article: {
          id: 201,
          slug: "page-1-article",
          translations: [
            {
              id: 1,
              title: "Page 1 Article",
              body: "<p>Content 1</p>",
              language_id: "en",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          keywords: [],
          tags: ["ct_traveler"],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      fetchMock.get("https://api.elev.io/v1/articles/202", {
        article: {
          id: 202,
          slug: "page-2-article",
          translations: [
            {
              id: 2,
              title: "Page 2 Article",
              body: "<p>Content 2</p>",
              language_id: "en-us",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          keywords: [],
          tags: ["ct_owner"],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });

      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "createOrUpdateKnowledgeBase",
      ).mockImplementation(vi.fn());
      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "createKnowledgeBaseVersion",
      ).mockImplementation(vi.fn());
      vi.spyOn(
        MavenAGIClient.prototype.knowledge,
        "finalizeKnowledgeBaseVersion",
      ).mockImplementation(vi.fn());
      const createDocSpy = vi
        .spyOn(
          MavenAGIClient.prototype.knowledge,
          "createKnowledgeDocument",
        )
        .mockImplementation(vi.fn());

      const t = new InngestTestEngine({ function: processFunction });
      await t.execute({
        events: [
          {
            id: "test-pagination",
            name: `app/${process.env.MAVENAGI_APP_ID}/process`,
            data: {
              organizationId: "org1",
              agentId: "agent1",
              settings: mockSettings,
            },
          },
        ],
      });

      // Both articles from both pages should be created
      expect(createDocSpy).toHaveBeenCalledTimes(2);
    },
  );
});

describe("fetchData chunking", () => {
  const mockSettings = {
    key: "test-api-key",
    token: "test-token",
    helpCenterUrl: "https://help.example.com",
  };

  const mockEventData = {
    organizationId: "org1",
    agentId: "agent1",
    settings: mockSettings,
  };

  beforeEach(() => {
    fetchMock.removeRoutes();
    fetchMock.clearHistory();
    fetchMock.mockGlobal();
  });

  afterEach(() => {
    fetchMock.removeRoutes();
    fetchMock.clearHistory();
    fetchMock.unmockGlobal();
  });

  it("should return empty result when done", async () => {
    const { fetchData } = await import("@/knowledge-hooks");

    const result = await fetchData(
      { page: 1, totalPages: 1, pendingArticles: [], done: true },
      mockEventData,
      250,
    );

    expect(result.result).toHaveLength(0);
  });

  it("should chunk pending articles by ELEVIO_CHUNK_SIZE", async () => {
    const { fetchData } = await import("@/knowledge-hooks");

    // Create 12 pending article summaries (ELEVIO_CHUNK_SIZE is 5)
    const pending = Array.from({ length: 12 }, (_, i) => ({
      id: 300 + i,
      title: `Article ${i}`,
      status: "published",
      category_id: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    }));

    // Mock detail endpoints for all 12 articles
    for (const article of pending) {
      fetchMock.get(`https://api.elev.io/v1/articles/${article.id}`, {
        article: {
          id: article.id,
          title: article.title,
          slug: `article-${article.id}`,
          translations: [
            {
              id: article.id,
              title: article.title,
              body: "<p>Content</p>",
              language_id: "en",
              created_at: "2024-01-01T00:00:00Z",
              updated_at: "2024-01-01T00:00:00Z",
            },
          ],
          keywords: [],
          tags: ["ct_traveler"],
          created_at: "2024-01-01T00:00:00Z",
          updated_at: "2024-01-01T00:00:00Z",
        },
      });
    }

    // First chunk: should return 5 articles, leave 7 pending
    const chunk1 = await fetchData(
      { page: 1, totalPages: 1, pendingArticles: pending, done: false },
      mockEventData,
      250,
    );

    expect(chunk1.result).toHaveLength(5);
    expect(chunk1.updatedMetadata?.pendingArticles).toHaveLength(7);
    expect(chunk1.updatedMetadata?.done).toBe(false);

    // Second chunk: should return 5 articles, leave 2 pending
    const chunk2 = await fetchData(
      chunk1.updatedMetadata!,
      mockEventData,
      250,
    );

    expect(chunk2.result).toHaveLength(5);
    expect(chunk2.updatedMetadata?.pendingArticles).toHaveLength(2);
    expect(chunk2.updatedMetadata?.done).toBe(false);

    // Third chunk: should return remaining 2 articles
    const chunk3 = await fetchData(
      chunk2.updatedMetadata!,
      mockEventData,
      250,
    );

    expect(chunk3.result).toHaveLength(2);
    expect(chunk3.updatedMetadata?.pendingArticles).toHaveLength(0);
    // Last page and all drained → done
    expect(chunk3.updatedMetadata?.done).toBe(true);
  });

  it("should fetch next page when pending articles are drained", async () => {
    const { fetchData } = await import("@/knowledge-hooks");

    // Page 2 articles mock
    fetchMock.get("https://api.elev.io/v1/articles?status=published&page=2", {
      articles: [
        { id: 401, title: "Page 2 Art", status: "published" },
      ],
      page_number: 2,
      total_pages: 2,
      total_entries: 2,
    });

    fetchMock.get("https://api.elev.io/v1/articles/401", {
      article: {
        id: 401,
        title: "Page 2 Art",
        slug: "page-2-art",
        translations: [
          {
            id: 401,
            title: "Page 2 Art",
            body: "<p>Content</p>",
            language_id: "en",
            created_at: "2024-01-01T00:00:00Z",
            updated_at: "2024-01-01T00:00:00Z",
          },
        ],
        keywords: [],
        tags: ["ct_owner"],
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z",
      },
    });

    // Metadata: page 1 drained, more pages exist
    const result = await fetchData(
      { page: 1, totalPages: 2, pendingArticles: [], done: false },
      mockEventData,
      250,
    );

    expect(result.result).toHaveLength(1);
    expect(result.updatedMetadata?.page).toBe(2);
    expect(result.updatedMetadata?.done).toBe(true);
  });
});
