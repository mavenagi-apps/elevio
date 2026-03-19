import { sendProcessEvent } from "@mavenagi/apps-core/knowledge/inngest";

import { validateCredentials } from "@/lib/api";
import { ConnectorSettingsSchema } from "@/settings";

const hooks = {
  async preInstall({
    settings,
  }: {
    organizationId: string;
    agentId: string;
    settings: AppSettings;
  }) {
    ConnectorSettingsSchema.parse(settings);
    await validateCredentials(settings);
  },

  async postInstall({
    organizationId,
    agentId,
    settings,
  }: {
    organizationId: string;
    agentId: string;
    settings: AppSettings;
  }) {
    await sendProcessEvent({ organizationId, agentId, settings });
  },

  async executeAction(_params: {
    actionId: string;
    parameters: Record<string, string>;
  }) {
    // No actions for Elevio connector
  },

  async knowledgeBaseRefreshed({
    organizationId,
    agentId,
    knowledgeBaseId,
    settings,
  }: {
    organizationId: string;
    agentId: string;
    knowledgeBaseId: { referenceId: string };
    settings: AppSettings;
  }) {
    await sendProcessEvent({
      organizationId,
      agentId,
      knowledgeBaseId: knowledgeBaseId.referenceId,
      settings,
    });
  },
};

export default hooks;
