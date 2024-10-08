import { MavenAGIClient, MavenAGI } from 'mavenagi';
import MavenAGIKnowledgeBaseIntegration from '@mavenagi/knowledge-base-integration';
import TurndownService from 'turndown';
import gfm from 'turndown-plugin-gfm';

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

const { preInstall, postInstall, knowledgeBaseRefreshed } = new MavenAGIKnowledgeBaseIntegration({
  preInstallTest: async ({ settings }) => {
    // Make sure the elevio auth token works
    await callElevioApi('/categories', settings.key, settings.token);
  },
  generatePaginatedResults: async function* ({ settings }) {
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const articlesResponse = await callElevioApi(
        `/articles?status=published&page=${page}`,
        settings.key,
        settings.token
      );

      const articles = [];

      for (const doc of articlesResponse.articles) {
        const fullElevioDoc = await callElevioApi(
          `/articles/${doc.id}`,
          settings.key,
          settings.token
        );
        const englishTranslation = fullElevioDoc.article.translations.find(
          (translation) =>
            translation.language_id === 'en' ||
            translation.language_id === 'en-us'
        );

        if (englishTranslation) {
          articles.push({
            id: `${doc.id}`,
            title: englishTranslation.title,
            content: englishTranslation.body,
          });
        } else {
          console.warn(`No English translation found for article ID: ${doc.id}`);
        }
      }

      yield articles;

      console.log('Finished processing page ' + page + '/' + articlesResponse.total_pages);
      hasMorePages = page < articlesResponse.total_pages;  
      page++;
    }

    console.log('Finished processing all articles');
  },
  convertDataToMD: (documentBodyPayload: string) => {
    const turndownService = new TurndownService();
    turndownService.use(gfm);
    return turndownService.turndown(documentBodyPayload);
  }
});

export default {
  preInstall,
  postInstall,
  knowledgeBaseRefreshed,
};
