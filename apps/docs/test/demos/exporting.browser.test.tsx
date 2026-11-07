import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, server } from "vitest/browser";

import ExportingDemo from "../../demos/exporting/demo";
import {
  find,
  frameLayout,
  layoutOf,
  mountDemo,
  mountLive,
  ready,
} from "./helpers";

vi.mock(import("../../demos/shell/photo"), async () => {
  const { photoMock } = await import("./fixtures");

  return await photoMock();
});

const panel = (): HTMLElement => find('[data-demo="exporting"]');

const choice = (label: string): HTMLElement => {
  const found = [
    ...panel().querySelectorAll<HTMLElement>('[data-slot="track"] label'),
  ].find((element) => element.textContent === label);

  if (!found) {
    throw new Error(`no choice ${label}`);
  }

  return found;
};

const radio = (label: string): HTMLElement =>
  find('input[type="radio"]', choice(label));

const checked = (): string[] =>
  [...panel().querySelectorAll('[data-slot="track"] label[data-checked]')].map(
    (element) => element.textContent
  );

const action = (): HTMLElement =>
  find('[data-slot="corner-end"] > :last-child', panel());

const download = async (): Promise<{ name: string; type: string }> => {
  const links: HTMLAnchorElement[] = [];
  const spy = vi
    .spyOn(HTMLAnchorElement.prototype, "click")
    .mockImplementation(function capture(this: HTMLAnchorElement) {
      links.push(this);
    });

  await expect.poll(() => action().ariaDisabled).toBeNull();
  action().click();
  await expect.poll(() => links.length, { timeout: 15_000 }).toBe(1);
  spy.mockRestore();

  const [link] = links;
  const response = await fetch(link?.href ?? "");
  const blob = await response.blob();

  return { name: link?.download ?? "", type: blob.type };
};

const violations = async (): Promise<string[]> => {
  const result = await axe.run(panel(), {
    rules: { region: { enabled: false } },
  });

  return result.violations.map((each) => `${each.id}: ${each.help}`);
};

const WEBP = server.browser === "webkit" ? "image/jpeg" : "image/webp";

describe("exporting demo", () => {
  beforeEach(async () => {
    await page.viewport(1280, 900);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanup();
  });

  it("draws the live demo where the frame drew it", async () => {
    const frame = await frameLayout("exporting");

    await mountLive(ExportingDemo, "exporting");
    await ready();

    expect(layoutOf()).toStrictEqual(frame);
  });

  it("starts on jpeg and downloads a jpeg", async () => {
    await mountDemo("exporting");
    await ready();

    expect(checked()).toStrictEqual(["JPEG"]);
    await expect(violations()).resolves.toStrictEqual([]);

    await expect(download()).resolves.toStrictEqual({
      name: "zriz-crop.jpg",
      type: "image/jpeg",
    });
  });

  it("downloads the format picked in the track", async () => {
    await mountDemo("exporting");
    await ready();
    radio("PNG").click();
    await expect.poll(checked).toStrictEqual(["PNG"]);

    await expect(download()).resolves.toStrictEqual({
      name: "zriz-crop.png",
      type: "image/png",
    });

    radio("WebP").click();
    await expect.poll(checked).toStrictEqual(["WebP"]);
    await expect(download()).resolves.toHaveProperty("type", WEBP);
  });
});

describe("exporting demo on a phone", () => {
  beforeEach(async () => {
    await page.viewport(390, 844);
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each(["phone", "narrow"] as const)(
    "draws the live demo where the frame drew it at %s",
    async (width) => {
      const frame = await frameLayout("exporting", width);

      await mountLive(ExportingDemo, "exporting", width);
      await ready();

      expect(layoutOf()).toStrictEqual(frame);
      await expect(violations()).resolves.toStrictEqual([]);
    }
  );
});
