import "../../core/src/styles.css";
import { createCropper } from "@zriz/core";
import type { CropValue, Cropper as CropperApi } from "@zriz/core";
import { attachImage, imageOf, loadImage } from "@zriz/core/dom";
import type { LoadedImage, ZrizError } from "@zriz/core/dom";
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
} from "react";
import type { ReactNode, Ref } from "react";
import { flushSync } from "react-dom";
import { createRoot, hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "vitest-browser-react";
import { commands, userEvent } from "vitest/browser";

import { useCropper, useCropperValue } from "../src";
import * as Cropper from "../src/cropper";

const PHOTO = { height: 3000, width: 4000 };

const photoCropper = () => createCropper({ image: PHOTO });

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
  onValueCommit?: (value: CropValue) => void;
};

const Avatar = ({ src, actionsRef, onValueCommit }: AvatarProps) => (
  <Cropper.Root actionsRef={actionsRef} onValueCommit={onValueCommit} src={src}>
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

const mountBare = (tree: ReactNode): (() => void) => {
  const container = document.createElement("div");
  const root = createRoot(container);

  document.body.append(container);

  flushSync(() => {
    root.render(tree);
  });

  return () => {
    flushSync(() => {
      root.unmount();
    });

    container.remove();
  };
};

const mountedAvatar = async (src: Blob): Promise<WeakRef<Element>> => {
  const api = createRef<CropperApi>();
  const unmount = mountBare(
    <StrictMode>
      <Avatar actionsRef={api} src={src} />
    </StrictMode>
  );

  await ready(api);
  const node = document.querySelector("#viewport");

  if (!node) {
    throw new Error("no viewport");
  }

  const viewport = new WeakRef(node);

  unmount();

  return viewport;
};

const collected = async (ref: WeakRef<Element>): Promise<boolean> => {
  for (let i = 0; i < 40 && ref.deref(); i += 1) {
    mountBare(<Cropper.Root />)();
    await frames(2);
    await commands.gc();
  }

  return ref.deref() === undefined;
};

describe("rendering under StrictMode", () => {
  afterEach(async () => {
    await cleanup();
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

  it("lets a StrictMode unmount collect the viewport", async () => {
    const viewport = await mountedAvatar(await photo());

    await expect(collected(viewport)).resolves.toBeTruthy();
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
});

const objectRef = () => {
  const api = createRef<CropperApi>();

  return { current: () => api.current, ref: api };
};

const functionRef = () => {
  const seen: (CropperApi | null)[] = [];

  return {
    current: () => seen.at(-1) ?? null,
    ref: (next: CropperApi | null): void => {
      seen.push(next);
    },
  };
};

describe("actionsRef and the cropper's lifetime", () => {
  afterEach(async () => {
    await cleanup();
  });

  it.each([
    ["an object actionsRef", objectRef, false],
    ["an object actionsRef on a shared cropper", objectRef, true],
    ["a function actionsRef", functionRef, false],
  ])("keeps %s across a keyed remount", async (_name, make, shared) => {
    const { current, ref } = make();
    const cropper = shared ? createCropper({ image: PHOTO }) : undefined;
    const props = cropper ? { cropper } : { image: PHOTO };
    const screen = await render(
      <Cropper.Root key="a" actionsRef={ref} {...props} />
    );
    const first = current();

    await screen.rerender(<Cropper.Root key="b" actionsRef={ref} {...props} />);
    await frames(2);
    const next = current();

    expect({
      live: next !== null,
      same: next === first,
      shared: next === cropper,
    }).toStrictEqual({ live: true, same: shared, shared });

    await screen.unmount();
    expect(current()).toBeNull();
    cropper?.destroy();
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

  it("frees its own cropper's photo when an external cropper takes over", async () => {
    const src = await photo();
    const api = createRef<CropperApi>();
    const external = createCropper();
    const tree = (cropper?: CropperApi) => (
      <Cropper.Root actionsRef={api} cropper={cropper} src={src}>
        <Cropper.Viewport
          style={{ height: 300, padding: 20, position: "relative", width: 400 }}
        >
          <Cropper.Image alt="" />
        </Cropper.Viewport>
      </Cropper.Root>
    );
    const screen = await render(tree());

    await ready(api);
    const own = api.current;

    expect(own && imageOf(own)).not.toBeNull();
    await screen.rerender(tree(external));
    await ready(api);
    expect(own && imageOf(own)).toBeNull();
    await screen.unmount();
    attachImage(external, null);
    external.destroy();
  });

  it("clears actionsRef after a parent's layout effect in the unmount commit", async () => {
    const api = createRef<CropperApi>();
    const seen: boolean[] = [];

    type ParentProps = { on: boolean };

    const Parent = ({ on }: ParentProps) => {
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
});

describe("Suspense and Activity", () => {
  afterEach(async () => {
    await cleanup();
  });

  const { Activity } = React;

  it.runIf(Activity)("keeps a photo across Activity", async () => {
    const api = createRef<CropperApi>();
    const source = await photo();

    type HostProps = { mode: "hidden" | "visible" };

    const Host = ({ mode }: HostProps) => (
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

    type HostProps = { wait: boolean };

    const Host = ({ wait }: HostProps) => (
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
});

type ShownProps = { cropper?: CropperApi };

const Shown = ({ cropper }: ShownProps) => (
  <p id="shown">{JSON.stringify(useCropperValue(cropper))}</p>
);

const ShownValue = memo(Shown);

const shownValue = (): unknown =>
  JSON.parse(document.querySelector("#shown")?.textContent ?? "null");

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

describe("hydration", () => {
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

  it("patches a Dial and useCropperValue that changed between the server render and hydration", async () => {
    const cropper = photoCropper();
    const tree = (
      <>
        <Cropper.Root cropper={cropper}>
          <Cropper.Dial aria-label="Straighten" id="hydrated-dial" />
        </Cropper.Root>
        <ShownValue cropper={cropper} />
      </>
    );
    const { container, logged, remove } = await hydrated(
      tree,
      renderToString(tree),
      () => {
        cropper.setRotation(3);
        cropper.setOptions({ disabled: true });
      }
    );

    expect(logged).toBe(0);

    expect(
      container.querySelector("#hydrated-dial")?.getAttribute("aria-disabled")
    ).toBe("true");

    expect(shownValue()).toStrictEqual(cropper.getValue());
    remove();
  });
});

const RED = "#cc3333";

const solidPhoto = async (
  width = 400,
  height = 300,
  fill = RED
): Promise<Blob> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("no 2d context");
  }

  context.fillStyle = fill;
  context.fillRect(0, 0, width, height);

  return await canvas.convertToBlob({ type: "image/png" });
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const realAdd: unknown = Reflect.get(EventTarget.prototype, "addEventListener");
const realRemove: unknown = Reflect.get(
  EventTarget.prototype,
  "removeEventListener"
);
const realFrame = requestAnimationFrame.bind(globalThis);
const realCancelFrame = cancelAnimationFrame.bind(globalThis);
const realTimeout = setTimeout.bind(globalThis);
const realClearTimeout = clearTimeout.bind(globalThis);
const realCreateUrl = URL.createObjectURL.bind(URL);
const realRevokeUrl = URL.revokeObjectURL.bind(URL);
const realBitmap = createImageBitmap.bind(globalThis);
const realObserve: unknown = Reflect.get(ResizeObserver.prototype, "observe");
const realDisconnect: unknown = Reflect.get(
  ResizeObserver.prototype,
  "disconnect"
);

const applyReal = (real: unknown, self: object, args: readonly unknown[]) => {
  if (typeof real === "function") {
    Reflect.apply(real, self, args);
  }
};

type EditorProps = {
  src?: string | Blob | null;
  api?: Ref<CropperApi> | undefined;
  onLoad?: (image: LoadedImage) => void;
  onError?: (error: ZrizError) => void;
  onValueChange?: (value: CropValue) => void;
  onValueCommit?: (value: CropValue) => void;
  children?: ReactNode;
  rootProps?: Record<string, unknown>;
};

const Editor = ({
  src,
  api,
  onLoad,
  onError,
  onValueChange,
  onValueCommit,
  children,
  rootProps,
}: EditorProps) => (
  <Cropper.Root
    actionsRef={api}
    onError={onError}
    onLoad={onLoad}
    onValueChange={onValueChange}
    onValueCommit={onValueCommit}
    src={src}
    {...rootProps}
  >
    <Cropper.Viewport
      id="viewport"
      style={{ height: 300, padding: 20, position: "relative", width: 400 }}
    >
      <Cropper.Image alt="" />
      <Cropper.Mask />
      <Cropper.Area aria-label="Crop">
        <Cropper.Grid />
        <Cropper.Handle position="top-left" />
      </Cropper.Area>
    </Cropper.Viewport>
    <Cropper.Instructions>Arrows move the photo.</Cropper.Instructions>
    <Cropper.Dial
      aria-label="Straighten"
      id="dial"
      style={{ height: 40, width: 361 }}
    >
      <Cropper.DialTicks />
      <Cropper.DialValue />
    </Cropper.Dial>
    <Cropper.Zoom
      aria-label="Zoom"
      id="zoom"
      style={{ height: 20, width: 200 }}
    >
      <Cropper.ZoomThumb />
    </Cropper.Zoom>
    <Cropper.AspectGroup aria-label="Aspect">
      <Cropper.AspectItem value="free">Free</Cropper.AspectItem>
      <Cropper.AspectItem value={1}>Square</Cropper.AspectItem>
      <Cropper.AspectItem value={16 / 9}>Wide</Cropper.AspectItem>
    </Cropper.AspectGroup>
    <Cropper.Rotate aria-label="Rotate" />
    <Cropper.Flip aria-label="Flip" />
    <Cropper.Reset>Reset</Cropper.Reset>
    <Cropper.Announcer announce={() => "Saved"} />
    {children}
  </Cropper.Root>
);

const STACK = /packages\/(?:core\/dist|core\/src|react\/src)\//u;

const fromZriz = (): boolean => STACK.test(new Error("stack").stack ?? "");

type Leftovers = {
  bitmaps: number;
  frames: number;
  listeners: string[];
  observers: number;
  timers: number;
  urls: number;
};

const CLEAN: Leftovers = {
  bitmaps: 0,
  frames: 0,
  listeners: [],
  observers: 0,
  timers: 0,
  urls: 0,
};

const listenerKey = (
  target: EventTarget,
  ids: WeakMap<object, number>,
  [type, listener, options]: Parameters<EventTarget["addEventListener"]>
): string => {
  const idOf = (value: object): number => {
    const known = ids.get(value);

    if (known !== undefined) {
      return known;
    }

    const next = Math.random();

    ids.set(value, next);

    return next;
  };

  const capture =
    typeof options === "boolean" ? options : options?.capture === true;

  return `${idOf(target)} ${type} ${listener ? idOf(listener) : 0} ${capture}`;
};

const track = () => {
  const ids = new WeakMap<object, number>();
  const listeners = new Map<string, string>();
  const frameIds = new Set<number>();
  const urls = new Set<string>();
  const bitmaps: ImageBitmap[] = [];
  const timers = new Set<unknown>();
  const observers = new Set<ResizeObserver>();
  const spies = [
    vi
      .spyOn(EventTarget.prototype, "addEventListener")
      .mockImplementation(function add(this: EventTarget, ...args) {
        const [_type, _listener, options] = args;
        const once = typeof options === "object" && options.once === true;

        if (fromZriz() && !once) {
          listeners.set(
            listenerKey(this, ids, args),
            `${this.constructor.name}:${args[0]}`
          );
        }

        applyReal(realAdd, this, args);
      }),
    vi
      .spyOn(EventTarget.prototype, "removeEventListener")
      .mockImplementation(function remove(this: EventTarget, ...args) {
        listeners.delete(listenerKey(this, ids, args));
        applyReal(realRemove, this, args);
      }),
    vi.spyOn(globalThis, "requestAnimationFrame").mockImplementation((run) => {
      const id = realFrame((time) => {
        frameIds.delete(id);
        run(time);
      });

      if (fromZriz()) {
        frameIds.add(id);
      }

      return id;
    }),
    vi.spyOn(globalThis, "cancelAnimationFrame").mockImplementation((id) => {
      frameIds.delete(id);
      realCancelFrame(id);
    }),
    vi.spyOn(globalThis, "setTimeout").mockImplementation((run, ms) => {
      const mine = fromZriz();
      const id = realTimeout(() => {
        timers.delete(id);

        if (typeof run === "function") {
          run();
        }
      }, ms);

      if (mine) {
        timers.add(id);
      }

      return id;
    }),
    vi.spyOn(globalThis, "clearTimeout").mockImplementation((id) => {
      timers.delete(id);
      realClearTimeout(id);
    }),
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      const url = realCreateUrl(blob);

      if (fromZriz()) {
        urls.add(url);
      }

      return url;
    }),
    vi.spyOn(URL, "revokeObjectURL").mockImplementation((url) => {
      urls.delete(url);
      realRevokeUrl(url);
    }),
    vi
      .spyOn(globalThis, "createImageBitmap")
      .mockImplementation(async (...args: unknown[]): Promise<ImageBitmap> => {
        const made: unknown = await Reflect.apply(realBitmap, globalThis, args);

        if (!(made instanceof ImageBitmap)) {
          throw new TypeError("no bitmap");
        }

        bitmaps.push(made);

        return made;
      }),
    vi
      .spyOn(ResizeObserver.prototype, "observe")
      .mockImplementation(function observe(this: ResizeObserver, ...args) {
        if (fromZriz()) {
          observers.add(this);
        }

        applyReal(realObserve, this, args);
      }),
    vi
      .spyOn(ResizeObserver.prototype, "disconnect")
      .mockImplementation(function disconnect(this: ResizeObserver) {
        observers.delete(this);
        applyReal(realDisconnect, this, []);
      }),
  ];

  return {
    read: async (): Promise<Leftovers> => {
      await sleep(1200);

      return {
        bitmaps: bitmaps.filter((bitmap) => bitmap.width > 0).length,
        frames: frameIds.size,
        listeners: [...listeners.values()],
        observers: observers.size,
        timers: timers.size,
        urls: urls.size,
      };
    },
    restore: () => {
      for (const spy of spies) {
        spy.mockRestore();
      }
    },
  };
};

const unmountDuring = async (
  run: (api: { current: CropperApi | null }) => Promise<void>,
  waitForPhoto = true
): Promise<Leftovers> => {
  const tracker = track();

  try {
    const onLoad = vi.fn<(...args: unknown[]) => void>();
    const api = createRef<CropperApi>();
    const src = await solidPhoto(800, 600);
    const screen = await render(
      <StrictMode>
        <Editor api={api} onLoad={onLoad} src={src} />
      </StrictMode>
    );

    if (waitForPhoto) {
      await expect.poll(() => onLoad.mock.calls.length).toBe(1);
      await frames(3);
    }

    await run(api);
    await screen.unmount();

    return await tracker.read();
  } finally {
    tracker.restore();
  }
};

describe("unmount parity under StrictMode", () => {
  beforeAll(async () => {
    await loadImage(await solidPhoto(8, 8));
  });

  afterEach(async () => {
    await cleanup();
  });

  it.each<{
    name: string;
    run: (api: { current: CropperApi | null }) => Promise<void>;
    waitForPhoto?: boolean;
  }>([
    {
      name: "when idle",
      run: async () => {
        await frames(2);
      },
    },
    {
      name: "during an animation",
      run: async (api) => {
        api.current?.rotate90();
        await frames(2);
      },
    },
    {
      name: "in the middle of a drag",
      run: async () => {
        await commands.hold("#viewport", 200, 150);
        await frames(2);
      },
    },
    {
      name: "while the load is still running",
      run: async () => {
        await Promise.resolve();
      },
      waitForPhoto: false,
    },
    {
      name: "after the sharp canvas settled",
      run: async () => {
        await expect
          .poll(() => document.querySelector("[data-sharp]"), {
            timeout: 3000,
          })
          .not.toBeNull();
      },
    },
  ])("leaves nothing $name", async ({ run, waitForPhoto }) => {
    const result = await unmountDuring(run, waitForPhoto);

    await commands.release();
    expect(result).toStrictEqual(CLEAN);
  });
});

type FullProps = { api?: Ref<CropperApi> };

const Full = ({ api }: FullProps) => (
  <Editor api={api} rootProps={{ image: { height: 300, width: 400 } }}>
    <Cropper.Orientation aria-label="Orientation" />
    <Cropper.ZoomStep aria-label="Zoom in" factor={2} />
  </Editor>
);

describe("hydrating every part", () => {
  afterEach(async () => {
    await cleanup();
  });

  it("hydrates every part with no mismatch and stays interactive", async () => {
    const html = renderToString(<Full />);
    const host = document.createElement("div");

    host.innerHTML = html;
    document.body.append(host);
    const spy = vi.spyOn(console, "error");
    const recoverable: unknown[] = [];
    const api = createRef<CropperApi>();
    const root = hydrateRoot(host, <Full api={api} />, {
      onRecoverableError: (error) => {
        recoverable.push(error);
      },
    });

    await expect.poll(() => api.current !== null).toBeTruthy();
    await frames(3);
    const errors = spy.mock.calls.map((call) => String(call[0]).slice(0, 200));

    spy.mockRestore();
    expect(recoverable).toStrictEqual([]);
    expect(errors).toStrictEqual([]);
    const zoom = host.querySelector<HTMLElement>('[data-zriz-item="zoom"]');

    zoom?.focus();
    await userEvent.keyboard("{End}");
    await frames(3);
    expect(api.current?.getZoom()).toBeGreaterThan(1);
    root.unmount();
    host.remove();
  });
});
