import { z } from "zod";

import { ConnectorSettingsSchema } from "./src/settings";

declare global {
  type AppSettings = z.infer<typeof ConnectorSettingsSchema>;
}

export {};
