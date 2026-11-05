import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import UndoDemo from "../../demos/undo/demo";
import { fixtureFile } from "./fixtures";
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

const pick = (file: File): void => {
  const input = find('input[type="file"]', panel());

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
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

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("undo");

    await mountLive(UndoDemo, "undo");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("starts off, with undo on the left and rotate on the right", async () => {
    await mountDemo("undo");
    await ready();

    const row = [...panel().querySelectorAll('[data-slot="zone-row"] > *')];

    expect(row.at(0)).toBe(undo());
    expect(row.at(-1)).toBe(button("Rotate left"));
    expect(off()).toBe("true");
    expect(hits(undo())).toBeTruthy();
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("steps back through a turn and a straighten, one commit each", async () => {
    await mountDemo("undo");
    await ready();
    button("Rotate left").click();
    await settle();
    await nudge(1);

    expect([angle() === "0.0", ratio() < 1, off()]).toStrictEqual([
      false,
      true,
      "false",
    ]);

    undo().click();
    await settle();
    await expect.poll(angle).toBe("0.0");

    expect([ratio() < 1, off()]).toStrictEqual([true, "false"]);

    undo().click();
    await settle();
    await expect.poll(off).toBe("true");

    expect(ratio()).toBeGreaterThan(1);
  });

  it("keeps focus and stays off once the stack is empty", async () => {
    await mountDemo("undo");
    await ready();
    await nudge(1);
    undo().focus();
    undo().click();
    await settle();
    await expect.poll(off).toBe("true");

    expect(document.activeElement).toBe(undo());
    await expect(violations()).resolves.toStrictEqual([]);

    undo().click();
    await settle();

    expect(angle()).toBe("0.0");
  });

  it("does nothing while a gesture runs", async () => {
    await mountDemo("undo");
    await ready();
    await nudge(1);
    await expect.poll(off).toBe("false");

    const before = angle();
    const viewport = find(item("viewport"));
    const box = viewport.getBoundingClientRect();
    const at = { clientX: box.left + box.width / 2, clientY: box.top + 100 };

    viewport.dispatchEvent(
      new PointerEvent("pointerdown", {
        ...at,
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId: 7,
        pointerType: "mouse",
      })
    );

    await expect
      .poll(() => document.querySelector(`${item("root")}[data-interacting]`))
      .not.toBeNull();

    undo().click();

    expect(angle()).toBe(before);
    expect(off()).toBe("false");

    viewport.dispatchEvent(
      new PointerEvent("pointerup", {
        ...at,
        bubbles: true,
        button: 0,
        isPrimary: true,
        pointerId: 7,
        pointerType: "mouse",
      })
    );

    await settle();
  });

  it("starts an empty stack for a new photo", async () => {
    await mountDemo("undo");
    await ready();
    await nudge(1);
    await expect.poll(off).toBe("false");

    pick(await fixtureFile("portrait"));
    await expect.poll(ratio, { timeout: 15_000 }).toBeLessThan(1);
    await ready();

    expect(off()).toBe("true");
    expect(angle()).toBe("0.0");
  });
});

describe("undo demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("undo", width);

      await mountLive(UndoDemo, "undo", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
