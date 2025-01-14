import {MavenAGI, MavenAGIClient} from "mavenagi";

export const ELEVIO_KB_ID = 'elevio';
export const ELEVIO_API_BASE_URL = 'https://api.elev.io/v1';

export async function callElevioApi(path: string, key: string, token: string) {
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

export async function refreshDocumentsFromElevio(
    mavenAgi: MavenAGIClient,
    key: string,
    token: string
) {
    // Just in case we had a past failure, finalize any old versions so we can start from scratch
    // TODO(maven): Make the platform more lenient so this isn't necessary
    try {
        await mavenAgi.knowledge.finalizeKnowledgeBaseVersion(ELEVIO_KB_ID);
    } catch (error) {
        // Ignored
    }

    await mavenAgi.knowledge.createOrUpdateKnowledgeBase({
        name: 'Elevio',
        type: MavenAGI.KnowledgeBaseType.Api,
        knowledgeBaseId: { referenceId: ELEVIO_KB_ID },
    });

    // Make a new kb version
    await mavenAgi.knowledge.createKnowledgeBaseVersion(ELEVIO_KB_ID, {
        type: 'FULL',
    });

    // Fetch and save all elevio articles to the kb
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
        let articlesResponse = undefined;
        try {
            articlesResponse = await callElevioApi(
                `/articles?status=published&page=${page}`,
                key,
                token
            );
        } catch(e) {
            console.warn('Failed to call Elevio API');
        }

        if(!articlesResponse) {
            break;
        }

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
                await mavenAgi.knowledge.createKnowledgeDocument(ELEVIO_KB_ID, {
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
    await mavenAgi.knowledge.finalizeKnowledgeBaseVersion(ELEVIO_KB_ID);
}