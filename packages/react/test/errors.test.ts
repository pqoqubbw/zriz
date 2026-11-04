import { createCropper } from "@zriz/core";
import type { Cropper as CropperInstance } from "@zriz/core";
import { createElement, useState } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";

import * as Cropper from "../src/cropper";
import { useCropper, useCropperValue } from "../src/use-cropper";
import { useZoom } from "../src/use-zoom";

const OUTSIDE_ROOT = "zriz: pass a cropper or render inside <Cropper.Root>";

type HookProbeProps = { hook: () => unknown };

const HookProbe = ({ hook }: HookProbeProps) => {
  hook();

  return null;
};

const LostCropper = () => {
  const [cropper, setCropper] = useState<CropperInstance | undefined>(
    createCropper
  );

  if (cropper) {
    setCropper(undefined);
  }

  useCropper({ cropper });

  return null;
};

describe("thrown errors", () => {
  it("names a part outside Root", () => {
    expect(() => renderToString(createElement(Cropper.Viewport))).toThrow(
      new Error("zriz: parts must be inside <Cropper.Root>")
    );
  });

  it.each([
    ["useCropperValue", useCropperValue],
    ["useZoom", useZoom],
  ])("names %s outside Root", (_name, hook) => {
    expect(() =>
      renderToString(createElement(HookProbe, { hook: () => hook() }))
    ).toThrow(new Error(OUTSIDE_ROOT));
  });

  it("names a useCropper that had a cropper and lost it", () => {
    expect(() => renderToString(createElement(LostCropper))).toThrow(
      new Error("zriz: no cropper")
    );
  });
});
