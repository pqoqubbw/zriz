import { afterEach, beforeEach, vi } from "vitest";

import { createCropper } from "../src";
import type { Cropper, CropperEvents, CropperOptions, CropState } from "../src";
import type { LoadedImage } from "../src/dom";
import { viewOf } from "../src/dom/view";
import { fakeClock } from "./fake-clock";
import type { FakeClock } from "./fake-clock";

type Layout = Parameters<ReturnType<typeof viewOf>["setLayout"]>[0];

type Rig = {
  change: ReturnType<typeof vi.fn<CropperEvents["change"]>>;
  commit: ReturnType<typeof vi.fn<CropperEvents["commit"]>>;
  cropper: Cropper;
  time: FakeClock;
};

type KeyInit = {
  altKey?: boolean;
  key: string;
  shiftKey?: boolean;
};

const PHOTO = { height: 3000, width: 4000 };

const LAYOUT = {
  dpr: 1,
  height: 300,
  inset: { bottom: 0, left: 0, right: 0, top: 0 },
  width: 400,
};

const noop = (): void => undefined;

const isObject = (value: unknown): boolean =>
  typeof value === "object" && value !== null;
const isKey = (value: unknown): value is KeyboardEvent => isObject(value);
const isPointer = (value: unknown): value is PointerEvent => isObject(value);
const isElement = (value: unknown): value is Element => isObject(value);

const cast = <T>(value: unknown, is: (value: unknown) => value is T): T => {
  if (!is(value)) {
    throw new TypeError("unreachable");
  }

  return value;
};

const setup = (options: CropperOptions = {}): Rig => {
  const time = fakeClock();
  const change = vi.fn<CropperEvents["change"]>();
  const commit = vi.fn<CropperEvents["commit"]>();
  const cropper = createCropper({
    clock: time.clock,
    image: PHOTO,
    onValueChange: (value, details) => {
      change(value, details);
    },
    onValueCommit: (value, details) => {
      commit(value, details);
    },
    ...options,
  });

  return { change, commit, cropper, time };
};

const laidOut = (options: CropperOptions = {}, layout: Layout = LAYOUT) => {
  const rig = setup({ image: { height: 300, width: 400 }, ...options });
  const view = viewOf(rig.cropper);

  view.setLayout(layout);

  return { ...rig, view };
};

const stateOf = (cropper: Cropper): CropState => {
  const state = cropper.getCropState();

  if (!state) {
    throw new Error("no image");
  }

  return state;
};

const key = (init: KeyInit): KeyboardEvent =>
  cast(
    {
      altKey: false,
      currentTarget: null,
      preventDefault: noop,
      shiftKey: false,
      ...init,
    },
    isKey
  );

const pointer = (
  clientX: number,
  timeStamp = 0,
  init: Partial<PointerEventInit> = {}
): PointerEvent =>
  cast(
    {
      button: 0,
      clientX,
      clientY: 20,
      currentTarget: null,
      pointerId: 1,
      pointerType: "mouse",
      target: null,
      timeStamp,
      ...init,
    },
    isPointer
  );

const dialTrack = (width = 361): Element =>
  cast(
    {
      getBoundingClientRect: () => ({ left: 0, width }),
      getClientRects: () => [{}],
      ownerDocument: {},
      setPointerCapture: noop,
    },
    isElement
  );

class FakeInputEvent extends Event {
  constructor(type: string, init: object = {}) {
    super(type, { cancelable: true });
    Object.assign(this, init);
  }
}

const stubDom = (): void => {
  beforeEach(() => {
    vi.stubGlobal("document", new EventTarget());
    vi.stubGlobal("addEventListener", vi.fn<() => void>());
    vi.stubGlobal("removeEventListener", vi.fn<() => void>());
    vi.stubGlobal("Element", Map);
    vi.stubGlobal("KeyboardEvent", FakeInputEvent);
    vi.stubGlobal("PointerEvent", FakeInputEvent);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });
};

const loadedImage = (overrides: Partial<LoadedImage> = {}): LoadedImage => ({
  animated: false,
  height: 1,
  id: 1,
  mime: "image/png",
  preview: { close: noop, height: 1, width: 1 },
  source: new Blob(),
  width: 1,
  ...overrides,
});

export type { KeyInit, Layout, Rig };
export {
  cast,
  dialTrack,
  FakeInputEvent,
  isObject,
  key,
  LAYOUT,
  laidOut,
  loadedImage,
  noop,
  PHOTO,
  pointer,
  setup,
  stateOf,
  stubDom,
};
