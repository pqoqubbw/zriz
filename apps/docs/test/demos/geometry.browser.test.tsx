import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import IntroductionDemo from "../../demos/introduction/demo";
import { DEMO_NAMES, DEMO_SPECS } from "../../demos/registry";
import type { DemoWidth } from "../../demos/shell/sizes";
import { WIDTHS, editorBoard, panelHeight } from "./board";
import type { Box } from "./board";
import { boxIn, find, item, mountFrame, mountLive, ready } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

type Measured = Record<string, Box>;

const TOLERANCE = 0.5;

const PARTS = {
  download: '[data-slot="corner-end"] > :last-child',
  end: '[data-slot="zone-row"] > :last-child',
  open: '[data-slot="corner-start"] > :first-child',
  ruler: '[data-slot="ruler"]',
  stage: '[data-slot="stage"]',
  start: '[data-slot="zone-row"] > :first-child',
  value: '[data-slot="value"]',
  zone: '[data-slot="zone"]',
} as const;

const measure = (): Measured => {
  const panel = find("[data-demo]");
  const out: Measured = { panel: boxIn(panel, panel) };

  for (const [name, selector] of Object.entries(PARTS)) {
    out[name] = boxIn(find(selector, panel), panel);
  }

  return out;
};

const CROP_TOLERANCE = 1;

const near = (actual: number, expected: number, tolerance: number): boolean =>
  Number.isNaN(expected) || Math.abs(actual - expected) <= tolerance;

const offBy = (actual: Box, expected: Box, tolerance = TOLERANCE): string[] =>
  (["x", "y", "width", "height"] as const)
    .filter((key) => !near(actual[key], expected[key], tolerance))
    .map(
      (key) => `${key} ${actual[key].toFixed(2)} != ${expected[key].toFixed(2)}`
    );

const againstBoard = (measured: Measured, width: DemoWidth): string[] => {
  const board = editorBoard(width);
  const expected: Record<string, Box> = {
    download: board.download,
    end: board.dial.end,
    open: { height: 32, width: Number.NaN, x: 12, y: board.openTop },
    panel: board.panel,
    ruler: board.dial.ruler,
    stage: board.stage,
    start: board.dial.start,
    value: board.dial.value,
    zone: board.dial.zone,
  };

  return Object.entries(expected).flatMap(([name, box]) => {
    const got = measured[name];

    return got
      ? offBy(got, box).map((line) => `${name} ${line}`)
      : [`${name} missing`];
  });
};

const hooks = (): void => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });
};

const liveOffFrame = (live: Measured, frame: Measured): string[] =>
  Object.keys(frame).flatMap((name) => {
    const a = live[name];
    const b = frame[name];

    return a && b ? offBy(a, b).map((line) => `${name} ${line}`) : [];
  });

describe.each(WIDTHS)("introduction geometry at %s", (width) => {
  hooks();

  it("draws the frame at the board's sizes", async () => {
    await mountFrame("introduction", width);

    expect(againstBoard(measure(), width)).toStrictEqual([]);
  });

  it("draws the live demo at the frame's sizes and fits the crop", async () => {
    await mountFrame("introduction", width);

    const frame = measure();

    await cleanup();
    await mountLive(IntroductionDemo, "introduction", width);
    await ready();

    const live = measure();

    expect(againstBoard(live, width)).toStrictEqual([]);

    expect(liveOffFrame(live, frame)).toStrictEqual([]);

    const panel = find("[data-demo]");
    const crop = boxIn(find(item("area"), panel), panel);

    expect(
      offBy(crop, editorBoard(width).crop(3 / 2), CROP_TOLERANCE)
    ).toStrictEqual([]);
  });
});

describe.each(WIDTHS)("panel heights at %s", (width) => {
  hooks();

  it.each(DEMO_NAMES)("%s", async (name) => {
    await mountFrame(name, width);

    const panel = find("[data-demo]");

    expect(panel.getBoundingClientRect().height).toBeCloseTo(
      panelHeight(width, DEMO_SPECS[name].zones),
      1
    );
  });
});
