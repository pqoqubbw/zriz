import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import { find, item, mountDemo, ready, settle } from "./helpers";

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

  it("starts on pan, where the wheel cannot move a covered photo, and zooms with the wheel on zoom", async () => {
    await mountDemo("viewport");
    await ready();

    expect(checked()).toStrictEqual(["Pan"]);
    await expect(violations()).resolves.toStrictEqual([]);

    await scroll(0, -40);

    const still = changed();
    const before = photo().width;

    radio("Zoom").click();
    await expect.poll(checked).toStrictEqual(["Zoom"]);
    await scroll(0, -40);

    const zoomed = photo();
    const zoomedChanged = changed();

    radio("Pan").click();
    await expect.poll(checked).toStrictEqual(["Pan"]);
    await scroll(40, 0);

    const panned = photo();

    expect({
      changed: [still, zoomedChanged],
      grew: zoomed.width > before,
      moved: Math.abs(panned.left - zoomed.left) >= 0.5,
      width: Math.abs(panned.width - zoomed.width) < 0.5,
    }).toStrictEqual({
      changed: [false, true],
      grew: true,
      moved: true,
      width: true,
    });
  });
});
