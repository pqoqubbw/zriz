import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { commands as browser, page } from "vitest/browser";

import { button, find, item, mountDemo, ready, settle } from "./helpers";

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

  it("has eight handles, and a drag shows the thirds and resizes the crop", async () => {
    await mountDemo("crop-area");
    await ready();

    expect({
      edges: [...panel().querySelectorAll<HTMLElement>(item("handle"))].map(
        (handle) => handle.dataset.edge
      ),
      grid: gridShows(),
      zone: panel().querySelector('[data-slot="zone"]'),
    }).toStrictEqual({
      edges: [
        "top-left",
        "top",
        "top-right",
        "right",
        "bottom-right",
        "bottom",
        "bottom-left",
        "left",
      ],
      grid: false,
      zone: null,
    });

    await expect(violations()).resolves.toStrictEqual([]);

    await commands.hold(`${item("handle")}[data-edge="left"]`, 22, 22);
    await expect.poll(gridShows).toBeTruthy();

    const { grid } = find(item("grid")).dataset;

    await commands.release();
    await settle();

    expect({
      grid,
      narrower: area().width / area().height < 1.45,
      reset: button("Reset").checkVisibility(),
    }).toStrictEqual({ grid: "coarse", narrower: true, reset: true });
  });
});
