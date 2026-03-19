export const KNOWLEDGE_BASE_NAME = "Elevio";
export const KNOWLEDGE_BASE_ID = "elevio";
export const APP_ID = process.env.MAVENAGI_APP_ID ?? "elevio";

export const ELEVIO_API_BASE_URL = "https://api.elev.io/v1";

// Language IDs considered "English" for filtering
export const ENGLISH_LANGUAGE_IDS = ["en", "en-us"] as const;

// Rate limiting: conservative defaults for Elevio API
export const API_MAX_CONCURRENT = 5;
export const API_MIN_TIME_MS = 200;
