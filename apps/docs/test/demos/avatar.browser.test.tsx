import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { button, find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const near = (actual: number, expected: number): boolean =>
  Math.abs(actual - expected) < 0.05;

const panel = (): HTMLElement => find('[data-demo="avatar"]');

const shown = (): string => find('[data-slot="value"]', panel()).textContent;

const zoom = (): number =>
  Number(find(item("zoom")).getAttribute("aria-valuenow"));

const off = (label: string): boolean =>
  button(label).getAttribute("aria-disabled") === "true";

const press = async (keys: string): Promise<void> => {
  find(item("zoom")).focus();
  await userEvent.keyboard(keys);
  find(item("zoom")).blur();
  await settle();
};

const bigPortrait = async (): Promise<File> => {
  const canvas = new OffscreenCanvas(1600, 2400);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = "#6f8fb3";
  context.fillRect(0, 0, 1600, 2400);

  const blob = await canvas.convertToBlob({ type: "image/png" });

  return new File([blob], "big.png", { type: "image/png" });
};

const pick = (file: File): void => {
  const input = find('input[type="file"]', panel());

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const capture = (): string[] => {
  const links: string[] = [];

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function keep(this: HTMLAnchorElement) {
      links.push(this.href);
    }
  );

  return links;
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("avatar demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it("crops a circle at 1×, zooms with the steps and the wheel up to 512 source px, and starts a new photo from the whole frame", async () => {
    await mountDemo("avatar");
    await ready();

    const area = find(item("area"));
    const circle = area.getBoundingClientRect();

    expect({
      extra: panel().querySelector(`${item("handle")}, ${item("grid")}`),
      off: off("Zoom out"),
      round: near(circle.width, circle.height),
      shape: area.dataset.shape,
      shown: shown(),
    }).toStrictEqual({
      extra: null,
      off: true,
      round: true,
      shape: "circle",
      shown: "1.0×",
    });

    await expect(violations()).resolves.toStrictEqual([]);

    button("Zoom in").click();
    await settle();

    const stepped = shown();
    const before = zoom();
    const viewport = find(item("viewport"));
    const box = viewport.getBoundingClientRect();

    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        deltaY: 40,
      })
    );

    await settle();

    const wheeled = zoom() < before;

    await press("{End}");

    const most = near(zoom(), 800 / 512);
    const reset = button("Reset").checkVisibility();

    pick(await bigPortrait());

    await expect
      .poll(() => button("Reset").checkVisibility(), { timeout: 15_000 })
      .toBeFalsy();

    expect({ most, reset, shown: shown(), stepped, wheeled }).toStrictEqual({
      most: true,
      reset: true,
      shown: "1.0×",
      stepped: "1.25×",
      wheeled: true,
    });
  });

  it("downloads a round png at most 512 px wide", async () => {
    await mountDemo("avatar");
    await ready();

    const links = capture();

    button("Download").click();
    await expect.poll(() => links.length).toBe(1);

    const response = await fetch(links[0] ?? "");
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");

    context?.drawImage(bitmap, 0, 0);

    const corner = context?.getImageData(0, 0, 1, 1).data[3];
    const middle = context?.getImageData(
      bitmap.width / 2,
      bitmap.height / 2,
      1,
      1
    ).data[3];

    expect(blob.type).toBe("image/png");
    expect(bitmap.width).toBe(512);
    expect(bitmap.height).toBe(512);
    expect(corner).toBe(0);
    expect(middle).toBe(255);
  });
});
