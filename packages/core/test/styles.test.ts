import { readFileSync } from "node:fs";
import path from "node:path";

import { transform } from "lightningcss";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  path.resolve(import.meta.dirname, "../src/styles.css")
);

const version = (major: number, minor = 0): number =>
  major * 65_536 + minor * 256;

const lower = (): string =>
  transform({
    code: source,
    filename: "styles.css",
    minify: true,
    targets: { chrome: version(111), safari: version(16, 4) },
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

  it("keeps colours when a consumer's bundler lowers light-dark()", () => {
    const css = lower();

    expect(css).toContain("var(--lightningcss-light");

    expect(css).toMatch(
      /:where\(\[data-zriz-item\]\)\{[^}]*--lightningcss-light:initial;[^}]*--lightningcss-dark: ;/u
    );

    expect(css).toMatch(
      /@media[^{]*prefers-color-scheme:\s*dark[^{]*\{:where\(\[data-zriz-item\]\)\{[^}]*--lightningcss-light: ;[^}]*--lightningcss-dark:initial/u
    );

    expect(css).toMatch(
      /\[data-zriz-item\]:is\(\[data-theme=dark\],\.dark\)\)\{[^}]*--lightningcss-light: ;[^}]*--lightningcss-dark:initial/u
    );
  });

  it("still follows the page colour scheme when nothing is lowered", () => {
    const css = transform({
      code: source,
      filename: "styles.css",
      minify: true,
      targets: {
        chrome: version(139),
        firefox: version(142),
        safari: version(18),
      },
    }).code.toString();

    expect(css).toContain(
      "color-scheme:light dark;color-scheme:var(--zriz-scheme)"
    );

    expect(css).not.toContain("--lightningcss");
  });
});
