import { afterEach, describe, expect, it, vi } from "vitest";
import { commands } from "vitest/browser";

import { createCropper, frameClock } from "../../src";
import type { Clock, Cropper } from "../../src";
import {
  bindArea,
  bindHandle,
  bindImage,
  bindMask,
  bindPhoto,
  bindState,
  bindViewport,
  viewOf,
} from "../../src/dom";
import type { ViewFrame } from "../../src/dom";
import { applyHomography, invertMatrix3 } from "../../src/geometry";
import { fakeClock } from "../fake-clock";

const TIMER_ROUNDING = 2;

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

type Fixture = {
  id: string;
  cropper: Cropper;
  root: HTMLElement;
  changes: number;
  commits: number;
};

const mount = (
  motion: "always" | "reduce" = "always",
  clock?: Clock
): Fixture => {
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
      clock,
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

const clipOf = (node: Element | null): string =>
  node ? getComputedStyle(node).clipPath : "";

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

type Rest = {
  ended: number;
  moved: number;
  offCentre: number;
};

const shrinkAndWatch = async (fixture: Fixture): Promise<Rest> => {
  const view = viewOf(fixture.cropper);
  const rest: Rest = { ended: 0, moved: 0, offCentre: 0 };
  const offEnd = fixture.cropper.on("gestureend", () => {
    rest.ended = performance.now();
    rest.offCentre = centreOf(view.frame()).x;
  });
  const offFrame = view.onFrame((frame) => {
    if (
      rest.ended > 0 &&
      rest.moved === 0 &&
      Math.abs(centreOf(frame).x - rest.offCentre) > 0.5
    ) {
      rest.moved = performance.now();
    }
  });

  cleanups.push(offEnd, offFrame);
  await shrinkFromCorner(fixture);

  return rest;
};

const centred = async (fixture: Fixture): Promise<void> => {
  await expect
    .poll(() => Math.round(centreOf(viewOf(fixture.cropper).frame()).x), {
      timeout: 5000,
    })
    .toBe(200);
};

describe("view motion", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("waits 0.5 s, then recentres with the same pixels under the crop", async () => {
    const fixture = mount();

    await frames();
    const view = viewOf(fixture.cropper);
    const rest = await shrinkAndWatch(fixture);

    expect(rest.offCentre).toBeLessThan(190);
    await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(1);
    await frames();
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

    await centred(fixture);
    off();

    expect(rest.moved - rest.ended).toBeGreaterThanOrEqual(
      500 - TIMER_ROUNDING
    );

    expect(fixture.changes).toBe(changes);
    const [first] = corners;
    const tolerance = (1.25 * 4000) / 360;

    for (const pair of corners) {
      expect(Math.abs((pair[0]?.x ?? 0) - (first?.[0]?.x ?? 0))).toBeLessThan(
        tolerance
      );

      expect(Math.abs((pair[1]?.y ?? 0) - (first?.[1]?.y ?? 0))).toBeLessThan(
        tolerance
      );
    }
  });

  it("waits as long as recentreDelay asks", async () => {
    const fixture = mount();

    await frames();
    const view = viewOf(fixture.cropper);

    view.setOptions({ recentreDelay: 1060 });
    const rest = await shrinkAndWatch(fixture);

    await centred(fixture);

    expect(rest.moved - rest.ended).toBeGreaterThanOrEqual(
      1060 - TIMER_ROUNDING
    );
  });

  it("cancels the wait when a new touch lands", async () => {
    const fixture = mount();

    await frames();
    const off = fixture.cropper.on("gestureend", () => {
      off();

      setTimeout(() => {
        fixture.cropper.begin("pan");
      }, 250);
    });
    const rest = await shrinkAndWatch(fixture);

    await wait(1150);
    expect(rest.moved).toBe(0);
    expect(fixture.cropper.getState().interacting).toBe("pan");
    fixture.cropper.end();
    await centred(fixture);
  });

  it("animates a quarter turn without change events in between", async () => {
    const time = fakeClock();
    const fixture = mount("always", time.clock);

    await frames();
    time.frames(2);
    const seen = new Set<string>();
    const view = viewOf(fixture.cropper);
    const off = view.onFrame((frame) => {
      seen.add(Math.atan2(frame.matrix[3], frame.matrix[0]).toFixed(2));
    });

    fixture.cropper.rotate90();
    time.frames(2);
    expect(fixture.root.dataset.transition).toBe("rotate");
    time.frames(36);
    off();
    expect(fixture.root.dataset.transition).toBeUndefined();
    expect(seen.size).toBeGreaterThan(5);
    expect(fixture.changes).toBe(1);
    expect(fixture.commits).toBe(1);
  });

  it("a quarter turn clips the mask and the photo to the turning crop", () => {
    const time = fakeClock();
    const fixture = mount("always", time.clock);
    const image = fixture.root.children.item(0);
    const mask = fixture.root.children.item(1);

    time.frames(2);
    fixture.cropper.rotate90("cw", { reason: "rotate-90" });
    time.frames(6);
    const frame = viewOf(fixture.cropper).frame();
    const a = frame?.clip?.[0] ?? { x: 0, y: 0 };
    const b = frame?.clip?.[1] ?? { x: 0, y: 0 };

    expect(Math.abs(a.y - b.y)).toBeGreaterThan(20);

    expect({
      image: clipOf(image).startsWith("polygon("),
      mask: clipOf(mask).includes(a.x.toFixed(2).slice(0, -1)),
      transition: fixture.root.dataset.transition,
    }).toStrictEqual({ image: true, mask: true, transition: "rotate" });

    time.frames(40);

    expect({
      image: clipOf(image),
      mask: clipOf(mask).includes("evenodd"),
      transition: fixture.root.dataset.transition,
    }).toStrictEqual({ image: "none", mask: true, transition: undefined });
  });

  it("a photo layer follows the turning crop in its own box", async () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      image: { height: 300, width: 400 },
    });
    const root = document.createElement("div");

    root.style.cssText =
      "position:relative;width:400px;height:300px;overflow:hidden;";

    const image = document.createElement("div");

    root.append(image);
    document.body.append(root);
    const off = [bindViewport(cropper, root), bindPhoto(cropper, image)];

    cleanups.push(() => {
      for (const stop of off) {
        stop();
      }

      cropper.destroy();
      root.remove();
    });

    viewOf(cropper).setOptions({ motion: "always" });
    await expect.poll(() => viewOf(cropper).frame()).not.toBeNull();
    time.frames(2);
    cropper.rotate90("cw", { reason: "rotate-90" });
    time.frames(6);
    expect(image.style.clipPath).toContain("polygon(");
    time.frames(40);
    expect(image.style.clipPath).toBe("");
  });

  it("a circle stays a circle through a quarter turn", () => {
    const time = fakeClock();
    const cropper = createCropper({
      clock: time.clock,
      defaultValue: { aspect: 1 },
      image: { height: 3000, width: 4000 },
    });
    const root = document.createElement("div");

    root.style.cssText =
      "position:relative;width:400px;height:300px;overflow:hidden;";

    const image = document.createElement("div");
    const mask = document.createElement("div");

    root.append(image, mask);
    document.body.append(root);
    const off = [
      bindViewport(cropper, root),
      bindImage(cropper, image),
      bindMask(cropper, mask, "circle"),
    ];

    cleanups.push(() => {
      for (const stop of off) {
        stop();
      }

      cropper.destroy();
      root.remove();
    });

    viewOf(cropper).setOptions({ motion: "always" });
    time.frames(2);
    cropper.rotate90("cw", { reason: "rotate-90" });
    time.frames(6);
    expect(image.style.clipPath).toContain("ellipse(");

    expect(mask.style.clipPath + mask.style.maskImage).not.toContain(
      "polygon("
    );
  });

  it("passes through zero width when flipping", async () => {
    const time = fakeClock();
    const fixture = mount("always", time.clock);

    await frames();
    time.frames(2);
    let narrowest = Number.POSITIVE_INFINITY;
    const off = viewOf(fixture.cropper).onFrame((frame) => {
      narrowest = Math.min(narrowest, Math.abs(frame.matrix[0]));
    });

    fixture.cropper.flip();
    time.frames(42);
    off();
    expect(narrowest).toBeLessThan(0.02);
    expect(fixture.cropper.getValue().mirrored).toBeTruthy();
  });

  it("morphs the crop to a new aspect", async () => {
    const time = fakeClock();
    const fixture = mount("always", time.clock);

    await frames();
    time.frames(2);
    const widths: number[] = [];
    const off = viewOf(fixture.cropper).onFrame((frame) => {
      widths.push(frame.rect.width);
    });

    fixture.cropper.setAspect(1);
    time.frames(42);
    off();
    const start = widths[0] ?? 0;
    const end = widths.at(-1) ?? 0;

    expect(end).toBeCloseTo(260, 0);
    expect(widths.some((w) => w < start - 10 && w > end + 10)).toBeTruthy();
    expect(fixture.root.dataset.transition).toBeUndefined();
  });

  it("finishes in about 150 ms under reduced motion", async () => {
    const time = fakeClock();
    const fixture = mount("reduce", time.clock);

    await frames();
    time.frames(2);
    fixture.cropper.rotate90();
    time.frames(2);
    expect(fixture.root.dataset.transition).toBe("rotate");
    time.frames(6);
    expect(fixture.root.dataset.transition).toBe("rotate");
    time.frames(4);
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
    let cleared = 0;
    const observer = new MutationObserver(() => {
      if (cleared === 0 && fixture.root.dataset.grid !== "coarse") {
        cleared = performance.now();
      }
    });

    observer.observe(fixture.root, {
      attributeFilter: ["data-grid"],
      attributes: true,
    });

    cleanups.push(() => {
      observer.disconnect();
    });

    const ended = performance.now();

    fixture.cropper.end();

    await expect
      .poll(() => fixture.root.dataset.grid, { timeout: 5000 })
      .toBe("none");

    expect(cleared - ended).toBeGreaterThanOrEqual(1380 - TIMER_ROUNDING);
    expect(Object.hasOwn(fixture.root.dataset, "interacting")).toBeFalsy();
  });
});

describe("a page where frames stop, as in a hidden tab", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("still reports writes and commits on a timer", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const cropper = createCropper({ image: { height: 300, width: 400 } });
    const commits: number[] = [];
    let changes = 0;

    cropper.on("change", () => {
      changes += 1;
    });

    cropper.on("commit", (value) => {
      commits.push(value.rotation);
    });

    cropper.setRotation(5);

    await expect
      .poll(() => commits, { interval: 50, timeout: 2000 })
      .toStrictEqual([5]);

    expect(changes).toBe(1);
    expect(cropper.getState().committed.rotation).toBe(5);
    cropper.destroy();
  });

  it("finishes held motion and commits once", async () => {
    vi.stubGlobal("requestAnimationFrame", () => 0);
    const cropper = createCropper({ image: { height: 300, width: 400 } });
    const commits: number[] = [];

    cropper.on("commit", (value) => {
      commits.push(value.rotation);
    });

    let ticks = 0;

    cropper.setRotation(5);

    cropper.run(() => {
      ticks += 1;

      return ticks < 2;
    });

    await expect
      .poll(() => commits, { interval: 50, timeout: 3000 })
      .toStrictEqual([5]);

    expect(cropper.getState().settling).toBeFalsy();
    cropper.destroy();
  });
});

describe("a page with frames", () => {
  it("runs one step per request and cancels both paths", async () => {
    const clock = frameClock();
    let steps = 0;
    const handle = clock.request(() => {
      steps += 1;
    });

    clock.cancel(handle);
    await wait(300);
    expect(steps).toBe(0);

    clock.request(() => {
      steps += 1;
    });

    await wait(400);
    expect(steps).toBe(1);
  });
});
