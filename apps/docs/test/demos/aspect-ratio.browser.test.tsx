import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import { fixtureFile } from "./fixtures";
import { button, find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const LANDSCAPE = ["Free", "Original", "1:1", "5:4", "16:9"];

const PORTRAIT = ["Free", "Original", "1:1", "4:5", "9:16"];

const near = (actual: number, expected: number): boolean =>
  Math.abs(actual - expected) < 0.05;

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

  it("starts free, locks, swaps and resets a ratio, and relabels for a portrait photo", async () => {
    await mountDemo("aspect-ratio");
    await ready();

    const state = () => ({
      checked: checked(),
      labels: labels(),
      ratio: ratio(),
      swapOff: button("Swap orientation").hasAttribute("disabled"),
    });

    expect({
      ...state(),
      dial: panel().querySelector(item("dial")),
    }).toMatchObject({
      checked: ["Free"],
      dial: null,
      labels: LANDSCAPE,
      swapOff: true,
    });

    const audits = [await violations()];

    aspect("16:9").click();
    await settle();

    const locked = state();

    button("Swap orientation").click();
    await settle();

    const swapped = state();

    audits.push(await violations());
    button("Reset").click();

    await expect
      .poll(() => [checked(), labels()])
      .toStrictEqual([["Free"], LANDSCAPE]);

    pick(await fixtureFile("portrait"));
    await expect.poll(ratio, { timeout: 15_000 }).toBeLessThan(1);
    await expect.poll(labels).toStrictEqual(PORTRAIT);

    expect([
      { ...locked, ratio: near(locked.ratio, 16 / 9) },
      { ...swapped, ratio: near(swapped.ratio, 9 / 16) },
    ]).toMatchObject([
      { ratio: true },
      { checked: ["9:16"], labels: PORTRAIT, ratio: true },
    ]);

    expect(audits).toStrictEqual([[], []]);
  });
});
