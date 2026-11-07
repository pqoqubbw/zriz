import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { commands as browser, page, userEvent } from "vitest/browser";

import { fixtureFile } from "./fixtures";
import { button, find, hits, item, mountDemo, ready, settle } from "./helpers";

type Path = readonly (readonly [number, number, number?])[];

type Tools = {
  drag: (selector: string, path: Path) => Promise<void>;
};

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const isTools = (value: object): value is Tools => "drag" in value;

const toolsOf = (value: object): Tools => {
  if (!isTools(value)) {
    throw new Error("no test commands");
  }

  return value;
};

const commands = toolsOf(browser);

const FAKE_TIMERS: Parameters<typeof vi.useFakeTimers>[0] = {
  shouldAdvanceTime: true,
  toFake: ["setTimeout", "clearTimeout"],
};

const panel = (): HTMLElement => find('[data-demo="introduction"]');

const angle = (): string => find(item("dial-value")).textContent;

const resetChip = (): HTMLElement => find(item("reset"));

const shown = (element: Element): boolean =>
  getComputedStyle(element).display !== "none";

const says = (text: string): boolean => panel().textContent.includes(text);

const ratio = (): number => {
  const box = find(item("area")).getBoundingClientRect();

  return box.width / box.height;
};

const dragDial = async (by: number): Promise<void> => {
  await commands.drag(item("dial"), [
    [180, 16],
    [180 + by / 3, 16, 16],
    [180 + (by * 2) / 3, 16, 16],
    [180 + by, 16, 16],
  ]);

  await settle();
};

const nudge = async (): Promise<void> => {
  find(item("dial")).focus();
  await userEvent.keyboard("{ArrowRight}");
  find(item("dial")).blur();
  await expect.poll(() => shown(resetChip())).toBeTruthy();
};

const pick = (file: File): void => {
  const input = find('input[type="file"]', panel());

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const nameOf = (element: Element | null): string =>
  element?.getAttribute("aria-label") ??
  (element instanceof HTMLElement ? element.dataset.zrizItem : undefined) ??
  "";

const tabOrder = async (steps: number): Promise<string[]> => {
  button("Open a photo").focus();

  const order: string[] = [];

  for (let step = 0; step < steps; step += 1) {
    await userEvent.tab();
    order.push(nameOf(document.activeElement));
  }

  return order;
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

const drop = (type: "dragenter" | "drop", transfer: DataTransfer): void => {
  find('[data-slot="stage"]', panel()).dispatchEvent(
    new DragEvent(type, {
      bubbles: true,
      cancelable: true,
      dataTransfer: transfer,
    })
  );
};

describe("introduction demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    document.body.style.padding = "";
    await cleanup();
  });

  it("straightens, turns, flips, resets and downloads a jpeg", async () => {
    await mountDemo("introduction");
    await ready();

    const state = () => ({ angle: angle(), reset: shown(resetChip()) });
    const start = state();
    const audits = [await violations()];

    await dragDial(-60);

    const straightened = state();

    audits.push(await violations());
    resetChip().click();
    await expect.poll(state).toStrictEqual({ angle: "0.0", reset: false });

    const landscape = ratio() > 1;

    button("Rotate left").click();
    await settle();

    const portrait = ratio() < 1;

    button("Flip").click();
    await settle();

    const flipped = {
      mirrored: Object.hasOwn(find(item("root")).dataset, "mirrored"),
      reset: shown(resetChip()),
    };
    const links: string[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function capture(this: HTMLAnchorElement) {
        links.push(this.href);
      }
    );

    vi.useFakeTimers(FAKE_TIMERS);
    button("Download").click();
    await expect.poll(() => links.length).toBe(1);

    const response = await fetch(links[0] ?? "");
    const blob = await response.blob();

    audits.push(await violations());

    expect(audits).toStrictEqual([[], [], []]);

    expect({
      download: button("Download").getAttribute("aria-label"),
      flipped,
      landscape,
      level: straightened.angle === "0.0",
      portrait,
      saved: says("Saved"),
      start,
      straightenedReset: straightened.reset,
      type: blob.type,
    }).toStrictEqual({
      download: "Download",
      flipped: { mirrored: true, reset: true },
      landscape: true,
      level: false,
      portrait: true,
      saved: false,
      start: { angle: "0.0", reset: false },
      straightenedReset: true,
      type: "image/jpeg",
    });
  });

  it("names a file that is not an image or cannot be read, and opens a dropped photo", async () => {
    await mountDemo("introduction");
    await ready();
    vi.useFakeTimers(FAKE_TIMERS);
    pick(new File(["plain text"], "notes.txt", { type: "text/plain" }));
    await expect.poll(() => says("Not an image")).toBeTruthy();
    await expect(violations()).resolves.toStrictEqual([]);

    vi.advanceTimersByTime(4000);
    await expect.poll(() => says("Not an image")).toBeFalsy();
    vi.useRealTimers();
    pick(await fixtureFile("portrait"));
    await expect.poll(ratio, { timeout: 15_000 }).toBeLessThan(1);

    const transfer = new DataTransfer();

    transfer.items.add(await fixtureFile("square"));
    drop("dragenter", transfer);
    await expect.poll(() => says("Drop to open")).toBeTruthy();

    expect(
      Object.hasOwn(find('[data-slot="chip-bar"]').dataset, "hidden")
    ).toBeTruthy();

    drop("drop", transfer);
    await expect.poll(() => says("Drop to open")).toBeFalsy();
    await expect.poll(ratio, { timeout: 15_000 }).toBeCloseTo(1, 1);

    pick(new File(["not really a png"], "broken.png", { type: "image/png" }));
    await expect.poll(() => says("Can’t read this file")).toBeTruthy();
  });

  it("gives every button a 44 px hit box and tabs from the corners to the stage, then the dial", async () => {
    document.body.style.padding = "32px";
    await mountDemo("introduction");
    await ready();
    await nudge();

    expect({
      download: hits(button("Download"), ["top", "bottom", "right"]),
      flip: hits(button("Flip")),
      open: hits(button("Open a photo")),
      reset: hits(button("Reset"), ["top", "bottom", "left"]),
      rotate: hits(button("Rotate left")),
    }).toStrictEqual({
      download: true,
      flip: true,
      open: true,
      reset: true,
      rotate: true,
    });

    await expect(tabOrder(6)).resolves.toStrictEqual([
      "Reset",
      "Download",
      "Crop area",
      "Rotate left",
      "Straighten",
      "Flip",
    ]);
  });
});
