import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import DialDemo from "../../demos/dial/demo";
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

  it.each(["desktop", "phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("dial", width);

      await mountLive(DialDemo, "dial", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
    }
  );

  it("holds only the value and the ruler, 360 px wide", async () => {
    await mountDemo("dial");
    await ready();

    expect(panel().querySelectorAll('[data-slot="zone-row"] > *')).toHaveLength(
      1
    );

    expect(find(item("dial")).getBoundingClientRect().width).toBe(360);
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("goes 45° each way and back to 0", async () => {
    await mountDemo("dial");
    await ready();

    await press("{End}");

    expect(angle()).toBe("45.0");
    expect(find(item("dial")).getAttribute("aria-valuenow")).toBe("45");

    await press("{Home}");

    expect(angle()).toBe("−45.0");

    await press("0");

    expect(angle()).toBe("0.0");
  });

  it("shows reset after a turn and resets", async () => {
    await mountDemo("dial");
    await ready();
    await press("{ArrowLeft}{ArrowLeft}");

    expect(angle()).toBe("−2.0");

    button("Reset").click();
    await expect.poll(angle).toBe("0.0");
  });
});
