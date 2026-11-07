import { describe, expect, it } from "vitest";

import { bindArea } from "../../src/dom/parts";
import { laidOut } from "../cropper-fixture";

const NAMES = [
  "--zriz-rotation",
  "--zriz-rotation-progress",
  "--zriz-zoom",
  "--zriz-zoom-progress",
  "--zriz-overscroll",
];

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
  const { cropper, time, view } = laidOut({
    image: { height: 3000, width: 4000 },
  });

  time.frame();
  const area = fakeArea();
  const stop = bindArea(cropper, area.element, { liveVariables });

  return { ...area, cropper, stop, time, view };
};

const close = (value: number, digits: number): unknown =>
  expect.closeTo(value, digits);

const read = (variables: Map<string, string>) =>
  Object.fromEntries(NAMES.map((name) => [name, Number(variables.get(name))]));

describe("area live variables", () => {
  it("writes the five variables at rest, after rotation and zoom, and at both range ends", () => {
    const { cropper, time, variables, view } = mount(true);

    expect(read(variables)).toStrictEqual({
      "--zriz-overscroll": 0,
      "--zriz-rotation": 0,
      "--zriz-rotation-progress": 0,
      "--zriz-zoom": 1,
      "--zriz-zoom-progress": 0,
    });

    cropper.setRotation(-10);
    cropper.setZoom(4);
    time.frame();
    const limit = cropper.getRotationLimit();

    expect(read(variables)).toStrictEqual({
      "--zriz-overscroll": 0,
      "--zriz-rotation": close(-10, 3),
      "--zriz-rotation-progress": close(-10 / limit, 3),
      "--zriz-zoom": close(4, 3),
      "--zriz-zoom-progress": close(
        Math.log(4) / Math.log(cropper.getMaxZoom()),
        3
      ),
    });

    cropper.setRotation(-limit);
    cropper.setZoom(cropper.getMaxZoom());
    time.frame();
    const ends = read(variables);

    expect(ends["--zriz-rotation-progress"]).toBe(-1);
    expect(ends["--zriz-zoom-progress"]).toBeCloseTo(1, 2);
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
