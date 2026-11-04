import { afterEach, describe, expect, it } from "vitest";
import { commands, server } from "vitest/browser";

import { createCropper } from "../../src";
import type { Clock, Cropper, CropperEvents } from "../../src";
import {
  bindArea,
  bindHandle,
  bindImage,
  bindMask,
  bindViewport,
  dialHandlers,
  handleHandlers,
  viewOf,
  viewportController,
  zoomHandlers,
} from "../../src/dom";
import { visualScale } from "../../src/dom/view";
import { applyHomography, invertMatrix3 } from "../../src/geometry";
import { fakeClock } from "../fake-clock";

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
    pinch: (
      selector: string,
      a: readonly (readonly [number, number])[],
      b: readonly (readonly [number, number])[],
      release: boolean
    ) => Promise<void>;
  }
}

const photo = { height: 3000, width: 4000 };
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
  viewport: HTMLElement;
  image: HTMLElement;
  mask: HTMLElement;
  area: HTMLElement;
  commits: number;
}

const mount = (
  width = 400,
  height = 300,
  hidden = false,
  clock?: Clock
): Fixture => {
  count += 1;
  const id = `zriz-${count}`;
  const viewport = document.createElement("div");
  viewport.id = id;
  viewport.style.cssText = `position:relative;width:${width}px;height:${height}px;padding:20px;box-sizing:border-box;overflow:hidden;background:#111;${hidden ? "display:none;" : ""}`;
  const image = document.createElement("div");
  image.style.background = "linear-gradient(45deg,#c33,#33c)";
  const mask = document.createElement("div");
  mask.style.background = "rgb(0 0 0 / 0.5)";
  const area = document.createElement("div");
  area.style.outline = "1px solid white";
  const handle = document.createElement("div");
  handle.dataset.handle = "se";
  handle.style.cssText =
    "position:absolute;right:-12px;bottom:-12px;width:24px;height:24px;background:white;";
  area.append(handle);
  viewport.append(image, mask, area);
  document.body.append(viewport);
  const fixture: Fixture = {
    area,
    commits: 0,
    cropper: createCropper({
      clock,
      image: photo,
      onValueCommit: () => {
        fixture.commits += 1;
      },
    }),
    id,
    image,
    mask,
    viewport,
  };
  const { cropper } = fixture;
  const unbind = [
    bindViewport(cropper, viewport),
    bindImage(cropper, image),
    bindMask(cropper, mask),
    bindArea(cropper, area),
    bindHandle(cropper, handle, "bottom-right"),
  ];
  cleanups.push(() => {
    for (const off of unbind) {
      off();
    }
    viewOf(cropper).destroy();
    cropper.destroy();
    viewport.remove();
  });
  return fixture;
};

const local = (fixture: Fixture, element: HTMLElement): DOMRect => {
  const outer = fixture.viewport.getBoundingClientRect();
  const box = element.getBoundingClientRect();
  return new DOMRect(box.x - outer.x, box.y - outer.y, box.width, box.height);
};

const wheel = (fixture: Fixture, init: WheelEventInit): boolean => {
  const box = fixture.viewport.getBoundingClientRect();
  return fixture.viewport.dispatchEvent(
    new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      clientX: box.x + 200,
      clientY: box.y + 150,
      ...init,
    })
  );
};

const pressers: Record<
  string,
  (cropper: Cropper, element: HTMLElement) => (event: PointerEvent) => void
> = {
  dial: (cropper, element) =>
    dialHandlers(cropper, {}, () => element).onPointerDown,
  handle: (cropper, element) =>
    handleHandlers(cropper, "top-left", () => element).onPointerDown,
  viewport: (cropper, element) => {
    const controller = viewportController(cropper);
    controller.setElement(element);
    cleanups.push(() => {
      controller.destroy();
    });
    return controller.handlers.onPointerDown;
  },
  zoom: (cropper, element) =>
    zoomHandlers(cropper, {}, () => element).onPointerDown,
};

const startsGesture = (part: string, init: PointerEventInit): boolean => {
  const cropper = createCropper({ image: photo });
  const element = document.createElement("div");
  element.style.cssText = "width:400px;height:300px;";
  document.body.append(element);
  cleanups.push(() => {
    cropper.destroy();
    element.remove();
  });
  let started = false;
  cropper.on("gesturestart", () => {
    started = true;
  });
  pressers[part]?.(
    cropper,
    element
  )(
    new PointerEvent("pointerdown", {
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      ...init,
    })
  );
  return started;
};

describe("which presses start a gesture", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it.each(["dial", "handle", "viewport", "zoom"])(
    "ignores every button but the main one on the %s",
    (part) => {
      for (const init of [
        { button: 2, buttons: 2, pointerType: "mouse" },
        { button: 2, buttons: 2, pointerType: "pen" },
        { button: 5, buttons: 32, pointerType: "pen" },
      ]) {
        expect(startsGesture(part, init)).toBeFalsy();
      }
    }
  );

  it.each(["dial", "handle", "viewport", "zoom"])(
    "takes the main button of any pointer on the %s",
    (part) => {
      for (const pointerType of ["mouse", "pen", "touch"]) {
        expect(
          startsGesture(part, { button: 0, buttons: 1, pointerType })
        ).toBeTruthy();
      }
    }
  );
});

describe("dom binders", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  describe("layout", () => {
    it("fits the crop inside the padding and covers it with the photo", async () => {
      const fixture = mount();
      await frames();
      const area = local(fixture, fixture.area);
      expect(area.y).toBeCloseTo(20, 0);
      expect(area.height).toBeCloseTo(260, 0);
      expect(Math.abs(area.width - 346.67)).toBeLessThan(1);
      expect(Math.abs(area.x - 26.67)).toBeLessThan(1);
    });

    it("covers the crop with the photo", async () => {
      const fixture = mount();
      await frames();
      const area = local(fixture, fixture.area);
      const image = local(fixture, fixture.image);
      expect(image.x).toBeLessThanOrEqual(area.x + 0.01);
      expect(image.x + image.width).toBeGreaterThanOrEqual(
        area.x + area.width - 0.01
      );
    });

    it("lays out once a hidden viewport is revealed", async () => {
      const fixture = mount(400, 300, true);
      await frames();
      fixture.viewport.style.display = "block";
      await frames(3);
      expect(local(fixture, fixture.area).height).toBeCloseTo(260, 0);
    });

    it("keeps the value through resizes", async () => {
      const fixture = mount();
      fixture.cropper.setValue({
        center: { x: 0.4, y: 0.55 },
        rotation: 6,
        size: { height: 0.5, width: 0.5 },
      });
      await frames();
      const before = fixture.cropper.getValue();
      for (const width of [800, 200, 1600, 800]) {
        fixture.viewport.style.width = `${width}px`;
        await frames(2);
      }
      expect(fixture.cropper.getValue()).toStrictEqual(before);
    });

    it("runs ten croppers independently", async () => {
      const all = Array.from({ length: 10 }, () => mount(200, 150));
      await frames();
      const others = all.filter((_, i) => i !== 3);
      const values = others.map((f) => f.cropper.getValue());
      all[3]?.cropper.setZoom(2);
      await frames();
      expect(others.map((f) => f.cropper.getValue())).toStrictEqual(values);
      expect(all[3]?.cropper.getZoom()).toBeCloseTo(2, 6);
    });
  });

  describe("pointer", () => {
    it("pans with a mouse drag and commits once", async () => {
      const fixture = mount();
      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      const before = fixture.cropper.getValue().center.x;
      const scale = viewOf(fixture.cropper).frame()?.scale ?? 1;
      await commands.drag(`#${fixture.id}`, [
        [200, 150],
        [220, 150],
        [240, 150],
        [250, 150],
      ]);
      await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(1);
      await frames(3);
      const moved =
        (before - fixture.cropper.getValue().center.x) * 4000 * scale;
      expect(moved).toBeCloseTo(50, 0);
      expect(fixture.commits).toBe(1);
    });

    it("rubber-bands past the edge and springs back", async () => {
      const fixture = mount();
      await frames();
      const rest = fixture.image.style.transform;
      const changes: string[] = [];
      fixture.cropper.on("frame", () => {
        changes.push(fixture.image.style.transform);
      });
      await commands.drag(`#${fixture.id}`, [
        [200, 150],
        [260, 150],
        [320, 150],
      ]);
      await expect.poll(() => changes.some((t) => t !== rest)).toBeTruthy();
      await expect
        .poll(() => fixture.image.style.transform, { timeout: 5000 })
        .toBe(rest);
      expect(fixture.commits).toBe(0);
    });

    it("resizes from a corner handle", async () => {
      const fixture = mount();
      await frames();
      const area = local(fixture, fixture.area);
      const x = area.x + area.width;
      const y = area.y + area.height;
      await commands.drag(`#${fixture.id}`, [
        [x, y],
        [x - 40, y - 30],
        [x - 80, y - 60],
      ]);
      await expect.poll(() => fixture.commits, { timeout: 5000 }).toBe(1);
      await frames(2);
      const { size } = fixture.cropper.getValue();
      expect(size.width).toBeLessThan(0.9);
      expect(size.height).toBeLessThan(0.9);
      expect(fixture.commits).toBe(1);
    });

    it("keeps a dragged handle inside the viewport padding", async () => {
      const fixture = mount();
      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      const area = local(fixture, fixture.area);
      const x = area.x + area.width;
      const y = area.y + area.height;
      await commands.drag(`#${fixture.id}`, [
        [x, y],
        [x + 10, y + 8],
        [x + 22, y + 16],
      ]);
      await expect
        .poll(() => {
          const moved = local(fixture, fixture.area);
          return moved.x + moved.width;
        })
        .toBeGreaterThan(x + 1);
      const after = local(fixture, fixture.area);
      expect(after.x + after.width).toBeLessThanOrEqual(380.5);
      expect(after.y + after.height).toBeLessThanOrEqual(280.5);
    });

    it("ends a gesture on pointercancel", async () => {
      const fixture = mount();
      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      const ends: Parameters<CropperEvents["gestureend"]>[] = [];
      fixture.cropper.on("gestureend", (...args) => {
        ends.push(args);
      });
      const box = fixture.viewport.getBoundingClientRect();
      const init = {
        bubbles: true,
        clientX: box.x + 200,
        clientY: box.y + 150,
        pointerId: 7,
        pointerType: "touch",
      };
      fixture.viewport.dispatchEvent(new PointerEvent("pointerdown", init));
      fixture.viewport.dispatchEvent(new PointerEvent("pointercancel", init));
      expect(ends).toHaveLength(1);
      expect(fixture.cropper.getState().interacting).toBeNull();
    });
  });

  describe("wheel", () => {
    it("lets the page scroll at the pan limit and pans otherwise", async () => {
      const fixture = mount();
      await frames();
      expect(wheel(fixture, { deltaY: 40 })).toBeTruthy();
      await wait(200);
      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      const before = fixture.cropper.getValue().center.y;
      expect(wheel(fixture, { deltaY: 40 })).toBeFalsy();
      expect(fixture.cropper.getValue().center.y).toBeGreaterThan(before);
    });

    it("keeps a gesture that moved the photo and stops it at the edge", async () => {
      const fixture = mount();
      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      const view = viewOf(fixture.cropper);
      const centres: number[] = [];
      const handled = Array.from({ length: 40 }, (_, i) => {
        const passed = wheel(fixture, { deltaY: i % 2 === 0 ? 40 : 7 });
        centres.push(fixture.cropper.getValue().center.y);
        return passed;
      });
      expect(handled.every((passed) => !passed)).toBeTruthy();
      expect(view.overscroll()).toStrictEqual({ x: 0, y: 0 });
      expect(
        centres.every((y, i) => i === 0 || y >= (centres[i - 1] ?? 0))
      ).toBeTruthy();
      expect(centres.at(-1)).toBeCloseTo(0.75, 6);
      await wait(200);
      expect(fixture.cropper.getState().interacting).toBeNull();
    });

    it("hands the whole gesture to the page when it starts at the limit", async () => {
      const fixture = mount();
      await frames();
      const gestures: string[] = [];
      fixture.cropper.on("gesturestart", (reason) => {
        gestures.push(reason);
      });
      const handled = Array.from({ length: 5 }, () =>
        wheel(fixture, { deltaY: 40 })
      );
      expect(handled.every(Boolean)).toBeTruthy();
      expect(gestures).toStrictEqual([]);
    });

    it("stretches past the smallest zoom with ctrl and springs back", async () => {
      const time = fakeClock();
      const fixture = mount(400, 300, false, time.clock);
      await frames();
      time.frames(2);
      const view = viewOf(fixture.cropper);
      for (let i = 0; i < 6; i += 1) {
        wheel(fixture, { ctrlKey: true, deltaY: 50 });
      }
      expect(fixture.cropper.getZoom()).toBeCloseTo(1, 6);
      expect(view.overzoom()).toBeLessThan(0.9);
      expect(view.overzoom()).toBeGreaterThan(Math.exp(-0.5));
      time.frames(2);
      const shrunk = view.frame()?.matrix[0] ?? 0;
      wheel(fixture, { ctrlKey: true, deltaY: -20 });
      expect(fixture.cropper.getZoom()).toBeCloseTo(1, 6);
      time.frames(2);
      expect(view.frame()?.matrix[0] ?? 0).toBeGreaterThan(shrunk);
      await wait(200);
      time.frames(120);
      await expect.poll(() => view.overzoom()).toBe(1);
    });

    it("only stretches once the zoom reaches its minimum", async () => {
      const fixture = mount();
      await frames();
      fixture.cropper.setZoom(3, { emit: false });
      await frames();
      const view = viewOf(fixture.cropper);
      const box = fixture.viewport.getBoundingClientRect();
      const early: number[] = [];
      for (let i = 0; i < 20; i += 1) {
        wheel(fixture, {
          clientX: box.x + 340,
          clientY: box.y + 250,
          ctrlKey: true,
          deltaY: 8,
        });
        if (view.overzoom() < 1 && fixture.cropper.getZoom() > 1 + 1e-6) {
          early.push(fixture.cropper.getZoom());
        }
      }
      expect(early).toStrictEqual([]);
      expect(fixture.cropper.getZoom()).toBeCloseTo(1, 6);
      expect(view.overzoom()).toBeLessThan(1);
    });

    it("shrinks around the crop centre with even gaps, never below two thirds", async () => {
      const time = fakeClock();
      const fixture = mount(400, 300, false, time.clock);
      await frames();
      time.frames(2);
      const view = viewOf(fixture.cropper);
      const box = fixture.viewport.getBoundingClientRect();
      for (let i = 0; i < 40; i += 1) {
        wheel(fixture, {
          clientX: box.x + 40,
          clientY: box.y + 40,
          ctrlKey: true,
          deltaY: 4,
        });
      }
      time.frames(2);
      const frame = view.frame();
      if (!frame) {
        throw new Error("no frame");
      }
      const [a, , e, , d, f] = frame.matrix;
      const { rect } = frame;
      const left = e - rect.x;
      const right = rect.x + rect.width - (e + a * photo.width);
      const top = f - rect.y;
      const bottom = rect.y + rect.height - (f + d * photo.height);
      expect(left).toBeGreaterThan(5);
      expect(Math.abs(left - right)).toBeLessThan(0.5);
      expect(Math.abs(top - bottom)).toBeLessThan(0.5);
      expect(view.overzoom()).toBeGreaterThan(2 / 3);
      expect(view.overzoom()).toBeLessThan(0.75);
    });

    it("only nudges past the smallest zoom on a trackpad, then snaps back quickly", async () => {
      const time = fakeClock();
      const fixture = mount(400, 300, false, time.clock);
      await frames();
      time.frames(2);
      const view = viewOf(fixture.cropper);
      for (let i = 0; i < 60; i += 1) {
        wheel(fixture, { ctrlKey: true, deltaY: 3.7 });
      }
      expect(view.overzoom()).toBeLessThan(0.97);
      expect(view.overzoom()).toBeGreaterThan(Math.exp(-0.08));
      wheel(fixture, { ctrlKey: true, deltaY: -1.3 });
      expect(fixture.cropper.getZoom()).toBeCloseTo(1, 6);
      await wait(150);
      time.frames(24);
      expect(view.overzoom()).toBeGreaterThan(0.999);
      time.frames(120);
      expect(view.overzoom()).toBe(1);
    });

    it("lets a trackpad pinch start right after the page took a scroll", async () => {
      const fixture = mount();
      await frames();
      expect(wheel(fixture, { deltaY: 40 })).toBeTruthy();
      expect(wheel(fixture, { ctrlKey: true, deltaY: -20 })).toBeFalsy();
      expect(fixture.cropper.getZoom()).toBeGreaterThan(1.1);
    });

    it("waits for a real delta before deciding who owns the gesture", async () => {
      const fixture = mount();
      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      wheel(fixture, { deltaY: 0 });
      expect(wheel(fixture, { deltaY: 40 })).toBeFalsy();
    });

    it("ends the wheel gesture when the viewport goes away", async () => {
      const cropper = createCropper({ image: photo });
      const element = document.createElement("div");
      element.style.cssText = "position:relative;width:400px;height:300px;";
      document.body.append(element);
      const unbind = bindViewport(cropper, element);
      await frames();
      cropper.setZoom(2, { emit: false });
      await frames();
      element.dispatchEvent(
        new WheelEvent("wheel", { bubbles: true, cancelable: true, deltaY: 40 })
      );
      expect(cropper.getState().interacting).toBe("wheel");
      unbind();
      expect(cropper.getState().interacting).toBeNull();
      expect(cropper.begin("pan", undefined, "other")).toBeTruthy();
      cropper.end(undefined, "other");
      viewOf(cropper).destroy();
      cropper.destroy();
      element.remove();
    });

    it("zooms at the cursor with ctrl", async () => {
      const fixture = mount();
      await frames();
      expect(wheel(fixture, { ctrlKey: true, deltaY: -50 })).toBeFalsy();
      await frames();
      expect(fixture.cropper.getZoom()).toBeCloseTo(Math.exp(0.5), 6);
    });
  });

  describe("pinch", () => {
    it.runIf(server.browser === "chromium")(
      "keeps the photo point under the fingers while zooming and turning",
      async () => {
        const fixture = mount(600, 600);
        await frames();
        const view = viewOf(fixture.cropper);
        const start = view.frame();
        if (!start) {
          throw new Error("no frame");
        }
        const mid = { x: 300, y: 300 };
        const anchor = applyHomography(invertMatrix3(start.matrix), mid);
        const turn = (20 * Math.PI) / 180;
        const steps = 12;
        const a: [number, number][] = [];
        const b: [number, number][] = [];
        for (let i = 0; i <= steps; i += 1) {
          const t = i / steps;
          const r = 60 * (1 + t);
          const angle = turn * t;
          a.push([mid.x - r * Math.cos(angle), mid.y - r * Math.sin(angle)]);
          b.push([mid.x + r * Math.cos(angle), mid.y + r * Math.sin(angle)]);
        }
        await commands.pinch(`#${fixture.id}`, a, b, true);
        await expect
          .poll(() => Math.round(fixture.cropper.getValue().rotation))
          .toBe(15);
        await frames(2);
        const end = view.frame();
        if (!end) {
          throw new Error("no frame");
        }
        const shown = applyHomography(end.matrix, anchor);
        expect(Math.abs(shown.x - mid.x)).toBeLessThan(0.1);
        expect(Math.abs(shown.y - mid.y)).toBeLessThan(0.1);
        expect(fixture.cropper.getValue().rotation).toBeCloseTo(15, 0);
      }
    );

    it.runIf(server.browser === "chromium")(
      "turns with two fingers without shrinking the photo",
      async () => {
        const fixture = mount(600, 600);
        await frames();
        const view = viewOf(fixture.cropper);
        let smallest = 1;
        const off = view.onFrame(() => {
          smallest = Math.min(smallest, view.overzoom());
        });
        const mid = { x: 300, y: 300 };
        const a: [number, number][] = [];
        const b: [number, number][] = [];
        for (let i = 0; i <= 12; i += 1) {
          const angle = ((20 * Math.PI) / 180) * (i / 12);
          a.push([
            mid.x - 100 * Math.cos(angle),
            mid.y - 100 * Math.sin(angle),
          ]);
          b.push([
            mid.x + 100 * Math.cos(angle),
            mid.y + 100 * Math.sin(angle),
          ]);
        }
        await commands.pinch(`#${fixture.id}`, a, b, true);
        await expect
          .poll(() => fixture.cropper.getValue().rotation)
          .toBeGreaterThan(10);
        await frames(2);
        off();
        expect(smallest).toBe(1);
      }
    );
  });
});

describe("viewport resize during a pan", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("keeps the photo under the finger", async () => {
    const fixture = mount();
    const { cropper, viewport } = fixture;
    cropper.setValue({ size: { height: 0.5, width: 0.5 } });
    const view = viewOf(cropper);
    const screenX = (): number => {
      const frame = view.frame();
      if (!frame) {
        throw new Error("no frame");
      }
      return applyHomography(frame.matrix, { x: 2000, y: 1500 }).x;
    };
    const press = (type: string, clientX: number): void => {
      viewport.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          button: 0,
          buttons: 1,
          clientX,
          clientY: 150,
          pointerId: 1,
          pointerType: "touch",
        })
      );
    };
    await frames();
    press("pointerdown", 200);
    press("pointermove", 190);
    await frames();
    const scale = view.frame()?.scale;
    viewport.style.width = "240px";
    viewport.style.height = "180px";
    await expect.poll(() => view.frame()?.scale).not.toBe(scale);
    press("pointermove", 180);
    await frames();
    const resized = screenX();
    press("pointermove", 150);
    await frames();
    const moved = screenX() - resized;
    press("pointerup", 150);
    expect(moved).toBeCloseTo(-30, 3);
  });
});

const pair = () => {
  const fixture = mount();
  const element = document.createElement("div");
  element.style.cssText = "position:relative;width:400px;height:300px;";
  document.body.append(element);
  const off = bindViewport(fixture.cropper, element);
  cleanups.push(() => {
    off();
    element.remove();
  });
  return { element, fixture, off, view: viewOf(fixture.cropper) };
};

describe("two viewports on one cropper", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("hiding one leaves the visible one working, in either direction", async () => {
    const { element, fixture, view } = pair();
    await frames();
    element.style.display = "none";
    await expect.poll(() => view.frame()?.layout.inset.left).toBe(20);
    fixture.viewport.style.display = "none";
    element.style.display = "block";
    await expect.poll(() => view.frame()?.layout.inset.left).toBe(0);
    fixture.viewport.style.display = "block";
    element.style.display = "none";
    await expect.poll(() => view.frame()?.layout.inset.left).toBe(20);
  });

  it("a drag works on the one left visible", async () => {
    const { element, fixture, view } = pair();
    await frames();
    element.style.display = "none";
    await expect.poll(() => view.frame()?.layout.inset.left).toBe(20);
    fixture.cropper.setZoom(2);
    await frames();
    const before = fixture.cropper.getCropState()?.crop.x;
    await commands.drag(`#${fixture.id}`, [
      [200, 150],
      [160, 150],
    ]);
    expect(fixture.cropper.getCropState()?.crop.x).not.toBe(before);
  });

  it("removing the newer one hands the frame back to the older one", async () => {
    const { fixture, off, view } = pair();
    await frames();
    off();
    expect(view.frame()?.layout.inset.left).toBe(20);
    const box = fixture.viewport.getBoundingClientRect();
    expect(
      view.local({ clientX: box.x + 10, clientY: box.y + 20 })
    ).toStrictEqual({
      x: 10,
      y: 20,
    });
    wheel(fixture, { ctrlKey: true, deltaY: -30 });
    expect(fixture.cropper.getZoom()).toBeGreaterThan(1);
  });

  it("removing the older one leaves the newer one in charge", async () => {
    const { element, fixture, view } = pair();
    await frames();
    const controller = viewportController(fixture.cropper);
    const other = document.createElement("div");
    other.style.cssText = "width:400px;height:300px;padding:5px;";
    document.body.append(other);
    cleanups.push(() => {
      other.remove();
    });
    controller.setElement(other);
    expect(view.frame()?.layout.inset.left).toBe(5);
    controller.setElement(null);
    expect(view.frame()?.layout.inset.left).toBe(0);
    const box = element.getBoundingClientRect();
    expect(
      view.local({ clientX: box.x + 1, clientY: box.y + 2 })
    ).toStrictEqual({
      x: 1,
      y: 2,
    });
  });

  it("cleanup lets go of the element", async () => {
    const cropper = createCropper({ image: photo });
    const element = document.createElement("div");
    element.style.cssText =
      "position:fixed;left:50px;top:60px;width:40px;height:40px;";
    document.body.append(element);
    cleanups.push(() => {
      cropper.destroy();
      element.remove();
    });
    const off = bindViewport(cropper, element);
    await frames();
    expect(viewOf(cropper).local({ clientX: 60, clientY: 70 })).toStrictEqual({
      x: 10,
      y: 10,
    });
    off();
    expect(viewOf(cropper).frame()).toBeNull();
    expect(viewOf(cropper).local({ clientX: 60, clientY: 70 })).toStrictEqual({
      x: 60,
      y: 70,
    });
  });
});

describe("a removed photo", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("leaves no crop box or mask hole, and the next photo lays out again", async () => {
    const fixture = mount();
    const { area, mask } = fixture;
    await frames();
    const { width } = area.style;
    fixture.cropper.setImage(null);
    await frames();
    expect([
      area.style.width,
      area.style.left,
      mask.style.clipPath,
    ]).toStrictEqual(["", "", ""]);
    fixture.cropper.setImage(photo);
    await frames();
    expect(area.style.width).toBe(width);
    expect(mask.style.clipPath).not.toBe("");
  });

  it("clears a box that went hidden before the photo left", async () => {
    const fixture = mount();
    await frames();
    fixture.viewport.style.display = "none";
    await expect.poll(() => viewOf(fixture.cropper).frame()).toBeNull();
    fixture.cropper.setImage(null);
    fixture.viewport.style.display = "block";
    await frames(3);
    expect(fixture.area.style.width).toBe("");
  });
});

describe("zoom at the cursor", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("keeps the pixel under the cursor with two wheels in one frame", async () => {
    const fixture = mount();
    await frames();
    const view = viewOf(fixture.cropper);
    const box = fixture.viewport.getBoundingClientRect();
    const cursor = { x: 340, y: 250 };
    const under = (): { x: number; y: number } => {
      const frame = view.frame();
      if (!frame) {
        throw new Error("no frame");
      }
      return applyHomography(invertMatrix3(frame.matrix), cursor);
    };
    const before = under();
    for (let i = 0; i < 2; i += 1) {
      wheel(fixture, {
        clientX: box.x + cursor.x,
        clientY: box.y + cursor.y,
        ctrlKey: true,
        deltaY: -50,
      });
    }
    await frames();
    const after = under();
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(2);
  });
});

const HOSTS = [
  ["transform: scale(2)", "transform:scale(2);transform-origin:0 0;"],
  ["transform: scale(0.5)", "transform:scale(0.5);transform-origin:0 0;"],
  ["zoom: 2", "zoom:2;"],
  ["zoom: 0.5", "zoom:0.5;"],
  ["no scale", ""],
] as const;

describe.each(HOSTS)("under an ancestor with %s", (_, css) => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  const hosted = async (): Promise<Fixture> => {
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:0;top:0;${css}`;
    document.body.append(host);
    const fixture = mount(200, 160);
    host.append(fixture.viewport);
    cleanups.push(() => {
      host.remove();
    });
    await frames();
    return fixture;
  };

  it("a pan moves the photo with the pointer", async () => {
    const fixture = await hosted();
    fixture.cropper.setZoom(3);
    await frames();
    const before = fixture.image.getBoundingClientRect();
    await commands.drag(`#${fixture.id}`, [
      [40, 40],
      [30, 35],
      [20, 30],
    ]);
    await frames();
    const after = fixture.image.getBoundingClientRect();
    expect(after.x - before.x).toBeCloseTo(-20, 0);
    expect(after.y - before.y).toBeCloseTo(-10, 0);
  });

  it("a handle keeps its corner under the pointer", async () => {
    const fixture = await hosted();
    const start = fixture.area.getBoundingClientRect();
    const outer = fixture.viewport.getBoundingClientRect();
    const x = start.right - outer.x;
    const y = start.bottom - outer.y;
    await commands.drag(`#${fixture.id}`, [
      [x, y],
      [x - 5, y - 4],
      [x - 10, y - 8],
    ]);
    await frames();
    const end = fixture.area.getBoundingClientRect();
    expect(Math.abs(end.right - (start.right - 10))).toBeLessThan(1.5);
    expect(Math.abs(end.bottom - (start.bottom - 8))).toBeLessThan(1.5);
  });

  it("a wheel keeps the pixel under the cursor", async () => {
    const fixture = await hosted();
    const outer = fixture.viewport.getBoundingClientRect();
    const clientX = outer.x + outer.width * 0.75;
    const clientY = outer.y + outer.height * 0.75;
    const screen = (): { x: number; y: number } => {
      const box = fixture.image.getBoundingClientRect();
      return {
        x: (clientX - box.x) / box.width,
        y: (clientY - box.y) / box.height,
      };
    };
    const before = screen();
    wheel(fixture, { clientX, clientY, ctrlKey: true, deltaY: -30 });
    await frames();
    const after = screen();
    expect(after.x).toBeCloseTo(before.x, 2);
    expect(after.y).toBeCloseTo(before.y, 2);
  });
});

describe("a fractional width with no scale", () => {
  it("counts as no scale", () => {
    const element = document.createElement("div");
    element.style.cssText = "width:100.5px;height:50.5px;";
    document.body.append(element);
    expect(visualScale(element)).toStrictEqual({ x: 1, y: 1 });
    element.remove();
  });
});

const frameDocument = async (): Promise<HTMLIFrameElement> => {
  const frame = document.createElement("iframe");
  frame.srcdoc = "<!doctype html><body style='margin:0'></body>";
  frame.style.cssText = "width:420px;height:320px;border:0;";
  await new Promise((resolve) => {
    frame.addEventListener("load", resolve, { once: true });
    document.body.append(frame);
  });
  cleanups.push(() => {
    frame.remove();
  });
  return frame;
};

const documentOf = (frame: HTMLIFrameElement): Document => {
  const doc = frame.contentDocument;
  if (!doc) {
    throw new Error("no document");
  }
  return doc;
};

const windowIn = (frame: HTMLIFrameElement): Window => {
  const win = frame.contentWindow;
  if (!win) {
    throw new Error("no window");
  }
  return win;
};

const inFrame = async () => {
  const frame = await frameDocument();
  const doc = documentOf(frame);
  const element = doc.createElement("div");
  element.style.cssText = "width:400px;height:300px;";
  doc.body.append(element);
  const cropper = createCropper({ image: photo });
  const off = bindViewport(cropper, element);
  cleanups.push(() => {
    off();
    cropper.destroy();
  });
  return { cropper, doc, element, win: windowIn(frame) };
};

const pressOn = (element: HTMLElement): void => {
  element.dispatchEvent(
    new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: 50,
      clientY: 50,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
    })
  );
};

describe("a viewport in another document", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("escape in that window cancels the pan", async () => {
    const { cropper, element, win } = await inFrame();
    await frames();
    pressOn(element);
    expect(cropper.getState().interacting).toBe("pan");
    win.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(cropper.getState().interacting).toBeNull();
  });

  it("a blur of that window ends the pan, a blur of this one does not", async () => {
    const { cropper, element, win } = await inFrame();
    await frames();
    pressOn(element);
    globalThis.dispatchEvent(new Event("blur"));
    expect(cropper.getState().interacting).toBe("pan");
    win.dispatchEvent(new Event("blur"));
    expect(cropper.getState().interacting).toBeNull();
  });

  it("an ancestor there re-measures when its animation ends", async () => {
    const { cropper, element, doc } = await inFrame();
    await frames();
    const wrapper = doc.createElement("div");
    doc.body.append(wrapper);
    wrapper.append(element);
    element.style.boxSizing = "content-box";
    element.style.paddingLeft = "7px";
    element.style.width = "393px";
    wrapper.dispatchEvent(new Event("transitionend", { bubbles: true }));
    expect(viewOf(cropper).frame()?.layout.inset.left).toBe(7);
  });

  it("the pressed element takes the capture error from that realm", async () => {
    const doc = documentOf(await frameDocument());
    const cropper = createCropper({ image: photo });
    cleanups.push(() => {
      cropper.destroy();
    });
    const element = doc.createElement("div");
    doc.body.append(element);
    const handlers = zoomHandlers(cropper, {}, () => element);
    expect(() => {
      handlers.onPointerDown(
        new PointerEvent("pointerdown", {
          button: 0,
          buttons: 1,
          clientX: 1,
          clientY: 1,
          pointerId: 999,
        })
      );
    }).not.toThrow();
    expect(cropper.getState().interacting).toBe("zoom-control");
  });

  it("a handler with no getter still finds an element from that realm", async () => {
    const doc = documentOf(await frameDocument());
    const cropper = createCropper({ image: photo });
    cleanups.push(() => {
      cropper.destroy();
    });
    const track = doc.createElement("div");
    track.style.cssText = "width:200px;height:20px;";
    doc.body.append(track);
    const handlers = zoomHandlers(cropper);
    track.addEventListener("pointerdown", handlers.onPointerDown);
    track.dispatchEvent(
      new PointerEvent("pointerdown", {
        button: 0,
        buttons: 1,
        clientX: 100,
        clientY: 5,
        pointerId: 1,
      })
    );
    expect(cropper.getZoom()).toBeGreaterThan(1);
    handlers.release();
  });
});

const bare = (css: string) => {
  const element = document.createElement("div");
  element.style.cssText = css;
  const cropper = createCropper({ image: photo });
  cleanups.push(() => {
    cropper.destroy();
    element.remove();
  });
  return { cropper, element, view: viewOf(cropper) };
};

describe("a viewport's own box", () => {
  afterEach(() => {
    for (const cleanup of cleanups.splice(0)) {
      cleanup();
    }
  });

  it("refits when padding changes and the content box does not", async () => {
    const { cropper, element, view } = bare(
      "width:400px;height:300px;padding:24px;box-sizing:content-box;"
    );
    document.body.append(element);
    const off = bindViewport(cropper, element);
    cleanups.push(off);
    await frames(3);
    expect(view.frame()?.layout.inset.left).toBe(24);
    element.style.padding = "8px";
    await expect.poll(() => view.frame()?.layout.inset.left).toBe(8);
  });

  it("refits inside a shadow tree when percent padding follows its parent", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const parent = document.createElement("div");
    parent.style.width = "400px";
    host.attachShadow({ mode: "open" }).append(parent);
    const { cropper, element, view } = bare(
      "width:400px;height:300px;padding:5%;box-sizing:content-box;"
    );
    parent.append(element);
    const off = bindViewport(cropper, element);
    cleanups.push(() => {
      off();
      host.remove();
    });
    await frames(3);
    expect(view.frame()?.layout.inset.left).toBe(20);
    parent.style.width = "800px";
    await expect.poll(() => view.frame()?.layout.inset.left).toBe(40);
  });

  it("becomes positioned when it is connected after the bind", async () => {
    const { cropper, element } = bare("width:400px;height:300px;");
    const off = bindViewport(cropper, element);
    cleanups.push(off);
    document.body.append(element);
    await expect
      .poll(() => getComputedStyle(element).position)
      .toBe("relative");
  });

  it("gets back what the bind wrote, and keeps a position of its own", async () => {
    const { cropper, element } = bare("width:400px;height:300px;");
    document.body.append(element);
    const off = bindViewport(cropper, element);
    expect(element.style.position).toBe("relative");
    off();
    expect([
      element.style.position,
      element.style.touchAction,
      element.style.userSelect,
    ]).toStrictEqual(["", "", ""]);
    const placed = bare("position:absolute;width:40px;height:30px;");
    document.body.append(placed.element);
    bindViewport(placed.cropper, placed.element)();
    expect(placed.element.style.position).toBe("absolute");
    await frames();
  });
});
