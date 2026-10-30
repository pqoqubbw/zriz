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
    for (const input of ["", "{", "null", "3", 3, null, undefined, "[]x"]) {
      expect(parse(input)).toBeNull();
    }
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
});
