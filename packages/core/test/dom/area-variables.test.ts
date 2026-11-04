import { describe, expect, it } from "vitest";

import { createCropper } from "../../src";
import { bindArea } from "../../src/dom/parts";
import { viewOf } from "../../src/dom/view";
import { fakeClock } from "../fake-clock";

const NAMES = [
  "--zriz-rotation",
  "--zriz-rotation-progress",
  "--zriz-zoom",
  "--zriz-zoom-progress",
  "--zriz-overscroll",
];

const LAYOUT = {
  dpr: 1,
  height: 300,
  inset: { bottom: 0, left: 0, right: 0, top: 0 },
  width: 400,
};

const isElement = (value: object): value is HTMLElement => "style" in value;

const fakeArea = () => {
  const variables = new Map<string, string>();
  const writes: string[] = [];
  const element = {
    style: {
      removeProperty(name: string): void {
        variables.delete(name);
      },
      setProperty(name: string, value: string): void {
        variables.set(name, value);
        writes.push(name);
      },
    },
    toggleAttribute: () => false,
  };

  if (!isElement(element)) {
    throw new Error("no style");
  }

  return { element, variables, writes };
};

const mount = (liveVariables?: boolean) => {
  const time = fakeClock();
  const cropper = createCropper({
    clock: time.clock,
    image: { height: 3000, width: 4000 },
  });
  const view = viewOf(cropper);

  view.setLayout(LAYOUT);
  time.frame();
  const area = fakeArea();
  const stop = bindArea(cropper, area.element, { liveVariables });

  return { ...area, cropper, stop, time, view };
};

const read = (variables: Map<string, string>) =>
  Object.fromEntries(NAMES.map((name) => [name, Number(variables.get(name))]));

describe("area live variables", () => {
  it("writes the five variables from the first frame, at rest", () => {
    const { variables, view } = mount(true);

    expect(read(variables)).toStrictEqual({
      "--zriz-overscroll": 0,
      "--zriz-rotation": 0,
      "--zriz-rotation-progress": 0,
      "--zriz-zoom": 1,
      "--zriz-zoom-progress": 0,
    });

    view.destroy();
  });

  it("follows rotation and zoom", () => {
    const { cropper, time, variables, view } = mount(true);

    cropper.setRotation(-10);
    cropper.setZoom(4);
    time.frame();
    const limit = cropper.getRotationLimit();
    const values = read(variables);

    expect(values["--zriz-rotation"]).toBeCloseTo(-10, 3);
    expect(values["--zriz-rotation-progress"]).toBeCloseTo(-10 / limit, 3);
    expect(values["--zriz-zoom"]).toBeCloseTo(4, 3);

    expect(values["--zriz-zoom-progress"]).toBeCloseTo(
      Math.log(4) / Math.log(cropper.getMaxZoom()),
      3
    );

    view.destroy();
  });

  it("reaches the ends of both progress ranges", () => {
    const { cropper, time, variables, view } = mount(true);

    cropper.setRotation(-cropper.getRotationLimit());
    cropper.setZoom(cropper.getMaxZoom());
    time.frame();
    const values = read(variables);

    expect(values["--zriz-rotation-progress"]).toBe(-1);
    expect(values["--zriz-zoom-progress"]).toBeCloseTo(1, 2);
    view.destroy();
  });

  it("measures overscroll in px and returns to 0 at rest", () => {
    const { time, variables, view } = mount(true);

    view.setOverscroll({ x: 30, y: -40 });
    time.frame();
    expect(variables.get("--zriz-overscroll")).toBe("50");
    view.settleOverscroll();
    time.frames(120);
    expect(variables.get("--zriz-overscroll")).toBe("0");
    view.destroy();
  });

  it("rounds to three decimals", () => {
    const { cropper, time, variables, view } = mount(true);

    cropper.setRotation(-4.56789);
    time.frame();
    expect(variables.get("--zriz-rotation")).toBe("-4.568");
    view.destroy();
  });

  it("writes nothing when a value has not changed", () => {
    const { cropper, time, view, writes } = mount(true);
    const first = writes.length;

    cropper.invalidate();
    time.frame();
    expect(writes).toHaveLength(first);
    view.destroy();
  });

  it("writes nothing without the prop, and stops after cleanup", () => {
    const off = mount();

    off.cropper.setRotation(-10);
    off.time.frame();
    expect(off.writes).toStrictEqual([]);
    off.view.destroy();

    const on = mount(true);

    on.stop();
    const count = on.writes.length;

    on.cropper.setRotation(-10);
    on.time.frame();
    expect(on.writes).toHaveLength(count);
    on.view.destroy();
  });
});
