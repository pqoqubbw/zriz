import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import FullEditorDemo from "../../demos/full-editor/demo";
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

const panel = (): HTMLElement => find('[data-demo="full-editor"]');

const angle = (): string => find(item("dial-value")).textContent;

const ratio = (): number => {
  const box = find(item("area")).getBoundingClientRect();

  return box.width / box.height;
};

const aspect = (label: string): HTMLElement => {
  const found = [
    ...panel().querySelectorAll<HTMLElement>(item("aspect-item")),
  ].find((element) => element.textContent === label);

  if (!found) {
    throw new Error(`no aspect ${label}`);
  }

  return found;
};

const labels = (): string[] =>
  [...panel().querySelectorAll(item("aspect-item"))].map(
    (element) => element.textContent
  );

const checked = (): string[] =>
  [...panel().querySelectorAll(`${item("aspect-item")}[data-checked]`)].map(
    (element) => element.textContent
  );

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("full editor demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("full-editor");

    await mountLive(FullEditorDemo, "full-editor");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("straightens with the dial and resets", async () => {
    await mountDemo("full-editor");
    await ready();

    expect(angle()).toBe("0.0");
    await expect(violations()).resolves.toStrictEqual([]);

    find(item("dial")).focus();
    await userEvent.keyboard("{Shift>}{ArrowRight}{/Shift}");
    find(item("dial")).blur();
    await settle();

    expect(angle()).toBe("10.0");

    button("Reset").click();
    await expect.poll(angle).toBe("0.0");
  });

  it("starts free with landscape labels and orientation off", async () => {
    await mountDemo("full-editor");
    await ready();

    expect(labels()).toStrictEqual(["free", "original", "1:1", "5:4", "16:9"]);
    expect(checked()).toStrictEqual(["free"]);
    expect(button("Swap orientation").hasAttribute("disabled")).toBeTruthy();
  });

  it("locks an aspect and swaps it, keeping one item checked", async () => {
    await mountDemo("full-editor");
    await ready();
    aspect("16:9").click();
    await settle();

    expect(ratio()).toBeCloseTo(16 / 9, 1);

    button("Swap orientation").click();
    await settle();

    expect(ratio()).toBeCloseTo(9 / 16, 1);
    expect(checked()).toStrictEqual(["9:16"]);
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("turns and flips", async () => {
    await mountDemo("full-editor");
    await ready();
    button("Rotate left").click();
    await settle();

    expect(ratio()).toBeLessThan(1);

    button("Flip").click();
    await settle();

    expect(Object.hasOwn(find(item("root")).dataset, "mirrored")).toBeTruthy();
  });

  it("downloads a jpeg", async () => {
    await mountDemo("full-editor");
    await ready();

    const links: string[] = [];

    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
      function capture(this: HTMLAnchorElement) {
        links.push(this.href);
      }
    );

    button("Download").click();
    await expect.poll(() => links.length).toBe(1);

    const response = await fetch(links[0] ?? "");
    const blob = await response.blob();

    expect(blob.type).toBe("image/jpeg");
  });

  it("gives the zone buttons a 44 px hit box", async () => {
    await mountDemo("full-editor");
    await ready();
    aspect("16:9").click();
    await settle();

    expect(hits(button("Rotate left"))).toBeTruthy();
    expect(hits(button("Flip"))).toBeTruthy();
    expect(hits(button("Swap orientation"))).toBeTruthy();
    expect(hits(aspect("1:1"), ["top", "bottom"])).toBeTruthy();
  });
});

describe("full editor demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("full-editor", width);

      await mountLive(FullEditorDemo, "full-editor", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
