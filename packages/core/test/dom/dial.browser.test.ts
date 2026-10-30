import { afterEach, describe, expect, it } from "vitest";
import { commands, server, userEvent } from "vitest/browser";

import { createCropper } from "../../src";
import type { Cropper } from "../../src";
import {
  bindDial,
  bindDialTicks,
  bindDialValue,
  bindViewport,
  dialState,
  viewOf,
} from "../../src/dom";

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
    touch: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
  }
}

const cleanups: (() => void)[] = [];
let count = 0;

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const wait = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

interface DialFixture {
  id: string;
  cropper: Cropper;
  dial: HTMLElement;
  strip: HTMLElement;
  label: HTMLElement;
  commits: number;
}

const mount = (): DialFixture => {
  count += 1;
  const id = `dial-${count}`;
  const viewport = document.createElement("div");
  viewport.style.cssText = "position:relative;width:400px;height:300px;";
  const dial = document.createElement("div");
  dial.id = id;
  dial.setAttribute("aria-label", "Straighten");
  dial.style.cssText =
    "position:relative;width:361px;height:40px;overflow:hidden;";
  const strip = document.createElement("div");
  dial.append(strip);
  const label = document.createElement("span");
  document.body.append(viewport, dial, label);
  const fixture: DialFixture = {
    commits: 0,
    cropper: createCropper({
      image: { height: 3000, width: 4000 },
      onValueCommit: () => {
        fixture.commits += 1;
      },
    }),
    dial,
    id,
    label,
    strip,
  };
  const { cropper } = fixture;
  const unbind = [
    bindViewport(cropper, viewport),
    bindDial(cropper, dial),
    bindDialTicks(cropper, strip),
    bindDialValue(cropper, label),
  ];
  cleanups.push(() => {
    for (const off of unbind) {
      off();
    }
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
    dial.remove();
    label.remove();
  });
  return fixture;
};

describe("dial", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("renders the iOS ruler once", () => {
    const { strip } = mount();
    const ticks = [...strip.children].filter(
      (t): t is HTMLElement => t instanceof HTMLElement
    );
    expect(ticks).toHaveLength(41);
    expect(
      ticks.flatMap((t, i) => (Object.hasOwn(t.dataset, "major") ? [i] : []))
    ).toStrictEqual([0, 10, 20, 30, 40]);
    expect(
      ticks.flatMap((t, i) => (Object.hasOwn(t.dataset, "zero") ? [i] : []))
    ).toStrictEqual([20]);
    expect(
      ticks.flatMap((t, i) => (t.dataset.fade === undefined ? [] : [i]))
    ).toStrictEqual([0, 1, 2, 38, 39, 40]);
  });

  it("turns 1:1 at 4 px per degree after a 10 px slop, left is counter-clockwise", async () => {
    const fixture = mount();
    await frames();
    await commands.drag(`#${fixture.id}`, [
      [180, 20],
      [175, 20],
      [170, 20],
      [150, 20],
      [130, 20],
      [130, 20, 80],
    ]);
    await wait(50);
    expect(fixture.cropper.getValue().rotation).toBeCloseTo(-10, 0);
    expect(fixture.label.textContent).toBe("-10");
  });

  it("keeps turning after a throw and commits once when it stops", async () => {
    const fixture = mount();
    await frames();
    const path: [number, number][] = [[100, 20]];
    for (let i = 1; i <= 8; i += 1) {
      path.push([100 + i * 15, 20]);
    }
    await commands.drag(`#${fixture.id}`, path);
    const released = fixture.cropper.getValue().rotation;
    await wait(1200);
    const rested = fixture.cropper.getValue().rotation;
    expect(Math.abs(rested)).toBeGreaterThanOrEqual(Math.abs(released));
    expect(fixture.commits).toBe(1);
    expect(fixture.cropper.getState().interacting).toBeNull();
  });

  it("stops at 45 degrees and springs the ruler back", async () => {
    const fixture = mount();
    await frames();
    await commands.drag(`#${fixture.id}`, [
      [10, 20],
      [30, 20],
      [200, 20],
      [355, 20],
    ]);
    expect(fixture.cropper.getValue().rotation).toBe(45);
    await wait(800);
    expect(dialState(fixture.cropper).overshoot()).toBe(0);
    expect(fixture.cropper.getValue().rotation).toBe(45);
  });

  it("follows the slider keys and speaks the value", async () => {
    const fixture = mount();
    await frames();
    fixture.dial.focus();
    const seen: number[] = [];
    for (const key of [
      "{ArrowRight}",
      "{ArrowRight}",
      "{PageUp}",
      "{End}",
      "{Home}",
      "0",
      "{ArrowLeft}",
    ]) {
      await userEvent.keyboard(key);
      seen.push(fixture.cropper.getValue().rotation);
    }
    expect(seen).toStrictEqual([1, 2, 12, 45, -45, 0, -1]);
    await frames();
    expect(fixture.dial.getAttribute("aria-valuetext")).toBe("-1 degree");
    expect(fixture.dial.getAttribute("role")).toBe("slider");
  });

  it("snaps the ruler to device pixels", async () => {
    const fixture = mount();
    fixture.cropper.setRotation(3.3);
    await frames(3);
    const match = /translateX\((?<x>[-\d.e]+)px\)/u.exec(
      fixture.strip.style.transform
    );
    const x = Number(match?.groups?.x);
    const dpr = devicePixelRatio;
    expect(Math.abs(x * dpr - Math.round(x * dpr))).toBeLessThan(1e-6);
  });

  it.runIf(server.browser === "chromium")(
    "lets a vertical swipe scroll the page and turns on a horizontal one",
    async () => {
      const fixture = mount();
      const spacer = document.createElement("div");
      spacer.style.height = "3000px";
      document.body.append(spacer);
      window.scrollTo(0, 0);
      await frames();
      await commands.touch(`#${fixture.id}`, [
        [180, 30],
        [180, 20],
        [180, 5],
        [181, -40],
        [181, -90],
      ]);
      await frames(3);
      expect(window.scrollY).toBeGreaterThan(0);
      expect(fixture.cropper.getValue().rotation).toBe(0);
      window.scrollTo(0, 0);
      await frames();
      await commands.touch(`#${fixture.id}`, [
        [180, 20],
        [170, 20],
        [150, 20],
        [120, 20],
        [120, 20, 80],
      ]);
      await frames(3);
      expect(fixture.cropper.getValue().rotation).toBeLessThan(-5);
      spacer.remove();
    }
  );
});
