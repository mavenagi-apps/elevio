export const KNOWLEDGE_BASE_NAME = "Elevio";
export const KNOWLEDGE_BASE_ID = "elevio";
export const APP_ID = process.env.MAVENAGI_APP_ID ?? "elevio";

export const ELEVIO_API_BASE_URL = "https://api.elev.io/v1";

// Language IDs considered "English" for filtering
export const ENGLISH_LANGUAGE_IDS = ["en", "en-us"] as const;

// Rate limiting: conservative defaults for Elevio API
export const API_MAX_CONCURRENT = 5;
export const API_MIN_TIME_MS = 200;

// Max articles to fetch per chunk (keeps each Inngest step under timeout).
// Each chunk runs fetchData + convertToMavenDocuments + Maven uploads in a
// single step.run(), so this must be small enough that the combined work
// (detail fetches + HTML→MD conversion + uploads) finishes well under 100s.
export const ELEVIO_CHUNK_SIZE = 5;

// Abort fetch requests that hang longer than this (ms)
export const FETCH_TIMEOUT_MS = 30_000;
