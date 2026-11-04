import { createCropper } from "@zriz/core";
import type { CropValue, Cropper as CropperApi } from "@zriz/core";
import { ZrizError, imageOf } from "@zriz/core/dom";
import type { LoadedImage } from "@zriz/core/dom";
import { Profiler, StrictMode, createRef, useState } from "react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands, userEvent } from "vitest/browser";

import { preventZrizHandler, useCropperValue } from "../src";
import * as Cropper from "../src/cropper";

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
  }
}

const photo = async (): Promise<Blob> => {
  const canvas = new OffscreenCanvas(400, 300);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("no 2d context");
  }
  context.fillStyle = "#c33";
  context.fillRect(0, 0, 400, 300);
  context.fillStyle = "#33c";
  context.fillRect(200, 0, 200, 300);
  return await canvas.convertToBlob({ type: "image/png" });
};

const frames = async (n = 2): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise((resolve) => {
      requestAnimationFrame(resolve);
    });
  }
};

const ready = async (api: { current: CropperApi | null }): Promise<void> => {
  for (let i = 0; i < 100 && api.current?.getState().ready !== true; i += 1) {
    await frames(1);
  }
  await frames(2);
};

interface AvatarProps {
  src: Blob;
  actionsRef: React.Ref<CropperApi>;
  onValueCommit?: (value: CropValue) => void;
  onPointerDown?: (event: React.PointerEvent) => void;
  children?: ReactNode;
}

const Avatar = ({
  src,
  actionsRef,
  onValueCommit,
  onPointerDown,
  children,
}: AvatarProps) => (
  <Cropper.Root actionsRef={actionsRef} onValueCommit={onValueCommit} src={src}>
    <Cropper.Viewport
      id="viewport"
      onPointerDown={onPointerDown}
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Image alt="" />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop" />
      {children}
    </Cropper.Viewport>
  </Cropper.Root>
);

describe("react parts", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("renders the avatar and lays out once the photo loads", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const screen = await render(<Avatar actionsRef={api} src={src} />);
    await ready(api);
    const area = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="area"]'
    );
    expect(area?.style.width).toBe("400px");
    expect(
      screen.container.querySelector('[data-zriz-item="root"]')
    ).not.toBeNull();
  });

  it("causes no React render while dragging", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    let commits = 0;
    await render(
      <Profiler
        id="zriz"
        onRender={() => {
          commits += 1;
        }}
      >
        <Avatar actionsRef={api} src={src} />
      </Profiler>
    );
    await ready(api);
    api.current?.setZoom(2, { emit: false });
    await frames(2);
    commits = 0;
    const path: [number, number][] = [[200, 150]];
    for (let i = 1; i <= 30; i += 1) {
      path.push([200 + i * 2, 150]);
    }
    await commands.drag("#viewport", path);
    await frames(2);
    expect(commits).toBeLessThanOrEqual(4);
  });

  it("lets the user veto a pointer handler", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    await render(
      <Avatar
        actionsRef={api}
        onPointerDown={(event) => {
          preventZrizHandler(event);
        }}
        src={src}
      />
    );
    await ready(api);
    api.current?.setZoom(2, { emit: false });
    const before = api.current?.getValue();
    await commands.drag("#viewport", [
      [200, 150],
      [240, 150],
    ]);
    expect(api.current?.getValue()).toBe(before);
  });

  it("commits once per drag under StrictMode", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    let commits = 0;
    await render(
      <StrictMode>
        <Avatar
          actionsRef={api}
          onValueCommit={() => {
            commits += 1;
          }}
          src={src}
        />
      </StrictMode>
    );
    await ready(api);
    api.current?.setZoom(2, { emit: false });
    await commands.drag("#viewport", [
      [200, 150],
      [230, 150],
      [260, 150],
    ]);
    await expect.poll(() => commits, { timeout: 5000 }).toBe(1);
    await frames(3);
    expect(commits).toBe(1);
  });

  it("renders into the user's element and passes state to className", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const screen = await render(
      <Avatar actionsRef={api} src={src}>
        <Cropper.Grid
          className={(state) => `grid-${state.grid}`}
          render={<section />}
        />
      </Avatar>
    );
    await ready(api);
    const grid = screen.container.querySelector('[data-zriz-item="grid"]');
    expect(grid?.tagName).toBe("SECTION");
    expect(grid?.className).toBe("grid-none");
  });

  it("moves an Image that mounts after the photo is ready", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const Late = () => {
      const [shown, setShown] = useState(false);
      return (
        <Cropper.Root actionsRef={api} src={src}>
          <Cropper.Viewport
            style={{
              height: 300,
              padding: 20,
              position: "relative",
              width: 400,
            }}
          >
            {shown ? <Cropper.Image alt="" /> : null}
            <button
              aria-label="show"
              id="show"
              onClick={() => {
                setShown(true);
              }}
              type="button"
            />
          </Cropper.Viewport>
        </Cropper.Root>
      );
    };
    const screen = await render(<Late />);
    await ready(api);
    screen.container.querySelector<HTMLButtonElement>("#show")?.click();
    await frames(3);
    const image = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="image"] img'
    );
    expect(image?.style.transform).toMatch(/^matrix\(/u);
  });

  it("frees the photo when Root unmounts", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} src={src}>
        <Cropper.Viewport
          style={{ height: 300, padding: 20, position: "relative", width: 400 }}
        >
          <Cropper.Image />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    await ready(api);
    const cropper = api.current;
    expect(cropper && imageOf(cropper)).not.toBeNull();
    await screen.unmount();
    expect(cropper && imageOf(cropper)).toBeNull();
  });

  it("applies a controlled zoom given before the photo loads", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    await render(
      <Cropper.Root actionsRef={api} src={src} zoom={2}>
        <Cropper.Viewport
          style={{ height: 300, padding: 20, position: "relative", width: 400 }}
        >
          <Cropper.Image alt="" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    await ready(api);
    expect(api.current?.getZoom()).toBeCloseTo(2, 6);
  });

  it("applies a controlled zoom set while disabled once enabled", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const Editor = ({
      disabled,
      zoom,
    }: {
      disabled: boolean;
      zoom: number;
    }) => (
      <Cropper.Root actionsRef={api} disabled={disabled} src={src} zoom={zoom}>
        <Cropper.Viewport
          style={{ height: 300, padding: 20, position: "relative", width: 400 }}
        >
          <Cropper.Image alt="" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    const screen = await render(<Editor disabled={false} zoom={1} />);
    await ready(api);
    await screen.rerender(<Editor disabled zoom={2} />);
    await frames(2);
    expect(api.current?.getZoom()).toBeCloseTo(1, 6);
    await screen.rerender(<Editor disabled={false} zoom={2} />);
    await frames(2);
    expect(api.current?.getZoom()).toBeCloseTo(2, 6);
  });

  it("shrinks and grows a locked crop with alt and the arrows", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root actionsRef={api} aspect={1} src={src}>
        <Cropper.Viewport
          style={{ height: 300, padding: 20, position: "relative", width: 400 }}
        >
          <Cropper.Image alt="" />
          <Cropper.Area aria-label="Crop" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    await ready(api);
    const width = (): number => api.current?.getValue().size.width ?? 0;
    const start = width();
    screen.container
      .querySelector<HTMLElement>('[data-zriz-item="area"]')
      ?.focus();
    await userEvent.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    await frames(3);
    const shrunk = width();
    expect(shrunk).toBeLessThan(start);
    await userEvent.keyboard("{Alt>}{ArrowUp}{/Alt}");
    await frames(3);
    expect(width()).toBeLessThan(shrunk);
    await userEvent.keyboard("{Alt>}{ArrowRight}{/Alt}");
    await frames(3);
    expect(width()).toBeGreaterThan(shrunk * 0.99);
    const crop = api.current?.getCropState()?.crop;
    expect(crop?.width).toBeCloseTo(crop?.height ?? 0, 6);
  });

  it("reports the orientation button as its own reason", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const reasons: string[] = [];
    const screen = await render(
      <Cropper.Root
        actionsRef={api}
        aspect={16 / 9}
        onValueChange={(_, details) => {
          reasons.push(details.reason);
        }}
        src={src}
      >
        <Cropper.Viewport
          style={{ height: 300, padding: 20, position: "relative", width: 400 }}
        >
          <Cropper.Image alt="" />
        </Cropper.Viewport>
        <Cropper.Orientation>turn</Cropper.Orientation>
      </Cropper.Root>
    );
    await ready(api);
    screen.container
      .querySelector<HTMLButtonElement>('[data-zriz-item="orientation"]')
      ?.click();
    await frames(4);
    expect(api.current?.getValue().aspect).toBeCloseTo(9 / 16, 6);
    expect(reasons).toContain("orientation");
    expect(reasons).not.toContain("aspect");
  });

  it("never echoes a controlled value", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    let changes = 0;
    const Controlled = () => {
      const [value, setValue] = useState<CropValue | undefined>();
      return (
        <Cropper.Root
          actionsRef={api}
          onValueChange={(next) => {
            changes += 1;
            setValue(next);
          }}
          src={src}
          value={value}
        >
          <Cropper.Viewport
            id="viewport"
            style={{
              height: 300,
              padding: 20,
              position: "relative",
              width: 400,
            }}
          >
            <Cropper.Image alt="" />
          </Cropper.Viewport>
        </Cropper.Root>
      );
    };
    await render(<Controlled />);
    await ready(api);
    expect(changes).toBe(0);
    api.current?.setRotation(5);
    await frames(4);
    expect(changes).toBe(1);
    expect(api.current?.getValue().rotation).toBe(5);
  });
});

describe("react review regressions", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("binds through a render element that has its own ref", async () => {
    const api = createRef<CropperApi>();
    const mine = createRef<HTMLDivElement>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={{ height: 300, width: 400 }}>
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Area render={<div ref={mine} />} />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    await frames(3);
    const area = screen.container.querySelector<HTMLElement>(
      '[data-zriz-item="area"]'
    );
    expect(mine.current).toBe(area);
    expect(area?.style.width).toBe("400px");
  });

  it("keeps an external cropper's options", async () => {
    const external = createCropper({
      image: { height: 300, width: 400 },
      maxZoom: 4,
    });
    await render(<Cropper.Root cropper={external} />);
    expect(external.getMaxZoom()).toBe(4);
  });
});

describe("Root load results", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("reports an svg with html inside through onLoad", async () => {
    const svg = new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><foreignObject width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject></svg>',
      ],
      { type: "image/svg+xml" }
    );
    const loads: LoadedImage[] = [];
    const errors: unknown[] = [];
    await render(
      <Cropper.Root
        src={svg}
        onLoad={(image) => {
          loads.push(image);
        }}
        onError={(error) => {
          errors.push(error);
        }}
      />
    );
    await expect.poll(() => loads.length + errors.length).toBe(1);
    expect(errors).toStrictEqual([]);
    expect(loads[0]?.width).toBe(200);
  });

  it("does not report an app error from onLoad as a failed load", async () => {
    const thrown = new ZrizError("no-image", "zriz: from the app");
    const errors: unknown[] = [];
    const surfaced: unknown[] = [];
    const catcher = (event: PromiseRejectionEvent): void => {
      surfaced.push(event.reason);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    window.addEventListener("unhandledrejection", catcher, { capture: true });
    await render(
      <Cropper.Root
        src={await photo()}
        onLoad={() => {
          throw thrown;
        }}
        onError={(error) => {
          errors.push(error);
        }}
      />
    );
    await expect.poll(() => surfaced).toStrictEqual([thrown]);
    window.removeEventListener("unhandledrejection", catcher, {
      capture: true,
    });
    expect(errors).toStrictEqual([]);
  });
});

describe("useCropperValue", () => {
  afterEach(cleanup);

  it("renders once for every commit with the committed value", async () => {
    let time = 0;
    const queue = new Map<number, (now: number) => void>();
    let id = 0;
    const cropper = createCropper({
      clock: {
        cancel: (handle) => {
          queue.delete(handle);
        },
        now: () => time,
        request: (step) => {
          id += 1;
          queue.set(id, step);
          return id;
        },
      },
      image: { height: 3000, width: 4000 },
    });
    const frame = (): void => {
      time += 16;
      const steps = [...queue.values()];
      queue.clear();
      for (const step of steps) {
        step(time);
      }
    };
    let renders = 0;
    const Angle = () => {
      renders += 1;
      return <p id="angle">{useCropperValue(cropper).rotation}</p>;
    };
    await render(<Angle />);
    for (const rotation of [5, 9, 13, 17, 21]) {
      renders = 0;
      cropper.setRotation(rotation);
      frame();
      await frames();
      expect(document.querySelector("#angle")?.textContent).toBe(`${rotation}`);
      expect(renders).toBe(1);
    }
    renders = 0;
    cropper.setValue({ rotation: 3 }, { emit: false });
    frame();
    await frames();
    expect(renders).toBe(0);
  });
});

describe("AspectItem", () => {
  afterEach(cleanup);

  it("stays checked after turns on a ratio whose inverse drifts", async () => {
    const cropper = createCropper({
      defaultValue: { aspect: 1.85 },
      image: { height: 3000, width: 4000 },
    });
    await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.AspectItem id="item" value={1.85} />
      </Cropper.Root>
    );
    const item = document.querySelector("#item");
    expect(item?.hasAttribute("data-checked")).toBe(true);
    cropper.rotate90();
    cropper.rotate90();
    await frames();
    expect(cropper.getValue().aspect).not.toBe(1.85);
    expect(item?.hasAttribute("data-checked")).toBe(true);
    cropper.rotate90();
    cropper.rotate90();
    await frames();
    expect(cropper.getState().pristine).toBe(true);
  });
});
