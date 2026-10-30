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
import { applyHomography, invertMatrix3 } from "../../src/geometry";

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (
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

interface Fixture {
  id: string;
  cropper: Cropper;
  root: HTMLElement;
  changes: number;
  commits: number;
}

const mount = (motion: "always" | "reduce" = "always"): Fixture => {
  count += 1;
  const id = `motion-${count}`;
  const root = document.createElement("div");
  root.id = id;
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
    changes: 0,
    commits: 0,
    cropper: createCropper({
      image: { height: 3000, width: 4000 },
      onValueChange: () => {
        fixture.changes += 1;
      },
      onValueCommit: () => {
        fixture.commits += 1;
      },
    }),
    id,
    root,
  };
  const { cropper } = fixture;
  viewOf(cropper).setOptions({ motion });
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

const centreOf = (frame: ViewFrame | null): { x: number; y: number } => ({
  x: (frame?.rect.x ?? 0) + (frame?.rect.width ?? 0) / 2,
  y: (frame?.rect.y ?? 0) + (frame?.rect.height ?? 0) / 2,
});

const shrinkFromCorner = async (fixture: Fixture): Promise<void> => {
  const rect = viewOf(fixture.cropper).frame()?.rect;
  const x = (rect?.x ?? 0) + (rect?.width ?? 0);
  const y = (rect?.y ?? 0) + (rect?.height ?? 0);
  await commands.drag(`#${fixture.id}`, [
    [x, y],
    [x - 60, y - 50],
    [x - 120, y - 100],
    [x - 120, y - 100, 60],
  ]);
};

describe("view motion", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("waits 1.06 s, then recentres with the same pixels under the crop", async () => {
    const fixture = mount();
    await frames();
    await shrinkFromCorner(fixture);
    await frames();
    const view = viewOf(fixture.cropper);
    const offCentre = centreOf(view.frame());
    expect(offCentre.x).toBeLessThan(190);
    const { changes } = fixture;
    const corners: { x: number; y: number }[][] = [];
    const off = view.onFrame((frame) => {
      const back = invertMatrix3(frame.matrix);
      const { rect } = frame;
      corners.push([
        applyHomography(back, { x: rect.x, y: rect.y }),
        applyHomography(back, {
          x: rect.x + rect.width,
          y: rect.y + rect.height,
        }),
      ]);
    });
    await wait(900);
    expect(centreOf(view.frame()).x).toBeCloseTo(offCentre.x, 0);
    await expect
      .poll(() => Math.round(centreOf(view.frame()).x), { timeout: 3000 })
      .toBe(200);
    off();
    expect(fixture.changes).toBe(changes);
    const [first] = corners;
    const tolerance = 4000 / 360;
    for (const pair of corners) {
      expect(Math.abs((pair[0]?.x ?? 0) - (first?.[0]?.x ?? 0))).toBeLessThan(
        tolerance
      );
      expect(Math.abs((pair[1]?.y ?? 0) - (first?.[1]?.y ?? 0))).toBeLessThan(
        tolerance
      );
    }
  });

  it("cancels the wait when a new touch lands", async () => {
    const fixture = mount();
    await frames();
    await shrinkFromCorner(fixture);
    const view = viewOf(fixture.cropper);
    const offCentre = centreOf(view.frame());
    await wait(600);
    fixture.cropper.begin("pan");
    await wait(900);
    expect(centreOf(view.frame()).x).toBeCloseTo(offCentre.x, 0);
    fixture.cropper.end();
    await expect
      .poll(() => Math.round(centreOf(view.frame()).x), { timeout: 3000 })
      .toBe(200);
  });

  it("animates a quarter turn without change events in between", async () => {
    const fixture = mount();
    await frames();
    const seen = new Set<string>();
    const view = viewOf(fixture.cropper);
    const off = view.onFrame((frame) => {
      seen.add(Math.atan2(frame.matrix[3], frame.matrix[0]).toFixed(2));
    });
    fixture.cropper.rotate90();
    await frames(2);
    expect(fixture.root.dataset.transition).toBe("rotate");
    await wait(600);
    off();
    expect(fixture.root.dataset.transition).toBeUndefined();
    expect(seen.size).toBeGreaterThan(5);
    expect(fixture.changes).toBe(1);
    expect(fixture.commits).toBe(1);
  });

  it("passes through zero width when flipping", async () => {
    const fixture = mount();
    await frames();
    let narrowest = Number.POSITIVE_INFINITY;
    const off = viewOf(fixture.cropper).onFrame((frame) => {
      narrowest = Math.min(narrowest, Math.abs(frame.matrix[0]));
    });
    fixture.cropper.flip();
    await wait(700);
    off();
    expect(narrowest).toBeLessThan(0.02);
    expect(fixture.cropper.getValue().mirrored).toBeTruthy();
  });

  it("morphs the crop to a new aspect", async () => {
    const fixture = mount();
    await frames();
    const widths: number[] = [];
    const off = viewOf(fixture.cropper).onFrame((frame) => {
      widths.push(frame.rect.width);
    });
    fixture.cropper.setAspect(1);
    await wait(700);
    off();
    const start = widths[0] ?? 0;
    const end = widths.at(-1) ?? 0;
    expect(end).toBeCloseTo(260, 0);
    expect(widths.some((w) => w < start - 10 && w > end + 10)).toBeTruthy();
    expect(fixture.root.dataset.transition).toBeUndefined();
  });

  it("finishes in about 150 ms under reduced motion", async () => {
    const fixture = mount("reduce");
    await frames();
    fixture.cropper.rotate90();
    await frames(2);
    expect(fixture.root.dataset.transition).toBe("rotate");
    await wait(250);
    expect(fixture.root.dataset.transition).toBeUndefined();
  });

  it("shows the coarse grid while panning and holds it 1.38 s after", async () => {
    const fixture = mount();
    fixture.cropper.setZoom(2, { emit: false });
    await frames();
    fixture.cropper.begin("pan");
    await frames();
    expect(fixture.root.dataset.grid).toBe("coarse");
    expect(Object.hasOwn(fixture.root.dataset, "panning")).toBeTruthy();
    fixture.cropper.end();
    await wait(1000);
    expect(fixture.root.dataset.grid).toBe("coarse");
    await wait(600);
    expect(fixture.root.dataset.grid).toBe("none");
    expect(Object.hasOwn(fixture.root.dataset, "interacting")).toBeFalsy();
  });
});
