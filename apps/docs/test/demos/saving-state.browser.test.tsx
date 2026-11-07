import { parse } from "@zriz/core";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { fixtureFile } from "./fixtures";
import { button, find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const KEY = "zriz-docs:saving-state:landscape";

const panel = (): HTMLElement => find('[data-demo="saving-state"]');

const angle = (): string => find(item("dial-value")).textContent;

const resetChip = (): HTMLElement => find(item("reset"));

const shown = (element: Element): boolean =>
  getComputedStyle(element).display !== "none";

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

const pick = (file: File): void => {
  const input = find('input[type="file"]', panel());

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const saved = (key = KEY): number | null => {
  const value = parse(localStorage.getItem(key));

  return value ? value.rotation : null;
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

const clear = (): void => {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("zriz-docs:saving-state:")) {
      localStorage.removeItem(key);
    }
  }
};

describe("saving state demo", () => {
  beforeEach(async () => {
    clear();
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
    clear();
  });

  it("saves each commit, brings the crop back on the next visit, resets to it and keeps a crop per photo", async () => {
    await mountDemo("saving-state");
    await ready();
    await settle();

    const fresh = saved();

    await nudge(3);
    await vi.waitUntil(() => saved() !== null);

    const first = saved();
    const audit = await violations();

    button("Rotate left").click();
    await settle();

    const kept = angle();

    await cleanup();
    await mountDemo("saving-state");
    await ready();
    await settle();

    const restored = {
      angle: angle(),
      portrait: ratio() < 1,
      reset: shown(resetChip()),
    };

    await nudge(2);
    await expect.poll(() => shown(resetChip())).toBeTruthy();
    resetChip().click();
    await settle();
    await expect.poll(angle).toBe(kept);

    const afterReset = ratio() < 1;
    const file = await fixtureFile("portrait");

    pick(file);
    await expect.poll(angle, { timeout: 15_000 }).toBe("0.0");
    await ready();
    await settle();
    const key = `zriz-docs:saving-state:${file.name}:${file.size}:${file.lastModified}`;

    await nudge(1);
    await vi.waitUntil(() => saved(key) !== null);

    expect({
      afterReset,
      audit,
      first: first !== 0,
      fresh,
      kept: kept === "0.0",
      other: angle() === kept,
      restored,
    }).toStrictEqual({
      afterReset: true,
      audit: [],
      first: true,
      fresh: null,
      kept: false,
      other: false,
      restored: { angle: kept, portrait: true, reset: false },
    });
  });
});
