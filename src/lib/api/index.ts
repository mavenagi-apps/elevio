import { apiLimiter, buildBaseUrl, buildHeaders } from "@/lib/client";
import type {
  ElevioArticleDetailResponse,
  ElevioArticlesListResponse,
} from "@/lib/knowledge";

async function callElevioApi<T>(
  path: string,
  settings: AppSettings,
): Promise<T> {
  const endpoint = `${buildBaseUrl()}${path}`;
  const response = await apiLimiter.schedule(() =>
    fetch(endpoint, {
      method: "GET",
      headers: buildHeaders(settings),
    }),
  );

  if (!response.ok) {
    throw new Error(
      `Elevio API error: ${response.status} ${response.statusText} for ${endpoint}`,
    );
  }

  return response.json() as Promise<T>;
}

/** Validate credentials by calling a lightweight endpoint */
export async function validateCredentials(
  settings: AppSettings,
): Promise<void> {
  await callElevioApi("/categories", settings);
}

/** Fetch a paginated list of published articles */
export async function fetchArticlesPage(
  settings: AppSettings,
  page: number,
): Promise<ElevioArticlesListResponse> {
  return callElevioApi<ElevioArticlesListResponse>(
    `/articles?status=published&page=${page}`,
    settings,
  );
}

/** Fetch a single article with full detail (including translations) */
export async function fetchArticleById(
  settings: AppSettings,
  articleId: number,
): Promise<ElevioArticleDetailResponse> {
  return callElevioApi<ElevioArticleDetailResponse>(
    `/articles/${articleId}`,
    settings,
  );
}
