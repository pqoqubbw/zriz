import { describe, expect, it } from "vitest";

import {
  defaultValue,
  parse,
  serialize,
  stateToValue,
  valueToState,
} from "../src";

describe(parse, () => {
  it("returns null for garbage", () => {
    for (const input of ["", "{", "null", "3", 3, null, undefined, "[]x", "[]", "[1,2,3]", [], [1]]) {
      expect(parse(input)).toBeNull();
    }
  });

  it("takes a nested array as a missing field", () => {
    expect(parse('{"center":[],"size":[1,2]}')).toStrictEqual(defaultValue);
  });

  it("fills defaults and clamps", () => {
    expect(parse("{}")).toStrictEqual(defaultValue);
    const value = parse({
      aspect: -2,
      perspective: { vertical: 90 },
      quarterTurns: 7,
      rotation: 300,
      size: { height: -5, width: Number.NaN },
    });
    expect(value).toMatchObject({
      aspect: "free",
      perspective: { horizontal: 0, vertical: 30 },
      quarterTurns: 3,
      rotation: 45,
      size: { height: 1, width: 1 },
    });
  });

  it("turns -0 into 0", () => {
    const value = parse({ center: { x: -0, y: 0.5 }, rotation: -0 });
    expect(Object.is(value?.rotation, 0)).toBeTruthy();
    expect(Object.is(value?.center.x, 0)).toBeTruthy();
  });

  it("round-trips through serialize", () => {
    const value = {
      ...defaultValue,
      aspect: 1.5,
      mirrored: true,
      rotation: -12.25,
    };
    expect(serialize(value)).toContain('"v":1');
    expect(parse(serialize(value))).toStrictEqual(value);
  });
});

describe("value and state", () => {
  it("convert both ways for every quarter turn", () => {
    for (const quarterTurns of [0, 1, 2, 3] as const) {
      const value = {
        ...defaultValue,
        center: { x: 0.3, y: 0.7 },
        quarterTurns,
        rotation: 3,
        size: { height: 0.2, width: 0.25 },
      };
      const image = { height: 1080, width: 1920 };
      expect(
        stateToValue(valueToState(value, image), value.aspect)
      ).toStrictEqual(value);
    }
  });

  it("clamps a saved number past the range a crop can use", () => {
    const value = parse('{"center":{"x":1e308,"y":-1e308},"size":{"width":1e308,"height":1e-320}}');
    expect(value?.center).toStrictEqual({ x: 1e6, y: -1e6 });
    expect(value?.size).toStrictEqual({ height: 1e-100, width: 1e6 });
  });

  it("keeps a centre outside 0 to 1, a rotated panorama needs it", () => {
    expect(parse('{"center":{"x":0.5,"y":14.29}}')?.center.y).toBe(14.29);
  });

  it("turns an aspect out of range into free", () => {
    for (const aspect of ["1e308", "5e-324", "1e14", "1e-14", "0", "-1"]) {
      expect(parse(`{"aspect":${aspect}}`)?.aspect).toBe("free");
    }
    expect(parse('{"aspect":1e6}')?.aspect).toBe(1e6);
  });

  it("keeps a thin side above 0 in a state read back as a value", () => {
    const state = valueToState(defaultValue, { height: 1, width: 1e12 });
    const value = stateToValue(
      { ...state, crop: { ...state.crop, width: 0.2 } },
      "free"
    );
    expect(value.size.width).toBeGreaterThan(0);
  });
});
