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

async function processDocsForCategory(
  mavenAgi: MavenAGIClient,
  key: string,
  token: string,
  knowledgeBaseId: string
) {
  await mavenAgi.knowledge.createKnowledgeBaseVersion(knowledgeBaseId, {
    type: 'FULL',
  });

  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const articlesResponse = await callElevioApi(
      `/articles?status=published&category_id=${knowledgeBaseId}&page=${page}`,
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

    hasMorePages = page < articlesResponse.total_pages;
    page++;
  }

  await mavenAgi.knowledge.finalizeKnowledgeBaseVersion(knowledgeBaseId);
}

export default {
  async preInstall({ settings }) {
    // Make sure the elevio auth token works
    await callElevioApi('/categories', settings.key, settings.token);
  },

  async postInstall({ organizationId, agentId, settings }) {
    const mavenAgi = new MavenAGIClient({
      organizationId,
      agentId,
    });

    // Make a maven knowledge base for each elevio subcategory
    // We're using the elevio subcategory id as the knowledge base id to make Elevio API calls easy
    const categories = await callElevioApi(
      '/categories',
      settings.key,
      settings.token
    );

    for (const category of categories.categories) {
      const subcategories = category.subcategories;
      for (const subcategory of subcategories) {
        const knowledgeBase =
          await mavenAgi.knowledge.createOrUpdateKnowledgeBase({
            name: `Elevio: ${category.name} - ${subcategory.name}`,
            type: MavenAGI.KnowledgeBaseType.Api,
            knowledgeBaseId: { referenceId: `${subcategory.id}` },
          });

        // Add documents to the knowledge base
        await processDocsForCategory(
          mavenAgi,
          settings.key,
          settings.token,
          knowledgeBase.knowledgeBaseId.referenceId
        );
      }
    }
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
    await processDocsForCategory(
      mavenAgi,
      settings.key,
      settings.token,
      knowledgeBaseId.referenceId
    );
  },
};
