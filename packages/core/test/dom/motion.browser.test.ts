import { afterEach, describe, expect, it } from "vitest";
import { commands } from "vitest/browser";

import { createCropper } from "../../src";
import type { Cropper } from "../../src";
import {
  bindArea,
  bindHandle,
  bindImage,
  bindMask,
  bindState,
  bindViewport,
  viewOf,
} from "../../src/dom";
import type { ViewFrame } from "../../src/dom";
import { PHOTO } from "../cropper-fixture";

const HOLD_SLACK = 250;

const TIMER_ROUNDING = 2;

const cleanups: (() => void)[] = [];

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

type Fixture = {
  commits: number;
  cropper: Cropper;
  root: HTMLElement;
};

const mount = (): Fixture => {
  const root = document.createElement("div");

  root.id = "motion";

  root.style.cssText =
    "position:relative;width:400px;height:300px;padding:20px;box-sizing:border-box;overflow:hidden;";

  const image = document.createElement("div");
  const mask = document.createElement("div");
  const area = document.createElement("div");
  const handle = document.createElement("div");

  handle.style.cssText =
    "position:absolute;right:-12px;bottom:-12px;width:24px;height:24px;";

  area.append(handle);
  root.append(image, mask, area);
  document.body.append(root);
  const fixture: Fixture = {
    commits: 0,
    cropper: createCropper({
      image: PHOTO,
      onValueCommit: () => {
        fixture.commits += 1;
      },
    }),
    root,
  };
  const { cropper } = fixture;

  viewOf(cropper).setOptions({ motion: "always" });
  const unbind = [
    bindViewport(cropper, root),
    bindImage(cropper, image),
    bindMask(cropper, mask),
    bindArea(cropper, area),
    bindHandle(cropper, handle, "bottom-right"),
    bindState(cropper, root),
  ];

  cleanups.push(() => {
    for (const off of unbind) {
      off();
    }

    viewOf(cropper).destroy();
    cropper.destroy();
    root.remove();
  });

  return fixture;
};

const centreOf = (frame: ViewFrame | null): number =>
  (frame?.rect.x ?? 0) + (frame?.rect.width ?? 0) / 2;

describe("view motion", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("holds the grid for 0.3 s after a resize drag, then recentres", async () => {
    const fixture = mount();
    const view = viewOf(fixture.cropper);

    await frames();
    const rest = { cleared: 0, ended: 0, grid: "", moved: 0, offCentre: 0 };
    const offEnd = fixture.cropper.on("gestureend", () => {
      rest.ended = performance.now();
      rest.grid = fixture.root.dataset.grid ?? "";
      rest.offCentre = centreOf(view.frame());
    });
    const offFrame = view.onFrame((frame) => {
      if (
        rest.ended > 0 &&
        rest.moved === 0 &&
        Math.abs(centreOf(frame) - rest.offCentre) > 0.5
      ) {
        rest.moved = performance.now();
      }
    });
    const observer = new MutationObserver(() => {
      if (
        rest.ended > 0 &&
        rest.cleared === 0 &&
        fixture.root.dataset.grid !== "coarse"
      ) {
        rest.cleared = performance.now();
      }
    });

    observer.observe(fixture.root, {
      attributeFilter: ["data-grid"],
      attributes: true,
    });

    cleanups.push(offEnd, offFrame, () => {
      observer.disconnect();
    });

    const rect = view.frame()?.rect;
    const x = (rect?.x ?? 0) + (rect?.width ?? 0);
    const y = (rect?.y ?? 0) + (rect?.height ?? 0);

    await commands.drag("#motion", [
      [x, y],
      [x - 60, y - 50],
      [x - 120, y - 100],
      [x - 120, y - 100, 60],
    ]);

    expect(rest.grid).toBe("coarse");
    expect(rest.offCentre).toBeLessThan(190);
    await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(1);

    await expect
      .poll(() => Math.round(centreOf(view.frame())), { timeout: 5000 })
      .toBe(200);

    for (const at of [rest.moved, rest.cleared]) {
      expect(at - rest.ended).toBeGreaterThanOrEqual(300 - TIMER_ROUNDING);
      expect(at - rest.ended).toBeLessThan(300 + HOLD_SLACK);
    }

    expect(fixture.root.dataset.grid).toBe("none");
    expect(Object.hasOwn(fixture.root.dataset, "interacting")).toBeFalsy();
  });
});
