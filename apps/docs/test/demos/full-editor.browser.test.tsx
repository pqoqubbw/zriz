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

const panel = (): HTMLElement => find('[data-demo="full-editor"]');

const angle = (): string => find(item("dial-value")).textContent;

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

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("full editor demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it("straightens, locks and swaps an aspect, turns, flips and downloads a jpeg", async () => {
    await mountDemo("full-editor");
    await ready();

    const start = {
      angle: angle(),
      checked: checked(),
      labels: labels(),
      swapOff: button("Swap orientation").hasAttribute("disabled"),
    };
    const audits = [await violations()];

    find(item("dial")).focus();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    find(item("dial")).blur();
    await settle();

    const straightened = angle();

    button("Reset").click();
    await expect.poll(angle).toBe("0.0");
    aspect("16:9").click();
    await settle();

    const locked = near(ratio(), 16 / 9);

    button("Swap orientation").click();
    await settle();

    const swapped = { checked: checked(), ratio: near(ratio(), 9 / 16) };

    audits.push(await violations());
    button("Reset").click();
    await expect.poll(checked).toStrictEqual(["Free"]);
    button("Rotate left").click();
    await settle();

    const turned = ratio() < 1;

    button("Flip").click();
    await settle();

    const links: string[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function capture(this: HTMLAnchorElement) {
        links.push(this.href);
      }
    );

    button("Download").click();
    await expect.poll(() => links.length).toBe(1);

    const response = await fetch(links[0] ?? "");
    const blob = await response.blob();

    expect(audits).toStrictEqual([[], []]);

    expect({
      locked,
      mirrored: Object.hasOwn(find(item("root")).dataset, "mirrored"),
      start,
      straightened,
      swapped,
      turned,
      type: blob.type,
    }).toStrictEqual({
      locked: true,
      mirrored: true,
      start: {
        angle: "0.0",
        checked: ["Free"],
        labels: ["Free", "Original", "1:1", "5:4", "16:9"],
        swapOff: true,
      },
      straightened: "10.0",
      swapped: { checked: ["9:16"], ratio: true },
      turned: true,
      type: "image/jpeg",
    });
  });
});
