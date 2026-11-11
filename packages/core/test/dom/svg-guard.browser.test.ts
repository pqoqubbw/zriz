import { describe, expect, it } from "vitest";

import logo from "../../../../apps/docs/public/brand/zriz-logo.svg?raw";
import mark from "../../../../apps/docs/public/brand/zriz-mark.svg?raw";
import { ZrizError, loadImage } from "../../src/dom";
import viewbox from "../fixtures/viewbox.svg?raw";

const svgText = (body: string, defs = ""): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="400" height="300"><defs>${defs}</defs>${body}</svg>`;

const svg = (body: string, defs = ""): Blob =>
  new Blob([svgText(body, defs)], { type: "image/svg+xml" });

const useBombText = (levels: number, fan = 4): string => {
  let defs = '<rect id="l0" width="4" height="4"/>';

  for (let level = 1; level <= levels; level += 1) {
    const uses = Array.from(
      { length: fan },
      () => `<use href="#l${level - 1}"/>`
    ).join("");

    defs += `<g id="l${level}">${uses}</g>`;
  }

  return svgText(`<use href="#l${levels}"/>`, defs);
};

const useBomb = (levels: number, fan = 4): Blob =>
  new Blob([useBombText(levels, fan)], { type: "image/svg+xml" });

const repeat = (count: number, item: (index: number) => string): string =>
  Array.from({ length: count }, (_, index) => item(index)).join("");

const outcome = async (
  blob: Blob
): Promise<{ code: string; message: string; ms: number }> => {
  const start = performance.now();
  const [code, message] = await loadImage(blob).then(
    (): [string, string] => ["loaded", ""],
    (error: unknown): [string, string] =>
      error instanceof ZrizError
        ? [error.code, error.message]
        : [String(error), String(error)]
  );

  return { code, message, ms: performance.now() - start };
};

describe("svg that would freeze the page", () => {
  it.each([
    ["a nested use bomb", useBomb(10)],
    ["a use bomb split wide", useBomb(6, 7)],
    ["use chains twelve deep", useBomb(12, 1)],
    [
      "a use that refers to itself",
      svg('<g id="a"><rect width="4" height="4"/><use href="#a"/></g>'),
    ],
    [
      "a use cycle through xlink",
      svg(
        '<use xlink:href="#b"/>',
        '<g id="b"><use xlink:href="#c"/></g><g id="c"><use xlink:href="#b"/></g>'
      ),
    ],
    ["sixty thousand shapes", svg(repeat(60_000, () => "<rect/>"))],
    [
      "a path with too many commands",
      svg(`<path d="M0 0${" l1 1".repeat(120_000)}"/>`),
    ],
    [
      "a big convolution matrix",
      svg(
        '<rect width="400" height="300" filter="url(#f)"/>',
        `<filter id="f"><feConvolveMatrix order="9" kernelMatrix="${"1 ".repeat(81)}"/></filter>`
      ),
    ],
    [
      "a long filter chain",
      svg(
        '<rect width="400" height="300" filter="url(#f)"/>',
        `<filter id="f">${repeat(50, () => '<feGaussianBlur stdDeviation="1"/>')}</filter>`
      ),
    ],
    [
      "a filter on thousands of shapes",
      svg(
        repeat(1500, () => '<rect width="4" height="4" filter="url(#f)"/>'),
        '<filter id="f"><feGaussianBlur stdDeviation="1"/></filter>'
      ),
    ],
    [
      "markers on every vertex of a long path",
      svg(
        `<path marker-mid="url(#m)" d="M0 0${" l1 1".repeat(5000)}"/>`,
        `<marker id="m">${repeat(30, () => "<circle r='1'/>")}</marker>`
      ),
    ],
    [
      "a use bomb inside a nested svg image",
      svg(
        `<image width="400" height="300" href="data:image/svg+xml;base64,${btoa(useBombText(10))}"/>`
      ),
    ],
    [
      "a use bomb behind a second element with the same id",
      new Blob(
        [
          useBombText(10).replace(
            "</svg>",
            `${repeat(11, (level) => `<rect id="l${level}"/>`)}</svg>`
          ),
        ],
        { type: "image/svg+xml" }
      ),
    ],
  ])("refuses %s before it draws", async (_name, blob) => {
    const { code, message, ms } = await outcome(blob);

    expect(code).toBe("too-large");
    expect(message).toContain("SVG");
    expect(ms).toBeLessThan(1000);
  });
});

describe("svg that draws fine", () => {
  it.each([
    ["a small use tree", useBomb(5, 4)],
    [
      "a few thousand shapes",
      svg(
        repeat(
          5000,
          (i) => `<rect x="${i % 400}" y="${i % 300}" width="2" height="2"/>`
        )
      ),
    ],
    [
      "a drop shadow on a handful of shapes",
      svg(
        repeat(20, () => '<rect width="40" height="40" filter="url(#s)"/>'),
        '<filter id="s"><feGaussianBlur stdDeviation="3"/><feOffset dx="2" dy="2"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>'
      ),
    ],
    [
      "arrows on a path",
      svg(
        `<path marker-end="url(#a)" d="M0 0${" l2 1".repeat(200)}"/>`,
        '<marker id="a"><path d="M0 0 L4 2 L0 4 z"/></marker>'
      ),
    ],
    ["the viewBox fixture", new Blob([viewbox], { type: "image/svg+xml" })],
    ["the zriz logo", new Blob([logo], { type: "image/svg+xml" })],
    ["the zriz mark", new Blob([mark], { type: "image/svg+xml" })],
  ])("opens %s", async (_name, blob) => {
    await expect(outcome(blob)).resolves.toMatchObject({ code: "loaded" });
  });
});
