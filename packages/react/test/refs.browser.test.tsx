import type { Cropper as CropperApi } from "@zriz/core";
import {
  StrictMode,
  createRef,
  forwardRef,
  useCallback,
  useState,
  version,
} from "react";
import type { Ref } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import { useRender } from "../src";
import type { AreaProps } from "../src";
import * as Cropper from "../src/cropper";
import { mergeRefs } from "../src/merge-props";
import { useMergedRef } from "../src/part";

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const log: string[] = [];

const count = (entry: string): number =>
  log.filter((item) => item === entry).length;

const theirs = (node: HTMLDivElement | null): void => {
  log.push(node ? "theirs+" : "theirs-");
};

type ProbeProps = {
  tag: string;
  held?: Ref<HTMLDivElement>;
};

const Probe = ({ tag, held = theirs }: ProbeProps) => {
  const own = useCallback(
    (node: HTMLDivElement) => {
      log.push(`bind ${tag} ${node.tagName}`);

      return () => {
        log.push(`unbind ${tag}`);
      };
    },
    [tag]
  );

  return <div ref={useMergedRef(own, held)} />;
};

const userRef = (node: HTMLElement | null) => {
  log.push(node ? "attach" : "null");

  return () => {
    log.push("cleanup");
  };
};

type OwnPartProps = { own: object };

const OwnPart = ({ own }: OwnPartProps) =>
  useRender({ props: own, state: {}, tag: "span" });

const isCallback = (
  value: unknown
): value is (node: HTMLDivElement | null) => void =>
  typeof value === "function";

const pointer = (selector: string, type: string): void => {
  document.querySelector(selector)?.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    })
  );
};

type ShellProps = {
  api: Ref<CropperApi>;
  children: React.ReactNode;
};

const Shell = ({ api, children }: ShellProps) => (
  <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
    <Cropper.Viewport style={{ height: 300, position: "relative", width: 400 }}>
      {children}
    </Cropper.Viewport>
  </Cropper.Root>
);

describe("refs on React 18 and 19", () => {
  afterEach(async () => {
    log.length = 0;
    await cleanup();
  });

  it("runs on the React major its project names", ({ task }) => {
    expect(version.split(".")[0]).toBe(
      task.file.projectName?.includes("react18") === true ? "18" : "19"
    );
  });

  it("binds once, rebinds on a new ref callback and unbinds on unmount", async () => {
    const screen = await render(<Probe tag="a" />);

    expect(log).toStrictEqual(["bind a DIV", "theirs+"]);
    log.length = 0;
    await screen.rerender(<Probe tag="b" />);
    expect(log).toStrictEqual(["theirs-", "unbind a", "bind b DIV", "theirs+"]);
    log.length = 0;
    await screen.unmount();
    expect(log).toStrictEqual(["theirs-", "unbind b"]);
  });

  it("stops updating a part after it unmounts", async () => {
    const api = createRef<CropperApi>();

    const Toggle = () => {
      const [shown, setShown] = useState(true);

      return (
        <Shell api={api}>
          {shown ? <Cropper.Zoom aria-label="Zoom" /> : null}
          <button
            aria-label="hide"
            id="hide"
            onClick={() => {
              setShown(false);
            }}
            type="button"
          />
        </Shell>
      );
    };

    const screen = await render(<Toggle />);
    const zoom = screen.container.querySelector('[data-zriz-item="zoom"]');

    api.current?.setZoom(1.5);
    await frames(2);
    expect(zoom?.getAttribute("aria-valuenow")).toBe("1.5");
    screen.container.querySelector<HTMLButtonElement>("#hide")?.click();
    await frames(2);
    expect(zoom?.isConnected).toBeFalsy();
    api.current?.setZoom(2);
    await frames(2);
    expect(zoom?.getAttribute("aria-valuenow")).toBe("1.5");
  });

  it("rebinds a part on new options and moves a changed ref over once", async () => {
    const api = createRef<CropperApi>();
    const first = createRef<HTMLDivElement>();
    const second = createRef<HTMLDivElement>();
    const screen = await render(
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" max={4} ref={first} />
      </Shell>
    );
    const zoom = screen.container.querySelector('[data-zriz-item="zoom"]');
    const read = () => ({
      first: first.current,
      max: zoom?.getAttribute("aria-valuemax"),
      second: second.current === zoom,
    });

    expect(read()).toStrictEqual({ first: zoom, max: "4", second: false });

    await screen.rerender(
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" max={4} ref={second} />
      </Shell>
    );

    expect(read()).toStrictEqual({ first: null, max: "4", second: true });

    await screen.rerender(
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" max={8} ref={second} />
      </Shell>
    );

    expect(read()).toStrictEqual({ first: null, max: "8", second: true });
    api.current?.setZoom(2);
    await frames(2);
    expect(read().max).toBe("8");

    const entry = (name: string) => (node: HTMLDivElement | null) => {
      log.push(`${name}${node ? "+" : "-"}`);
    };

    const a = entry("a");
    const b = entry("b");

    await screen.rerender(
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" format={{}} ref={a} />
      </Shell>
    );

    await frames(1);
    log.length = 0;

    await screen.rerender(
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" format={{}} ref={b} />
      </Shell>
    );

    const swapped = [...log];

    await screen.unmount();

    expect({ swapped, unmounted: log }).toStrictEqual({
      swapped: ["a-", "b+"],
      unmounted: ["a-", "b+", "b-"],
    });
  });

  it("runs a user ref's cleanup once on unmount", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Shell api={api}>
        <Cropper.Area aria-label="Crop" ref={userRef} />
      </Shell>
    );

    await frames(2);
    expect(log).toStrictEqual(["attach"]);
    await screen.unmount();
    expect(log).toStrictEqual(["attach", "cleanup"]);
  });

  it("sets and clears the ref on a render element", async () => {
    const api = createRef<CropperApi>();
    const mine = createRef<HTMLDivElement>();
    const screen = await render(
      <Shell api={api}>
        <Cropper.Area aria-label="Crop" render={<div ref={mine} />} />
      </Shell>
    );

    await frames(2);
    const area = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="area"]'
    );

    expect(mine.current).toBe(area);
    expect(area?.style.width).toBe("400px");
    await screen.unmount();
    expect(mine.current).toBeNull();
  });

  it("logs no console error in development", async () => {
    const errors = vi.spyOn(console, "error");
    const api = createRef<CropperApi>();
    const area = createRef<HTMLDivElement>();
    const rotate = createRef<HTMLButtonElement>();
    const flip = createRef<HTMLButtonElement>();
    const plain = createRef<HTMLDivElement>();
    const screen = await render(
      <Shell api={api}>
        <div ref={mergeRefs(plain)} />
        <Cropper.Image alt="" />
        <Cropper.Mask />
        <Cropper.Area aria-label="Crop" ref={area} render={<section />}>
          <Cropper.Grid />
          <Cropper.Handle position="top-left" />
        </Cropper.Area>
        <Cropper.Dial aria-label="Straighten">
          <Cropper.DialTicks />
          <Cropper.DialValue />
        </Cropper.Dial>
        <Cropper.Zoom aria-label="Zoom">
          <Cropper.ZoomThumb />
        </Cropper.Zoom>
        <Cropper.ZoomStep factor={2}>in</Cropper.ZoomStep>
        <Cropper.Rotate ref={rotate}>rotate</Cropper.Rotate>
        <Cropper.Flip
          render={<button aria-label="flip" ref={flip} type="button" />}
        >
          flip
        </Cropper.Flip>
        <Cropper.Reset ref={userRef}>reset</Cropper.Reset>
        <Cropper.Orientation>turn</Cropper.Orientation>
        <Cropper.AspectGroup aria-label="Aspect">
          <Cropper.AspectItem value={1}>square</Cropper.AspectItem>
        </Cropper.AspectGroup>
        <Cropper.Instructions>drag to move</Cropper.Instructions>
        <Cropper.Announcer announce={() => null} />
      </Shell>
    );

    await frames(2);
    expect(area.current?.tagName).toBe("SECTION");

    expect(
      [rotate, flip, plain].map((held) => held.current?.tagName)
    ).toStrictEqual(["BUTTON", "BUTTON", "DIV"]);

    rotate.current?.click();
    await frames(2);
    await screen.unmount();
    expect(count("attach")).toBe(count("cleanup"));
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("detaches every ref a merged ref holds, also from a fresh mergeRefs in a wrapper", async () => {
    const object = createRef<HTMLDivElement>();
    const node = document.createElement("div");
    const merged = mergeRefs(object, userRef);

    merged(node);
    const attached = object.current;

    merged(null);

    expect({ attached, detached: object.current, log }).toStrictEqual({
      attached: node,
      detached: null,
      log: ["attach", "cleanup"],
    });

    log.length = 0;

    const api = createRef<CropperApi>();
    const held = createRef<HTMLDivElement>();
    const OwnArea = forwardRef<HTMLDivElement, AreaProps>(
      function OwnArea(props, ref) {
        return (
          <Cropper.Area
            {...props}
            ref={(element) => mergeRefs(held, ref)(element)}
          />
        );
      }
    );
    const screen = await render(
      <Shell api={api}>
        <OwnArea aria-label="Crop" ref={userRef} />
      </Shell>
    );

    await frames(2);
    expect(held.current?.dataset.zrizItem).toBe("area");
    await screen.unmount();

    expect({
      attaches: count("attach"),
      held: held.current,
      last: log.at(-1),
    }).toStrictEqual({
      attaches: 1,
      held: null,
      last: log.at(-1)?.match(/^(?:cleanup|null)$/u)?.[0],
    });
  });

  it("attaches a ref given in useRender props", async () => {
    const mine = createRef<HTMLSpanElement>();

    await render(<OwnPart own={{ ref: mine }} />);
    expect(mine.current?.tagName).toBe("SPAN");
  });

  it.each(["element", "function"] as const)(
    "keeps a drag going when a render %s makes a new ref",
    async (kind) => {
      const api = createRef<CropperApi>();

      type HostProps = { tick: number };

      const Host = ({ tick }: HostProps) => (
        <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
          <Cropper.Viewport
            id="view"
            render={
              kind === "element" ? (
                <div
                  data-tick={tick}
                  ref={() => {
                    log.push("inline");
                  }}
                />
              ) : (
                (own) => (
                  <div
                    {...own}
                    data-tick={tick}
                    ref={mergeRefs(isCallback(own.ref) ? own.ref : undefined)}
                  />
                )
              )
            }
            style={{ height: 300, position: "relative", width: 400 }}
          />
        </Cropper.Root>
      );
      const screen = await render(<Host tick={0} />);

      await frames(2);
      pointer("#view", "pointerdown");
      expect(api.current?.getState().interacting).toBe("pan");
      await screen.rerender(<Host tick={1} />);
      expect(api.current?.getState().interacting).toBe("pan");
      pointer("#view", "pointerup");
    }
  );

  it("hands a render function or a className function the part's props and state", async () => {
    const api = createRef<CropperApi>();
    const mine = createRef<HTMLButtonElement>();
    const screen = await render(
      <Shell api={api}>
        <Cropper.Flip
          className={(state) => (state.mirrored ? "on" : "off")}
          ref={mine}
          render={(props, state) => (
            <button
              {...props}
              title={state.mirrored ? "mirrored" : "plain"}
              type="button"
            />
          )}
        />
        <Cropper.Grid
          className={(state) => `grid-${state.grid}`}
          render={<section />}
        />
      </Shell>
    );
    const flip = screen.container.querySelector<HTMLButtonElement>(
      '[data-zriz-item="flip"]'
    );
    const grid = screen.container.querySelector('[data-zriz-item="grid"]');
    const read = () => ({
      className: flip?.className,
      title: flip?.title,
    });

    expect([grid?.tagName, grid?.className]).toStrictEqual([
      "SECTION",
      "grid-none",
    ]);

    expect(mine.current).toBe(flip);
    expect(read()).toStrictEqual({ className: "off", title: "plain" });
    flip?.click();
    await frames(2);
    expect(read()).toStrictEqual({ className: "on", title: "mirrored" });
  });

  it("runs the user's handlers first, then zriz's", async () => {
    const api = createRef<CropperApi>();
    const calls: string[] = [];

    const note = (who: string) => () => {
      calls.push(`${who} ${String(api.current?.getValue().mirrored)}`);
    };

    const screen = await render(
      <Shell api={api}>
        <Cropper.Flip
          onClick={note("part")}
          render={
            <button aria-label="Flip" onClick={note("element")} type="button" />
          }
        />
      </Shell>
    );
    const flip = screen.container.querySelector<HTMLButtonElement>(
      '[data-zriz-item="flip"]'
    );

    flip?.click();
    await frames(2);
    expect(calls).toStrictEqual(["element false", "part false"]);
    expect(api.current?.getValue().mirrored).toBeTruthy();
  });

  it("joins className with the class on a render element", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Shell api={api}>
        <Cropper.Grid
          className="a"
          render={<section className="b" title="mine" />}
        />
      </Shell>
    );
    const grid = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="grid"]'
    );

    expect(grid?.tagName).toBe("SECTION");
    expect(grid?.title).toBe("mine");
    expect(grid?.className).toBe("a b");

    await screen.rerender(
      <Shell api={api}>
        <Cropper.Grid render={<section className="b" />} />
      </Shell>
    );

    expect(grid?.className).toBe("b");
  });

  it("leaves no binding or ref behind in StrictMode", async () => {
    const api = createRef<CropperApi>();
    const object = createRef<HTMLDivElement>();
    const screen = await render(
      <StrictMode>
        <Probe tag="s" />
        <Shell api={api}>
          <Cropper.Area aria-label="Crop" ref={object} />
          <Cropper.Zoom aria-label="Zoom" ref={userRef} />
        </Shell>
      </StrictMode>
    );

    await frames(2);
    expect(object.current?.dataset.zrizItem).toBe("area");
    await screen.unmount();
    expect(object.current).toBeNull();
    expect(count("bind s DIV")).toBe(count("unbind s"));
    expect(count("theirs+")).toBe(count("theirs-"));
    expect(count("attach")).toBe(count("cleanup"));
  });
});

type FormatHostProps = {
  digits: number;
  dial: () => void;
  zoom: () => void;
};

const FormatHost = ({ digits, dial, zoom }: FormatHostProps) => (
  <Cropper.Root image={{ height: 300, width: 400 }}>
    <Cropper.Dial
      aria-label="Dial"
      format={{ maximumFractionDigits: digits }}
      ref={dial}
    />
    <Cropper.Zoom
      aria-label="Zoom"
      format={{ maximumFractionDigits: digits }}
      ref={zoom}
    />
  </Cropper.Root>
);

type SpokenHostProps = { kind: "percent" | "decimal" };

const SpokenHost = ({ kind }: SpokenHostProps) => (
  <Cropper.Root image={{ height: 300, width: 400 }}>
    <Cropper.Zoom aria-label="Zoom" format={{ style: kind }} />
  </Cropper.Root>
);

type UnitHostProps = { unit: string };

const UnitHost = ({ unit }: UnitHostProps) => (
  <Cropper.Root image={{ height: 300, width: 400 }}>
    <Cropper.DialValue format={(angle) => `${angle}${unit}`} />
  </Cropper.Root>
);

type ChildHostProps = { on: boolean };

const ChildHost = ({ on }: ChildHostProps) => {
  const loose: Record<string, unknown> = { children: on ? <b>x</b> : null };

  return (
    <Cropper.Root image={{ height: 300, width: 400 }}>
      <Cropper.DialValue {...loose} />
    </Cropper.Root>
  );
};

type MaskHostProps = { shape: "rect" | "circle" };

const MaskHost = ({ shape }: MaskHostProps) => (
  <Cropper.Root image={{ height: 300, width: 400 }} shape={shape}>
    <Cropper.Viewport style={{ height: 300, position: "relative", width: 400 }}>
      <Cropper.Mask />
    </Cropper.Viewport>
  </Cropper.Root>
);

type LiveHostProps = { live: boolean };

const LiveHost = ({ live }: LiveHostProps) => (
  <Cropper.Root image={{ height: 300, width: 400 }}>
    <Cropper.Viewport style={{ height: 300, position: "relative", width: 400 }}>
      <Cropper.Area aria-label="Crop" liveVariables={live} />
    </Cropper.Viewport>
  </Cropper.Root>
);

describe("sliders across parent renders", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("keeps the ref and the attributes while an inline format stays equal", async () => {
    const dial = vi.fn<() => void>();
    const zoom = vi.fn<() => void>();
    const screen = await render(
      <FormatHost digits={0} dial={dial} zoom={zoom} />
    );

    await frames();
    dial.mockClear();
    zoom.mockClear();
    await screen.rerender(<FormatHost digits={0} dial={dial} zoom={zoom} />);
    await screen.rerender(<FormatHost digits={0} dial={dial} zoom={zoom} />);
    await frames();
    expect(dial).not.toHaveBeenCalled();
    expect(zoom).not.toHaveBeenCalled();
  });

  it("writes a new format in the commit that changes it, and nothing for equal text", async () => {
    const screen = await render(<SpokenHost kind="percent" />);

    await frames();
    await screen.rerender(<SpokenHost kind="decimal" />);

    expect(
      screen.container
        .querySelector('[data-zriz-item="zoom"]')
        ?.getAttribute("aria-valuetext")
    ).toBe("1");

    await screen.rerender(<UnitHost unit="deg" />);
    const node = screen.container.querySelector(
      '[data-zriz-item="dial-value"]'
    );

    expect(node?.textContent).toBe("0deg");
    await screen.rerender(<UnitHost unit="grad" />);
    expect(node?.textContent).toBe("0grad");
    const first = node?.firstChild;

    await screen.rerender(<UnitHost unit="grad" />);
    expect(node?.firstChild).toBe(first);
  });
});

describe("DialValue text", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("shows the angle over children and survives removing them", async () => {
    const screen = await render(<ChildHost on />);

    await screen.rerender(<ChildHost on={false} />);
    await frames();

    expect(
      screen.container.querySelector('[data-zriz-item="dial-value"]')
        ?.textContent
    ).toBe("0");
  });
});

describe("Mask and Area rebinding", () => {
  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it("clears what a Mask or Area wrote when the part rebinds without it", async () => {
    vi.spyOn(CSS, "supports").mockReturnValue(false);
    const screen = await render(<MaskHost shape="circle" />);

    await frames(3);
    const mask = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="mask"]'
    );

    expect(mask?.style.getPropertyValue("mask-image")).not.toBe("");
    await screen.rerender(<MaskHost shape="rect" />);
    await frames(3);

    expect({
      clip: mask?.style.clipPath === "",
      gradient: mask?.style.getPropertyValue("mask-image"),
    }).toStrictEqual({ clip: false, gradient: "" });

    await screen.rerender(<LiveHost live />);
    await frames(3);
    const area = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="area"]'
    );

    expect(area?.style.getPropertyValue("--zriz-zoom")).toBe("1");
    await screen.rerender(<LiveHost live={false} />);
    await frames(2);

    expect({
      width: area?.style.width === "",
      zoom: area?.style.getPropertyValue("--zriz-zoom"),
    }).toStrictEqual({ width: false, zoom: "" });
  });
});
