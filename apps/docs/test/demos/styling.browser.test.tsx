import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import StylingDemo from "../../demos/styling/demo";
import {
  find,
  frameLayout,
  hits,
  item,
  layoutOf,
  mountDemo,
  mountLive,
  ready,
} from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const VARIABLES = [
  "--zriz-accent",
  "--zriz-grid",
  "--zriz-line",
  "--zriz-scrim",
  "--zriz-tick",
] as const;

const panel = (): HTMLElement => find('[data-demo="styling"]');

const choice = (label: string): HTMLElement => {
  const found = [
    ...panel().querySelectorAll<HTMLElement>('[data-slot="track"] label'),
  ].find((element) => element.textContent === label);

  if (!found) {
    throw new Error(`no choice ${label}`);
  }

  return found;
};

const radio = (label: string): HTMLElement =>
  find('input[type="radio"]', choice(label));

const variables = (): string[] => {
  const style = getComputedStyle(find(item("root")));

  return VARIABLES.map((name) => style.getPropertyValue(name).trim());
};

const channels = (colour: string): number[] =>
  (colour.match(/[\d.]+/gu) ?? []).map(Number);

const outline = (): string =>
  getComputedStyle(find(item("area")), "::after").outlineColor;

const scrimLightness = (): number => {
  const [red = 0, green = 0, blue = 0] = channels(
    getComputedStyle(find(item("mask"))).backgroundColor
  );

  return (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("styling demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("styling");

    await mountLive(StylingDemo, "styling");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("starts on the stylesheet's colours", async () => {
    await mountDemo("styling");
    await ready();

    expect(variables()).toStrictEqual(["", "", "", "", ""]);
    expect(panel().querySelector(item("dial"))).not.toBeNull();
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it.each(["ink", "soft"])("sets all five variables for %s", async (look) => {
    await mountDemo("styling");
    await ready();
    radio(look).click();

    await expect
      .poll(() => variables().every((value) => value !== ""))
      .toBeTruthy();

    expect(scrimLightness()).toBeGreaterThan(0.85);
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("keeps every look light", async () => {
    await mountDemo("styling");
    await ready();

    const seen: number[] = [];

    for (const look of ["default", "ink", "soft"]) {
      radio(look).click();

      await expect
        .poll(() => Object.hasOwn(choice(look).dataset, "checked"))
        .toBeTruthy();

      seen.push(scrimLightness());
    }

    expect(Math.min(...seen)).toBeGreaterThan(0.85);
  });

  it("paints the crop outline with the picked look", async () => {
    await mountDemo("styling");
    await ready();
    radio("ink").click();
    await expect.poll(outline).toBe("rgb(30, 58, 138)");

    radio("ink").focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(outline).toBe("rgb(87, 83, 78)");
    expect(hits(choice("soft"), ["top", "bottom"])).toBeTruthy();
  });
});

describe("styling demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("styling", width);

      await mountLive(StylingDemo, "styling", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
