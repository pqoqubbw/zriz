import { describe, expect, it } from "vitest";

import { sniff } from "../../src/dom";
import { svgSize } from "../../src/dom/svg-size";

const encode = (text: string): Uint8Array => new TextEncoder().encode(text);

const SLOW = 1000;

describe("sniffing svg text", () => {
  it.each([
    ["<svg>", "image/svg+xml"],
    ['<?xml version="1.0"?>\n<svg width="1">', "image/svg+xml"],
    [
      '<?xml version="1.0"?><?xml-stylesheet href="a.css"?><svg>',
      "image/svg+xml",
    ],
    ["<!-- a -- b -->\n<svg>", "image/svg+xml"],
    ['<!DOCTYPE svg PUBLIC "a" "b"><svg>', "image/svg+xml"],
    ['<!DOCTYPE svg [ <!ENTITY a "b"> ] ><svg>', "image/svg+xml"],
    ["  <!---->  <!-- x --><svg\n>", "image/svg+xml"],
    ['<svg:svg xmlns:svg="http://www.w3.org/2000/svg">', "image/svg+xml"],
    ['<?xml version="1.0"?><my-ns.1:svg xmlns:my-ns.1="a">', "image/svg+xml"],
    ["<svgx>", null],
    ["<html><svg>", null],
    ["<!-- open <svg>", null],
    ["<?xml <svg>", null],
    ["text", null],
    ["<svg:svgx>", null],
    ["<:svg>", null],
    ["<a:b:svg>", null],
  ])("sniffs %s as %s", (text, mime) => {
    expect(sniff(encode(text)).mime).toBe(mime);
  });

  it("reads a prolog longer than the old head", () => {
    const text = `<?xml version="1.0"?><!-- ${"x".repeat(1000)} --><svg>`;

    expect(sniff(encode(text)).mime).toBe("image/svg+xml");
  });

  it("reads little and big endian text", () => {
    const text = "<svg>";
    const le = new Uint8Array([
      0xff,
      0xfe,
      ...[...encode(text)].flatMap((code) => [code, 0]),
    ]);
    const be = new Uint8Array([
      0xfe,
      0xff,
      ...[...encode(text)].flatMap((code) => [0, code]),
    ]);

    expect(sniff(le).mime).toBe("image/svg+xml");
    expect(sniff(be).mime).toBe("image/svg+xml");
  });
});

describe("the size of an svg", () => {
  it.each([
    ['<svg width="10cm" height="10cm">', 96 / 0.254, 96 / 0.254],
    ['<svg width="1in" height="2in">', 96, 192],
    ['<svg width="96pt" height="12pc">', 128, 192],
    ['<svg width="25.4mm" height="101.6q">', 96, 96],
    ['<svg width="10PX" height=" 20 ">', 10, 20],
    ['<svg width="10" viewBox="0 0 2 1">', 10, 5],
    ['<svg height="10" viewBox="0,0,2,1">', 20, 10],
    ['<svg viewBox="0 0 30 20">', 30, 20],
    ["<svg>", 300, 150],
    ['<svg width="100%" height="100%">', 300, 150],
    ['<svg width="200">', 200, 150],
    ['<svg height="75">', 300, 75],
    ['<svg width="10cm" height="100%">', 96 / 0.254, 150],
    ['<svg width="1em" height="2ex">', 300, 150],
    ['<svg:svg xmlns:svg="a" width="400" height="200"/>', 400, 200],
    ['<?xml version="1.0"?><s:svg viewBox="0 0 30 20"/>', 30, 20],
    ['<!-- <svg width="1" height="1"> --><svg viewBox="0 0 100 50"/>', 100, 50],
    [
      '<!DOCTYPE svg [ <!ENTITY a "<svg width=\'1\' height=\'1\'>"> ]><svg width="9" height="9"/>',
      9,
      9,
    ],
    ['<svg data-note="a>b" width="100" height="50"/>', 100, 50],
    [
      `<svg data-note=" width='999' height='999'" viewBox="0 0 10 10"/>`,
      10,
      10,
    ],
  ])("reads %s", (text, width, height) => {
    const size = svgSize(text);

    expect(size.width).toBeCloseTo(width);
    expect(size.height).toBeCloseTo(height);
  });

  it.each([
    '<svg viewBox="0 0 Infinity 1"/>',
    '<svg viewBox="0 0 1e308 1e-308" height="100"/>',
    '<svg viewBox="0 0 1e308 1e-308" width="100"/>',
    '<svg width="1e308" height="1e400"/>',
  ])("falls back on the default for %s", (text) => {
    const { width, height } = svgSize(text);

    expect(Number.isFinite(width) && width > 0).toBeTruthy();
    expect(Number.isFinite(height) && height > 0).toBeTruthy();
  });
});

describe("hostile svg text", () => {
  it.each<readonly [string, () => unknown, unknown]>([
    [
      "a long name with no prefix",
      () => sniff(encode(`<${"a".repeat(1_000_000)}`)).mime,
      null,
    ],
    ...(
      [
        ["<!---->", 30],
        ["<!DOCTYPE a[]>", 26],
        ["<!DOCTYPE >", 26],
        ["<!-- a -->\n", 30],
        ["<?a?>", 500],
      ] as const
    ).map(
      ([unit, count]) =>
        [
          `a long prolog of ${unit}`,
          () => sniff(encode(`${unit.repeat(count)}<svgx`)).mime,
          null,
        ] as const
    ),
    ...(
      [
        ["<svg ", 60_000],
        ['<svg "', 60_000],
        ["<!--", 200_000],
        ["<!DOCTYPE a", 100_000],
      ] as const
    ).map(
      ([unit, count]) =>
        [
          `an unclosed root of ${unit}`,
          () => svgSize(unit.repeat(count)),
          { height: 150, width: 300 },
        ] as const
    ),
    ...(["a", "e"] as const).map(
      (unit) =>
        [
          `a long run of ${unit} in a tag`,
          () => {
            const value = unit.repeat(2_000_000);

            return svgSize(`<svg width="${value}" ${value}>`);
          },
          { height: 150, width: 300 },
        ] as const
    ),
    [
      "a root behind a huge comment",
      () =>
        svgSize(`<!--${"x".repeat(20_000_000)}--><svg width="4" height="2">`),
      { height: 2, width: 4 },
    ],
  ])("reads %s in linear time", (_name, run, expected) => {
    const start = performance.now();

    expect(run()).toStrictEqual(expected);
    expect(performance.now() - start).toBeLessThan(SLOW);
  });
});
