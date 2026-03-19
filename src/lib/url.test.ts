import { describe, expect, it } from "vitest";

import { buildArticleUrl, extractSection } from "@/lib/url";

describe("extractSection", () => {
  it("should extract section from ct_ prefixed tag", () => {
    expect(extractSection(["ct_traveler"])).toBe("traveler");
  });

  it("should extract section from ct_owner tag", () => {
    expect(extractSection(["ct_owner"])).toBe("owner");
  });

  it("should return first matching section tag", () => {
    expect(extractSection(["other", "ct_traveler", "ct_owner"])).toBe(
      "traveler",
    );
  });

  it("should return undefined when no section tag exists", () => {
    expect(extractSection(["some-tag", "another"])).toBeUndefined();
  });

  it("should return undefined for empty tags", () => {
    expect(extractSection([])).toBeUndefined();
  });
});

describe("buildArticleUrl", () => {
  it("should construct full URL with section, id, and slug", () => {
    expect(
      buildArticleUrl(
        "https://www.tripadvisorsupport.com/en-US/hc",
        377,
        "reporting-inaccurate-business-information",
        ["ct_traveler"],
      ),
    ).toBe(
      "https://www.tripadvisorsupport.com/en-US/hc/traveler/articles/377-reporting-inaccurate-business-information",
    );
  });

  it("should use ct_owner tag for owner section", () => {
    expect(
      buildArticleUrl(
        "https://www.tripadvisorsupport.com/en-US/hc",
        402,
        "updating-my-business-details",
        ["ct_owner"],
      ),
    ).toBe(
      "https://www.tripadvisorsupport.com/en-US/hc/owner/articles/402-updating-my-business-details",
    );
  });

  it("should strip trailing slash from helpCenterUrl", () => {
    expect(
      buildArticleUrl("https://help.example.com/", 456, "test-article", [
        "ct_traveler",
      ]),
    ).toBe("https://help.example.com/traveler/articles/456-test-article");
  });

  it("should return empty string when helpCenterUrl is undefined", () => {
    expect(
      buildArticleUrl(undefined, 123, "test", ["ct_traveler"]),
    ).toBe("");
  });

  it("should return empty string when no section tag exists", () => {
    expect(
      buildArticleUrl("https://help.example.com", 123, "test", [
        "some-other-tag",
      ]),
    ).toBe("");
  });

  it("should return empty string when tags are empty", () => {
    expect(
      buildArticleUrl("https://help.example.com", 123, "test", []),
    ).toBe("");
  });
});
