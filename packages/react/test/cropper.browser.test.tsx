import { createCropper } from "@zriz/core";
import type { CropValue, Cropper as CropperApi } from "@zriz/core";
import { ZrizError, imageOf, viewOf } from "@zriz/core/dom";
import type { LoadedImage } from "@zriz/core/dom";
import {
  Profiler,
  createRef,
  memo,
  useEffect,
  useLayoutEffect,
  useState,
} from "react";
import type { Ref } from "react";
import { createPortal, flushSync } from "react-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";

import { useCropper, useCropperValue, useZoom } from "../src";
import type { RootProps } from "../src";
import * as Cropper from "../src/cropper";

const photoCropper = () =>
  createCropper({ image: { height: 3000, width: 4000 } });

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

type AvatarProps = {
  src: Blob;
  actionsRef: Ref<CropperApi>;
};

const Avatar = ({ src, actionsRef }: AvatarProps) => (
  <Cropper.Root actionsRef={actionsRef} src={src}>
    <Cropper.Viewport
      id="viewport"
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Image alt="" />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop" />
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

  it("passes previewEdge and the svg options to the load", async () => {
    const preview = vi.fn<(image: LoadedImage) => void>();
    const refused = vi.fn<(error: ZrizError) => void>();
    const loads: LoadedImage[] = [];
    const errors: unknown[] = [];
    const plain = new Blob(
      ['<svg xmlns="http://www.w3.org/2000/svg" width="64" height="32"/>'],
      { type: "image/svg+xml" }
    );
    const html = new Blob(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><foreignObject width="200" height="100"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject></svg>',
      ],
      { type: "image/svg+xml" }
    );

    await render(
      <>
        <Cropper.Root onLoad={preview} previewEdge={64} src={await photo()}>
          <Cropper.Viewport style={{ height: 300, width: 400 }}>
            <Cropper.Image />
          </Cropper.Viewport>
        </Cropper.Root>
        <Cropper.Root onError={refused} src={plain} svg={false}>
          <Cropper.Viewport style={{ height: 300, width: 400 }}>
            <Cropper.Image />
          </Cropper.Viewport>
        </Cropper.Root>
        <Cropper.Root
          src={html}
          onLoad={(image) => {
            loads.push(image);
          }}
          onError={(error) => {
            errors.push(error);
          }}
        />
      </>
    );

    await vi.waitFor(() => {
      expect(preview).toHaveBeenCalledOnce();
      expect(refused).toHaveBeenCalledOnce();
    });

    await expect.poll(() => loads.length + errors.length).toBe(1);
    const [image] = preview.mock.calls[0] ?? [];

    expect(image?.preview.width).toBe(64);
    expect(image?.width).toBe(400);
    expect(refused.mock.calls[0]?.[0].code).toBe("decode");
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

type ShownProps = { cropper?: CropperApi };

const Shown = ({ cropper }: ShownProps) => (
  <p id="shown">{JSON.stringify(useCropperValue(cropper))}</p>
);

const ShownValue = memo(Shown);

const shownValue = (): unknown =>
  JSON.parse(document.querySelector("#shown")?.textContent ?? "null");

describe(useCropperValue, () => {
  afterEach(cleanup);

  it("shows the props applied when the photo arrived, on a shared cropper and from src", async () => {
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
    await cleanup();

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

const near = (expected: number): unknown => expect.closeTo(expected, 6);

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

const CIRCLE_PHOTO = { height: 800, width: 1000 };

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

  it("holds props set while disabled and applies them once enabled", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();

    type EditorProps = {
      disabled: boolean;
      zoom: number;
    };

    const Editor = ({ disabled, zoom }: EditorProps) => (
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
    await screen.unmount();

    const cropper = createCropper({ disabled: true, image: PHOTO });

    await render(
      <Cropper.Root aspect={1} cropper={cropper} rotation={5} zoom={2} />
    );

    await frames(2);
    expect(cropper.getValue().aspect).toBe("free");
    cropper.setOptions({ disabled: false });
    await frames(2);

    expect({
      aspect: cropper.getValue().aspect,
      rotation: cropper.getValue().rotation,
      zoom: cropper.getZoom(),
    }).toStrictEqual({ aspect: 1, rotation: 5, zoom: near(2) });
  });

  it("does not bring back an old prop or aspect when disabled toggles", async () => {
    const api = createRef<CropperApi>();
    const { commits, onValueCommit } = events();

    type HostProps = { disabled: boolean };

    const Host = ({ disabled }: HostProps) => (
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

    expect({
      aspect: cropper?.getValue().aspect,
      commits,
      rotation: cropper?.getValue().rotation,
    }).toStrictEqual({ aspect: held?.aspect, commits: [], rotation: 12 });

    await screen.unmount();

    const reset = createRef<CropperApi>();

    type ResetHostProps = { aspect: number; disabled: boolean };

    const ResetHost = ({ aspect, disabled }: ResetHostProps) => (
      <Cropper.Root
        actionsRef={reset}
        aspect={aspect}
        disabled={disabled}
        image={PHOTO}
      />
    );
    const after = await render(<ResetHost aspect={1} disabled={false} />);

    await frames(2);
    await after.rerender(<ResetHost aspect={16 / 9} disabled={false} />);
    await frames(2);
    reset.current?.reset();
    const target = reset.current?.getValue().aspect;

    await after.rerender(<ResetHost aspect={16 / 9} disabled />);
    await after.rerender(<ResetHost aspect={16 / 9} disabled={false} />);
    await frames(2);
    expect([target, reset.current?.getValue().aspect]).toStrictEqual([1, 1]);
    await after.unmount();

    const circle = createRef<CropperApi>();

    type CircleHostProps = { disabled: boolean; shape: "rect" | "circle" };

    const CircleHost = ({ disabled, shape }: CircleHostProps) => (
      <Cropper.Root
        actionsRef={circle}
        disabled={disabled}
        image={CIRCLE_PHOTO}
        shape={shape}
      />
    );
    const round = await render(<CircleHost disabled={false} shape="rect" />);

    await frames(2);
    circle.current?.setAspect(4 / 3);
    await frames(2);
    await round.rerender(<CircleHost disabled={false} shape="circle" />);
    await frames(2);
    await round.rerender(<CircleHost disabled shape="circle" />);
    await frames(2);
    await round.rerender(<CircleHost disabled shape="rect" />);
    await frames(2);
    await round.rerender(<CircleHost disabled={false} shape="rect" />);
    await frames(2);
    expect(circle.current?.getValue().aspect).toBe(4 / 3);
  });

  it("applies props at load without events, and later ones with events", async () => {
    const api = createRef<CropperApi>();
    const { changes, commits, onValueChange, onValueCommit } = events();

    type HostProps = { aspect: number; zoom: number };

    const Host = ({ aspect, zoom }: HostProps) => (
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

    expect({
      aspect: api.current?.getValue().aspect,
      rotation: api.current?.getValue().rotation,
      zoom: api.current?.getZoom(),
    }).toStrictEqual({
      aspect: near(16 / 9),
      rotation: 5,
      zoom: near(2),
    });

    api.current?.panBy(0.01, 0);
    await frames(2);
    expect(changes).toStrictEqual(["pan"]);
    changes.length = 0;
    commits.length = 0;
    await screen.rerender(<Host aspect={16 / 9} zoom={3} />);
    await frames(3);
    expect([changes, commits]).toStrictEqual([[], ["controlled"]]);
  });

  it("reports aspect for a preset that also changes rotation or zoom", async () => {
    const api = createRef<CropperApi>();
    const { changes, commits, onValueChange, onValueCommit } = events();

    type HostProps = {
      aspect: number;
      rotation: number;
    };

    const Host = ({ aspect, rotation }: HostProps) => (
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
    expect(changes).toStrictEqual([]);
    expect(commits).toStrictEqual(["aspect"]);
    expect(api.current?.getValue().rotation).toBe(5);
  });

  it("applies a prop that was released and comes back at its old value", async () => {
    const api = createRef<CropperApi>();

    type HostProps = { locked: boolean };

    const Host = ({ locked }: HostProps) => (
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

    type HostProps = { maxZoom: number; min: number };

    const Host = ({ maxZoom, min }: HostProps) => (
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

  it("uses first render props as the reset target and sends nothing on load", async () => {
    const api = createRef<CropperApi>();
    const change = vi.fn<() => void>();
    const commit = vi.fn<() => void>();
    const screen = await render(
      <Cropper.Root
        actionsRef={api}
        image={PHOTO}
        onValueChange={change}
        onValueCommit={commit}
        zoom={2}
      >
        <Cropper.Reset>reset</Cropper.Reset>
      </Cropper.Root>
    );

    await frames(3);
    const reset = screen.container.querySelector("button");

    expect({
      changes: change.mock.calls.length,
      commits: commit.mock.calls.length,
      hidden: reset?.hidden,
      zoom: api.current?.getZoom(),
    }).toStrictEqual({ changes: 0, commits: 0, hidden: true, zoom: 2 });

    api.current?.setZoom(5);
    await frames(3);
    expect(reset?.hidden).toBeFalsy();
    reset?.click();
    await frames(3);

    expect({
      hidden: reset?.hidden,
      zoom: api.current?.getZoom(),
    }).toStrictEqual({ hidden: true, zoom: near(2) });

    await screen.unmount();

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

    expect({
      aspect: cropper.getValue().aspect,
      pristine: cropper.getState().pristine,
      rotation: cropper.getValue().rotation,
    }).toStrictEqual({
      aspect: near(16 / 9),
      pristine: true,
      rotation: 3,
    });
  });
});

describe("callbacks on a shared cropper", () => {
  afterEach(async () => {
    await cleanup();
  });

  it.each([
    ["a Root", { aspect: 1, rotation: 10 }],
    ["a circle Root", { rotation: 10, shape: "circle" as const }],
  ])("drops the reset target of %s that left", async (_name, props) => {
    const cropper = photoCropper();
    const screen = await render(<Cropper.Root cropper={cropper} {...props} />);

    await frames(2);
    await screen.unmount();
    await render(<Cropper.Root cropper={cropper} />);
    cropper.reset();
    await frames(2);
    const { aspect, rotation } = cropper.getValue();

    expect({ aspect, rotation }).toStrictEqual({ aspect: "free", rotation: 0 });
  });

  it("stops calling a closed Root, gives the creator's callback back and keeps a second Root's", async () => {
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

    const shared = createCropper({ image: PHOTO });
    const stays = vi.fn<() => void>();

    type HostProps = { both: boolean };

    const Host = ({ both }: HostProps) => (
      <>
        {both ? <Cropper.Root cropper={shared} /> : null}
        <Cropper.Root cropper={shared} onValueCommit={stays} />
      </>
    );
    const pair = await render(<Host both />);

    await pair.rerender(<Host both={false} />);
    shared.setRotation(2);
    await frames(2);
    expect(stays).toHaveBeenCalledOnce();
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

const reduced = (container: Element): boolean =>
  container.querySelector("[data-reduced-motion]") !== null;

describe("reduced motion attribute", () => {
  afterEach(async () => {
    await cleanup();
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
});

type SwapHostProps = { cropper: CropperApi };

const SwapHost = ({ cropper }: SwapHostProps) => (
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

type SliderProps = {
  cropper: CropperApi;
  onValue: (zoom: ReturnType<typeof useZoom>) => void;
};

const Slider = ({ cropper, onValue }: SliderProps) => {
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

  it("closes a change no press opened, holds a motionless press until its release, and ends at unmount", async () => {
    const cropper = photoCropper();
    const commit = vi.fn<() => void>();
    const seen: (string | null)[] = [];

    const note = (): void => {
      seen.push(cropper.getState().interacting);
    };

    cropper.on("commit", commit);
    let zoom: ReturnType<typeof useZoom> | undefined;
    const screen = await render(
      <Slider
        cropper={cropper}
        onValue={(next) => {
          zoom = next;
        }}
      />
    );

    zoom?.onValueChange(2);
    note();
    await idle(cropper);
    note();
    await frames(2);
    expect(commit).toHaveBeenCalledOnce();

    firePointer("pointerdown", 1);
    zoom?.onValueChange(3);

    await new Promise((resolve) => {
      setTimeout(resolve, 250);
    });

    note();
    firePointer("pointerdown", 2);
    firePointer("pointerup", 2);
    note();
    firePointer("pointerup", 1);
    note();

    firePointer("pointerdown", 1);
    zoom?.onValueChange(2);
    await screen.unmount();
    note();
    firePointer("pointerup", 1);

    expect(seen).toStrictEqual([
      "zoom-control",
      null,
      "zoom-control",
      "zoom-control",
      null,
      null,
    ]);
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

  it("forgets a letter a meta chord swallowed and keeps a held pointer through a meta release", async () => {
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

    firePointer("pointerdown", 1);
    zoom?.onValueChange(3);
    fireKey("keydown", "Meta");
    fireKey("keyup", "Meta");
    expect(cropper.getState().interacting).toBe("zoom-control");
    firePointer("pointerup", 1);
    expect(cropper.getState().interacting).toBeNull();
  });
});

const ReadMax = memo(function ReadMax() {
  const { max } = useZoom();

  return <output id="zoom-max">{max}</output>;
});

type ZoomMaxHostProps = { top: number };

const ZoomMaxHost = ({ top }: ZoomMaxHostProps) => (
  <Cropper.Root image={PHOTO} maxZoom={top}>
    <ReadMax />
  </Cropper.Root>
);

const LATE_MS = 100;
const ANSWER_WINDOW_MS = 2200;

type LateParent = {
  api: { current: CropperApi | null };
  commits: number[];
  trail: number[];
  press: () => Promise<void>;
  prop: () => number;
  write: (rotation: number) => Promise<void>;
};

const lateParent = async (
  wait: number,
  shape: (rotation: number) => number = (rotation) => rotation,
  mirror = true
): Promise<LateParent> => {
  const api = createRef<CropperApi>();
  const commits: number[] = [];
  const trail: number[] = [];
  const state: { prop: number; write: (rotation: number) => void } = {
    prop: 0,
    write: () => {},
  };

  const Host = () => {
    const [rotation, setRotation] = useState(0);

    useLayoutEffect(() => {
      state.prop = rotation;
      state.write = setRotation;
    }, [rotation]);

    return (
      <Cropper.Root
        actionsRef={api}
        image={PHOTO}
        onValueChange={(value) => {
          if (mirror) {
            setTimeout(() => {
              setRotation(shape(value.rotation));
            }, wait);
          }
        }}
        onValueCommit={(value) => {
          commits.push(value.rotation);
        }}
        rotation={rotation}
      >
        <Cropper.Dial aria-label="straighten" id="late-dial" />
      </Cropper.Root>
    );
  };

  await render(<Host />);
  await frames(3);

  api.current?.on("frame", ({ value }) => {
    if (trail.at(-1) !== value.rotation) {
      trail.push(value.rotation);
    }
  });

  return {
    api,
    commits,
    press: async () => {
      const dial = document.querySelector("#late-dial");

      dial?.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "ArrowRight",
        })
      );

      dial?.dispatchEvent(
        new KeyboardEvent("keyup", {
          bubbles: true,
          cancelable: true,
          key: "ArrowRight",
        })
      );

      await frames(2);
    },
    prop: () => state.prop,
    trail,
    write: async (rotation) => {
      flushSync(() => {
        state.write(rotation);
      });

      await frames(3);
    },
  };
};

const quietFor = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

type AnswerWindow = { close: () => Promise<void> };

const realNow = performance.now.bind(performance);

const afterWindow = (): number => realNow() + ANSWER_WINDOW_MS;

const answerWindow = (): AnswerWindow => {
  const realTimeout = globalThis.setTimeout;
  const pending = new Map<ReturnType<typeof setTimeout>, () => void>();

  vi.spyOn(globalThis, "setTimeout").mockImplementation((run, ms) => {
    const watched =
      (ms ?? 0) >= 1000 &&
      new Error("timer").stack?.includes("use-cropper") === true;
    const id = realTimeout(() => {
      pending.delete(id);

      if (typeof run === "function") {
        run();
      }
    }, ms);

    if (watched && typeof run === "function") {
      pending.set(id, () => {
        run();
      });
    }

    return id;
  });

  return {
    close: async () => {
      vi.spyOn(performance, "now").mockImplementation(afterWindow);

      for (const [id, fire] of pending) {
        pending.delete(id);
        clearTimeout(id);
        fire();
      }

      await frames(2);
    },
  };
};

type Mirrored = { commits: number[]; rotation: number; trail: number[] };

const rotationMirror =
  (wait: number, settle: number, closing = false) =>
  async (): Promise<Mirrored> => {
    const answers = answerWindow();
    const parent = await lateParent(wait);

    await parent.press();
    await parent.press();
    await expect.poll(parent.prop, { timeout: 2000 }).toBe(2);
    await quietFor(settle);

    if (closing) {
      await answers.close();
    }

    return {
      commits: parent.commits,
      rotation: parent.api.current?.getValue().rotation ?? 0,
      trail: parent.trail,
    };
  };

const valueMirror = async (): Promise<Mirrored> => {
  const api = createRef<CropperApi>();
  const trail: number[] = [];
  const commits: number[] = [];
  const held: { value?: CropValue | undefined } = {};

  const Host = () => {
    const [value, setValue] = useState<CropValue>();

    useLayoutEffect(() => {
      held.value = value;
    });

    return (
      <Cropper.Root
        actionsRef={api}
        image={PHOTO}
        onValueChange={(next) => {
          setTimeout(() => {
            setValue(next);
          }, LATE_MS);
        }}
        onValueCommit={(next) => {
          commits.push(next.rotation);
        }}
        {...(value ? { value } : {})}
      />
    );
  };

  await render(<Host />);
  await frames(3);

  api.current?.on("frame", (frame) => {
    if (trail.at(-1) !== frame.value.rotation) {
      trail.push(frame.value.rotation);
    }
  });

  api.current?.setRotation(1);
  await frames(1);
  api.current?.setRotation(2);
  await expect.poll(() => held.value?.rotation).toBe(2);
  await quietFor(LATE_MS * 3);

  return {
    commits,
    rotation: api.current?.getValue().rotation ?? 0,
    trail,
  };
};

type Answered = {
  after?: () => void;
  read: () => unknown;
  write: () => Promise<void>;
};

const answeredRotation = async (): Promise<Answered> => {
  const parent = await lateParent(0, undefined, false);

  for (let count = 0; count < 5; count += 1) {
    await parent.press();
  }

  return {
    after: () => {
      expect(parent.commits).toStrictEqual([1, 2, 3, 4, 5, 3]);
    },
    read: () => parent.api.current?.getValue().rotation,
    write: async () => {
      await parent.write(3);
    },
  };
};

const answeredTurns = async (): Promise<Answered> => {
  const api = createRef<CropperApi>();
  const state: { write: (aspect: number) => void } = { write: () => {} };

  const Host = () => {
    const [aspect, setAspect] = useState(16 / 9);

    useLayoutEffect(() => {
      state.write = setAspect;
    }, []);

    return (
      <Cropper.Root
        actionsRef={api}
        aspect={aspect}
        image={PHOTO}
        onValueCommit={() => {}}
      >
        <Cropper.Rotate id="late-turn" />
      </Cropper.Root>
    );
  };

  await render(<Host />);
  await frames(3);
  document.querySelector<HTMLElement>("#late-turn")?.click();
  await frames(2);
  document.querySelector<HTMLElement>("#late-turn")?.click();
  await frames(2);
  expect(api.current?.getValue().aspect).toBeCloseTo(16 / 9);

  return {
    read: () => api.current?.getValue().aspect,
    write: async () => {
      flushSync(() => {
        state.write(9 / 16);
      });

      await frames(2);
    },
  };
};

const answeredItems = async (): Promise<Answered> => {
  const api = createRef<CropperApi>();
  const state: { write: (aspect: number | "free") => void } = {
    write: () => {},
  };

  const Host = () => {
    const [aspect, setAspect] = useState<number | "free">("free");

    useLayoutEffect(() => {
      state.write = setAspect;
    }, []);

    return (
      <Cropper.Root
        actionsRef={api}
        aspect={aspect}
        image={PHOTO}
        onValueCommit={() => {}}
      >
        <Cropper.AspectGroup aria-label="aspect">
          <Cropper.AspectItem id="late-square" value={1} />
          <Cropper.AspectItem id="late-wide" value={2} />
        </Cropper.AspectGroup>
      </Cropper.Root>
    );
  };

  await render(<Host />);
  await frames(3);
  document.querySelector<HTMLElement>("#late-square")?.click();
  await frames(2);
  document.querySelector<HTMLElement>("#late-wide")?.click();
  await frames(2);

  return {
    read: () => api.current?.getValue().aspect,
    write: async () => {
      flushSync(() => {
        state.write(1);
      });

      await frames(2);
    },
  };
};

const answeredValue = async (): Promise<Answered> => {
  const api = createRef<CropperApi>();
  const reports: CropValue[] = [];
  const state: { write: (value: CropValue) => void } = { write: () => {} };

  const Host = () => {
    const [value, setValue] = useState<CropValue>();

    useLayoutEffect(() => {
      state.write = setValue;
    }, []);

    return (
      <Cropper.Root
        actionsRef={api}
        image={PHOTO}
        onValueChange={(next) => {
          reports.push(next);
        }}
        {...(value ? { value } : {})}
      />
    );
  };

  await render(<Host />);
  await frames(3);
  api.current?.setRotation(1);
  await frames(1);
  api.current?.setRotation(2);
  await frames(1);

  return {
    read: () => api.current?.getValue().rotation,
    write: async () => {
      const [first] = reports;

      if (first) {
        flushSync(() => {
          state.write(first);
        });
      }

      await frames(2);
    },
  };
};

describe("a controlled parent that answers late", () => {
  afterEach(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  it.each([
    ["a parent a little late", rotationMirror(LATE_MS, LATE_MS * 4)],
    ["a parent slower than the first press", rotationMirror(400, 600)],
    ["a mirror once the window closes", rotationMirror(400, 600, true)],
    ["a value object mirror", valueMirror],
  ])("never rewinds %s", async (_name, run) => {
    const out = await run();

    expect(out.trail).toStrictEqual([1, 2]);
    expect(out.commits).toStrictEqual([1, 2]);
    expect(out.rotation).toBe(2);
  });

  it("settles on the last press when answers come back in another order", async () => {
    const api = createRef<CropperApi>();
    const commits: number[] = [];
    let answers = 0;

    const Host = () => {
      const [rotation, setRotation] = useState(0);

      return (
        <Cropper.Root
          actionsRef={api}
          image={PHOTO}
          onValueChange={(value) => {
            answers += 1;

            setTimeout(
              () => {
                setRotation(value.rotation);
              },
              answers % 2 === 1 ? 130 : 70
            );
          }}
          onValueCommit={(value) => {
            commits.push(value.rotation);
          }}
          rotation={rotation}
        />
      );
    };

    await render(<Host />);
    await frames(3);
    api.current?.setRotation(1);
    await frames(1);
    api.current?.setRotation(2);
    await frames(1);
    api.current?.setRotation(3);
    await quietFor(600);
    const settled = commits.length;

    await quietFor(600);
    expect(commits).toHaveLength(settled);
    expect(settled).toBeLessThan(12);
  });

  it("converges on a parent that rounds what it hears", async () => {
    const parent = await lateParent(LATE_MS, Math.round);
    const cropper = parent.api.current;

    cropper?.setRotation(1.3);
    await frames(1);
    cropper?.setRotation(2.3);
    await quietFor(LATE_MS * 6);
    const settled = parent.commits.length;

    await quietFor(LATE_MS * 6);
    expect(parent.commits).toHaveLength(settled);
    expect(settled).toBeLessThanOrEqual(4);
  });

  it("treats a reported value as an answer within 2 s of the last report, and moves the crop after", async () => {
    const within = await lateParent(0, undefined, false);

    await within.press();
    await within.press();
    await within.write(1);
    expect(within.api.current?.getValue().rotation).toBe(2);
    await cleanup();

    const after = await lateParent(0, undefined, false);

    await after.press();
    await after.press();
    const now = performance.now();
    const later = vi.spyOn(performance, "now");

    later.mockReturnValue(now + 3000);
    await after.write(1);
    expect(after.api.current?.getValue().rotation).toBe(1);
  });

  it.each([
    ["a rotation preset equal to an earlier report", answeredRotation, 5, 3],
    ["an aspect reported by two turns", answeredTurns, 16 / 9, 9 / 16],
    ["an aspect reported by aspect items", answeredItems, 2, 1],
    ["a value object reported earlier", answeredValue, 2, 1],
  ])(
    "applies %s when the answer window closes",
    async (_name, setup, held, applied) => {
      const answers = answerWindow();
      const parent = await setup();

      await parent.write();
      expect(parent.read()).toBeCloseTo(held);
      await answers.close();
      expect(parent.read()).toBe(applied);
      parent.after?.();
    }
  );

  it("keeps a press made after the parent wrote a reported value", async () => {
    const answers = answerWindow();
    const parent = await lateParent(0, undefined, false);

    await parent.press();
    await parent.press();
    await parent.write(1);
    await parent.press();
    await answers.close();
    expect(parent.api.current?.getValue().rotation).toBe(3);
  });

  it("forgets a held prop when the image leaves", async () => {
    const api = createRef<CropperApi>();
    const state: { write: (rotation: number) => void } = { write: () => {} };

    type HostProps = { image: { height: number; width: number } | null };

    const Host = ({ image }: HostProps) => {
      const [rotation, setRotation] = useState(0);

      useLayoutEffect(() => {
        state.write = setRotation;
      }, []);

      return (
        <Cropper.Root
          actionsRef={api}
          image={image}
          onValueCommit={() => {}}
          rotation={rotation}
        />
      );
    };

    const answers = answerWindow();
    const screen = await render(<Host image={PHOTO} />);

    await frames(3);
    api.current?.setRotation(1);
    await frames(1);
    api.current?.setRotation(2);
    await frames(1);

    flushSync(() => {
      state.write(1);
    });

    await frames(2);
    await screen.rerender(<Host image={null} />);
    await frames(2);
    await screen.rerender(<Host image={PHOTO} />);
    await frames(2);
    api.current?.setRotation(7, { emit: false });
    await answers.close();
    expect(api.current?.getValue().rotation).toBe(7);
  });

  it("sends no change for a prop that lands exactly, and reports what zriz applied when it lands elsewhere", async () => {
    const changes: number[] = [];
    const commits: number[] = [];

    type HostProps = { rotation: number };

    const Host = ({ rotation }: HostProps) => (
      <Cropper.Root
        image={PHOTO}
        onValueChange={(value) => {
          changes.push(value.rotation);
        }}
        onValueCommit={(value) => {
          commits.push(value.rotation);
        }}
        rotation={rotation}
      />
    );
    const screen = await render(<Host rotation={0} />);

    await frames(3);
    await screen.rerender(<Host rotation={10} />);
    await frames(3);
    expect(changes).toStrictEqual([]);
    expect(commits).toStrictEqual([10]);
    await screen.rerender(<Host rotation={60} />);
    await frames(3);
    expect(changes).toStrictEqual([45]);
  });
});

const leaveCircle = async (
  props: Partial<RootProps>,
  first: "rect" | "circle",
  before?: (cropper: CropperApi) => void
) => {
  const api = createRef<CropperApi>();

  type HostProps = { shape: "rect" | "circle" };

  const Host = ({ shape }: HostProps) => (
    <Cropper.Root
      actionsRef={api}
      image={CIRCLE_PHOTO}
      shape={shape}
      {...props}
    />
  );
  const screen = await render(<Host shape={first} />);

  await frames(2);

  if (api.current) {
    before?.(api.current);
  }

  await frames(2);

  if (first === "rect") {
    await screen.rerender(<Host shape="circle" />);
    await frames(2);
    expect(api.current?.getValue().aspect).toBe(1);
  }

  await screen.rerender(<Host shape="rect" />);
  await frames(2);
  const left = api.current?.getValue().aspect;
  const plan = api.current?.getPixelCrop();

  api.current?.reset();
  await frames(2);

  return {
    left,
    pixels: [plan?.width, plan?.height],
    reset: api.current?.getValue().aspect,
  };
};

const ANY: unknown = expect.anything();

const setFourThirds = (cropper: CropperApi): void => {
  cropper.setAspect(4 / 3);
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

  it("stays round through reset without marking it edited, and frees the aspect once it goes", async () => {
    const api = createRef<CropperApi>();

    type HostProps = { shape: "rect" | "circle" };

    const Host = ({ shape }: HostProps) => (
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
    await screen.rerender(<Host shape="rect" />);
    await frames();
    api.current?.setAspect(2);
    await frames();
    expect(api.current?.getValue().aspect).toBe(2);
  });

  it.each([
    [
      "a free crop held before the circle",
      {},
      "rect",
      undefined,
      "free",
      "free",
      ANY,
    ],
    [
      "an aspect set before the circle",
      {},
      "rect",
      setFourThirds,
      4 / 3,
      "free",
      [1000, 750],
    ],
    [
      "the default aspect",
      { defaultValue: { aspect: 16 / 9 } },
      "rect",
      undefined,
      16 / 9,
      16 / 9,
      ANY,
    ],
    [
      "free on a Root that started round",
      {},
      "circle",
      undefined,
      "free",
      "free",
      ANY,
    ],
    [
      "defaultValue on a Root that started round",
      { defaultValue: { aspect: 16 / 9 } },
      "circle",
      undefined,
      16 / 9,
      16 / 9,
      ANY,
    ],
    ["an aspect prop", { aspect: 4 / 3 }, "rect", undefined, 4 / 3, 4 / 3, ANY],
  ] as const)(
    "restores %s when the circle goes, and reset follows",
    async (_name, props, first, before, left, reset, pixels) => {
      const out = await leaveCircle(props, first, before);

      expect(out).toStrictEqual({ left, pixels, reset });
    }
  );

  it("restores free with no commit when the circle goes before the photo", async () => {
    const api = createRef<CropperApi>();
    const commit = vi.fn<() => void>();

    type HostProps = { shape: "rect" | "circle" };

    const Host = ({ shape }: HostProps) => (
      <Cropper.Root actionsRef={api} onValueCommit={commit} shape={shape} />
    );
    const screen = await render(<Host shape="circle" />);

    await frames(2);
    await screen.rerender(<Host shape="rect" />);
    await frames(2);
    api.current?.setImage(CIRCLE_PHOTO);
    await frames(3);
    expect(api.current?.getValue().aspect).toBe("free");
    expect(commit).not.toHaveBeenCalled();
  });

  it("starts clean on a cropper from useCropper, with the photo in it or arriving later", async () => {
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

    const screen = await render(<Host />);

    await frames(3);

    expect({
      aspect: seen.current?.getValue().aspect,
      commits: commit.mock.calls.length,
      hidden: document.querySelector<HTMLElement>("#again")?.hidden,
      pristine: seen.current?.getState().pristine,
    }).toStrictEqual({ aspect: 1, commits: 0, hidden: true, pristine: true });

    await screen.unmount();

    const later = vi.fn<() => void>();
    const empty = createRef<CropperApi>();

    const Empty = () => {
      const cropper = useCropper({ onValueCommit: later });

      return (
        <Cropper.Root actionsRef={empty} cropper={cropper} shape="circle" />
      );
    };

    await render(<Empty />);
    await frames();
    empty.current?.setImage(PHOTO);
    await frames(3);
    expect(later).not.toHaveBeenCalled();
    expect(empty.current?.getState().pristine).toBeTruthy();
  });
});

describe("Root inside a drawer", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("marks itself so drawer libraries leave its touches alone, and null takes the marks off", async () => {
    const open: Record<string, unknown> = {
      "data-base-ui-swipe-ignore": null,
      "data-vaul-no-drag": null,
    };
    const screen = await render(
      <>
        <Cropper.Root id="drawer-root" />
        <Cropper.Root id="drawer-open" {...open} />
      </>
    );
    const root = screen.container.querySelector<HTMLElement>("#drawer-root");
    const opened = screen.container.querySelector<HTMLElement>("#drawer-open");

    expect(root?.dataset.vaulNoDrag).toBe("");
    expect(root?.dataset.baseUiSwipeIgnore).toBe("");
    expect(opened?.dataset.vaulNoDrag).toBeUndefined();
    expect(opened?.dataset.baseUiSwipeIgnore).toBeUndefined();
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
