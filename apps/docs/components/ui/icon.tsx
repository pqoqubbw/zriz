import type { ComponentProps } from "react";

type IconProps = ComponentProps<"svg"> & {
  name: keyof typeof ICON_PATHS;
};

const ICON_PATHS = {
  check: ["M4 10.5L8 14.5L16 6.5"],
  close: ["M5 5L15 15M15 5L5 15"],
  copy: [
    "M9.5 7.5H14.5A2 2 0 0 1 16.5 9.5V14.5A2 2 0 0 1 14.5 16.5H9.5A2 2 0 0 1 7.5 14.5V9.5A2 2 0 0 1 9.5 7.5Z",
    "M7.5 12.5H5.5A2 2 0 0 1 3.5 10.5V5.5A2 2 0 0 1 5.5 3.5H10.5A2 2 0 0 1 12.5 5.5V7.5",
  ],
  menu: ["M3.5 7.5H16.5M3.5 12.5H16.5"],
} as const;

const Icon = ({ name, ...props }: IconProps) => (
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
    {ICON_PATHS[name].map((d) => (
      <path d={d} key={d} />
    ))}
  </svg>
);

export type { IconProps };
export { Icon };
