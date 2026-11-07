import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { button, find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="undo"]');

const angle = (): string => find(item("dial-value")).textContent;

const undo = (): HTMLElement => button("Undo");

const off = (): string | null => undo().getAttribute("aria-disabled");

const ratio = (): number => {
  const box = find(item("area")).getBoundingClientRect();

  return box.width / box.height;
};

const nudge = async (times: number): Promise<void> => {
  find(item("dial")).focus();

  for (let step = 0; step < times; step += 1) {
    await userEvent.keyboard("{ArrowRight}");
  }

  find(item("dial")).blur();
  await settle();
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("undo demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("starts off, then steps back through a turn and a straighten, one commit each", async () => {
    await mountDemo("undo");
    await ready();

    const row = [...panel().querySelectorAll('[data-slot="zone-row"] > *')];

    expect({
      first: row.at(0) === button("Rotate left"),
      last: row.at(-1) === undo(),
      off: off(),
    }).toStrictEqual({ first: true, last: true, off: "true" });

    await expect(violations()).resolves.toStrictEqual([]);

    button("Rotate left").click();
    await settle();
    await nudge(1);

    const state = () => ({
      level: angle() === "0.0",
      off: off(),
      portrait: ratio() < 1,
    });
    const steps = [state()];

    undo().click();
    await settle();
    await expect.poll(angle).toBe("0.0");
    steps.push(state());
    undo().click();
    await settle();
    await expect.poll(off).toBe("true");
    steps.push(state());

    expect(steps).toStrictEqual([
      { level: false, off: "false", portrait: true },
      { level: true, off: "false", portrait: true },
      { level: true, off: "true", portrait: false },
    ]);
  });
});
