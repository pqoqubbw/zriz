import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import { button, find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const LABELS = ["Rotate left", "Rotate right", "Flip", "Flip vertically"];

const panel = (): HTMLElement => find('[data-demo="buttons"]');

const shown = (element: Element): boolean =>
  getComputedStyle(element).display !== "none";

const ratio = (): number => {
  const box = find(item("area")).getBoundingClientRect();

  return box.width / box.height;
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("buttons demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("labels four buttons that turn, flip and reset", async () => {
    await mountDemo("buttons");
    await ready();

    expect(
      [...panel().querySelectorAll('[data-slot="zone-row"] > button')].map(
        (element) => element.getAttribute("aria-label")
      )
    ).toStrictEqual(LABELS);

    await expect(violations()).resolves.toStrictEqual([]);

    const steps: Record<string, unknown>[] = [];

    for (const label of [
      "Rotate left",
      "Rotate right",
      "Flip vertically",
      "Flip",
      "Reset",
    ]) {
      button(label).click();
      await settle();

      steps.push({
        flip: button("Flip").getAttribute("aria-pressed"),
        flipVertically: button("Flip vertically").getAttribute("aria-pressed"),
        portrait: ratio() < 1,
        reset: shown(button("Reset")),
      });
    }

    expect(steps).toMatchObject([
      { portrait: true, reset: true },
      { portrait: false },
      { flipVertically: "true", reset: true },
      { flip: "false" },
      { reset: false },
    ]);
  });
});
