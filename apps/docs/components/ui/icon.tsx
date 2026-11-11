import type { ComponentProps } from "react";

type GlyphProps = ComponentProps<"svg"> & {
  paths: readonly IconPath[];
};

type IconProps = ComponentProps<"svg"> & {
  name: IconName;
};

type BrandProps = ComponentProps<"svg"> & {
  name: BrandName;
};

type BrandName = keyof typeof BRAND_PATHS;

type IconName = keyof typeof ICON_PATHS;

type IconPath = string | { readonly d: string; readonly fill: true };

type IconPathElementProps = {
  path: IconPath;
};

const BRAND_PATHS = {
  github:
    "M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z",
  npm: "M1 1v14h14V1H1zm11.5 11.5h-2.25V5.75H8v6.75H3.5v-9h9v9z",
} as const satisfies Record<string, string>;

const ICON_PATHS = {
  check: ["M4 10L8 14L16 6"],
  chevron: ["M6 8L10 12L14 8"],
  close: ["M5 5L15 15M15 5L5 15"],
  copy: [
    "M9.5 7.5H14.5A2 2 0 0 1 16.5 9.5V14.5A2 2 0 0 1 14.5 16.5H9.5A2 2 0 0 1 7.5 14.5V9.5A2 2 0 0 1 9.5 7.5Z",
    "M7.5 12.5H5.5A2 2 0 0 1 3.5 10.5V5.5A2 2 0 0 1 5.5 3.5H10.5A2 2 0 0 1 12.5 5.5V7.5",
  ],
  menu: ["M3.5 7.5H16.5M3.5 12.5H16.5"],
  minus: ["M5 10H15"],
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

const Brand = ({ name, ...props }: BrandProps) => (
  <svg
    aria-hidden="true"
    data-slot="icon"
    fill="currentColor"
    viewBox="0 0 16 16"
    {...props}
  >
    <path d={BRAND_PATHS[name]} />
  </svg>
);

const Icon = ({ name, ...props }: IconProps) => (
  <Glyph paths={ICON_PATHS[name]} {...props} />
);

export type {
  BrandName,
  BrandProps,
  GlyphProps,
  IconName,
  IconPath,
  IconProps,
};
export { Brand, Glyph, ICON_NAMES, ICON_PATHS, Icon };
