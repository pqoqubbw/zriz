type DemoWidth = "desktop" | "phone" | "narrow";

type DemoSize = {
  column: number;
  dial: number;
  inset: number;
  stage: number;
};

type ZoneKind = "aspect" | "dial" | "row" | "track" | "zoom";

const DEMO_SIZES = {
  desktop: { column: 560, dial: 360, inset: 24, stage: 380 },
  narrow: { column: 328, dial: 176, inset: 20, stage: 320 },
  phone: { column: 358, dial: 200, inset: 24, stage: 320 },
} as const satisfies Record<DemoWidth, DemoSize>;

const PANEL_PADDING = 4;
const SAFE_TOP = 60;
const SAFE_BOTTOM = 60;
const CHIP_OFFSET = 8;
const CHIP_GAP = 6;
const CONTROL_HEIGHT = 32;
const TRACK_ITEM_HEIGHT = 28;
const DOWNLOAD_WIDTH = 108;
const ZOOM_WIDTH_MAX = 280;
const VALUE_HEIGHT = 16;
const VALUE_GAP = 6;
const RULER_FOCUS_OUTSET = 6;
const ICON_COLUMNS_BELOW = 400;
const MIN_HIT = 44;
const ERROR_MS = 4000;
const SAVED_MS = 2000;
const SPINNER_DELAY_MS = 200;

const ZONE_PADDING = {
  aspect: { bottom: 8, top: 12 },
  dial: { bottom: 6, top: 14 },
  row: { bottom: 8, top: 12 },
  track: { bottom: 8, top: 12 },
  zoom: { bottom: 6, top: 14 },
} as const satisfies Record<ZoneKind, { bottom: number; top: number }>;

const zoneHeight = (kind: ZoneKind, value: boolean): number =>
  ZONE_PADDING[kind].top +
  (value ? VALUE_HEIGHT + VALUE_GAP : 0) +
  CONTROL_HEIGHT +
  ZONE_PADDING[kind].bottom;

const zoomWidth = (width: DemoWidth): number =>
  Math.min(DEMO_SIZES[width].dial, ZOOM_WIDTH_MAX);

export type { DemoSize, DemoWidth, ZoneKind };
export {
  CHIP_GAP,
  CHIP_OFFSET,
  CONTROL_HEIGHT,
  DEMO_SIZES,
  DOWNLOAD_WIDTH,
  ERROR_MS,
  ICON_COLUMNS_BELOW,
  MIN_HIT,
  PANEL_PADDING,
  RULER_FOCUS_OUTSET,
  SAFE_BOTTOM,
  SAFE_TOP,
  SAVED_MS,
  SPINNER_DELAY_MS,
  TRACK_ITEM_HEIGHT,
  VALUE_GAP,
  VALUE_HEIGHT,
  ZONE_PADDING,
  ZOOM_WIDTH_MAX,
  zoneHeight,
  zoomWidth,
};
