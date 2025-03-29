import { MavenAGIClient, MavenAGI } from 'mavenagi';
import {refreshDocumentsFromElevio} from "./lib";
import {callElevioApi} from "./lib/knowledge";

export default {
  async preInstall({ settings }) {
    // Make sure the elevio auth token works
    await callElevioApi('/categories', settings.key, settings.token);
  },

  async postInstall({ organizationId, agentId, settings }) {
    const mavenAgi = new MavenAGIClient({ organizationId, agentId });

    await refreshDocumentsFromElevio(
      mavenAgi,
      settings.key,
      settings.token,
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

    await refreshDocumentsFromElevio(
      mavenAgi,
      settings.key,
      settings.token,
    );
  },
};
