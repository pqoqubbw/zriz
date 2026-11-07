import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { button, find, item, mountDemo, ready, settle } from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="dial"]');

const angle = (): string => find(item("dial-value")).textContent;

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

const press = async (keys: string): Promise<void> => {
  find(item("dial")).focus();
  await userEvent.keyboard(keys);
  find(item("dial")).blur();
  await settle();
};

describe("dial demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("holds only the value and the ruler, turns and resets", async () => {
    await mountDemo("dial");
    await ready();

    expect(panel().querySelectorAll('[data-slot="zone-row"] > *')).toHaveLength(
      1
    );

    await expect(violations()).resolves.toStrictEqual([]);

    await press("{ArrowLeft}{ArrowLeft}");

    expect(angle()).toBe("−2.0");

    button("Reset").click();
    await expect.poll(angle).toBe("0.0");
  });
});
