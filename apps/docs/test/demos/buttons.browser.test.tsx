import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import ButtonsDemo from "../../demos/buttons/demo";
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

  it.each(["desktop", "phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("buttons", width);

      await mountLive(ButtonsDemo, "buttons", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
    }
  );

  it("puts four labelled buttons under the stage", async () => {
    await mountDemo("buttons");
    await ready();

    expect(
      [...panel().querySelectorAll('[data-slot="zone-row"] > button')].map(
        (element) => element.getAttribute("aria-label")
      )
    ).toStrictEqual(LABELS);

    expect(
      LABELS.every((label) => hits(button(label), ["top", "bottom"]))
    ).toBeTruthy();

    expect(hits(button("Rotate left"), ["left"])).toBeTruthy();
    expect(hits(button("Flip vertically"), ["right"])).toBeTruthy();

    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("turns left and right a quarter each", async () => {
    await mountDemo("buttons");
    await ready();

    button("Rotate left").click();
    await settle();

    expect(ratio()).toBeLessThan(1);
    expect(shown(button("Reset"))).toBeTruthy();

    button("Rotate right").click();
    await settle();

    expect(ratio()).toBeGreaterThan(1);
  });

  it("flips on both axes and resets", async () => {
    await mountDemo("buttons");
    await ready();

    button("Flip vertically").click();
    await settle();

    expect(button("Flip vertically").getAttribute("aria-pressed")).toBe("true");

    expect(shown(button("Reset"))).toBeTruthy();

    button("Flip").click();
    await settle();

    expect(button("Flip").getAttribute("aria-pressed")).toBe("false");

    button("Reset").click();
    await settle();

    expect(shown(button("Reset"))).toBeFalsy();
  });
});
