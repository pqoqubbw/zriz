import Link from "next/link";

import { Mark } from "@/components/doc/icon";

export const Logo = () => (
  <Link
    className="text-logo -my-2.5 flex h-11 w-fit items-center gap-2"
    href="/docs/introduction"
  >
    <Mark className="size-5 shrink-0" />
    zriz
  </Link>
);
