import Link from "next/link";

import { cn } from "@/lib/cn";
import { order, pathOf, titleOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

const Side = ({ label, slug }: { label: "next" | "previous"; slug: Slug }) => (
  <Link
    className={cn(
      "-my-px flex min-w-11 flex-col gap-0.5 py-px",
      label === "next" ? "ml-auto items-end" : ""
    )}
    href={pathOf(slug)}
    rel={label === "next" ? "next" : "prev"}
  >
    <span className="text-small text-faint">{label}</span>
    <span className="font-medium">{titleOf(slug)}</span>
  </Link>
);

export const Pager = ({ slug }: { slug: Slug }) => {
  const at = order.indexOf(slug);
  const previous = order[at - 1];
  const next = order[at + 1];
  return (
    <nav aria-label="pages" className="flex pt-4">
      {previous !== undefined && <Side label="previous" slug={previous} />}
      {next !== undefined && <Side label="next" slug={next} />}
    </nav>
  );
};
