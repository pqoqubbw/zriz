import type { Cropper } from "../cropper";
import { multiplyMatrix3 } from "../geometry/matrix";
import {
  isFlatPerspective,
  perspectiveHomography,
} from "../geometry/perspective";
import { linearTransform } from "../geometry/state";
import type { CropState, Matrix3, Point } from "../geometry/types";
import { spring } from "../motion";

export interface Inset {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface Layout {
  width: number;
  height: number;
  inset: Inset;
  dpr: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Placement {
  scale: number;
  offset: Point;
}

export interface ViewFrame {
  rect: Box;
  matrix: Matrix3;
  scale: number;
  state: CropState;
  layout: Layout;
}

export interface View {
  frame: () => ViewFrame | null;
  setTarget: (element: HTMLElement | null) => void;
  local: (event: { clientX: number; clientY: number }) => Point;
  claim: (event: Event) => void;
  claimed: (event: Event) => boolean;
  setLayout: (layout: Layout | null) => void;
  hold: () => Placement | null;
  release: () => void;
  setOverscroll: (offset: Point) => void;
  settleOverscroll: () => void;
  onFrame: (listener: (frame: ViewFrame) => void) => () => void;
  destroy: () => void;
}

export const capture = (element: Element, id: number): void => {
  try {
    element.setPointerCapture(id);
  } catch (error) {
    if (!(error instanceof DOMException)) {
      throw error;
    }
  }
};

export const snap = (value: number, dpr: number): number =>
  Math.round(value * dpr) / dpr;

export const fitPlacement = (layout: Layout, state: CropState): Placement => {
  const { inset } = layout;
  const width = Math.max(layout.width - inset.left - inset.right, 1);
  const height = Math.max(layout.height - inset.top - inset.bottom, 1);
  const scale = Math.min(width / state.crop.width, height / state.crop.height);
  return {
    offset: {
      x: inset.left + width / 2 - scale * state.crop.x,
      y: inset.top + height / 2 - scale * state.crop.y,
    },
    scale,
  };
};

const inward = (low: number, high: number, dpr: number): [number, number] => [
  Math.ceil(low * dpr - 1e-6) / dpr,
  Math.max(Math.floor(high * dpr + 1e-6), Math.ceil(low * dpr - 1e-6)) / dpr,
];

export const cropBox = (
  state: CropState,
  placement: Placement,
  dpr: number
): Box => {
  const { offset, scale } = placement;
  const { crop } = state;
  const [x0, x1] = inward(
    offset.x + scale * (crop.x - crop.width / 2),
    offset.x + scale * (crop.x + crop.width / 2),
    dpr
  );
  const [y0, y1] = inward(
    offset.y + scale * (crop.y - crop.height / 2),
    offset.y + scale * (crop.y + crop.height / 2),
    dpr
  );
  return { height: y1 - y0, width: x1 - x0, x: x0, y: y0 };
};

const NO_SHIFT: Point = { x: 0, y: 0 };

export const imageMatrix = (
  state: CropState,
  placement: Placement,
  shift: Point = NO_SHIFT
): Matrix3 => {
  const [l00, l01, l10, l11] = linearTransform(state);
  const k = placement.scale;
  const affine: Matrix3 = [
    k * l00,
    k * l01,
    placement.offset.x + shift.x,
    k * l10,
    k * l11,
    placement.offset.y + shift.y,
    0,
    0,
    1,
  ];
  const centre: Matrix3 = [
    1,
    0,
    -state.image.width / 2,
    0,
    1,
    -state.image.height / 2,
    0,
    0,
    1,
  ];
  const keystone = isFlatPerspective(state.perspective)
    ? centre
    : multiplyMatrix3(perspectiveHomography(state.perspective), centre);
  return multiplyMatrix3(affine, keystone);
};

export const cssMatrix = (m: Matrix3): string => {
  if (m[6] === 0 && m[7] === 0 && m[8] === 1) {
    return `matrix(${m[0]},${m[3]},${m[1]},${m[4]},${m[2]},${m[5]})`;
  }
  return `matrix3d(${m[0]},${m[3]},0,${m[6]},${m[1]},${m[4]},0,${m[7]},0,0,1,0,${m[2]},${m[5]},0,${m[8]})`;
};

const views = new WeakMap<Cropper, View>();

const OVERSCROLL_OMEGA = 42;
const OVERSCROLL_ZETA = 1.4;

export const viewOf = (cropper: Cropper): View => {
  const existing = views.get(cropper);
  if (existing) {
    return existing;
  }
  let layout: Layout | null = null;
  let held: Placement | null = null;
  let shift: Point = { x: 0, y: 0 };
  let stopShift: (() => void) | null = null;
  let last: ViewFrame | null = null;
  let target: HTMLElement | null = null;
  const claims = new WeakSet<Event>();
  const listeners = new Set<(frame: ViewFrame) => void>();

  const compute = (): ViewFrame | null => {
    const state = cropper.getCropState();
    if (!layout || !state) {
      return null;
    }
    const placement = held ?? fitPlacement(layout, state);
    return {
      layout,
      matrix: imageMatrix(state, placement, shift),
      rect: cropBox(state, placement, layout.dpr),
      scale: placement.scale,
      state,
    };
  };

  const publish = (): void => {
    last = compute();
    if (last) {
      for (const listener of listeners) {
        listener(last);
      }
    }
  };

  const off = cropper.on("frame", publish);

  const view: View = {
    claim(event) {
      claims.add(event);
    },
    claimed: (event) => claims.has(event),
    destroy() {
      off();
      stopShift?.();
      listeners.clear();
      views.delete(cropper);
    },
    frame: () => last ?? compute(),
    hold() {
      const state = cropper.getCropState();
      if (!layout || !state) {
        return null;
      }
      held ??= fitPlacement(layout, state);
      return held;
    },
    local(event) {
      if (!target) {
        return { x: event.clientX, y: event.clientY };
      }
      const box = target.getBoundingClientRect();
      return {
        x: event.clientX - box.left - target.clientLeft,
        y: event.clientY - box.top - target.clientTop,
      };
    },
    onFrame(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    release() {
      held = null;
      cropper.invalidate();
    },
    setLayout(next) {
      layout = next;
      cropper.invalidate();
    },
    setOverscroll(offset) {
      stopShift?.();
      stopShift = null;
      shift = offset;
      cropper.invalidate();
    },
    setTarget(element) {
      target = element;
    },
    settleOverscroll() {
      stopShift?.();
      const from = shift;
      let elapsed = 0;
      if (from.x === 0 && from.y === 0) {
        return;
      }
      stopShift = cropper.run((_, delta) => {
        elapsed += delta;
        const x = spring(from.x, 0, OVERSCROLL_OMEGA, OVERSCROLL_ZETA, elapsed);
        const y = spring(from.y, 0, OVERSCROLL_OMEGA, OVERSCROLL_ZETA, elapsed);
        const done =
          Math.abs(x.value) < 0.1 &&
          Math.abs(y.value) < 0.1 &&
          Math.abs(x.velocity) < 1 &&
          Math.abs(y.velocity) < 1;
        shift = done ? { x: 0, y: 0 } : { x: x.value, y: y.value };
        if (done) {
          stopShift = null;
        }
        return !done;
      }, false);
    },
  };
  views.set(cropper, view);
  return view;
};
