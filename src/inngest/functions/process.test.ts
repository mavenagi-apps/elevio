import { InngestTestEngine } from "@inngest/test";
import fetchMock from "fetch-mock";
import { MavenAGIClient } from "mavenagi";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { processFunction } from "@/inngest/functions/process";

describe("Elevio Knowledge Processor", () => {
  const mockSettings = {
    key: "test-api-key",
    token: "test-token",
    helpCenterUrl: "https://help.example.com",
  };

  const baseEventData = {
    organizationId: "org1",
    agentId: "agent1",
    settings: mockSettings,
  };

  function createEvent(id: string) {
    return {
      id,
      name: "app/elevio/process" as const,
      data: baseEventData,
    };
  }

  beforeEach(() => {
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

  it("should process an empty knowledge base", { timeout: 30000 }, async () => {
    fetchMock.get(
      "https://api.elev.io/v1/articles?status=published&page=1",
      {
        articles: [],
        page_number: 1,
        total_pages: 0,
        total_entries: 0,
      },
    );

    const createKbSpy = vi
      .spyOn(
        MavenAGIClient.prototype.knowledge,
        "createOrUpdateKnowledgeBase",
      )
      .mockImplementation(vi.fn());
    vi.spyOn(
      MavenAGIClient.prototype.knowledge,
      "createKnowledgeBaseVersion",
    ).mockImplementation(vi.fn());
    const finalizeSpy = vi
      .spyOn(
        MavenAGIClient.prototype.knowledge,
        "finalizeKnowledgeBaseVersion",
      )
      .mockImplementation(vi.fn());
    const createDocSpy = vi
      .spyOn(MavenAGIClient.prototype.knowledge, "createKnowledgeDocument")
      .mockImplementation(vi.fn());

    const t = new InngestTestEngine({ function: processFunction });
    const { result } = await t.execute({
      events: [createEvent("test-empty-kb")],
    });

    expect(createKbSpy).toHaveBeenCalledTimes(1);
    expect(createDocSpy).not.toHaveBeenCalled();
    // Finalize called in step 2 (stale cleanup) + step final
    expect(finalizeSpy).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it(
    "should process English articles and set correct URLs",
    { timeout: 30000 },
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
        .spyOn(MavenAGIClient.prototype.knowledge, "createKnowledgeDocument")
        .mockImplementation(vi.fn());

      const t = new InngestTestEngine({ function: processFunction });
      await t.execute({
        events: [createEvent("test-with-articles")],
      });

      // Only article 101 should be created (102 has no English translation)
      expect(createDocSpy).toHaveBeenCalledTimes(1);
      expect(createDocSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          title: "Getting Started",
          contentType: "MARKDOWN",
          language: "en",
          url: "https://help.example.com/traveler/articles/101",
          knowledgeDocumentId: { referenceId: "101" },
        }),
      );
    },
  );

  it(
    "should handle multi-page pagination",
    { timeout: 30000 },
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
        .spyOn(MavenAGIClient.prototype.knowledge, "createKnowledgeDocument")
        .mockImplementation(vi.fn());

      const t = new InngestTestEngine({ function: processFunction });
      await t.execute({
        events: [createEvent("test-pagination")],
      });

      // Both articles from both pages should be created
      expect(createDocSpy).toHaveBeenCalledTimes(2);
    },
  );

  it(
    "should skip non-English articles without errors",
    { timeout: 30000 },
    async () => {
      fetchMock.get(
        "https://api.elev.io/v1/articles?status=published&page=1",
        {
          articles: [
            { id: 301, title: "Spanish Only", status: "published" },
            { id: 302, title: "French Only", status: "published" },
          ],
          page_number: 1,
          total_pages: 1,
          total_entries: 2,
        },
      );

      fetchMock.get("https://api.elev.io/v1/articles/301", {
        article: {
          id: 301,
          slug: "spanish-only",
          translations: [
            {
              id: 1,
              title: "Solo Espanol",
              body: "<p>Contenido</p>",
              language_id: "es",
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

      fetchMock.get("https://api.elev.io/v1/articles/302", {
        article: {
          id: 302,
          slug: "french-only",
          translations: [
            {
              id: 2,
              title: "Francais Seulement",
              body: "<p>Contenu</p>",
              language_id: "fr",
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
        .spyOn(MavenAGIClient.prototype.knowledge, "createKnowledgeDocument")
        .mockImplementation(vi.fn());

      const t = new InngestTestEngine({ function: processFunction });
      const { result } = await t.execute({
        events: [createEvent("test-non-english")],
      });

      // No documents should be uploaded
      expect(createDocSpy).not.toHaveBeenCalled();
      expect(result).toBeDefined();
    },
  );

  it(
    "should be resilient to individual article fetch failures",
    { timeout: 30000 },
    async () => {
      fetchMock.get(
        "https://api.elev.io/v1/articles?status=published&page=1",
        {
          articles: [
            { id: 401, title: "Good Article", status: "published" },
            { id: 402, title: "Bad Article", status: "published" },
            { id: 403, title: "Another Good", status: "published" },
          ],
          page_number: 1,
          total_pages: 1,
          total_entries: 3,
        },
      );

      fetchMock.get("https://api.elev.io/v1/articles/401", {
        article: {
          id: 401,
          slug: "good-article",
          translations: [
            {
              id: 1,
              title: "Good Article",
              body: "<p>Good content</p>",
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

      // Article 402 fails
      fetchMock.get("https://api.elev.io/v1/articles/402", {
        status: 500,
        body: "Internal Server Error",
      });

      fetchMock.get("https://api.elev.io/v1/articles/403", {
        article: {
          id: 403,
          slug: "another-good",
          translations: [
            {
              id: 3,
              title: "Another Good",
              body: "<p>More good content</p>",
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
        .spyOn(MavenAGIClient.prototype.knowledge, "createKnowledgeDocument")
        .mockImplementation(vi.fn());

      const t = new InngestTestEngine({ function: processFunction });
      const { result } = await t.execute({
        events: [createEvent("test-resilience")],
      });

      // Articles 401 and 403 succeed, 402 fails silently (Promise.allSettled)
      expect(createDocSpy).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    },
  );
});
