import Link from "next/link";

import { FocusTarget } from "@/components/ui/focus-target";
import { pagePath } from "@/lib/nav";

type MarkProps = {
  className: string;
};

const Mark = ({ className }: MarkProps) => (
  <svg aria-hidden="true" className={className} fill="none" viewBox="6 6 36 36">
    <path
      d="M10 20V12H18M30 12H38V20M38 28V36H30M18 36H10V28"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="3.8"
      transform="rotate(-5 24 24)"
    />
  </svg>
);

const Logo = () => (
  <Link
    className="group -my-2.5 flex h-11 w-fit items-center text-logo"
    href={pagePath("introduction")}
  >
    <FocusTarget className="items-center gap-2">
      <Mark className="size-5 shrink-0" />
      zriz
    </FocusTarget>
  </Link>
);

export { Logo, Mark };
