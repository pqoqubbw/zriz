import { parse } from "@zriz/core";
import axe from "axe-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { find, item, mountDemo, ready, settle } from "./helpers";

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

  it("works out the plan in the browser, uploads nothing, dims a stale result and sends an affine plan when straightened", async () => {
    await mountDemo("server-crop");
    await ready();

    const fetches = vi.spyOn(globalThis, "fetch");
    const beacons = vi.spyOn(navigator, "sendBeacon");
    const requests = vi.spyOn(XMLHttpRequest.prototype, "send");
    const before = result();

    await send();

    const level = {
      label: action().ariaLabel,
      plan: plan(),
      rotation: parse(sentValue())?.rotation,
      stale: result()?.dataset.stale,
    };
    const audit = await violations();

    await nudge();
    await expect.poll(() => result()?.dataset.stale).toBe("");
    await send();
    await expect.poll(() => result()?.dataset.stale).toBeUndefined();

    expect([
      fetches.mock.calls.length,
      beacons.mock.calls.length,
      requests.mock.calls.length,
    ]).toStrictEqual([0, 0, 0]);

    expect({
      audit,
      before,
      level,
      straightened: {
        level: parse(sentValue())?.rotation === 0,
        plan: plan(),
      },
    }).toMatchObject({
      audit: [],
      before: null,
      level: {
        label: "Send",
        plan: { flop: false, kind: "extract", rotate: 0 },
        rotation: 0,
        stale: undefined,
      },
      straightened: {
        level: false,
        plan: {
          extend: { extendWith: "copy" },
          kind: "affine",
          options: { interpolator: "bicubic" },
        },
      },
    });
  });
});
