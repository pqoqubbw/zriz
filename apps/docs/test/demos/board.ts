import type { ZoneSpec } from "../../demos/registry";
import {
  CHIP_GAP,
  CHIP_OFFSET,
  CONTROL_HEIGHT,
  DEMO_SIZES,
  DOWNLOAD_WIDTH,
  ICON_COLUMNS_BELOW,
  PANEL_PADDING,
  SAFE_BOTTOM,
  SAFE_TOP,
  VALUE_GAP,
  VALUE_HEIGHT,
  ZONE_PADDING,
  zoneHeight,
} from "../../demos/shell/sizes";
import type { DemoWidth } from "../../demos/shell/sizes";

type Box = {
  height: number;
  width: number;
  x: number;
  y: number;
};

type DialBoard = {
  end: Box;
  ruler: Box;
  start: Box;
  value: Box;
  zone: Box;
};

type Board = {
  crop: (ratio: number) => Box;
  dial: DialBoard;
  download: Box;
  openTop: number;
  panel: Box;
  stage: Box;
};

const WIDTHS: readonly DemoWidth[] = ["desktop", "phone", "narrow"];

const contain = (ratio: number, box: Box): Box => {
  const wide = box.width / box.height > ratio;
  const width = wide ? box.height * ratio : box.width;
  const height = wide ? box.height : box.width / ratio;

  return {
    height,
    width,
    x: box.x + (box.width - width) / 2,
    y: box.y + (box.height - height) / 2,
  };
};

const panelHeight = (width: DemoWidth, zones: readonly ZoneSpec[]): number =>
  PANEL_PADDING * 2 +
  DEMO_SIZES[width].stage +
  zones.reduce(
    (sum, zone) =>
      sum +
      zoneHeight(
        zone.kind,
        zone.kind === "zoom" || (zone.kind === "dial" && zone.value)
      ),
    0
  );

const editorBoard = (width: DemoWidth): Board => {
  const size = DEMO_SIZES[width];
  const stageWidth = size.column - PANEL_PADDING * 2;
  const stage = {
    height: size.stage,
    width: stageWidth,
    x: PANEL_PADDING,
    y: PANEL_PADDING,
  };
  const zoneTop = PANEL_PADDING + size.stage;
  const zone = {
    height: zoneHeight("dial", true),
    width: stageWidth,
    x: PANEL_PADDING,
    y: zoneTop,
  };
  const row = CONTROL_HEIGHT * 2 + 12 * 2 + size.dial;
  const rowLeft = (size.column - row) / 2;
  const controlTop =
    zoneTop + zone.height - ZONE_PADDING.dial.bottom - CONTROL_HEIGHT;
  const iconOnly = stageWidth < ICON_COLUMNS_BELOW;
  const downloadWidth = iconOnly ? CONTROL_HEIGHT : DOWNLOAD_WIDTH;
  const safe = {
    height: size.stage - SAFE_TOP - SAFE_BOTTOM,
    width: stageWidth - size.inset * 2,
    x: PANEL_PADDING + size.inset,
    y: PANEL_PADDING + SAFE_TOP,
  };

  return {
    crop: (ratio) => contain(ratio, safe),
    dial: {
      end: {
        height: CONTROL_HEIGHT,
        width: CONTROL_HEIGHT,
        x: rowLeft + row - CONTROL_HEIGHT,
        y: controlTop,
      },
      ruler: {
        height: CONTROL_HEIGHT,
        width: size.dial,
        x: rowLeft + CONTROL_HEIGHT + 12,
        y: controlTop,
      },
      start: {
        height: CONTROL_HEIGHT,
        width: CONTROL_HEIGHT,
        x: rowLeft,
        y: controlTop,
      },
      value: {
        height: VALUE_HEIGHT,
        width: Number.NaN,
        x: Number.NaN,
        y: controlTop - VALUE_GAP - VALUE_HEIGHT,
      },
      zone,
    },
    download: {
      height: CONTROL_HEIGHT,
      width: downloadWidth,
      x: PANEL_PADDING + stageWidth - CHIP_OFFSET - downloadWidth,
      y: PANEL_PADDING + CHIP_OFFSET,
    },
    openTop: PANEL_PADDING + CHIP_OFFSET,
    panel: {
      height: PANEL_PADDING * 2 + size.stage + zone.height,
      width: size.column,
      x: 0,
      y: 0,
    },
    stage,
  };
};

const resetLeftOf = (board: Board, resetWidth: number): number =>
  board.download.x - CHIP_GAP - resetWidth;

export type { Board, Box, DialBoard };
export { WIDTHS, contain, editorBoard, panelHeight, resetLeftOf };
