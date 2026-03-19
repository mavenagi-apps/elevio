export const KNOWLEDGE_BASE_NAME = "Elevio";
export const KNOWLEDGE_BASE_ID = "elevio";
export const APP_ID = process.env.MAVENAGI_APP_ID ?? "elevio";

export const ELEVIO_API_BASE_URL = "https://api.elev.io/v1";

// Language IDs considered "English" for filtering
export const ENGLISH_LANGUAGE_IDS = ["en", "en-us"] as const;

// Rate limiting: conservative defaults for Elevio API
export const API_MAX_CONCURRENT = 5;
export const API_MIN_TIME_MS = 200;

// Articles to process per Inngest step.run() (~4s each step)
export const ARTICLES_PER_STEP = 25;

// Parallel articles within a mini-batch inside each step
export const ARTICLES_PER_BATCH = 5;

// Maven API calls per second (100ms between calls)
export const MAVEN_API_RATE_LIMIT = 10;

// Fire-and-forget wait before returning from finalize step (ms)
export const FINALIZATION_DELAY_MS = 5000;

// Abort fetch requests that hang longer than this (ms)
export const FETCH_TIMEOUT_MS = 30_000;
