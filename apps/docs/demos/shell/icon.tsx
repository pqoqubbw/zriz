import type { ComponentProps } from "react";

import { Glyph, ICON_PATHS as SITE_PATHS } from "@/components/ui/icon";
import type { IconPath } from "@/components/ui/icon";

type IconProps = ComponentProps<"svg"> & {
  name: IconName;
};

type IconName = keyof typeof ICON_PATHS;

const ICON_PATHS = {
  check: SITE_PATHS.check,
  download: [
    "M10 3.75V11.75",
    "M6.75 8.75L10 12L13.25 8.75",
    "M4.25 12.75V14.25A2 2 0 0 0 6.25 16.25H13.75A2 2 0 0 0 15.75 14.25V12.75",
  ],
  "flip-horizontal": ["M8.5 4.5V15.5H3.5Z", "M11.5 4.5V15.5H16.5Z"],
  "flip-vertical": ["M15.5 8.5H4.5V3.5Z", "M15.5 11.5H4.5V16.5Z"],
  landscape: [
    "M5.75 5.75H14.25A2 2 0 0 1 16.25 7.75V12.25A2 2 0 0 1 14.25 14.25H5.75A2 2 0 0 1 3.75 12.25V7.75A2 2 0 0 1 5.75 5.75Z",
  ],
  "open-image": [
    "M4.5 4.5H15.5A2 2 0 0 1 17.5 6.5V13.5A2 2 0 0 1 15.5 15.5H4.5A2 2 0 0 1 2.5 13.5V6.5A2 2 0 0 1 4.5 4.5Z",
    "M2.5 13.5L7 9L13.5 15.5",
    "M14.5 8.5A1.5 1.5 0 1 1 11.5 8.5A1.5 1.5 0 1 1 14.5 8.5Z",
  ],
  portrait: [
    "M7.75 3.75H12.25A2 2 0 0 1 14.25 5.75V14.25A2 2 0 0 1 12.25 16.25H7.75A2 2 0 0 1 5.75 14.25V5.75A2 2 0 0 1 7.75 3.75Z",
  ],
  reset: ["M4.8 7.5A6 6 0 1 0 10 4.5", "M11.4 6.69L10 4.5L12.19 3.1"],
  "rotate-left": [
    "M5.5 9.5H10.5A1.5 1.5 0 0 1 12 11V15A1.5 1.5 0 0 1 10.5 16.5H5.5A1.5 1.5 0 0 1 4 15V11A1.5 1.5 0 0 1 5.5 9.5Z",
    "M16 12.5V9.5A4 4 0 0 0 12 5.5H9",
    "M11 3.5L9 5.5L11 7.5",
  ],
  "rotate-right": [
    "M14.5 9.5H9.5A1.5 1.5 0 0 0 8 11V15A1.5 1.5 0 0 0 9.5 16.5H14.5A1.5 1.5 0 0 0 16 15V11A1.5 1.5 0 0 0 14.5 9.5Z",
    "M4 12.5V9.5A4 4 0 0 1 8 5.5H11",
    "M9 3.5L11 5.5L9 7.5",
  ],
  square: [
    "M6.25 4.25H13.75A2 2 0 0 1 15.75 6.25V13.75A2 2 0 0 1 13.75 15.75H6.25A2 2 0 0 1 4.25 13.75V6.25A2 2 0 0 1 6.25 4.25Z",
  ],
  undo: [
    "M6.875 4L3.875 7L6.875 10",
    "M3.875 7H11.625A4.5 4.5 0 0 1 11.625 16H8.125",
  ],
  upload: [
    "M10 4V12",
    "M6.75 7L10 3.75L13.25 7",
    "M4.25 12.75V14.25A2 2 0 0 0 6.25 16.25H13.75A2 2 0 0 0 15.75 14.25V12.75",
  ],
  warning: [
    "M10 3.25L17.5 16.75H2.5Z",
    "M10 8.25V11.75",
    {
      d: "M10.85 14A0.85 0.85 0 1 1 9.15 14A0.85 0.85 0 1 1 10.85 14Z",
      fill: true,
    },
  ],
  "zoom-in": [
    "M14.25 8.75A5.5 5.5 0 1 1 3.25 8.75A5.5 5.5 0 1 1 14.25 8.75Z",
    "M12.639 12.639L16.75 16.75",
    "M6.25 8.75H11.25M8.75 6.25V11.25",
  ],
  "zoom-out": [
    "M14.25 8.75A5.5 5.5 0 1 1 3.25 8.75A5.5 5.5 0 1 1 14.25 8.75Z",
    "M12.639 12.639L16.75 16.75",
    "M6.25 8.75H11.25",
  ],
} as const satisfies Record<string, readonly IconPath[]>;

const ICON_NAMES = Object.keys(ICON_PATHS).filter(
  (key): key is IconName => key in ICON_PATHS
);

const Icon = ({ name, ...props }: IconProps) => (
  <Glyph paths={ICON_PATHS[name]} {...props} />
);

export type { IconName, IconProps };
export { ICON_NAMES, Icon };
