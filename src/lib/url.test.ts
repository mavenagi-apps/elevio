import { describe, expect, it } from "vitest";

import { buildArticleUrl, slugifyTitle } from "@/lib/url";

describe("slugifyTitle", () => {
  it("should convert title to kebab-case", () => {
    expect(slugifyTitle("Getting Started")).toBe("getting-started");
  });

  it("should remove special characters", () => {
    expect(slugifyTitle("FAQ: Billing & Payments")).toBe(
      "faq-billing-payments",
    );
  });

  it("should handle empty string", () => {
    expect(slugifyTitle("")).toBe("");
  });

  it("should collapse multiple spaces and dashes", () => {
    expect(slugifyTitle("How  to   Use  This")).toBe("how-to-use-this");
  });

  it("should trim leading and trailing dashes", () => {
    expect(slugifyTitle(" Hello World ")).toBe("hello-world");
  });
});

describe("buildArticleUrl", () => {
  it("should construct URL from helpCenterUrl and article ID", () => {
    expect(
      buildArticleUrl("https://help.example.com/en", 123, "Getting Started"),
    ).toBe("https://help.example.com/en/articles/123");
  });

  it("should strip trailing slash from helpCenterUrl", () => {
    expect(buildArticleUrl("https://help.example.com/", 456, "Test")).toBe(
      "https://help.example.com/articles/456",
    );
  });

  it("should return empty string when helpCenterUrl is undefined", () => {
    expect(buildArticleUrl(undefined, 123, "Test")).toBe("");
  });

  it("should work with nested help center base paths", () => {
    expect(
      buildArticleUrl(
        "https://www.tripadvisorsupport.com/en-US/hc/traveler",
        377,
        "Reporting inaccurate business information",
      ),
    ).toBe(
      "https://www.tripadvisorsupport.com/en-US/hc/traveler/articles/377",
    );
  });
});
