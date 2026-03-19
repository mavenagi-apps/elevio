/** Response shape from GET /articles (paginated list) */
export interface ElevioArticlesListResponse {
  articles: ElevioArticleSummary[];
  page_number: number;
  total_pages: number;
  total_entries: number;
}

export interface ElevioArticleSummary {
  id: number;
  title: string;
  status: string;
  category_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Response shape from GET /articles/{id} (full detail) */
export interface ElevioArticleDetailResponse {
  article: ElevioArticleDetail;
}

export interface ElevioArticleDetail {
  id: number;
  title: string;
  slug: string;
  status: string;
  category_id: number | null;
  translations: ElevioTranslation[];
  keywords: string[];
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface ElevioTranslation {
  id: number;
  title: string;
  body: string;
  summary?: string;
  language_id: string;
  keywords?: string[];
  created_at: string;
  updated_at: string;
}
