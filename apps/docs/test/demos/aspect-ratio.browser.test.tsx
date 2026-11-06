import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import AspectRatioDemo from "../../demos/aspect-ratio/demo";
import { fixtureFile } from "./fixtures";
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

const panel = (): HTMLElement => find('[data-demo="aspect-ratio"]');

const ratio = (): number => {
  const box = find(item("area")).getBoundingClientRect();

  return box.width / box.height;
};

const aspect = (label: string): HTMLElement => {
  const found = [
    ...panel().querySelectorAll<HTMLElement>(item("aspect-item")),
  ].find((element) => element.textContent === label);

  if (!found) {
    throw new Error(`no aspect ${label}`);
  }

  return found;
};

const labels = (): string[] =>
  [...panel().querySelectorAll(item("aspect-item"))].map(
    (element) => element.textContent
  );

const checked = (): string[] =>
  [...panel().querySelectorAll(`${item("aspect-item")}[data-checked]`)].map(
    (element) => element.textContent
  );

const pick = (file: File): void => {
  const input = find('input[type="file"]', panel());

  if (!(input instanceof HTMLInputElement)) {
    throw new TypeError("no file input");
  }

  const transfer = new DataTransfer();

  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("aspect ratio demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("aspect-ratio");

    await mountLive(AspectRatioDemo, "aspect-ratio");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("starts free with landscape labels and orientation off", async () => {
    await mountDemo("aspect-ratio");
    await ready();

    expect(labels()).toStrictEqual(["Free", "Original", "1:1", "5:4", "16:9"]);
    expect(checked()).toStrictEqual(["Free"]);
    expect(button("Swap orientation").hasAttribute("disabled")).toBeTruthy();
    expect(panel().querySelector(item("dial"))).toBeNull();
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("locks a ratio, swaps it and resets to free", async () => {
    await mountDemo("aspect-ratio");
    await ready();
    aspect("16:9").click();
    await settle();

    expect(ratio()).toBeCloseTo(16 / 9, 1);

    button("Swap orientation").click();
    await settle();

    expect(ratio()).toBeCloseTo(9 / 16, 1);
    expect(checked()).toStrictEqual(["9:16"]);
    expect(labels()).toStrictEqual(["Free", "Original", "1:1", "4:5", "9:16"]);
    await expect(violations()).resolves.toStrictEqual([]);

    button("Reset").click();
    await expect.poll(checked).toStrictEqual(["Free"]);
  });

  it("moves the pick with the arrow keys", async () => {
    await mountDemo("aspect-ratio");
    await ready();
    aspect("Free").focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}");
    await settle();

    expect(checked()).toStrictEqual(["1:1"]);
    expect(ratio()).toBeCloseTo(1, 1);

    await userEvent.keyboard("{End}");

    expect(checked()).toStrictEqual(["16:9"]);
  });

  it("turns the labels for a portrait photo", async () => {
    await mountDemo("aspect-ratio");
    await ready();
    pick(await fixtureFile("portrait"));
    await expect.poll(ratio, { timeout: 15_000 }).toBeLessThan(1);

    expect(labels()).toStrictEqual(["Free", "Original", "1:1", "4:5", "9:16"]);
  });

  it("gives the zone buttons a 44 px hit box", async () => {
    await mountDemo("aspect-ratio");
    await ready();
    aspect("16:9").click();
    await settle();

    expect(hits(button("Swap orientation"))).toBeTruthy();
    expect(hits(aspect("1:1"), ["top", "bottom"])).toBeTruthy();
  });
});

describe("aspect ratio demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("aspect-ratio", width);

      await mountLive(AspectRatioDemo, "aspect-ratio", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
