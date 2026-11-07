import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="quick-start"]');

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("quick start demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("has four corner handles and a dial, and straightens and resizes", async () => {
    await mountDemo("quick-start");
    await ready();

    expect({
      edges: [...panel().querySelectorAll<HTMLElement>(item("handle"))].map(
        (handle) => handle.dataset.edge
      ),
      grid: panel().querySelector(item("grid")),
      value: panel().querySelector(item("dial-value")),
    }).toStrictEqual({
      edges: ["top-left", "top-right", "bottom-right", "bottom-left"],
      grid: null,
      value: null,
    });

    await expect(violations()).resolves.toStrictEqual([]);

    const dial = find(item("dial"));

    dial.focus();
    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowRight}");
    dial.blur();
    await settle();

    expect(dial.getAttribute("aria-valuenow")).toBe("3");

    const area = find(item("area"));
    const before = area.getBoundingClientRect().width;

    area.focus();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{ArrowLeft}{/Alt}");

    await expect
      .poll(() => area.getBoundingClientRect().width)
      .toBeLessThan(before);

    area.blur();
  });
});
