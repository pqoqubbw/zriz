import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import AvatarDemo from "../../demos/avatar/demo";
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

const panel = (): HTMLElement => find('[data-demo="avatar"]');

const shown = (): string => find('[data-slot="value"]', panel()).textContent;

const zoom = (): number =>
  Number(find(item("zoom")).getAttribute("aria-valuenow"));

const off = (label: string): boolean =>
  button(label).getAttribute("aria-disabled") === "true";

const press = async (keys: string): Promise<void> => {
  find(item("zoom")).focus();
  await userEvent.keyboard(keys);
  find(item("zoom")).blur();
  await settle();
};

const bigPortrait = async (): Promise<File> => {
  const canvas = new OffscreenCanvas(1600, 2400);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = "#6f8fb3";
  context.fillRect(0, 0, 1600, 2400);

  const blob = await canvas.convertToBlob({ type: "image/png" });

  return new File([blob], "big.png", { type: "image/png" });
};

const pick = (file: File): void => {
  const input = find('input[type="file"]', panel());

  Object.defineProperty(input, "files", {
    configurable: true,
    value: [file],
  });

  input.dispatchEvent(new Event("change", { bubbles: true }));
};

const capture = (): string[] => {
  const links: string[] = [];

  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(
    function keep(this: HTMLAnchorElement) {
      links.push(this.href);
    }
  );

  return links;
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("avatar demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it.each(["desktop", "phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("avatar", width);

      await mountLive(AvatarDemo, "avatar", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
    }
  );

  it("crops a circle with no handles and no grid", async () => {
    await mountDemo("avatar");
    await ready();

    const area = find(item("area"));
    const box = area.getBoundingClientRect();
    const extra = panel().querySelector(`${item("handle")}, ${item("grid")}`);

    expect(area.dataset.shape).toBe("circle");
    expect(box.width).toBeCloseTo(box.height, 1);
    expect(extra).toBeNull();

    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("starts at 1× with zoom out off", async () => {
    await mountDemo("avatar");
    await ready();

    expect(shown()).toBe("1.0×");
    expect(off("Zoom out")).toBeTruthy();
  });

  it("zooms with the steps and the wheel", async () => {
    await mountDemo("avatar");
    await ready();
    button("Zoom in").click();
    await settle();

    expect(shown()).toBe("1.3×");

    const before = zoom();
    const viewport = find(item("viewport"));
    const box = viewport.getBoundingClientRect();

    viewport.dispatchEvent(
      new WheelEvent("wheel", {
        bubbles: true,
        cancelable: true,
        clientX: box.left + box.width / 2,
        clientY: box.top + box.height / 2,
        deltaY: 40,
      })
    );

    await settle();

    expect(zoom()).toBeLessThan(before);
  });

  it("stops where the crop reaches 512 source px", async () => {
    await mountDemo("avatar");
    await ready();
    await press("{End}");

    expect(zoom()).toBeCloseTo(800 / 512, 1);
  });

  it("stops at 3× on a large photo", async () => {
    await mountDemo("avatar");
    await ready();
    pick(await bigPortrait());

    await expect
      .poll(
        async () => {
          await press("{End}");

          return shown();
        },
        { timeout: 15_000 }
      )
      .toBe("3.0×");

    expect(off("Zoom in")).toBeTruthy();
  });

  it("starts a new photo from the whole frame", async () => {
    await mountDemo("avatar");
    await ready();
    button("Zoom in").click();
    await settle();

    expect(button("Reset").checkVisibility()).toBeTruthy();

    pick(await bigPortrait());

    await expect
      .poll(() => button("Reset").checkVisibility(), { timeout: 15_000 })
      .toBeFalsy();

    expect(shown()).toBe("1.0×");
  });

  it("downloads a round png at most 512 px wide", async () => {
    await mountDemo("avatar");
    await ready();

    const links = capture();

    button("Download").click();
    await expect.poll(() => links.length).toBe(1);

    const response = await fetch(links[0] ?? "");
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");

    context?.drawImage(bitmap, 0, 0);

    const corner = context?.getImageData(0, 0, 1, 1).data[3];
    const middle = context?.getImageData(
      bitmap.width / 2,
      bitmap.height / 2,
      1,
      1
    ).data[3];

    expect(blob.type).toBe("image/png");
    expect(bitmap.width).toBe(512);
    expect(bitmap.height).toBe(512);
    expect(corner).toBe(0);
    expect(middle).toBe(255);
  });

  it("gives the steps a 44 px hit box", async () => {
    await mountDemo("avatar");
    await ready();

    expect(hits(button("Zoom out"))).toBeTruthy();
    expect(hits(button("Zoom in"))).toBeTruthy();
  });
});

describe("avatar demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("keeps the circle inside the safe area", async () => {
    await mountDemo("avatar", "phone");
    await ready();

    const stage = find('[data-slot="stage"]').getBoundingClientRect();
    const area = find(item("area")).getBoundingClientRect();

    expect(area.height).toBeCloseTo(stage.height - 120, 0);
    expect(area.top - stage.top).toBeCloseTo(60, 0);
    await expect(violations()).resolves.toStrictEqual([]);
  });
});
