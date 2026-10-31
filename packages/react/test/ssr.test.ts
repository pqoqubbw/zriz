import { createElement, version } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import * as Cropper from "../src/cropper";

describe("server rendering", () => {
  it("renders every part without window", () => {
    expect("window" in globalThis).toBeFalsy();
    const errors = vi.spyOn(console, "error");
    const html = renderToString(
      createElement(
        Cropper.Root,
        { shape: "circle", src: "/photo.jpg" },
        createElement(
          Cropper.Viewport,
          null,
          createElement(Cropper.Image, { alt: "" }),
          createElement(Cropper.Mask),
          createElement(
            Cropper.Area,
            { "aria-label": "Crop" },
            createElement(Cropper.Grid),
            createElement(Cropper.Handle, { position: "top-left" })
          )
        ),
        createElement(
          Cropper.Dial,
          { "aria-label": "Straighten" },
          createElement(Cropper.DialTicks),
          createElement(Cropper.DialValue)
        ),
        createElement(
          Cropper.Zoom,
          { "aria-label": "Zoom" },
          createElement(Cropper.ZoomThumb)
        ),
        createElement(Cropper.Rotate, null, "rotate"),
        createElement(Cropper.Flip, null, "flip"),
        createElement(Cropper.Reset, null, "reset"),
        createElement(
          Cropper.AspectGroup,
          null,
          createElement(Cropper.AspectItem, { value: 1 }, "square")
        ),
        createElement(Cropper.Instructions, null, "drag to move"),
        createElement(Cropper.Announcer, { announce: () => null })
      )
    );
    expect(html).toContain('data-zriz-item="root"');
    expect(html).toContain('data-zriz-item="dial-ticks"');
    expect(html.match(/<span/gu)?.length).toBeGreaterThan(41);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("runs on the React major its project names", ({ task }) => {
    expect(version.split(".")[0]).toBe(
      task.file.projectName?.includes("react18") === true ? "18" : "19"
    );
  });
});
