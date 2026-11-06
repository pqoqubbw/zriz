import type { ComponentProps } from "react";

type GlyphProps = ComponentProps<"svg"> & {
  paths: readonly IconPath[];
};

type IconProps = ComponentProps<"svg"> & {
  name: IconName;
};

type IconName = keyof typeof ICON_PATHS;

type IconPath = string | { readonly d: string; readonly fill: true };

type IconPathElementProps = {
  path: IconPath;
};

const ICON_PATHS = {
  check: ["M4 10L8 14L16 6"],
  chevron: ["M6 8L10 12L14 8"],
  close: ["M5 5L15 15M15 5L5 15"],
  copy: [
    "M9.5 7.5H14.5A2 2 0 0 1 16.5 9.5V14.5A2 2 0 0 1 14.5 16.5H9.5A2 2 0 0 1 7.5 14.5V9.5A2 2 0 0 1 9.5 7.5Z",
    "M7.5 12.5H5.5A2 2 0 0 1 3.5 10.5V5.5A2 2 0 0 1 5.5 3.5H10.5A2 2 0 0 1 12.5 5.5V7.5",
  ],
  menu: ["M3.5 7.5H16.5M3.5 12.5H16.5"],
} as const satisfies Record<string, readonly IconPath[]>;

const ICON_NAMES = Object.keys(ICON_PATHS).filter(
  (key): key is IconName => key in ICON_PATHS
);

const IconPathElement = ({ path }: IconPathElementProps) =>
  typeof path === "string" ? (
    <path d={path} />
  ) : (
    <path d={path.d} fill="currentColor" stroke="none" />
  );

const Glyph = ({ paths, ...props }: GlyphProps) => (
  <svg
    aria-hidden="true"
    data-slot="icon"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="1.25"
    viewBox="0 0 20 20"
    {...props}
  >
    {paths.map((path: IconPath) => (
      <IconPathElement
        key={typeof path === "string" ? path : path.d}
        path={path}
      />
    ))}
  </svg>
);

const Icon = ({ name, ...props }: IconProps) => (
  <Glyph paths={ICON_PATHS[name]} {...props} />
);

export type { GlyphProps, IconName, IconPath, IconProps };
export { Glyph, ICON_NAMES, ICON_PATHS, Icon };
