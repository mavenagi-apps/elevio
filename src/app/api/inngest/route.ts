import { serve } from "inngest/next";

import { inngest } from "@/inngest/client";
import { processFunction } from "@/inngest/functions/process";

export const maxDuration = 300;

const handler = serve({
  client: inngest,
  functions: [processFunction],
  signingKey: process.env.INNGEST_SIGNING_KEY,
});

export const GET = handler;
export const POST = handler;
export const PUT = handler;
