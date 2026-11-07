import { afterEach, describe, expect, it, vi } from "vitest";

import type { Clock } from "../../src";
import { LAYOUT } from "../cropper-fixture";
import { fakeClock } from "../fake-clock";

type Supports = (property: string, value: string) => boolean;

const isElement = (_value: object): _value is HTMLElement => true;

const fakeElement = () => {
  const written = new Map<string, string>();
  const style = {
    clipPath: "",
    removeProperty(name: string): void {
      written.delete(name);
    },
    setProperty(name: string, value: string): void {
      written.set(name, value);
    },
  };
  const element = { style, toggleAttribute: () => false };

  if (!isElement(element)) {
    throw new Error("unreachable");
  }

  return { element, style, written };
};

const load = async (supports: Supports, clock?: Clock) => {
  vi.resetModules();
  vi.stubGlobal("CSS", { supports });

  const { createCropper } = await import("../../src");
  const { bindMask, setCropShape, viewOf } = await import("../../src/dom");
  const cropper = createCropper({
    clock,
    defaultValue: { aspect: 1 },
    image: { height: 300, width: 400 },
  });

  viewOf(cropper).setLayout({ ...LAYOUT, dpr: 2 });

  return { bindMask, cropper, setCropShape };
};

describe("round mask", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [true, ["shape", undefined]],
    [false, ["", "radial-gradient"]],
  ])(
    "picks clip-path or the gradient fallback when the probe gives %s, and clears it on unbind",
    async (passes, picked) => {
      const supports = vi.fn<Supports>(() => passes);
      const { bindMask, cropper } = await load(supports);
      const { element, style, written } = fakeElement();
      const unbind = bindMask(cropper, element, "circle");

      expect(supports.mock.lastCall?.slice(0, 1)).toStrictEqual(["clip-path"]);
      expect(supports.mock.lastCall?.[1]).not.toContain("var(");

      expect([
        style.clipPath.split("(")[0],
        written.get("mask-image")?.split("(")[0],
      ]).toStrictEqual(picked);

      expect(written.get("-webkit-mask-image")).toBe(written.get("mask-image"));
      unbind();
      expect(written.size).toBe(0);
    }
  );

  it("keeps the gradient fallback in step with a live bind as the photo leaves and the shape changes", async () => {
    const time = fakeClock();
    const { bindMask, cropper, setCropShape } = await load(
      () => false,
      time.clock
    );
    const { element, style, written } = fakeElement();
    const unbind = bindMask(cropper, element, "circle");

    time.frames(2);
    const drawn = written.get("mask-image");

    cropper.setImage(null);
    time.frames(2);
    const cleared = [...written.keys()];

    cropper.setImage({ height: 300, width: 400 });
    time.frames(2);

    expect({
      cleared,
      drawn: drawn?.includes("radial-gradient"),
      redrawn: written.get("mask-image")?.includes("radial-gradient"),
    }).toStrictEqual({ cleared: [], drawn: true, redrawn: true });

    unbind();
    setCropShape(cropper, "rect");
    const off = bindMask(cropper, element);

    time.frames(2);
    expect(style.clipPath).not.toBe("");
    setCropShape(cropper, "circle");
    cropper.invalidate();
    time.frames(2);

    expect([
      written.get("mask-image")?.includes("radial-gradient"),
      style.clipPath,
    ]).toStrictEqual([true, ""]);

    setCropShape(cropper, "rect");
    cropper.invalidate();
    time.frames(2);

    expect([written.has("mask-image"), style.clipPath === ""]).toStrictEqual([
      false,
      false,
    ]);

    off();
  });
});
