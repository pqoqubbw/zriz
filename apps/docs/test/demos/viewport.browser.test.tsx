import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import ViewportDemo from "../../demos/viewport/demo";
import {
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

const panel = (): HTMLElement => find('[data-demo="viewport"]');

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

const checked = (): string[] =>
  [...panel().querySelectorAll('[data-slot="track"] label[data-checked]')].map(
    (element) => element.textContent
  );

const photo = (): DOMRect =>
  find("img", find(item("image"))).getBoundingClientRect();

const changed = (): boolean =>
  Object.hasOwn(find(item("root")).dataset, "changed");

const scroll = async (deltaX: number, deltaY: number): Promise<void> => {
  const box = find(item("viewport")).getBoundingClientRect();

  for (let step = 0; step < 6; step += 1) {
    find(item("viewport")).dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        deltaX,
        deltaY,
      })
    );
  }

  await settle();
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("viewport demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("viewport");

    await mountLive(ViewportDemo, "viewport");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("starts on pan, where the wheel cannot move a photo the crop covers", async () => {
    await mountDemo("viewport");
    await ready();

    expect(checked()).toStrictEqual(["Pan"]);
    await expect(violations()).resolves.toStrictEqual([]);

    await scroll(0, -40);

    expect(changed()).toBeFalsy();
  });

  it("zooms with the wheel on zoom, then pans with it on pan", async () => {
    await mountDemo("viewport");
    await ready();

    const before = photo().width;

    radio("Zoom").click();
    await expect.poll(checked).toStrictEqual(["Zoom"]);
    await scroll(0, -40);

    expect(photo().width).toBeGreaterThan(before);
    expect(changed()).toBeTruthy();

    radio("Pan").click();
    await expect.poll(checked).toStrictEqual(["Pan"]);

    const zoomed = photo();

    await scroll(40, 0);

    expect(photo().width).toBeCloseTo(zoomed.width, 0);
    expect(photo().left).not.toBeCloseTo(zoomed.left, 0);
  });

  it("moves the pick with the arrow keys", async () => {
    await mountDemo("viewport");
    await ready();
    radio("Pan").focus();
    await userEvent.keyboard("{ArrowRight}");
    await expect.poll(checked).toStrictEqual(["Zoom"]);

    expect(document.activeElement).toBe(radio("Zoom"));

    await userEvent.keyboard("{ArrowLeft}");
    await expect.poll(checked).toStrictEqual(["Pan"]);
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("keeps one tab stop in the track", async () => {
    await mountDemo("viewport");
    await ready();

    const names = [
      ...panel().querySelectorAll<HTMLInputElement>('input[type="radio"]'),
    ].map((input) => input.name);

    expect(new Set(names).size).toBe(1);
    expect(find('[role="radiogroup"]', panel()).ariaLabel).toBe("Wheel");
  });

  it("gives the track items a 44 px hit box", async () => {
    await mountDemo("viewport");
    await ready();

    expect(hits(choice("Zoom"), ["top", "bottom"])).toBeTruthy();
  });
});

describe("viewport demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("viewport", width);

      await mountLive(ViewportDemo, "viewport", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
