import { describe, expect, it } from "vitest";

import { viewOf } from "../../src/dom/view";
import type { Flight, ViewFrame } from "../../src/dom/view";
import { multiplyMatrix3 } from "../../src/geometry/matrix";
import type { Matrix3 } from "../../src/geometry/types";
import { setup } from "../cropper-fixture";

const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const TOLERANCE = 1e-6;

const factor = (name: string | undefined, v: number[]): Matrix3 => {
  if (name === "translate") {
    return [1, 0, v[0] ?? 0, 0, 1, v[1] ?? 0, 0, 0, 1];
  }

  if (name === "scale") {
    return [v[0] ?? 1, 0, 0, 0, v[1] ?? 1, 0, 0, 0, 1];
  }

  if (name === "rotate") {
    const cos = Math.cos(v[0] ?? 0);
    const sin = Math.sin(v[0] ?? 0);

    return [cos, -sin, 0, sin, cos, 0, 0, 0, 1];
  }

  if (name === "matrix") {
    return [
      v[0] ?? 0,
      v[2] ?? 0,
      v[4] ?? 0,
      v[1] ?? 0,
      v[3] ?? 0,
      v[5] ?? 0,
      0,
      0,
      1,
    ];
  }

  throw new Error(`unknown ${name}`);
};

const parse = (css: string): Matrix3 => {
  let matrix = IDENTITY;

  for (const { groups } of css.matchAll(/(?<name>\w+)\((?<raw>[^)]*)\)/gu)) {
    const values = (groups?.raw ?? "")
      .split(",")
      .map((part) => Number(part.replace(/[a-z]+$/u, "")));

    matrix = multiplyMatrix3(matrix, factor(groups?.name, values));
  }

  return matrix;
};

const gap = (css: string | undefined, to: Matrix3 | undefined): number => {
  const from = parse(css ?? "");

  return Math.max(
    ...from.map((value, index) => Math.abs(value - (to?.[index] ?? Number.NaN)))
  );
};

const rig = (motion: "always" | "reduce" = "always") => {
  const { cropper, time } = setup({ image: { height: 1200, width: 1600 } });
  const view = viewOf(cropper);
  const flights: Flight[] = [];
  const stops: number[] = [];
  const frames: ViewFrame[] = [];

  view.setLayout({
    dpr: 2,
    height: 480,
    inset: { bottom: 0, left: 0, right: 0, top: 0 },
    width: 640,
  });

  view.setOptions({ motion });
  time.frame();

  view.onFrame((frame) => {
    frames.push(frame);
  });

  view.onFlight((flight) => {
    const id = flights.push(flight) - 1;

    stops[id] = 0;

    return {
      elapsed: () => null,
      stop: () => {
        stops[id] = (stops[id] ?? 0) + 1;
      },
    };
  });

  const follow = (): { compared: number; end: number; worst: number } => {
    time.frame(0);
    const [flight] = flights;
    const keyframes = flight?.frames ?? [];
    const count = keyframes.length - 1;
    let worst = 0;
    let compared = 0;

    for (let index = 0; index < count; index += 1) {
      if (view.chrome().transition) {
        compared += 1;
        worst = Math.max(worst, gap(keyframes[index], frames.at(-1)?.matrix));
      }

      time.frame((flight?.duration ?? 0) / count);
    }

    time.frames(5);

    return {
      compared,
      end: gap(keyframes.at(-1), view.frame()?.matrix),
      worst,
    };
  };

  const tilt = (): void => {
    cropper.setValue({
      center: { x: 0.3, y: 0.6 },
      rotation: 12,
      size: { height: 0.3, width: 0.4 },
    });

    time.frames(3);
  };

  return { cropper, flights, follow, stops, tilt, time, view };
};

describe("flights", () => {
  it("samples a rotate into keyframes that match the model at every step", () => {
    const { cropper, follow, tilt } = rig();

    tilt();
    cropper.rotate90("ccw");
    const { compared, end, worst } = follow();

    expect(compared).toBeGreaterThan(2);
    expect(worst).toBeLessThan(TOLERANCE);
    expect(end).toBeLessThan(TOLERANCE);
  });

  it("samples a flip into keyframes that match the model at every step", () => {
    const { cropper, follow, tilt } = rig();

    tilt();
    cropper.flip();
    const { compared, end, worst } = follow();

    expect(compared).toBeGreaterThan(2);
    expect(worst).toBeLessThan(TOLERANCE);
    expect(end).toBeLessThan(TOLERANCE);
  });

  it("lands a flip on the final frame when the crop is pinned off-centre along the mirror axis", () => {
    const { cropper, follow, time, view } = rig();

    cropper.begin("resize", undefined, "handle");
    view.hold();

    cropper.setValue({
      center: { x: 0.5, y: 0.7 },
      size: { height: 0.6, width: 1 },
    });

    time.frames(2);
    view.release();
    cropper.end(undefined, "handle");
    time.frames(2);
    cropper.flip();

    expect(follow().end).toBeLessThan(TOLERANCE);
  });

  it("stops every flight exactly once across interrupted and queued transitions", () => {
    const { cropper, flights, stops, time, view } = rig();

    cropper.rotate90("cw");
    time.frames(5);
    cropper.rotate90("cw");
    time.frames(5);
    cropper.flip();
    time.frames(5);
    cropper.rotate90("cw");
    time.frames(200);

    expect(flights.length).toBeGreaterThan(2);
    expect(stops).toStrictEqual(flights.map(() => 1));
    expect(view.chrome().transition).toBeNull();
  });

  it("keeps the flight running when the frame is read between the click and the next tick", () => {
    const { cropper, flights, stops, time, view } = rig();

    cropper.rotate90("cw");
    time.frames(3);
    cropper.rotate90("cw");
    view.frame();
    expect(stops).toStrictEqual([0]);
    time.frame(0);

    expect(flights).toHaveLength(2);
    expect(stops).toStrictEqual([1, 0]);
  });

  it("still flies under reduced motion and lands on the final frame", () => {
    const { cropper, flights, follow } = rig("reduce");

    cropper.rotate90("cw");
    const { end } = follow();

    expect(flights).toHaveLength(1);
    expect(end).toBeLessThan(TOLERANCE);
  });
});
