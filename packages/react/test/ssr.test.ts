import { createCropper } from "@zriz/core";
import { createElement, version } from "react";
import type { ElementType } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { useRender, useZoom } from "../src";
import * as Cropper from "../src/cropper";
import { mergeProps, preventZrizHandler } from "../src/merge-props";

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

type Captured = Record<string, unknown>;

const isHandler = (value: unknown): value is (event: unknown) => void =>
  typeof value === "function";

const fire = (handler: unknown, event: unknown): void => {
  if (!isHandler(handler)) {
    throw new Error("no handler");
  }
  handler(event);
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

const handlerNames = (part: ElementType, extra?: Captured): string[] =>
  Object.keys(propsOf(part, extra).props)
    .filter((key) => /^on[A-Z]/u.test(key))
    .toSorted();

const Lost = (): null => {
  useZoom();
  return null;
};

describe("part props", () => {
  it("gives each part its pointer and key handlers", () => {
    const pointer = [
      "onLostPointerCapture",
      "onPointerCancel",
      "onPointerDown",
      "onPointerMove",
      "onPointerUp",
    ];
    const keys = ["onBlur", "onKeyDown", "onKeyUp"];
    expect(handlerNames(Cropper.Viewport)).toStrictEqual(pointer);
    expect(
      handlerNames(Cropper.Handle, { position: "top-left" })
    ).toStrictEqual([...pointer, "onPointerDownCapture"].toSorted());
    expect(handlerNames(Cropper.Area)).toStrictEqual(keys);
    const both = [...keys, ...pointer].toSorted();
    expect(handlerNames(Cropper.Dial)).toStrictEqual(both);
    expect(handlerNames(Cropper.Zoom)).toStrictEqual(both);
  });

  it("forwards native events from the handlers it wraps", () => {
    const { cropper, props } = propsOf(Cropper.Dial);
    const nativeEvent = {
      key: "ArrowRight",
      preventDefault: vi.fn<() => void>(),
      shiftKey: false,
    };
    fire(props.onKeyDown, { nativeEvent });
    expect(cropper.getValue().rotation).toBe(1);
    expect(nativeEvent.preventDefault).toHaveBeenCalledOnce();
  });

  it("runs a user handler first and lets it veto the part's own", () => {
    const allowed = propsOf(Cropper.Flip, { onClick: vi.fn<() => void>() });
    click(allowed.props);
    expect(allowed.cropper.getValue().mirrored).toBeTruthy();
    const vetoed = propsOf(Cropper.Flip, { onClick: preventZrizHandler });
    click(vetoed.props);
    expect(vetoed.cropper.getValue().mirrored).toBeFalsy();
  });

  it("chains only onX props, other functions and lookalikes take the user's value", () => {
    const ours = vi.fn<() => void>();
    const theirs = vi.fn<() => void>();
    const merged = mergeProps(
      { onClick: ours, once: ours, onfocus: ours },
      { onClick: theirs, once: theirs, onfocus: theirs }
    );
    expect(merged.once).toBe(theirs);
    expect(merged.onfocus).toBe(theirs);
    fire(merged.onClick, {});
    expect(theirs).toHaveBeenCalledOnce();
    expect(ours).toHaveBeenCalledOnce();
  });

  it("calls both handlers with every argument when the first is not an object", () => {
    const calls: unknown[][] = [];
    const merged = mergeProps(
      {
        onValueChange: (...args: unknown[]) => {
          calls.push(["ours", ...args]);
        },
      },
      {
        onValueChange: (...args: unknown[]) => {
          preventZrizHandler(args[0] as object);
          calls.push(["theirs", ...args]);
        },
      }
    );
    (merged.onValueChange as (...args: unknown[]) => void)(0.5, "drag");
    expect(calls).toStrictEqual([
      ["theirs", 0.5, "drag"],
      ["ours", 0.5, "drag"],
    ]);
  });

  it("skips only zriz when a render element vetoes, never the part's prop", () => {
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

  it("keeps a part's handler when the user passes null", () => {
    const { cropper, props } = propsOf(Cropper.Flip, { onClick: null });
    click(props);
    expect(cropper.getValue().mirrored).toBeTruthy();
  });

  it("resolves a className function against the part state", () => {
    const { props } = propsOf(Cropper.Flip, {
      className: (state: { mirrored: boolean }) => `mirrored-${state.mirrored}`,
    });
    expect(props.className).toBe("mirrored-false");
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

  it("merges a render element's props and the part's class", () => {
    const html = renderToString(
      createElement(
        Cropper.Root,
        { shape: "rect" },
        createElement(Cropper.Rotate, {
          className: "ours",
          render: createElement("a", { className: "mine", href: "#x" }),
        })
      )
    );
    expect(html).toMatch(/<a[^>]*data-zriz-item="rotate"/u);
    expect(html).toMatch(/class="ours mine"/u);
  });

  it("names the fix when a zoom hook has no cropper", () => {
    expect(() => renderToString(createElement(Lost))).toThrow(
      "zriz: pass a cropper or render inside <Cropper.Root>"
    );
  });
});

describe("useRender", () => {
  const Own = ({
    option,
    props,
  }: {
    option?: string;
    props: Record<string, unknown>;
  }) => useRender({ className: option, props, state: {}, tag: "span" });

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

  it("gives no key to a render element without one", () => {
    let key: string | null = "unset";
    const Probe = () => {
      const element = useRender({
        props: {},
        render: createElement("a"),
        state: {},
        tag: "span",
      });
      ({ key } = element);
      return element;
    };
    renderToString(createElement(Probe));
    expect(key).toBeNull();
  });
});
