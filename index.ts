import { MavenAGIClient, MavenAGI } from 'mavenagi';
const ELEVIO_API_BASE_URL = 'https://api.elev.io/v1';

// Function to call Elev.io API
async function callElevioApi(path: string, token: string) {
  const endpoint = `${ELEVIO_API_BASE_URL}${path}`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-api-key': token, // Make sure the token is retrieved from settings
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch data from Elev.io API. Endpoint: ${endpoint}`);
  }

  console.log('Successful Elev.io API call for ' + endpoint);
  return response.json();
}

// Function to process documents for a specific category
async function processDocsForCategory(mavenAgi, token, knowledgeBaseId) {
  const docs = await callElevioApi(`/categories/${knowledgeBaseId}/articles`, token);

  for (const doc of docs.articles) {
    const fullElevioDoc = await callElevioApi(`/articles/${doc.id}`, token);

    await mavenAgi.knowledge.createKnowledgeDocument({
      knowledgeBaseId,
      title: fullElevioDoc.title,
      content: fullElevioDoc.body,
      documentId: doc.id,
    });
  }

  await mavenAgi.knowledge.finalizeKnowledgeBaseVersion({
    knowledgeBaseId: knowledgeBaseId,
  });
}

export default {
  async preInstall({ settings }) {
    try {
      await callElevioApi('/categories', settings.token);
    } catch (error) {
      console.error('Invalid Elev.io token', error);
    }
  },

  async postInstall({ organizationId, agentId, settings }) {
    const mavenAgi = new MavenAGIClient({
      organizationId,
      agentId,
    });

    try {
      const categories = await callElevioApi('/categories', settings.token);

      for (const category of categories.categories) {
        const knowledgeBase = await mavenAgi.knowledge.createKnowledgeBase({
          displayName: 'Elevio: ' + category.title,
          type: MavenAGI.KnowledgeBaseType.Api,
          knowledgeBaseId: category.id,
        });
        await processDocsForCategory(
          mavenAgi,
          settings.token,
          knowledgeBase.knowledgeBaseId
        );
      }
    } catch (error) {
      console.error('Error during postInstall process:', error);
    }
  },

  async knowledgeBaseRefresh({
    organizationId,
    agentId,
    knowledgeBaseId,
    settings,
  }) {
    const mavenAgi = new MavenAGIClient({ organizationId, agentId });

    try {
      await mavenAgi.knowledge.createKnowledgeBaseVersion({
        knowledgeBaseId: knowledgeBaseId,
        type: MavenAGI.KnowledgeBaseVersionType.Full,
      });
      await processDocsForCategory(mavenAgi, settings.token, knowledgeBaseId);
    } catch (error) {
      console.error('Error during knowledgeBaseRefresh process:', error);
    }
  },
};
