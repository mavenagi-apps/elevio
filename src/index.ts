import { MavenAGIClient, MavenAGI } from 'mavenagi';
const ELEVIO_API_BASE_URL = 'https://api.elev.io/v1';

async function callElevioApi(path: string, key: string, token: string) {
  const endpoint = `${ELEVIO_API_BASE_URL}${path}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': key,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch data from Elev.io API. Endpoint: ${endpoint}`
    );
  }

  console.log('Successful Elev.io API call for ' + endpoint);
  return response.json();
}

async function refreshDocumentsFromElevio(
  mavenAgi: MavenAGIClient,
  key: string,
  token: string,
  knowledgeBaseId: string
) {
  // Just in case we had a past failure, finalize any old versions so we can start from scratch
  // TODO(maven): Make the platform more lenient so this isn't necessary
  try {
    await mavenAgi.knowledge.finalizeKnowledgeBaseVersion(knowledgeBaseId);
  } catch (error) {
    // Ignored
  }

  // Make a new kb version
  await mavenAgi.knowledge.createKnowledgeBaseVersion(knowledgeBaseId, {
    type: 'FULL',
  });

  // Fetch and save all elevio articles to the kb
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const articlesResponse = await callElevioApi(
      `/articles?status=published&page=${page}`,
      key,
      token
    );

    for (const doc of articlesResponse.articles) {
      const fullElevioDoc = await callElevioApi(
        `/articles/${doc.id}`,
        key,
        token
      );
      const englishTranslation = fullElevioDoc.article.translations.find(
        (translation) =>
          translation.language_id === 'en' ||
          translation.language_id === 'en-us'
      );

      if (englishTranslation) {
        await mavenAgi.knowledge.createKnowledgeDocument(knowledgeBaseId, {
          title: englishTranslation.title,
          content: englishTranslation.body,
          contentType: 'HTML',
          knowledgeDocumentId: { referenceId: `${doc.id}` },
        });
      } else {
        console.warn(`No English translation found for article ID: ${doc.id}`);
      }
    }

    console.log('Finished processing page ' + page + '/' + articlesResponse.total_pages);
    hasMorePages = page < articlesResponse.total_pages;  
    page++;
  }

  // Finalize the version
  console.log('Finished processing all articles');
  await mavenAgi.knowledge.finalizeKnowledgeBaseVersion(knowledgeBaseId);
}

export default {
  async preInstall({ settings }) {
    // Make sure the elevio auth token works
    await callElevioApi('/categories', settings.key, settings.token);
  },

  async postInstall({ organizationId, agentId, settings }) {
    const mavenAgi = new MavenAGIClient({ organizationId, agentId });

    // Make one maven knowledge base for elevio
    await mavenAgi.knowledge.createOrUpdateKnowledgeBase({
      name: 'Elevio',
      type: MavenAGI.KnowledgeBaseType.Api,
      knowledgeBaseId: { referenceId: 'elevio' },
    });
    await refreshDocumentsFromElevio(
      mavenAgi,
      settings.key,
      settings.token,
      'elevio'
    );
  },

  async knowledgeBaseRefreshed({
    organizationId,
    agentId,
    knowledgeBaseId,
    settings,
  }) {
    console.log('Refresh request for ' + knowledgeBaseId.referenceId);
    const mavenAgi = new MavenAGIClient({ organizationId, agentId });

    // If we get a refresh request, create a new version for the knowledge base and add documents
    await refreshDocumentsFromElevio(
      mavenAgi,
      settings.key,
      settings.token,
      knowledgeBaseId.referenceId
    );
  },
};
