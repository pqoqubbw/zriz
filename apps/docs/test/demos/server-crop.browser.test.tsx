import { parse } from "@zriz/core";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import ServerCropDemo from "../../demos/server-crop/demo";
import { fixtureFile } from "./fixtures";
import {
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

const panel = (): HTMLElement => find('[data-demo="server-crop"]');

const action = (): HTMLElement =>
  find('[data-slot="corner-end"] > :last-child', panel());

const result = (): HTMLElement | null =>
  panel().querySelector('[data-slot="result"]');

const sentValue = (): string => find('[data-slot="sent-value"]').textContent;

const plan = (): unknown =>
  JSON.parse(find('[data-slot="sent-plan"]').textContent);

const ratio = (): number => {
  const box = find(item("area")).getBoundingClientRect();

  return box.width / box.height;
};

const nudge = async (): Promise<void> => {
  find(item("dial")).focus();
  await userEvent.keyboard("{ArrowRight}{ArrowRight}");
  find(item("dial")).blur();
  await settle();
};

const send = async (): Promise<void> => {
  await expect.poll(() => action().ariaDisabled).toBeNull();
  action().click();
  await expect.poll(result).not.toBeNull();
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
  const out = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return out.violations.map((each) => `${each.id}: ${each.help}`);
};

describe("server crop demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("server-crop");

    await mountLive(ServerCropDemo, "server-crop");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("works out the plan in the browser and uploads nothing", async () => {
    await mountDemo("server-crop");
    await ready();

    const fetches = vi.spyOn(globalThis, "fetch");
    const beacons = vi.spyOn(navigator, "sendBeacon");
    const requests = vi.spyOn(XMLHttpRequest.prototype, "send");

    expect(result()).toBeNull();

    await send();

    expect([
      fetches.mock.calls.length,
      beacons.mock.calls.length,
      requests.mock.calls.length,
    ]).toStrictEqual([0, 0, 0]);

    await expect.poll(() => action().ariaLabel).toBe("Sent");
    expect(parse(sentValue())?.rotation).toBe(0);
    expect(plan()).toMatchObject({ flop: false, kind: "extract", rotate: 0 });
    await expect(violations()).resolves.toStrictEqual([]);
  });

  it("dims the result once the crop moves on, and sends again", async () => {
    await mountDemo("server-crop");
    await ready();
    await send();

    expect(result()?.dataset.stale).toBeUndefined();

    await nudge();
    await expect.poll(() => result()?.dataset.stale).toBe("");
    await send();
    await expect.poll(() => result()?.dataset.stale).toBeUndefined();
  });

  it("sends an affine plan for a straightened crop", async () => {
    await mountDemo("server-crop");
    await ready();
    await nudge();
    await send();

    expect(parse(sentValue())?.rotation).not.toBe(0);

    expect(plan()).toMatchObject({
      extend: { extendWith: "copy" },
      kind: "affine",
      options: { interpolator: "bicubic" },
    });
  });

  it("drops the result for a new photo", async () => {
    await mountDemo("server-crop");
    await ready();
    await send();

    pick(await fixtureFile("portrait"));
    await expect.poll(result).toBeNull();
    await expect.poll(ratio, { timeout: 15_000 }).toBeLessThan(1);
    await ready();
    await send();

    expect(plan()).toMatchObject({ kind: "extract" });
  });
});

describe("server crop demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("server-crop", width);

      await mountLive(ServerCropDemo, "server-crop", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await send();
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
