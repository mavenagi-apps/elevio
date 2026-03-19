/** Prefix used on Elevio tags that map to help center URL sections */
const TAG_SECTION_PREFIX = "ct_";

/**
 * Extract the help center section from an article's tags.
 *
 * Elevio tags like "ct_traveler" or "ct_owner" map to URL sections
 * (e.g. /traveler, /owner). Returns the first matching section,
 * or undefined if no section tag is present.
 */
export function extractSection(tags: string[]): string | undefined {
  const sectionTag = tags.find((t) => t.startsWith(TAG_SECTION_PREFIX));
  return sectionTag?.slice(TAG_SECTION_PREFIX.length);
}

/**
 * Construct the public URL for an Elevio help center article.
 *
 * Uses the article's tags to determine the section.
 *
 * Pattern: {helpCenterUrl}/{section}/articles/{id}
 *
 * The `helpCenterUrl` setting should be the base path up to (but not including)
 * the section. For example: "https://www.tripadvisorsupport.com/en-US/hc"
 *
 * Returns empty string if helpCenterUrl is not configured or no section tag exists.
 */
export function buildArticleUrl(
  helpCenterUrl: string | undefined,
  articleId: number,
  tags: string[],
): string {
  if (!helpCenterUrl) {
    return "";
  }

  const section = extractSection(tags);
  if (!section) {
    return "";
  }

  const baseUrl = helpCenterUrl.replace(/\/$/, "");
  return `${baseUrl}/${section}/articles/${articleId}`;
}
