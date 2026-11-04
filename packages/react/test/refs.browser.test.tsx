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

const Probe = ({ tag }: { tag: string }) => {
  const own = useCallback(
    (node: HTMLDivElement) => {
      log.push(`bind ${tag} ${node.tagName}`);
      return () => {
        log.push(`unbind ${tag}`);
      };
    },
    [tag]
  );
  return <div ref={useMergedRef(own, theirs)} />;
};

const userRef = (node: HTMLElement | null) => {
  log.push(node ? "attach" : "null");
  return () => {
    log.push("cleanup");
  };
};

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

const Shell = ({
  api,
  children,
}: {
  api: Ref<CropperApi>;
  children: React.ReactNode;
}) => (
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

  it("rebinds a part when its options change", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" max={4} />
      </Shell>
    );
    const zoom = screen.container.querySelector('[data-zriz-item="zoom"]');
    expect(zoom?.getAttribute("aria-valuemax")).toBe("4");
    await screen.rerender(
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" max={8} />
      </Shell>
    );
    expect(zoom?.getAttribute("aria-valuemax")).toBe("8");
    api.current?.setZoom(2);
    await frames(2);
    expect(zoom?.getAttribute("aria-valuemax")).toBe("8");
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
    const area = screen.container.querySelector('[data-zriz-item="area"]');
    expect(mine.current).toBe(area);
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

  it("detaches every ref a merged ref holds", () => {
    const object = createRef<HTMLDivElement>();
    const node = document.createElement("div");
    const merged = mergeRefs(object, userRef);
    merged(node);
    expect(object.current).toBe(node);
    merged(null);
    expect(object.current).toBeNull();
    expect(log).toStrictEqual(["attach", "cleanup"]);
  });

  it("detaches refs merged by a fresh mergeRefs in a wrapper ref", async () => {
    const api = createRef<CropperApi>();
    const object = createRef<HTMLDivElement>();
    const OwnArea = forwardRef<HTMLDivElement, AreaProps>(
      function OwnArea(props, ref) {
        return (
          <Cropper.Area
            {...props}
            ref={(node) => mergeRefs(object, ref)(node)}
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
    expect(object.current?.dataset.zrizItem).toBe("area");
    await screen.unmount();
    expect(object.current).toBeNull();
    expect(log.at(-1)).toMatch(/^(?:cleanup|null)$/u);
    expect(log.filter((entry) => entry === "attach")).toHaveLength(1);
  });

  it("keeps the node when a part gains a render element of the same tag", async () => {
    const api = createRef<CropperApi>();
    const Host = ({ own }: { own: boolean }) => (
      <Shell api={api}>
        {own ? (
          <Cropper.Rotate
            id="kept"
            render={<button aria-label="turn" type="button" />}
          />
        ) : (
          <Cropper.Rotate id="kept" />
        )}
      </Shell>
    );
    const screen = await render(<Host own={false} />);
    const before = document.querySelector("#kept");
    await screen.rerender(<Host own />);
    expect(document.querySelector("#kept")).toBe(before);
  });

  it("keeps a drag going when a render element's ref changes", async () => {
    const api = createRef<CropperApi>();
    const Host = ({ tick }: { tick: number }) => (
      <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
        <Cropper.Viewport
          id="view"
          render={
            <div
              data-tick={tick}
              ref={() => {
                log.push("inline");
              }}
            />
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
  });

  it("keeps a drag going when a render function makes a new ref", async () => {
    const api = createRef<CropperApi>();
    const Host = ({ tick }: { tick: number }) => (
      <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
        <Cropper.Viewport
          id="view"
          render={(own) => (
            <div
              {...own}
              data-tick={tick}
              ref={mergeRefs(isCallback(own.ref) ? own.ref : undefined)}
            />
          )}
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
  });

  it("moves a new ref over once when the part rebinds in the same render", async () => {
    const entry = (name: string) => (node: HTMLDivElement | null) => {
      log.push(`${name}${node ? "+" : "-"}`);
    };
    const first = entry("a");
    const second = entry("b");
    const api = createRef<CropperApi>();
    const Host = ({ own }: { own: Ref<HTMLDivElement> }) => (
      <Shell api={api}>
        <Cropper.Zoom aria-label="Zoom" format={{}} ref={own} />
      </Shell>
    );
    const screen = await render(<Host own={first} />);
    await frames(1);
    log.length = 0;
    await screen.rerender(<Host own={second} />);
    expect(log).toStrictEqual(["a-", "b+"]);
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
