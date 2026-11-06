import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import ZoomDemo from "../../demos/zoom/demo";
import {
  button,
  find,
  frameLayout,
  hits,
  item,
  layoutOf,
  mountDemo,
  mountLive,
  ready,
  settle,
} from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="zoom"]');

const shown = (): string => find('[data-slot="value"]', panel()).textContent;

const off = (label: string): boolean =>
  button(label).getAttribute("aria-disabled") === "true";

const press = async (keys: string): Promise<void> => {
  find(item("zoom")).focus();
  await userEvent.keyboard(keys);
  find(item("zoom")).blur();
  await settle();
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("zoom demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["desktop", "phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("zoom", width);

      await mountLive(ZoomDemo, "zoom", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
    }
  );

  it("starts at 1× with zoom out off and a rect crop", async () => {
    await mountDemo("zoom");
    await ready();

    expect(shown()).toBe("1.0×");
    expect([off("Zoom out"), off("Zoom in")]).toStrictEqual([true, false]);
    expect(find(item("area")).dataset.shape).toBe("rect");
    expect(panel().querySelectorAll(item("handle"))).toHaveLength(8);
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("steps by 1.25 each way", async () => {
    await mountDemo("zoom");
    await ready();
    button("Zoom in").click();
    await settle();

    expect(shown()).toBe("1.25×");
    expect(off("Zoom out")).toBeFalsy();

    button("Zoom out").click();
    await settle();

    expect(shown()).toBe("1.0×");
    expect(off("Zoom out")).toBeTruthy();
  });

  it("stops the slider and the steps at 3×", async () => {
    await mountDemo("zoom");
    await ready();
    await press("{End}");

    expect(find(item("zoom")).getAttribute("aria-valuenow")).toBe("3");
    expect(off("Zoom in")).toBeTruthy();

    button("Zoom in").click();
    await settle();

    expect(shown()).toBe("3.0×");
    await expect(violations()).resolves.toStrictEqual([]);

    await press("{Home}");

    expect(shown()).toBe("1.0×");
  });

  it("puts the thumb on a log scale", async () => {
    await mountDemo("zoom");
    await ready();

    const ruler = find('[data-slot="ruler"]').getBoundingClientRect();

    const centre = (): number => {
      const thumb = find(item("zoom-thumb")).getBoundingClientRect();

      return thumb.left + thumb.width / 2 - ruler.left;
    };

    const at = (zoom: number): number =>
      16 + ((ruler.width - 32) * Math.log(zoom)) / Math.log(3);

    expect(centre()).toBeCloseTo(at(1), 1);

    button("Zoom in").click();
    await settle();

    expect(centre()).toBeCloseTo(at(1.25), 1);

    await press("{End}");

    expect(centre()).toBeCloseTo(at(3), 1);
  });

  it("shows reset after a zoom and resets", async () => {
    await mountDemo("zoom");
    await ready();
    button("Zoom in").click();
    await settle();
    button("Reset").click();

    await expect.poll(shown).toBe("1.0×");
  });

  it("gives the steps a 44 px hit box", async () => {
    await mountDemo("zoom");
    await ready();

    expect(hits(button("Zoom out"))).toBeTruthy();
    expect(hits(button("Zoom in"))).toBeTruthy();
  });
});

describe("zoom demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("keeps the slider 200 px wide and passes axe", async () => {
    await mountDemo("zoom", "phone");
    await ready();

    expect(find('[data-slot="ruler"]').getBoundingClientRect().width).toBe(200);

    await expect(violations()).resolves.toStrictEqual([]);
  });
});
