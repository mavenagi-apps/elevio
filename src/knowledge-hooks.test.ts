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
