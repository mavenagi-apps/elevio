import { z } from "zod";

export const ConnectorSettingsSchema = z.object({
  key: z.string().min(1, "Elevio API key is required"),
  token: z.string().min(1, "Elevio API token is required"),
  helpCenterUrl: z
    .string()
    .url("Must be a valid URL")
    .optional()
    .describe(
      "Base URL for Elevio help center (e.g., https://docs.elevio.help). Used to construct article URLs.",
    ),
});

export const AppSettingsSchema = z.object({
  organizationId: z.string().optional(),
  agentId: z.string().optional(),
  knowledgeBaseId: z.string().optional(),
  settings: ConnectorSettingsSchema,
});
