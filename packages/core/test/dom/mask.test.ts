import { afterEach, describe, expect, it, vi } from "vitest";

type Supports = (property: string, value: string) => boolean;

const BOX = { height: 200, width: 200, x: 100, y: 50 };
const CIRCLE =
  "shape(evenodd from 0 0, hline to 100%, vline to 100%, hline to 0, close, move to 200px 50px, arc by 0 200px of 100px 100px, arc by 0 -200px of 100px 100px, close)";
const GRADIENT =
  "radial-gradient(100px 100px at 200px 150px, transparent calc(100% - 0.25px), #000 calc(100% + 0.25px))";

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

const load = async (supports?: Supports) => {
  vi.resetModules();

  if (supports) {
    vi.stubGlobal("CSS", { supports });
  }

  const { createCropper } = await import("../../src");
  const { bindMask, maskClip, maskGradient, viewOf } =
    await import("../../src/dom");
  const cropper = createCropper({
    defaultValue: { aspect: 1 },
    image: { height: 300, width: 400 },
  });

  viewOf(cropper).setLayout({
    dpr: 2,
    height: 300,
    inset: { bottom: 0, left: 0, right: 0, top: 0 },
    width: 400,
  });

  return { bindMask, cropper, maskClip, maskGradient };
};

describe("round mask", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("cuts an even-odd hole with two half-circle arcs", async () => {
    const { maskClip } = await load();

    expect(maskClip(BOX, "circle")).toBe(CIRCLE);
  });

  it("ramps the fallback edge over one device pixel", async () => {
    const { maskGradient } = await load();

    expect(maskGradient(BOX, 2)).toBe(GRADIENT);
  });

  it("clips with shape() where the probe passes", async () => {
    const { bindMask, cropper } = await load(() => true);
    const { element, style, written } = fakeElement();
    const unbind = bindMask(cropper, element, "circle");

    expect(style.clipPath.startsWith("shape(evenodd from 0 0,")).toBeTruthy();
    expect(written.has("mask-image")).toBeFalsy();
    unbind();
  });

  it("falls back to a gradient mask where the probe fails", async () => {
    const { bindMask, cropper } = await load(() => false);
    const { element, style, written } = fakeElement();
    const unbind = bindMask(cropper, element, "circle");

    expect(style.clipPath).toBe("");

    expect(
      written.get("mask-image")?.startsWith("radial-gradient(")
    ).toBeTruthy();

    expect(written.get("-webkit-mask-image")).toBe(written.get("mask-image"));
    unbind();
    expect(written.size).toBe(0);
  });

  it("falls back when there is no CSS global", async () => {
    const { bindMask, cropper } = await load();
    const { element, style, written } = fakeElement();
    const unbind = bindMask(cropper, element, "circle");

    expect(style.clipPath).toBe("");
    expect(written.has("mask-image")).toBeTruthy();
    unbind();
  });

  it("probes a literal shape() once and never for a rect", async () => {
    const supports = vi.fn<Supports>(() => true);
    const { bindMask, cropper } = await load(supports);

    bindMask(cropper, fakeElement().element, "rect")();
    expect(supports).not.toHaveBeenCalled();
    bindMask(cropper, fakeElement().element, "circle")();
    bindMask(cropper, fakeElement().element, "circle")();
    expect(supports).toHaveBeenCalledOnce();
    expect(supports.mock.lastCall?.[0]).toBe("clip-path");
    expect(supports.mock.lastCall?.[1]).toContain("arc by");
    expect(supports.mock.lastCall?.[1]).not.toContain("var(");
  });
});
