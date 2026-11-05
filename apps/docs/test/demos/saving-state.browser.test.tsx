import { parse } from "@zriz/core";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import SavingStateDemo from "../../demos/saving-state/demo";
import { fixtureFile } from "./fixtures";
import {
  button,
  find,
  frameLayout,
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

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("saving-state");

    await mountLive(SavingStateDemo, "saving-state");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("saves each commit and skips the fit on load", async () => {
    await mountDemo("saving-state");
    await ready();
    await settle();

    expect(saved()).toBeNull();

    await nudge(3);
    await expect.poll(() => saved()).not.toBeNull();

    expect(saved()).not.toBe(0);
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("brings the crop back on the next visit and resets to it", async () => {
    await mountDemo("saving-state");
    await ready();
    await nudge(3);
    button("Rotate left").click();
    await settle();

    const kept = angle();

    expect(kept).not.toBe("0.0");

    await cleanup();
    await mountDemo("saving-state");
    await ready();
    await settle();

    expect(angle()).toBe(kept);
    expect(ratio()).toBeLessThan(1);
    expect(shown(resetChip())).toBeFalsy();

    await nudge(2);
    await expect.poll(() => shown(resetChip())).toBeTruthy();

    resetChip().click();
    await settle();
    await expect.poll(angle).toBe(kept);

    expect(ratio()).toBeLessThan(1);
  });

  it("keeps a crop per photo", async () => {
    await mountDemo("saving-state");
    await ready();
    await nudge(3);

    const first = angle();
    const file = await fixtureFile("portrait");

    pick(file);
    await expect.poll(ratio, { timeout: 15_000 }).toBeLessThan(1);
    await ready();

    expect(angle()).toBe("0.0");

    await nudge(1);

    const key = `zriz-docs:saving-state:${file.name}:${file.size}:${file.lastModified}`;

    await expect.poll(() => saved(key)).not.toBeNull();

    expect(angle()).not.toBe(first);
  });

  it("opens and edits when storage throws", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });

    await mountDemo("saving-state");
    await ready();

    expect(angle()).toBe("0.0");

    await nudge(3);

    expect(angle()).not.toBe("0.0");
    expect(shown(resetChip())).toBeTruthy();

    expect(warn).toHaveBeenCalledWith(
      "the crop was not saved",
      expect.any(DOMException)
    );

    await expect(violations()).resolves.toStrictEqual([]);
  });
});

describe("saving state demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("saving-state", width);

      await mountLive(SavingStateDemo, "saving-state", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
