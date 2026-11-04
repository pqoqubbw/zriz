import { createCropper } from "@zriz/core";
import type { CropValue, Cropper as CropperApi } from "@zriz/core";
import { ZrizError, imageOf, viewOf } from "@zriz/core/dom";
import type { LoadedImage } from "@zriz/core/dom";
import * as React from "react";
import {
  Profiler,
  StrictMode,
  Suspense,
  createRef,
  lazy,
  memo,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands, userEvent } from "vitest/browser";

import {
  preventZrizHandler,
  useCropper,
  useCropperValue,
  useZoom,
} from "../src";
import * as Cropper from "../src/cropper";

declare module "vitest/browser" {
  interface BrowserCommands {
    drag: (
      selector: string,
      path: readonly (readonly [number, number, number?])[]
    ) => Promise<void>;
  }
}

const photoCropper = () =>
  createCropper({ image: { height: 3000, width: 4000 } });

const pointerOn = (id: string, type: string): void => {
  document.querySelector(id)?.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId: 1,
    })
  );
};

const isActive = (id: string): boolean =>
  Object.hasOwn(
    document.querySelector<HTMLElement>(id)?.dataset ?? {},
    "active"
  );

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

const Shown = ({ cropper }: { cropper?: CropperApi }) => (
  <p id="shown">{JSON.stringify(useCropperValue(cropper))}</p>
);

const ShownValue = memo(Shown);

const shownValue = (): unknown =>
  JSON.parse(document.querySelector("#shown")?.textContent ?? "null");

describe(useCropperValue, () => {
  afterEach(cleanup);

  it("shows the props a shared cropper applied when its photo arrived", async () => {
    const cropper = createCropper();
    await render(
      <Cropper.Root aspect={1} cropper={cropper} rotation={10} zoom={2}>
        <ShownValue />
      </Cropper.Root>
    );
    await frames(2);
    cropper.setImage({ height: 3000, width: 4000 });
    await frames(3);
    expect(cropper.getValue().rotation).toBe(10);
    expect(shownValue()).toStrictEqual(cropper.getValue());
  });

  it("shows a zoom prop applied when a loaded photo arrived", async () => {
    const api = createRef<CropperApi>();
    await render(
      <Cropper.Root actionsRef={api} src={await photo()} zoom={2}>
        <ShownValue />
      </Cropper.Root>
    );
    await ready(api);
    expect(api.current?.getZoom()).toBeCloseTo(2, 6);
    expect(shownValue()).toStrictEqual(api.current?.getValue());
  });

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
    const Angle = () => <p id="angle">{useCropperValue(cropper).rotation}</p>;
    await render(
      <Profiler
        id="angle"
        onRender={() => {
          renders += 1;
        }}
      >
        <Angle />
      </Profiler>
    );
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
    const item = document.querySelector<HTMLElement>("#item");
    expect(item?.dataset.checked).toBe("");
    cropper.rotate90();
    cropper.rotate90();
    await frames();
    expect(cropper.getValue().aspect).not.toBe(1.85);
    expect(item?.dataset.checked).toBe("");
    cropper.rotate90();
    cropper.rotate90();
    await frames();
    expect(cropper.getState().pristine).toBeTruthy();
  });
});

describe("work a render does not need", () => {
  afterEach(cleanup);

  it("keeps one subscription across parent renders", async () => {
    const cropper = photoCropper();
    const on = vi.spyOn(cropper, "on");
    const Probe = ({ tick }: { tick: number }) => (
      <p>
        {tick}
        {useZoom({ cropper }).value}
        {useCropperValue(cropper).rotation}
      </p>
    );
    const { rerender } = await render(<Probe tick={0} />);
    const after = on.mock.calls.length;
    await rerender(<Probe tick={1} />);
    await rerender(<Probe tick={2} />);
    expect(on).toHaveBeenCalledTimes(after);
  });

  it("does not set options again for an equal inline minSize", async () => {
    const cropper = photoCropper();
    const setOptions = vi.spyOn(cropper, "setOptions");
    const Probe = ({ tick }: { tick: number }) => {
      useCropper({ cropper, minSize: { height: 100, width: 100 } });
      return <p>{tick}</p>;
    };
    const { rerender } = await render(<Probe tick={0} />);
    const after = setOptions.mock.calls.length;
    await rerender(<Probe tick={1} />);
    expect(setOptions).toHaveBeenCalledTimes(after);
  });

  it("does not write back the value the cropper already holds", async () => {
    const cropper = photoCropper();
    const setValue = vi.spyOn(cropper, "setValue");
    const Probe = ({ value }: { value: CropValue }) => {
      useCropper({ cropper, value });
      return null;
    };
    await render(<Probe value={cropper.getValue()} />);
    expect(setValue).not.toHaveBeenCalled();
  });

  it("keeps the dial ticks across parent renders", async () => {
    const cropper = photoCropper();
    const seen: unknown[] = [];
    const Probe = ({ tick }: { tick: number }) => (
      <Cropper.Root cropper={cropper} data-tick={tick}>
        <Cropper.DialTicks
          render={(props) => {
            seen.push(props.children);
            return <div {...props} />;
          }}
        />
      </Cropper.Root>
    );
    const { rerender } = await render(<Probe tick={0} />);
    await rerender(<Probe tick={1} />);
    expect(seen.length).toBeGreaterThan(1);
    expect(seen.at(-1)).toBe(seen[0]);
  });

  it("does not render an idle handle on a resize elsewhere", async () => {
    const cropper = photoCropper();
    let renders = 0;
    await render(
      <Cropper.Root cropper={cropper}>
        <Profiler
          id="handle"
          onRender={() => {
            renders += 1;
          }}
        >
          <Cropper.Handle position="right" />
        </Profiler>
      </Cropper.Root>
    );
    await frames();
    renders = 0;
    cropper.begin("resize");
    await frames();
    cropper.end();
    await frames();
    expect(renders).toBe(0);
  });

  it("clears a handle's active mark when its drag ends", async () => {
    const cropper = photoCropper();
    await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Handle id="right" position="right" />
          <Cropper.Handle id="left" position="left" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    await frames();
    pointerOn("#right", "pointerdown");
    await frames();
    expect(isActive("#right")).toBeTruthy();
    pointerOn("#right", "pointerup");
    await frames();
    pointerOn("#left", "pointerdown");
    await frames();
    expect(isActive("#left")).toBeTruthy();
    expect(isActive("#right")).toBeFalsy();
    pointerOn("#left", "pointerup");
  });
});

describe("parts portaled into another document", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("arrow keys move an aspect group and the ruler lays out", async () => {
    const frame = document.createElement("iframe");
    frame.srcdoc = "<!doctype html><body></body>";
    await new Promise((resolve) => {
      frame.addEventListener("load", resolve, { once: true });
      document.body.append(frame);
    });
    const body = frame.contentDocument?.body;
    if (!body) {
      throw new Error("no body");
    }
    await render(
      createPortal(
        <Cropper.Root image={{ height: 300, width: 400 }}>
          <Cropper.AspectGroup aria-label="Aspect">
            <Cropper.AspectItem value="free">Free</Cropper.AspectItem>
            <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
          </Cropper.AspectGroup>
          <Cropper.Dial aria-label="Straighten" style={{ width: 200 }}>
            <Cropper.DialTicks />
          </Cropper.Dial>
        </Cropper.Root>,
        body
      )
    );
    await frames();
    const items = [...body.querySelectorAll("button")];
    items[0]?.focus();
    items[0]?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" })
    );
    await frames();
    expect(items[1]?.getAttribute("aria-checked")).toBe("true");
    expect(body.querySelectorAll('[data-zero][style*="left"]')).toHaveLength(1);
    await cleanup();
    frame.remove();
  });
});

const PHOTO = { height: 3000, width: 4000 };

const events = () => {
  const changes: string[] = [];
  const commits: string[] = [];
  return {
    changes,
    commits,
    onValueChange: (_: CropValue, details: { reason: string }) => {
      changes.push(details.reason);
    },
    onValueCommit: (_: CropValue, details: { reason: string }) => {
      commits.push(details.reason);
    },
  };
};

describe("controlled props", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("returns disabled, maxZoom and minSize to their defaults when the prop goes away", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root
        actionsRef={api}
        disabled
        image={{ height: 1200, width: 1200 }}
        maxZoom={3}
        minSize={{ height: 1100, width: 1100 }}
      />
    );
    expect(api.current?.getState().disabled).toBeTruthy();
    expect(api.current?.getMaxZoom()).toBe(3);
    const limited = api.current?.getRotationLimit() ?? 45;
    expect(limited).toBeLessThan(45);
    await screen.rerender(
      <Cropper.Root actionsRef={api} image={{ height: 1200, width: 1200 }} />
    );
    expect([
      api.current?.getState().disabled,
      api.current?.getMaxZoom(),
      api.current?.getRotationLimit(),
    ]).toStrictEqual([false, 15, 45]);
  });

  it("does not bring back an old prop when disabled toggles or the photo returns", async () => {
    const api = createRef<CropperApi>();
    const { commits, onValueCommit } = events();
    const Host = ({ disabled }: { disabled: boolean }) => (
      <Cropper.Root
        actionsRef={api}
        aspect={4 / 3}
        disabled={disabled}
        image={PHOTO}
        onValueCommit={onValueCommit}
        rotation={5}
        zoom={1.5}
      />
    );
    const screen = await render(<Host disabled={false} />);
    await frames(2);
    const cropper = api.current;
    cropper?.rotate90();
    cropper?.setRotation(12);
    cropper?.setZoom(2.5);
    await frames(3);
    const held = cropper?.getValue();
    commits.length = 0;
    await screen.rerender(<Host disabled />);
    await screen.rerender(<Host disabled={false} />);
    await frames(3);
    expect(cropper?.getValue()).toStrictEqual(held);
    cropper?.setImage(null);
    cropper?.setImage(PHOTO);
    await frames(3);
    expect(cropper?.getValue().aspect).toBe(held?.aspect);
    expect(cropper?.getValue().rotation).toBe(12);
    expect(commits).toStrictEqual([]);
  });

  it("applies props when the cropper is enabled from outside the hook", async () => {
    const cropper = createCropper({ disabled: true, image: PHOTO });
    await render(
      <Cropper.Root aspect={1} cropper={cropper} rotation={5} zoom={2} />
    );
    await frames(2);
    expect(cropper.getValue().aspect).toBe("free");
    cropper.setOptions({ disabled: false });
    await frames(2);
    expect(cropper.getValue().aspect).toBe(1);
    expect(cropper.getValue().rotation).toBe(5);
    expect(cropper.getZoom()).toBeCloseTo(2, 6);
  });

  it("applies props at load without events, and later ones with events", async () => {
    const api = createRef<CropperApi>();
    const { changes, commits, onValueChange, onValueCommit } = events();
    const Host = ({ aspect, zoom }: { aspect: number; zoom: number }) => (
      <Cropper.Root
        actionsRef={api}
        aspect={aspect}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        rotation={aspect === 1 ? 0 : 5}
        zoom={zoom}
      />
    );
    const screen = await render(<Host aspect={1} zoom={2} />);
    await screen.rerender(<Host aspect={16 / 9} zoom={2} />);
    api.current?.setImage(PHOTO);
    await frames(3);
    expect([changes, commits]).toStrictEqual([[], []]);
    expect(api.current?.getValue().aspect).toBeCloseTo(16 / 9, 6);
    expect(api.current?.getValue().rotation).toBe(5);
    expect(api.current?.getZoom()).toBeCloseTo(2, 6);
    await screen.rerender(<Host aspect={16 / 9} zoom={3} />);
    await frames(3);
    expect([changes, commits]).toStrictEqual([["controlled"], ["controlled"]]);
  });

  it("reports aspect for a preset that also changes rotation or zoom", async () => {
    const api = createRef<CropperApi>();
    const { changes, commits, onValueChange, onValueCommit } = events();
    const Host = ({
      aspect,
      rotation,
    }: {
      aspect: number;
      rotation: number;
    }) => (
      <Cropper.Root
        actionsRef={api}
        aspect={aspect}
        image={PHOTO}
        onValueChange={onValueChange}
        onValueCommit={onValueCommit}
        rotation={rotation}
      />
    );
    const screen = await render(<Host aspect={1} rotation={0} />);
    await frames(2);
    await screen.rerender(<Host aspect={16 / 9} rotation={5} />);
    await frames(3);
    expect(changes).toStrictEqual(["aspect"]);
    expect(commits).toStrictEqual(["aspect"]);
    expect(api.current?.getValue().rotation).toBe(5);
  });

  it("holds a controlled zoom on the same frame as a photo of another size", async () => {
    const api = createRef<CropperApi>();
    await render(
      <Cropper.Root actionsRef={api} aspect={1} image={PHOTO} zoom={2} />
    );
    await frames(2);
    api.current?.setImage({ height: 3000, width: 1000 });
    expect(api.current?.getZoom()).toBeCloseTo(2, 6);
  });

  it("applies a prop that was released and comes back at its old value", async () => {
    const api = createRef<CropperApi>();
    const Host = ({ locked }: { locked: boolean }) => (
      <Cropper.Root
        actionsRef={api}
        aspect={locked ? 1 : undefined}
        image={PHOTO}
        rotation={locked ? 10 : undefined}
        zoom={locked ? 2 : undefined}
      />
    );
    const screen = await render(<Host locked />);
    await frames(2);
    await screen.rerender(<Host locked={false} />);
    api.current?.setAspect("free");
    api.current?.setRotation(20);
    api.current?.setZoom(3);
    await frames(3);
    await screen.rerender(<Host locked />);
    await frames(3);
    expect(api.current?.getValue().aspect).toBe(1);
    expect(api.current?.getValue().rotation).toBe(10);
    expect(api.current?.getZoom()).toBeCloseTo(2, 6);
  });

  it("holds a controlled zoom across a photo of another size only", async () => {
    const api = createRef<CropperApi>();
    const { commits, onValueCommit } = events();
    await render(
      <Cropper.Root
        actionsRef={api}
        aspect={1}
        image={PHOTO}
        onValueCommit={onValueCommit}
        zoom={2}
      />
    );
    await frames(2);
    api.current?.setImage({ height: 3000, width: 1000 });
    await frames(3);
    expect(api.current?.getZoom()).toBeCloseTo(2, 6);
    expect(new Set(commits)).toStrictEqual(new Set(["coverage"]));
    api.current?.setZoom(3);
    await frames(3);
    api.current?.setImage({ height: 3000, width: 1000 });
    await frames(3);
    expect(api.current?.getZoom()).toBeCloseTo(3, 6);
  });

  it("moves a capped prop up when its limit relaxes, never over an edit", async () => {
    const api = createRef<CropperApi>();
    const Host = ({ maxZoom, min }: { maxZoom: number; min: number }) => (
      <Cropper.Root
        actionsRef={api}
        image={PHOTO}
        maxZoom={maxZoom}
        minSize={{ height: min, width: min }}
        rotation={40}
        zoom={20}
      />
    );
    const screen = await render(<Host maxZoom={15} min={2900} />);
    await frames(2);
    const limited = api.current?.getValue().rotation ?? 0;
    expect(limited).toBeLessThan(40);
    await screen.rerender(<Host maxZoom={30} min={1} />);
    await frames(2);
    expect(api.current?.getValue().rotation).toBe(40);
    expect(api.current?.getZoom()).toBeCloseTo(20, 6);
    await screen.rerender(<Host maxZoom={15} min={1} />);
    await frames(2);
    api.current?.setZoom(4);
    await frames(2);
    await screen.rerender(<Host maxZoom={30} min={1} />);
    await frames(2);
    expect(api.current?.getZoom()).toBeCloseTo(4, 6);
  });

  it("uses first render props as the reset target on a cropper it was given", async () => {
    const cropper = createCropper({ image: PHOTO });
    await render(
      <Cropper.Root aspect={16 / 9} cropper={cropper} rotation={3} />
    );
    await frames(3);
    cropper.setRotation(9);
    cropper.setValue({ aspect: 1 });
    await frames(2);
    cropper.reset();
    await frames(2);
    expect(cropper.getValue().aspect).toBeCloseTo(16 / 9, 6);
    expect(cropper.getValue().rotation).toBe(3);
    expect(cropper.getState().pristine).toBeTruthy();
  });

  it("keeps a circle round through reset after a toggle, without marking it edited", async () => {
    const api = createRef<CropperApi>();
    const Host = ({ shape }: { shape: "rect" | "circle" }) => (
      <Cropper.Root actionsRef={api} image={PHOTO} shape={shape} />
    );
    const screen = await render(<Host shape="rect" />);
    await frames(2);
    await screen.rerender(<Host shape="circle" />);
    await frames(3);
    expect(api.current?.getValue().aspect).toBe(1);
    expect(api.current?.getState().pristine).toBeTruthy();
    api.current?.setRotation(4);
    api.current?.reset();
    await frames(2);
    expect(api.current?.getValue().aspect).toBe(1);
  });
});

describe("callbacks on a shared cropper", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("drops the reset target of a Root that left", async () => {
    const cropper = photoCropper();
    const screen = await render(
      <Cropper.Root aspect={1} cropper={cropper} rotation={10} />
    );
    await frames(2);
    await screen.unmount();
    await render(<Cropper.Root cropper={cropper} />);
    cropper.reset();
    await frames(2);
    const { aspect, rotation } = cropper.getValue();
    expect({ aspect, rotation }).toStrictEqual({ aspect: "free", rotation: 0 });
  });

  it("drops the reset target of a circle Root that left", async () => {
    const cropper = photoCropper();
    const screen = await render(
      <Cropper.Root cropper={cropper} rotation={10} shape="circle" />
    );
    await frames(2);
    await screen.unmount();
    await render(<Cropper.Root cropper={cropper} />);
    cropper.reset();
    await frames(2);
    const { aspect, rotation } = cropper.getValue();
    expect({ aspect, rotation }).toStrictEqual({ aspect: "free", rotation: 0 });
  });

  it("stops calling a closed Root and gives the creator's callback back", async () => {
    const mine = vi.fn<() => void>();
    const cropper = createCropper({ image: PHOTO, onValueCommit: mine });
    const save = vi.fn<() => void>();
    const screen = await render(
      <Cropper.Root cropper={cropper} onValueCommit={save} />
    );
    cropper.setRotation(2);
    await frames(2);
    expect(save).toHaveBeenCalledOnce();
    expect(mine).toHaveBeenCalledOnce();
    await screen.unmount();
    cropper.setRotation(3);
    await frames(2);
    expect(save).toHaveBeenCalledOnce();
    expect(mine).toHaveBeenCalledTimes(2);
  });

  it("keeps a second Root's callback when the first closes", async () => {
    const cropper = createCropper({ image: PHOTO });
    const stays = vi.fn<() => void>();
    const Host = ({ both }: { both: boolean }) => (
      <>
        {both ? <Cropper.Root cropper={cropper} /> : null}
        <Cropper.Root cropper={cropper} onValueCommit={stays} />
      </>
    );
    const screen = await render(<Host both />);
    await screen.rerender(<Host both={false} />);
    cropper.setRotation(2);
    await frames(2);
    expect(stays).toHaveBeenCalledOnce();
  });

  it("keeps an object actionsRef on the new cropper across a keyed remount", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <Cropper.Root key="a" actionsRef={api} image={PHOTO} />
    );
    const first = api.current;
    await screen.rerender(
      <Cropper.Root key="b" actionsRef={api} image={PHOTO} />
    );
    await frames(2);
    expect(api.current).not.toBeNull();
    expect(api.current).not.toBe(first);
    await screen.unmount();
    expect(api.current).toBeNull();
  });

  it("keeps a function actionsRef on the new cropper across a keyed remount", async () => {
    const seen: (CropperApi | null)[] = [];
    const remember = (next: CropperApi | null): void => {
      seen.push(next);
    };
    const screen = await render(
      <Cropper.Root key="a" actionsRef={remember} image={PHOTO} />
    );
    await screen.rerender(
      <Cropper.Root key="b" actionsRef={remember} image={PHOTO} />
    );
    await frames(2);
    expect(seen.at(-1)).not.toBeNull();
    await screen.unmount();
    expect(seen.at(-1)).toBeNull();
  });

  it("delivers the final commit of its own cropper on unmount", async () => {
    const api = createRef<CropperApi>();
    const save = vi.fn<() => void>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={PHOTO} onValueCommit={save} />
    );
    api.current?.setRotation(2);
    await screen.unmount();
    expect(save).toHaveBeenCalledOnce();
  });

  it("follows the latest callback across renders", async () => {
    const api = createRef<CropperApi>();
    const first = vi.fn<() => void>();
    const second = vi.fn<() => void>();
    const screen = await render(
      <Cropper.Root actionsRef={api} image={PHOTO} onValueCommit={first} />
    );
    await screen.rerender(
      <Cropper.Root actionsRef={api} image={PHOTO} onValueCommit={second} />
    );
    api.current?.setRotation(2);
    await frames(2);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });
});

const Nothing = () => null;

const pass = (): void => undefined;

const lazySibling = () => {
  const gate = { open: pass };
  const opened = new Promise<void>((resolve) => {
    gate.open = resolve;
  });
  return {
    Sibling: lazy(async () => {
      await opened;
      return { default: Nothing };
    }),
    release: () => {
      gate.open();
    },
  };
};

const HydrateShell = () => {
  const cropper = useCropper();
  useEffect(() => {
    cropper.setImage(PHOTO);
  }, [cropper]);
  return (
    <Suspense fallback={null}>
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport id="hydrated">
          <Cropper.Image alt="" />
        </Cropper.Viewport>
      </Cropper.Root>
    </Suspense>
  );
};

describe("lifetimes under StrictMode, Suspense and Activity", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("clears actionsRef after a parent's layout effect in the unmount commit", async () => {
    const api = createRef<CropperApi>();
    const seen: boolean[] = [];
    const Parent = ({ on }: { on: boolean }) => {
      useLayoutEffect(() => {
        seen.push(api.current !== null);
      });
      return on ? <Cropper.Root actionsRef={api} image={PHOTO} /> : null;
    };
    const screen = await render(<Parent on />);
    await screen.rerender(<Parent on={false} />);
    expect(seen).toStrictEqual([true, true]);
    await expect.poll(() => api.current).toBeNull();
  });

  it("inits a plugin once on the live cropper and destroys what it started", async () => {
    const api = createRef<CropperApi>();
    const seen: unknown[] = [];
    const destroy = vi.fn<() => void>();
    const plugin = {
      destroy,
      init: (cropper: CropperApi) => {
        seen.push(cropper);
      },
      name: "probe",
    };
    await render(
      <StrictMode>
        <Cropper.Root actionsRef={api} plugins={[plugin]} />
      </StrictMode>
    );
    expect(seen).toStrictEqual([api.current]);
    api.current?.destroy();
    expect(destroy).toHaveBeenCalledOnce();
  });

  it("keeps an image prop under StrictMode", async () => {
    const api = createRef<CropperApi>();
    const screen = await render(
      <StrictMode>
        <Cropper.Root actionsRef={api} image={PHOTO}>
          <Cropper.Viewport style={{ height: 300, width: 400 }} />
        </Cropper.Root>
      </StrictMode>
    );
    await frames(2);
    expect(api.current?.getState().ready).toBeTruthy();
    expect(api.current?.getPixelCrop()).not.toBeNull();
    await screen.unmount();
  });

  const { Activity } = React;

  it.runIf(Activity)("keeps a photo across Activity", async () => {
    const api = createRef<CropperApi>();
    const source = await photo();
    const Host = ({ mode }: { mode: "hidden" | "visible" }) => (
      <Activity mode={mode}>
        <Cropper.Root actionsRef={api} src={source}>
          <Cropper.Viewport style={{ height: 300, width: 400 }} />
        </Cropper.Root>
      </Activity>
    );
    const screen = await render(<Host mode="visible" />);
    await ready(api);
    const cropper = api.current;
    const before = cropper && imageOf(cropper);
    expect(before).not.toBeNull();
    await screen.rerender(<Host mode="hidden" />);
    await frames(2);
    expect(cropper && imageOf(cropper)).toBe(before);
    await screen.rerender(<Host mode="visible" />);
    await ready(api);
    expect(api.current?.getState().ready).toBeTruthy();
  });

  it("keeps actionsRef and callbacks while a sibling suspends", async () => {
    const api = createRef<CropperApi>();
    const { Sibling, release } = lazySibling();
    const save = vi.fn<(held: CropperApi | null) => void>();
    const Host = ({ wait }: { wait: boolean }) => (
      <Suspense fallback={null}>
        <Cropper.Root
          actionsRef={api}
          image={PHOTO}
          onValueCommit={() => {
            save(api.current);
          }}
        />
        {wait ? <Sibling /> : null}
      </Suspense>
    );
    const screen = await render(<Host wait={false} />);
    const cropper = api.current;
    await screen.rerender(<Host wait />);
    await frames(2);
    expect(api.current).toBe(cropper);
    cropper?.setRotation(2);
    await frames(2);
    expect(save).toHaveBeenCalledWith(cropper);
    release();
    await frames(2);
    expect(api.current).toBe(cropper);
    await screen.unmount();
    expect(api.current).toBeNull();
  });

  it("hydrates a boundary from what the server rendered after the shell gets a photo", async () => {
    const html = renderToString(<HydrateShell />);
    const container = document.createElement("div");
    container.innerHTML = html;
    document.body.append(container);
    const errors = vi.spyOn(console, "error");
    const recoverable = vi.fn<() => void>();
    const root = hydrateRoot(container, <HydrateShell />, {
      onRecoverableError: recoverable,
    });
    for (
      let i = 0;
      i < 100 && !container.querySelector("[data-ready]");
      i += 1
    ) {
      await frames(1);
    }
    expect(container.querySelector("[data-ready]")).not.toBeNull();
    expect(errors).not.toHaveBeenCalled();
    expect(recoverable).not.toHaveBeenCalled();
    errors.mockRestore();
    root.unmount();
    container.remove();
  });
});

const LateZoom = () => <Cropper.Zoom aria-label="Zoom" id="late-zoom" />;

const hydrated = async (tree: ReactNode, html: string, write?: () => void) => {
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.append(container);
  write?.();
  await frames(2);
  const errors = vi.spyOn(console, "error");
  const recoverable = vi.fn<() => void>();
  const root = hydrateRoot(container, tree, {
    onRecoverableError: recoverable,
  });
  await frames(3);
  const logged = errors.mock.calls.length + recoverable.mock.calls.length;
  errors.mockRestore();
  return {
    container,
    logged,
    remove: () => {
      root.unmount();
      container.remove();
    },
  };
};

describe("hydrating a cropper that changed after the server render", () => {
  it("keeps a late Zoom on the server's value until it binds", async () => {
    const html = renderToString(
      <Cropper.Root cropper={photoCropper()}>
        <Suspense fallback={null}>
          <LateZoom />
        </Suspense>
      </Cropper.Root>
    );
    let open: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const Late = lazy(async () => {
      await gate;
      return { default: LateZoom };
    });
    const cropper = photoCropper();
    const tree = (
      <Cropper.Root cropper={cropper}>
        <Suspense fallback={null}>
          <Late />
        </Suspense>
      </Cropper.Root>
    );
    const { container, logged, remove } = await hydrated(tree, html);
    const errors = vi.spyOn(console, "error");
    cropper.setZoom(2);
    await frames(2);
    open?.();
    await vi.waitFor(() => {
      expect(
        container.querySelector("#late-zoom")?.getAttribute("aria-valuetext")
      ).toBe("200%");
    });
    expect(
      container.querySelector("#late-zoom")?.getAttribute("aria-valuenow")
    ).toBe("2");
    expect(logged + errors.mock.calls.length).toBe(0);
    errors.mockRestore();
    remove();
  });

  it("patches a Dial that was disabled in between", async () => {
    const cropper = photoCropper();
    const tree = (
      <Cropper.Root cropper={cropper}>
        <Cropper.Dial aria-label="Straighten" id="hydrated-dial" />
      </Cropper.Root>
    );
    const { container, logged, remove } = await hydrated(
      tree,
      renderToString(tree),
      () => {
        cropper.setOptions({ disabled: true });
      }
    );
    expect(logged).toBe(0);
    expect(
      container.querySelector("#hydrated-dial")?.getAttribute("aria-disabled")
    ).toBe("true");
    remove();
  });

  it("patches useCropperValue after a commit in between", async () => {
    const cropper = photoCropper();
    const tree = <ShownValue cropper={cropper} />;
    const { logged, remove } = await hydrated(
      tree,
      renderToString(tree),
      () => {
        cropper.setRotation(3);
      }
    );
    expect(logged).toBe(0);
    expect(shownValue()).toStrictEqual(cropper.getValue());
    remove();
  });
});

const reduced = (container: Element): boolean =>
  container.querySelector("[data-reduced-motion]") !== null;

const ReducedHost = ({ motion }: { motion: "reduce" | "always" }) => (
  <Cropper.Root image={PHOTO} motion={motion} />
);

describe("reduced motion attribute", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("follows the motion prop from the first paint", async () => {
    const screen = await render(<ReducedHost motion="reduce" />);
    expect(reduced(screen.container)).toBeTruthy();
    await screen.rerender(<ReducedHost motion="always" />);
    expect(reduced(screen.container)).toBeFalsy();
    await screen.rerender(<ReducedHost motion="reduce" />);
    expect(reduced(screen.container)).toBeTruthy();
  });

  it("follows the system setting under auto", async () => {
    const listeners = new Set<() => void>();
    let matches = false;
    vi.stubGlobal("matchMedia", () => ({
      addEventListener: (_: string, listener: () => void) => {
        listeners.add(listener);
      },
      get matches() {
        return matches;
      },
      removeEventListener: (_: string, listener: () => void) => {
        listeners.delete(listener);
      },
    }));
    const screen = await render(<Cropper.Root image={PHOTO} />);
    expect(reduced(screen.container)).toBeFalsy();
    matches = true;
    for (const listener of listeners) {
      listener();
    }
    await frames(2);
    expect(reduced(screen.container)).toBeTruthy();
    await screen.unmount();
    expect(listeners.size).toBe(0);
    vi.unstubAllGlobals();
  });

  it("renders the attribute on the server for motion reduce", () => {
    expect(renderToString(<Cropper.Root motion="reduce" />)).toContain(
      "data-reduced-motion"
    );
  });
});

const SwapHost = ({ cropper }: { cropper: CropperApi }) => (
  <Cropper.Root cropper={cropper}>
    <Cropper.Viewport style={{ height: 300, width: 400 }}>
      <Cropper.Area aria-label="Crop" id="swap-area" />
    </Cropper.Viewport>
    <Cropper.Dial aria-label="Dial" id="swap-dial" />
  </Cropper.Root>
);

const tapKey = (id: string, name: string): void => {
  for (const type of ["keydown", "keyup"]) {
    document
      .querySelector(id)
      ?.dispatchEvent(new KeyboardEvent(type, { bubbles: true, key: name }));
  }
};

describe("swapping the cropper prop", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("moves Viewport, Area and Dial to the new cropper", async () => {
    const a = photoCropper();
    const b = photoCropper();
    const screen = await render(<SwapHost cropper={a} />);
    await screen.rerender(<SwapHost cropper={b} />);
    await frames(2);
    a.setZoom(3);
    b.setZoom(3);
    await frames(2);
    const before = a.getValue();
    const centre = b.getCropState()?.crop.x;
    tapKey("#swap-area", "ArrowLeft");
    tapKey("#swap-dial", "ArrowRight");
    await frames(2);
    expect(a.getValue()).toStrictEqual(before);
    expect(b.getValue().rotation).toBe(1);
    expect(b.getCropState()?.crop.x).not.toBe(centre);
    expect(viewOf(b).frame()).not.toBeNull();
  });
});

const Slider = ({
  cropper,
  onValue,
}: {
  cropper: CropperApi;
  onValue: (zoom: ReturnType<typeof useZoom>) => void;
}) => {
  const zoom = useZoom({ cropper });
  useEffect(() => {
    onValue(zoom);
  });
  return null;
};

const idle = async (cropper: CropperApi): Promise<void> => {
  for (let i = 0; i < 100 && cropper.getState().interacting; i += 1) {
    await frames(1);
  }
};

const firePointer = (type: string, pointerId: number): void => {
  globalThis.dispatchEvent(new PointerEvent(type, { pointerId }));
};

const fireKey = (type: string, key: string): void => {
  globalThis.dispatchEvent(new KeyboardEvent(type, { key }));
};

describe("useZoom gesture", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("closes a change that no press opened", async () => {
    const cropper = photoCropper();
    const commit = vi.fn<() => void>();
    cropper.on("commit", commit);
    let zoom: ReturnType<typeof useZoom> | undefined;
    await render(
      <Slider
        cropper={cropper}
        onValue={(next) => {
          zoom = next;
        }}
      />
    );
    zoom?.onValueChange(2);
    expect(cropper.getState().interacting).toBe("zoom-control");
    await idle(cropper);
    expect(cropper.getState().interacting).toBeNull();
    await frames(2);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("keeps a motionless held drag open until the release", async () => {
    const cropper = photoCropper();
    let zoom: ReturnType<typeof useZoom> | undefined;
    await render(
      <Slider
        cropper={cropper}
        onValue={(next) => {
          zoom = next;
        }}
      />
    );
    firePointer("pointerdown", 1);
    zoom?.onValueChange(2);
    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });
    expect(cropper.getState().interacting).toBe("zoom-control");
    firePointer("pointerdown", 2);
    firePointer("pointerup", 2);
    expect(cropper.getState().interacting).toBe("zoom-control");
    firePointer("pointerup", 1);
    expect(cropper.getState().interacting).toBeNull();
  });

  it("ends the gesture when the window loses focus", async () => {
    const cropper = photoCropper();
    let zoom: ReturnType<typeof useZoom> | undefined;
    await render(
      <Slider
        cropper={cropper}
        onValue={(next) => {
          zoom = next;
        }}
      />
    );
    firePointer("pointerdown", 1);
    zoom?.onValueChange(2);
    globalThis.dispatchEvent(new Event("blur"));
    expect(cropper.getState().interacting).toBeNull();
    firePointer("pointerup", 1);
  });

  it("forgets a letter whose keyup a meta chord swallowed", async () => {
    const cropper = photoCropper();
    const commit = vi.fn<() => void>();
    cropper.on("commit", commit);
    let zoom: ReturnType<typeof useZoom> | undefined;
    await render(
      <Slider
        cropper={cropper}
        onValue={(next) => {
          zoom = next;
        }}
      />
    );
    fireKey("keydown", "Meta");
    fireKey("keydown", "c");
    fireKey("keyup", "Meta");
    firePointer("pointerdown", 1);
    zoom?.onValueChange(2);
    firePointer("pointerup", 1);
    expect(cropper.getState().interacting).toBeNull();
    await frames(2);
    expect(commit).toHaveBeenCalledOnce();
  });

  it("keeps a held pointer through a meta release", async () => {
    const cropper = photoCropper();
    let zoom: ReturnType<typeof useZoom> | undefined;
    await render(
      <Slider
        cropper={cropper}
        onValue={(next) => {
          zoom = next;
        }}
      />
    );
    firePointer("pointerdown", 1);
    zoom?.onValueChange(2);
    fireKey("keydown", "Meta");
    fireKey("keyup", "Meta");
    expect(cropper.getState().interacting).toBe("zoom-control");
    firePointer("pointerup", 1);
    expect(cropper.getState().interacting).toBeNull();
  });

  it("ends the gesture when the slider unmounts", async () => {
    const cropper = photoCropper();
    let zoom: ReturnType<typeof useZoom> | undefined;
    const screen = await render(
      <Slider
        cropper={cropper}
        onValue={(next) => {
          zoom = next;
        }}
      />
    );
    firePointer("pointerdown", 1);
    zoom?.onValueChange(2);
    await screen.unmount();
    expect(cropper.getState().interacting).toBeNull();
    firePointer("pointerup", 1);
  });
});

const ReadMax = memo(function ReadMax() {
  const { max } = useZoom();
  return <output id="zoom-max">{max}</output>;
});

const ZoomMaxHost = ({ top }: { top: number }) => (
  <Cropper.Root image={PHOTO} maxZoom={top}>
    <ReadMax />
  </Cropper.Root>
);

const press = (id: string, type: string, pointerId: number): void => {
  document.querySelector(id)?.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      button: 0,
      clientX: 100,
      clientY: 100,
      pointerId,
    })
  );
};

describe("a circle holds its aspect", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("refuses another aspect from setAspect and setValue", async () => {
    const api = createRef<CropperApi>();
    await render(
      <Cropper.Root actionsRef={api} image={PHOTO} shape="circle" />
    );
    await frames();
    const commit = vi.fn<() => void>();
    api.current?.on("commit", commit);
    api.current?.setAspect(2);
    await frames(2);
    expect(api.current?.getValue().aspect).toBe(1);
    expect(commit).not.toHaveBeenCalled();
    api.current?.setValue({ aspect: "free", rotation: 3 });
    await frames(2);
    expect(api.current?.getValue().aspect).toBe(1);
    expect(api.current?.getValue().rotation).toBe(3);
  });

  it("frees the aspect once the circle goes", async () => {
    const api = createRef<CropperApi>();
    const Host = ({ shape }: { shape: "rect" | "circle" }) => (
      <Cropper.Root actionsRef={api} image={PHOTO} shape={shape} />
    );
    const screen = await render(<Host shape="circle" />);
    await frames();
    await screen.rerender(<Host shape="rect" />);
    await frames();
    api.current?.setAspect(2);
    await frames();
    expect(api.current?.getValue().aspect).toBe(2);
  });

  it("starts clean on a cropper from useCropper with a photo in it", async () => {
    const commit = vi.fn<() => void>();
    const seen = createRef<CropperApi>();
    const Host = () => {
      const cropper = useCropper({ image: PHOTO, onValueCommit: commit });
      return (
        <Cropper.Root actionsRef={seen} cropper={cropper} shape="circle">
          <Cropper.Reset id="again">again</Cropper.Reset>
        </Cropper.Root>
      );
    };
    await render(<Host />);
    await frames(3);
    expect(commit).not.toHaveBeenCalled();
    expect(seen.current?.getValue().aspect).toBe(1);
    expect(seen.current?.getState().pristine).toBeTruthy();
    expect(document.querySelector<HTMLElement>("#again")?.hidden).toBeTruthy();
  });

  it("starts clean when the photo reaches a cropper from useCropper later", async () => {
    const commit = vi.fn<() => void>();
    const seen = createRef<CropperApi>();
    const Host = () => {
      const cropper = useCropper({ onValueCommit: commit });
      return (
        <Cropper.Root actionsRef={seen} cropper={cropper} shape="circle" />
      );
    };
    await render(<Host />);
    await frames();
    seen.current?.setImage(PHOTO);
    await frames(3);
    expect(commit).not.toHaveBeenCalled();
    expect(seen.current?.getState().pristine).toBeTruthy();
  });
});

describe("Root inside a drawer", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("marks itself so drawer libraries leave its touches alone", async () => {
    const screen = await render(<Cropper.Root id="drawer-root" />);
    const root = screen.container.querySelector<HTMLElement>("#drawer-root");
    expect(root?.dataset.vaulNoDrag).toBe("");
    expect(root?.dataset.baseUiSwipeIgnore).toBe("");
  });

  it("takes the marks off with null", async () => {
    const open: Record<string, unknown> = {
      "data-base-ui-swipe-ignore": null,
      "data-vaul-no-drag": null,
    };
    const screen = await render(<Cropper.Root id="drawer-root" {...open} />);
    const root = screen.container.querySelector<HTMLElement>("#drawer-root");
    expect(root?.dataset.vaulNoDrag).toBeUndefined();
    expect(root?.dataset.baseUiSwipeIgnore).toBeUndefined();
  });
});

describe("maxZoom changes", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("reach useZoom in a child that does not render again", async () => {
    const screen = await render(<ZoomMaxHost top={15} />);
    await frames();
    expect(document.querySelector("#zoom-max")?.textContent).toBe("15");
    await screen.rerender(<ZoomMaxHost top={5} />);
    await vi.waitFor(() => {
      expect(document.querySelector("#zoom-max")?.textContent).toBe("5");
    });
  });
});

describe("handle marks", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("leaves a refused second press off and clears it after both lift", async () => {
    const cropper = photoCropper();
    await render(
      <Cropper.Root cropper={cropper}>
        <Cropper.Viewport
          style={{ height: 300, position: "relative", width: 400 }}
        >
          <Cropper.Handle id="right" position="right" />
          <Cropper.Handle id="left" position="left" />
          <Cropper.Handle id="top" position="top" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    await frames();
    press("#right", "pointerdown", 1);
    press("#left", "pointerdown", 2);
    await frames();
    expect(isActive("#right")).toBeTruthy();
    expect(isActive("#left")).toBeFalsy();
    press("#left", "pointerup", 2);
    press("#right", "pointerup", 1);
    await frames();
    press("#top", "pointerdown", 3);
    await frames();
    expect(isActive("#top")).toBeTruthy();
    expect(isActive("#left")).toBeFalsy();
    expect(isActive("#right")).toBeFalsy();
    press("#top", "pointerup", 3);
  });
});

describe("text selection on the sliders", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("turns off with both spellings on Dial and Zoom", async () => {
    const screen = await render(
      <Cropper.Root image={PHOTO}>
        <Cropper.Dial aria-label="Dial" />
        <Cropper.Zoom aria-label="Zoom" />
      </Cropper.Root>
    );
    for (const name of ["dial", "zoom"]) {
      const { style } = screen.container.querySelector<HTMLElement>(
        `[data-zriz-item="${name}"]`
      ) ?? { style: null };
      expect(style?.getPropertyValue("user-select")).toBe("none");
      expect(style?.getPropertyValue("-webkit-user-select")).toBe("none");
    }
  });
});
