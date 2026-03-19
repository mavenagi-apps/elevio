import Bottleneck from "bottleneck";

import {
  API_MAX_CONCURRENT,
  API_MIN_TIME_MS,
  ELEVIO_API_BASE_URL,
} from "@/lib/constants";

export const apiLimiter = new Bottleneck({
  maxConcurrent: API_MAX_CONCURRENT,
  minTime: API_MIN_TIME_MS,
});

export function buildHeaders(settings: AppSettings): Record<string, string> {
  return {
    Authorization: `Bearer ${settings.token}`,
    "x-api-key": settings.key,
    "Content-Type": "application/json",
  };
}

export function buildBaseUrl(): string {
  return ELEVIO_API_BASE_URL;
}
