import { cva } from "class-variance-authority";
import Link from "next/link";

import { order, pathOf, titleOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

const side = cva("-my-3 flex flex-col gap-0.5 py-3", {
  variants: {
    label: {
      next: "col-start-2 items-end text-right",
      previous: "col-start-1 items-start",
    },
  },
});

const Side = ({ label, slug }: { label: "next" | "previous"; slug: Slug }) => (
  <Link
    className={side({ label })}
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
    <nav aria-label="pages" className="grid grid-cols-2 gap-4 pt-4">
      {previous !== undefined && <Side label="previous" slug={previous} />}
      {next !== undefined && <Side label="next" slug={next} />}
    </nav>
  );
};
