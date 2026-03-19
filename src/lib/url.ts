/** Slugify a title for URL construction */
export function slugifyTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Construct the public URL for an Elevio help center article.
 *
 * The `helpCenterUrl` setting should be the base path up to (but not including)
 * `/articles/`. For example:
 *   - "https://www.tripadvisorsupport.com/en-US/hc/traveler"
 *   - "https://help.example.com/en"
 *
 * Pattern: {helpCenterUrl}/articles/{id}
 *
 * Returns empty string if helpCenterUrl is not configured.
 */
export function buildArticleUrl(
  helpCenterUrl: string | undefined,
  articleId: number,
  _title: string,
): string {
  if (!helpCenterUrl) {
    return "";
  }

  const baseUrl = helpCenterUrl.replace(/\/$/, "");
  return `${baseUrl}/articles/${articleId}`;
}
