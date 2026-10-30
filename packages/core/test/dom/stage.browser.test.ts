import { afterEach, describe, expect, it } from "vitest";
import { commands, server } from "vitest/browser";

import { createCropper } from "../../src";
import type { Cropper, CropperEvents } from "../../src";
import {
  bindArea,
  bindHandle,
  bindImage,
  bindMask,
  bindViewport,
  viewOf,
} from "../../src/dom";
import { applyHomography, invertMatrix3 } from "../../src/geometry";

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
  area: HTMLElement;
  commits: number;
}

const mount = (width = 400, height = 300, hidden = false): Fixture => {
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
      image: photo,
      onValueCommit: () => {
        fixture.commits += 1;
      },
    }),
    id,
    image,
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
      await wait(700);
      expect(changes.some((t) => t !== rest)).toBeTruthy();
      expect(fixture.image.style.transform).toBe(rest);
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
      await frames(2);
      const { size } = fixture.cropper.getValue();
      expect(size.width).toBeLessThan(0.9);
      expect(size.height).toBeLessThan(0.9);
      expect(fixture.commits).toBe(1);
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
      fixture.cropper.setZoom(2, { emit: false });
      await frames();
      const before = fixture.cropper.getValue().center.y;
      expect(wheel(fixture, { deltaY: 40 })).toBeFalsy();
      expect(fixture.cropper.getValue().center.y).toBeGreaterThan(before);
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
  });
});
