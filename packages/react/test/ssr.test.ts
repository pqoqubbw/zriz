import { readFileSync } from "node:fs";

import { createCropper } from "@zriz/core";
import { createElement, version } from "react";
import type { ElementType, ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { useRender } from "../src";
import * as Cropper from "../src/cropper";
import { mergeProps, preventZrizHandler } from "../src/merge-props";

describe("the package manifest", () => {
  it("peers core, so an app holds one copy shared with its own imports", () => {
    const manifest: unknown = JSON.parse(
      readFileSync(new URL("../package.json", import.meta.url), "utf-8")
    );

    expect(manifest).toMatchObject({
      devDependencies: { "@zriz/core": "workspace:^" },
      peerDependencies: { "@zriz/core": "workspace:^" },
    });

    expect(manifest).not.toHaveProperty("dependencies");
  });
});

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
        createElement(Cropper.ZoomStep, { factor: 2 }, "in"),
        createElement(Cropper.Orientation, null, "turn"),
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
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("renders the same html whatever motion the user asks for", () => {
    const tree = createElement(
      Cropper.Root,
      { src: "/photo.jpg" },
      createElement(Cropper.Viewport)
    );
    const plain = renderToString(tree);

    vi.stubGlobal("matchMedia", () => ({ matches: true }));
    const reduced = renderToString(tree);

    vi.unstubAllGlobals();
    expect(reduced).toBe(plain);
  });

  it("renders data-reduced-motion on the server for motion reduce", () => {
    expect(
      renderToString(createElement(Cropper.Root, { motion: "reduce" }))
    ).toContain("data-reduced-motion");
  });

  it("runs on the React major its project names", ({ task }) => {
    expect(version.split(".")[0]).toBe(
      task.file.projectName?.includes("react18") === true ? "18" : "19"
    );
  });
});

type Captured = Record<string, unknown>;

const isHandler = (value: unknown): value is (...args: unknown[]) => void =>
  typeof value === "function";

const fire = (handler: unknown, ...args: unknown[]): void => {
  if (!isHandler(handler)) {
    throw new Error("no handler");
  }

  handler(...args);
};

const propsOf = (
  part: ElementType,
  extra: Captured = {}
): { cropper: ReturnType<typeof createCropper>; props: Captured } => {
  const cropper = createCropper({ image: { height: 600, width: 1000 } });
  let props: Captured = {};

  renderToString(
    createElement(
      Cropper.Root,
      { cropper },
      createElement(part, {
        ...extra,
        render: (own: Captured) => {
          props = own;

          return createElement("div");
        },
      })
    )
  );

  return { cropper, props };
};

const click = (props: Captured): void => {
  fire(props.onClick, { nativeEvent: new Event("click") });
};

describe("part props", () => {
  it("runs a user handler first, and a veto skips only zriz, never the part's prop", () => {
    const allowed = propsOf(Cropper.Flip, { onClick: vi.fn<() => void>() });

    click(allowed.props);
    expect(allowed.cropper.getValue().mirrored).toBeTruthy();
    const vetoed = propsOf(Cropper.Flip, { onClick: preventZrizHandler });

    click(vetoed.props);
    expect(vetoed.cropper.getValue().mirrored).toBeFalsy();
    const calls: string[] = [];
    const part = mergeProps(
      {
        onClick: () => {
          calls.push("zriz");
        },
      },
      {
        onClick: () => {
          calls.push("prop");
        },
      }
    );
    const veto = mergeProps(part, {
      onClick: (event: object) => {
        calls.push("element");
        preventZrizHandler(event);
      },
    });

    fire(veto.onClick, {});
    expect(calls).toStrictEqual(["element", "prop"]);
    calls.length = 0;

    fire(
      mergeProps(part, {
        onClick: () => {
          calls.push("element");
        },
      }).onClick,
      {}
    );

    expect(calls).toStrictEqual(["element", "prop", "zriz"]);
  });

  it("chains only onX props with every argument, and keeps a part's handler over null", () => {
    const ours = vi.fn<() => void>();
    const theirs = vi.fn<() => void>();
    const merged = mergeProps(
      { onClick: ours, once: ours, onfocus: ours },
      { onClick: theirs, once: theirs, onfocus: theirs }
    );

    fire(merged.onClick, {});

    expect({
      clicks: [ours.mock.calls.length, theirs.mock.calls.length],
      once: merged.once,
      onfocus: merged.onfocus,
    }).toStrictEqual({ clicks: [1, 1], once: theirs, onfocus: theirs });

    const calls: unknown[][] = [];
    const values = mergeProps(
      {
        onValueChange: (...args: unknown[]) => {
          calls.push(["ours", ...args]);
        },
      },
      {
        onValueChange: (...args: unknown[]) => {
          calls.push(["theirs", ...args]);
        },
      }
    );
    const details = { reason: "keyboard" };

    fire(values.onValueChange, 0.5, details);

    expect(calls).toStrictEqual([
      ["theirs", 0.5, details],
      ["ours", 0.5, details],
    ]);

    const { cropper, props } = propsOf(Cropper.Flip, { onClick: null });

    click(props);
    expect(cropper.getValue().mirrored).toBeTruthy();
  });

  it("anchors the handles to Area in server html, with or without the stylesheet", () => {
    const html = renderToString(
      createElement(
        Cropper.Root,
        null,
        createElement(Cropper.Area, { "aria-label": "Crop" })
      )
    );

    expect(html).toMatch(
      /data-zriz-item="area"[^>]*style="position:absolute"/u
    );
  });

  it("merges style and keeps the part's own attributes under user props", () => {
    const { props } = propsOf(Cropper.Dial, {
      "aria-label": "Straighten",
      style: { color: "red" },
      tabIndex: -1,
    });

    expect(props).toMatchObject({
      "aria-label": "Straighten",
      "data-zriz-item": "dial",
      role: "slider",
      style: { color: "red", position: "relative" },
      tabIndex: -1,
    });
  });
});

describe("plugins on the server", () => {
  it("does not start a plugin during render", () => {
    const init = vi.fn<() => void>();

    renderToString(
      createElement(Cropper.Root, {
        plugins: [{ init, name: "server" }],
      })
    );

    expect(init).not.toHaveBeenCalled();
  });
});

type OwnProps = {
  option?: string;
  props: Record<string, unknown>;
};

const Own = ({ option, props }: OwnProps) =>
  useRender({ className: option, props, state: {}, tag: "span" });

describe("useRender options", () => {
  it("keeps a class given in props and joins it with the option", () => {
    expect(
      renderToString(createElement(Own, { props: { className: "a" } }))
    ).toContain('class="a"');

    expect(
      renderToString(
        createElement(Own, { option: "b", props: { className: "a" } })
      )
    ).toContain('class="a b"');
  });
});

const warned = async (
  part: string,
  format: Intl.NumberFormatOptions,
  locale?: string
): Promise<number> => {
  vi.resetModules();
  const { warnFormat } = await import("../src/warn");
  const warn = vi.spyOn(console, "warn").mockReturnValue(undefined);

  warnFormat(part, locale, format);
  const count = warn.mock.calls.length;

  warn.mockRestore();

  return count;
};

describe("format warnings", () => {
  it.each<[string, Intl.NumberFormatOptions, string | undefined, number]>([
    ["Dial", { style: "unit", unitDisplay: "short" }, undefined, 0],
    ["Dial", { minimumFractionDigits: 2 }, undefined, 0],
    ["Zoom", { minimumFractionDigits: 1 }, undefined, 0],
    ["Zoom", { style: "unit" }, undefined, 1],
    ["Dial", { style: "currency" }, undefined, 1],
    [
      "Zoom",
      { maximumFractionDigits: 1, minimumFractionDigits: 2 },
      undefined,
      1,
    ],
    ["Zoom", {}, "en_US", 1],
  ])(
    "%s with %o in %s warns %i times, only when the part's defaults fail",
    async (part, format, locale, count) => {
      await expect(warned(part, format, locale)).resolves.toBe(count);
    }
  );
});

const IMAGE = { height: 300, width: 400 };

const server = (props: Record<string, unknown>, ...parts: ReactNode[]) => {
  const html = renderToString(createElement(Cropper.Root, props, ...parts));

  return {
    disabled: html.includes('aria-disabled="true"'),
    snapped: html.includes("data-snapped"),
    values: [...html.matchAll(/aria-valuenow="(?<value>[^"]*)"/gu)].map(
      (match) => match.groups?.value
    ),
  };
};

describe("sliders on the server", () => {
  it("carry a rounded value, the zero mark and aria-disabled before hydration", () => {
    const dial = createElement(Cropper.Dial, { "aria-label": "Dial" });
    const zoom = createElement(Cropper.Zoom, { "aria-label": "Zoom" });
    const small = { rotation: 7.16, size: { height: 0.3, width: 0.3 } };

    expect([
      server({ defaultValue: { rotation: 7 }, image: IMAGE }, dial, zoom),
      server({}, dial),
      server(
        { defaultValue: small, image: IMAGE },
        dial,
        createElement(Cropper.Zoom, { "aria-label": "Zoom", max: 2 })
      ),
      server({ defaultValue: small, image: IMAGE }, zoom),
      server({ defaultValue: { rotation: 0.04 }, image: IMAGE }, dial),
      server(
        { disabled: true, image: IMAGE },
        createElement(Cropper.Area, { "aria-label": "Crop" })
      ),
    ]).toStrictEqual([
      { disabled: false, snapped: false, values: ["7", "1"] },
      { disabled: false, snapped: true, values: ["0"] },
      { disabled: false, snapped: false, values: ["7.2", "2"] },
      { disabled: false, snapped: false, values: ["2.88"] },
      { disabled: false, snapped: false, values: ["0"] },
      { disabled: true, snapped: false, values: [] },
    ]);
  });

  it("leave inner html out of DialValue", () => {
    const loose: Record<string, unknown> = {
      dangerouslySetInnerHTML: { __html: "<b>x</b>" },
    };
    const html = renderToString(
      createElement(
        Cropper.Root,
        { image: { height: 300, width: 400 } },
        createElement(Cropper.DialValue, loose)
      )
    );

    expect(html).not.toContain("<b>");
  });
});
