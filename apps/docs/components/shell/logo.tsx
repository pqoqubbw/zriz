import Link from "next/link";

import { Mark } from "@/components/doc/icon";

export const Logo = () => (
  <Link
    className="group text-logo -my-2.5 flex h-11 w-fit items-center focus-visible:[border-image-source:none]"
    href="/docs/introduction"
  >
    <span className="group-focus-visible:corners flex items-center gap-2">
      <Mark className="size-5 shrink-0" />
      zriz
    </span>
  </Link>
);
