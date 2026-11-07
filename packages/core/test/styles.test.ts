import { readFileSync } from "node:fs";
import path from "node:path";

import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(import.meta.dirname, "../src/styles.css")
);

const version = (major: number, minor = 0): number =>
  major * 65_536 + minor * 256;

const lower = (targets: Record<string, number>): string =>
  transform({
    code: source,
    filename: "styles.css",
    minify: true,
    targets,
  }).code.toString();

describe("styles", () => {
  it("leaves a page's own data-edge elements alone", () => {
    const rules = source
      .toString()
      .replaceAll(/\s+/gu, " ")
      .split("{")
      .filter((selector) => selector.includes("data-edge"));

    expect(rules.length).toBeGreaterThan(0);

    for (const selector of rules) {
      expect(selector).toContain('[data-zriz-item="handle"]');
    }
  });

  it("keeps its default colours and the page colour scheme through a bundler", () => {
    expect(source.toString()).not.toContain("light-dark(");

    expect(lower({ chrome: version(111), safari: version(16, 4) })).toContain(
      "CanvasText"
    );

    expect(
      lower({
        chrome: version(139),
        firefox: version(142),
        safari: version(18),
      })
    ).not.toContain("--lightningcss");
  });
});
