import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { commands as browser, page, userEvent } from "vitest/browser";

import CropAreaDemo from "../../demos/crop-area/demo";
import {
  button,
  find,
  frameLayout,
  item,
  layoutOf,
  mountDemo,
  mountLive,
  ready,
  settle,
} from "./helpers";

type Tools = {
  hold: (selector: string, x: number, y: number) => Promise<void>;
  release: () => Promise<void>;
};

const isTools = (value: object): value is Tools =>
  "hold" in value && "release" in value;

const toolsOf = (value: object): Tools => {
  if (!isTools(value)) {
    throw new Error("no test commands");
  }

  return value;
};

const commands = toolsOf(browser);

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="crop-area"]');

const area = (): DOMRect => find(item("area")).getBoundingClientRect();

const gridShows = (): boolean =>
  Object.hasOwn(find(item("grid")).dataset, "visible");

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("crop area demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await commands.release();
    await cleanup();
  });

  it.each(["desktop", "phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("crop-area", width);

      await mountLive(CropAreaDemo, "crop-area", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
    }
  );

  it("has eight handles, a hidden grid and nothing under the stage", async () => {
    await mountDemo("crop-area");
    await ready();

    const edges = [
      ...panel().querySelectorAll<HTMLElement>(item("handle")),
    ].map((handle) => handle.dataset.edge);

    expect(edges).toStrictEqual([
      "top-left",
      "top",
      "top-right",
      "right",
      "bottom-right",
      "bottom",
      "bottom-left",
      "left",
    ]);

    expect(panel().querySelector('[data-slot="zone"]')).toBeNull();
    expect(gridShows()).toBeFalsy();
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("shows the thirds while a handle drags and resizes the crop", async () => {
    await mountDemo("crop-area");
    await ready();

    await commands.hold(`${item("handle")}[data-edge="left"]`, 22, 22);
    await expect.poll(gridShows).toBeTruthy();

    expect(find(item("grid")).dataset.grid).toBe("coarse");

    await commands.release();
    await settle();

    expect(area().width / area().height).toBeLessThan(1.45);
    expect(button("Reset").checkVisibility()).toBeTruthy();
  });

  it("moves and resizes the crop from the keyboard", async () => {
    await mountDemo("crop-area");
    await ready();

    const before = area();

    find(item("area")).focus();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await settle();

    const smaller = area();

    expect(smaller.width).toBeLessThan(before.width);

    find(item("area")).focus();
    await userEvent.keyboard("{Shift>}{ArrowLeft}{/Shift}");
    find(item("area")).blur();
    await settle();

    expect(gridShows()).toBeFalsy();

    button("Reset").click();
    await settle();
    await expect.poll(() => area().width).toBeCloseTo(before.width, 0);
  });
});
