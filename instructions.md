# Product Requirements Document

This project is to refactor the existing code to use the @mavenagi/knowledge-base-integration package to simplify the code and make it more readable.

# Core Functionality


1. Keep the existing `callElevioApi` function as is, and take note of all the existing code inside the `refreshDocumentsFromElevio`, `preInstall`, `postInstall`, and `knowledgeBaseRefreshed` functions.  If you need to rename the functions so we can reference the code in the subsequent steps.

2. Use the following code as a starting point to implement the core functionality.

```typescript
import MavenAGIKnowledgeBaseIntegration from '@mavenagi/knowledge-base-integration';

const { preInstall, postInstall, knowledgeBaseRefreshed } = new MavenAGIKnowledgeBaseIntegration({
  preInstallTest: async ({ settings, organizationId, agentId }) => {
    // Implement your pre-install test logic here
  },
  generatePaginatedResults: async function* ({ settings, organizationId, agentId }) {
    // Implement your data fetching logic in an async generator here
    // yield results as an array of { id, title, content } objects
  },
  convertDataToMD: (documentBodyPayload: string) => {
    const turndownService = new TurndownService();
    turndownService.use(gfm);
    return turndownService.turndown(responsePayload);
  }
});

export default {
  preInstall,
  postInstall,
  knowledgeBaseRefreshed,
}

``` 

3. Add the exported functions created when creating an instance of `MavenAGIKnowledgeBaseIntegration` to the `export default` statement.
4. Implement the `preInstallTest` function to test the connection to the data provider by taking all the existing code in the original `preInstall` function and placing it in the `preInstallTest` function.
5. Implement the `generatePaginatedResults` function by taking all the existing code from lines 44 to 82 in the original function `refreshDocumentsFromElevio`, and placing it in the `generatePaginatedResults` function, but instead of calling `await mavenAgi.knowledge.createKnowledgeDocument`, we need to yield the list of articles as an array of { id, title, content } objects.
6. Implement the `convertDataToMD` function by taking all the existing code in the `convertDataToMD` function example and placing it in the `convertDataToMD` function.



## Documentation

* [Maven AGI Knowledge Base Integration](https://www.npmjs.com/package/@mavenagi/knowledge-base-integration)
* [Elev.io API Documentation](https://docs.elev.io/)

