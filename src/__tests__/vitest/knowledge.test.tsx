
import { vi, describe, it, expect } from 'vitest';
import {MavenAGI, MavenAGIClient} from "mavenagi";
import {ELEVIO_KB_ID, refreshDocumentsFromElevio} from "../../lib/knowledge";

describe('it can sync articles', () => {
  it('can sync articles', async () => {

    vi.spyOn(global, 'fetch').mockImplementationOnce(async () => {
      return new Response(
        JSON.stringify({
          articles: [
            {
              id: '1',
              title: 'Article 1',
              content: 'Article 1 content',
            },
            {
              id: '2',
              title: 'Article 2',
              content: 'Article 2 content',
            },
          ],
          total_pages: 1,
        }),
        { status: 200 }
      );
    }).mockImplementationOnce(async () => {
        return new Response(
            JSON.stringify({
            article: {
                translations: [
                {
                    language_id: 'en',
                    title: 'Article 1',
                    body: 'Article 1 content',
                },
                ],
            },
            }),
            { status: 200 }
        );
    }).mockImplementationOnce(async () => {
        return new Response(
            JSON.stringify({
            article: {
                translations: [
                {
                    language_id: 'en',
                    title: 'Article 2',
                    body: 'Article 2 content',
                },
                ],
            },
            }),
            { status: 200 }
        );
    });


    const mockCreateOrUpdateKnowledgeBase = vi.spyOn(MavenAGIClient.prototype.knowledge, 'createOrUpdateKnowledgeBase').mockImplementation(vi.fn());
    const mockCreateKnowledgeBaseVersion = vi.spyOn(MavenAGIClient.prototype.knowledge, 'createKnowledgeBaseVersion').mockImplementation(vi.fn());
    const mockFinalizeKnowledgeBaseVersion = vi.spyOn(MavenAGIClient.prototype.knowledge, 'finalizeKnowledgeBaseVersion').mockImplementation(vi.fn());
    const mockCreateKnowledgeDocument = vi.spyOn(MavenAGIClient.prototype.knowledge, 'createKnowledgeDocument').mockImplementation(vi.fn());

    const mavenAgi = new MavenAGIClient({ organizationId: 'orgId', agentId: 'agentId' });

    await refreshDocumentsFromElevio(mavenAgi, 'foo', 'foo');

    expect(mockCreateOrUpdateKnowledgeBase).toHaveBeenCalledWith({
      name: 'Elevio',
      type: MavenAGI.KnowledgeBaseType.Api,
      knowledgeBaseId: { referenceId: ELEVIO_KB_ID },
    });

    expect(mockCreateOrUpdateKnowledgeBase).toHaveBeenCalledTimes(1);

    expect(mockFinalizeKnowledgeBaseVersion).toHaveBeenCalledTimes(2);

    expect(mockCreateKnowledgeBaseVersion).toHaveBeenCalledTimes(1);

    expect(mockCreateKnowledgeDocument).toHaveBeenCalledTimes(2);
  });

}, { timeout: 50000 });