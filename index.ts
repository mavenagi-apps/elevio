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
    throw new Error(`Failed to fetch data from Elev.io API. Endpoint: ${endpoint}`);
  }

  console.log('Successful Elev.io API call for ' + endpoint);
  return response.json();
}

async function processDocsForCategory(mavenAgi, key: string, token: string, knowledgeBaseId: string) {
  const docs = await callElevioApi(`/categories/${knowledgeBaseId}/articles`, token);

  for (const doc of docs.articles) {
    const fullElevioDoc = await callElevioApi(`/articles/${doc.id}`, key, token);

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
      await callElevioApi('/categories', settings.key, settings.token);
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
      const categories = await callElevioApi('/categories', settings.key, settings.token);

      for (const category of categories.categories) {
        const knowledgeBase = await mavenAgi.knowledge.createKnowledgeBase({
          displayName: 'Elevio: ' + category.title,
          type: MavenAGI.KnowledgeBaseType.Api,
          knowledgeBaseId: category.id,
        });
        await processDocsForCategory(
          mavenAgi,
          settings.key,
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
      await processDocsForCategory(mavenAgi, settings.key, settings.token, knowledgeBaseId);
    } catch (error) {
      console.error('Error during knowledgeBaseRefresh process:', error);
    }
  },
};
