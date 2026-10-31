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

const userRef = (node: HTMLDivElement | null) => {
  log.push(node ? "attach" : "null");
  return () => {
    log.push("cleanup");
  };
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
    const screen = await render(
      <Shell api={api}>
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
        <Cropper.Flip>flip</Cropper.Flip>
        <Cropper.Reset>reset</Cropper.Reset>
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
    expect(rotate.current?.tagName).toBe("BUTTON");
    rotate.current?.click();
    await frames(2);
    await screen.unmount();
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("returns a cleanup from mergeRefs that detaches every ref", () => {
    const object = createRef<HTMLDivElement>();
    const node = document.createElement("div");
    const off = mergeRefs(object, userRef)(node);
    expect(object.current).toBe(node);
    off();
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
