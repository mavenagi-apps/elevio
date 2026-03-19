export { GET, POST, PUT } from "@mavenagi/apps-core/knowledge/inngest";

// Extend Vercel serverless function timeout from the default (60s) to 300s.
// Each Inngest step.run() invocation is a separate HTTP request — without this,
// steps that include Redis cache operations + Maven API uploads can exceed
// the default timeout and produce 524 errors from Cloudflare.
export const maxDuration = 300;
