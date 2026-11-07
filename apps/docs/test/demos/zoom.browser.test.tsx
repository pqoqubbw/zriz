import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page } from "vitest/browser";

import { button, find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="zoom"]');

const shown = (): string => find('[data-slot="value"]', panel()).textContent;

const off = (label: string): boolean =>
  button(label).getAttribute("aria-disabled") === "true";

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("zoom demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("starts at 1×, steps by 1.25 each way and resets", async () => {
    await mountDemo("zoom");
    await ready();

    const state = () => ({
      in: off("Zoom in"),
      out: off("Zoom out"),
      shown: shown(),
    });

    expect({
      ...state(),
      handles: panel().querySelectorAll(item("handle")).length,
      shape: find(item("area")).dataset.shape,
    }).toStrictEqual({
      handles: 8,
      in: false,
      out: true,
      shape: "rect",
      shown: "1.0×",
    });

    await expect(violations()).resolves.toStrictEqual([]);

    const steps = [];

    for (const label of ["Zoom in", "Zoom out"]) {
      button(label).click();
      await settle();
      steps.push(state());
    }

    expect(steps).toMatchObject([
      { out: false, shown: "1.25×" },
      { out: true, shown: "1.0×" },
    ]);

    button("Zoom in").click();
    await settle();
    button("Reset").click();

    await expect.poll(shown).toBe("1.0×");
  });
});
