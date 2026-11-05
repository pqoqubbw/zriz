import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { commands as browser, page, server, userEvent } from "vitest/browser";

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

const domOrder = (): string[] =>
  [...panel().querySelectorAll<HTMLElement>("button, [tabindex]")]
    .filter((element) => element.tabIndex >= 0 && shown(element))
    .map((element) => nameOf(element))
    .slice(1);

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
    await cleanup();
  });

  it("starts level with reset hidden", async () => {
    await mountDemo("introduction");
    await ready();

    expect(angle()).toBe("0.0");
    expect(shown(resetChip())).toBeFalsy();
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("straightens, shows reset after a change and resets", async () => {
    await mountDemo("introduction");
    await ready();
    await dragDial(-60);

    expect(angle()).not.toBe("0.0");
    expect(shown(resetChip())).toBeTruthy();
    await expect(violations()).resolves.toStrictEqual([]);

    resetChip().click();
    await expect.poll(angle).toBe("0.0");
    await expect.poll(() => shown(resetChip())).toBeFalsy();
  });

  it("rotates a quarter and flips", async () => {
    await mountDemo("introduction");
    await ready();

    expect(ratio()).toBeGreaterThan(1);

    button("Rotate left").click();
    await settle();

    expect(ratio()).toBeLessThan(1);

    button("Flip").click();
    await settle();

    expect(Object.hasOwn(find(item("root")).dataset, "mirrored")).toBeTruthy();
    expect(shown(resetChip())).toBeTruthy();
  });

  it("downloads a jpeg and says saved for 2 s", async () => {
    await mountDemo("introduction");
    await ready();

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

    expect(blob.type).toBe("image/jpeg");
    await expect.poll(() => says("saved")).toBeTruthy();
    await expect(violations()).resolves.toStrictEqual([]);

    vi.advanceTimersByTime(2000);
    await expect.poll(() => says("saved")).toBeFalsy();
  });

  it("names a file that is not an image for 4 s and still opens", async () => {
    await mountDemo("introduction");
    await ready();
    vi.useFakeTimers(FAKE_TIMERS);
    pick(new File(["plain text"], "notes.txt", { type: "text/plain" }));
    await expect.poll(() => says("not an image")).toBeTruthy();

    expect(getComputedStyle(button("not an image. Open a photo")).color).toBe(
      "rgb(180, 35, 24)"
    );

    await expect(violations()).resolves.toStrictEqual([]);

    vi.advanceTimersByTime(4000);
    await expect.poll(() => says("not an image")).toBeFalsy();
    vi.useRealTimers();
    pick(await fixtureFile("portrait"));
    await expect.poll(ratio, { timeout: 15_000 }).toBeLessThan(1);
  });

  it("names a photo it cannot read", async () => {
    await mountDemo("introduction");
    await ready();
    pick(new File(["not really a png"], "broken.png", { type: "image/png" }));

    await expect.poll(() => says("can’t read this file")).toBeTruthy();
  });

  it("opens a dropped photo", async () => {
    await mountDemo("introduction");
    await ready();

    const transfer = new DataTransfer();

    transfer.items.add(await fixtureFile("square"));
    drop("dragenter", transfer);
    await expect.poll(() => says("drop to open")).toBeTruthy();

    expect(document.querySelector('[aria-label="Open a photo"]')).toBeNull();

    drop("drop", transfer);
    await expect.poll(() => says("drop to open")).toBeFalsy();
    await expect.poll(ratio, { timeout: 15_000 }).toBeCloseTo(1, 1);
  });

  it("gives every button a 44 px hit box", async () => {
    await mountDemo("introduction");
    await ready();
    await nudge();

    expect(hits(button("Open a photo"))).toBeTruthy();
    expect(hits(button("Reset"), ["top", "bottom", "left"])).toBeTruthy();
    expect(hits(button("Download"), ["top", "bottom", "right"])).toBeTruthy();
    expect(hits(button("Rotate left"))).toBeTruthy();
    expect(hits(button("Flip"))).toBeTruthy();
  });

  it("moves focus from the corners to the stage, then the dial", async () => {
    await mountDemo("introduction");
    await ready();
    await nudge();

    const order = server.browser === "webkit" ? domOrder() : await tabOrder(6);

    expect(order).toStrictEqual([
      "Reset",
      "Download",
      "Crop area",
      "Rotate left",
      "Straighten",
      "Flip",
    ]);
  });

  it.skipIf(server.browser === "webkit")(
    "draws the 2 px inset focus ring",
    async () => {
      await mountDemo("introduction");
      await ready();
      await tabOrder(3);

      expect(getComputedStyle(button("Rotate left")).boxShadow).toContain(
        "rgb(17, 17, 17) 0px 0px 0px 2px inset"
      );
    }
  );
});

describe("introduction demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("shows reset and download as icons", async () => {
    await mountDemo("introduction", "phone");
    await ready();
    await nudge();

    const widths = ["Reset", "Download"].map(
      (label) => button(label).getBoundingClientRect().width
    );
    const labels = ["Reset", "Download"].map((label) =>
      shown(find("span", button(label)))
    );

    expect(widths).toStrictEqual([32, 32]);
    expect(labels).toStrictEqual([false, false]);
    await expect(violations()).resolves.toStrictEqual([]);
  });
});
