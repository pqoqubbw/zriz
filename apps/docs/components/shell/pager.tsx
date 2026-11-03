import { cva } from "class-variance-authority";
import Link from "next/link";

import { PAGE_ORDER, pagePath, titleOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

type PagerLinkProps = {
  label: "next" | "previous";
  slug: Slug;
};

type PagerProps = {
  slug: Slug;
};

const pagerLinkVariants = cva("group -my-3 flex flex-col gap-0.5 py-3", {
  variants: {
    label: {
      next: "col-start-2 items-end text-right",
      previous: "col-start-1 items-start",
    },
  },
});

const PagerLink = ({ label, slug }: PagerLinkProps) => (
  <Link
    className={pagerLinkVariants({ label })}
    href={pagePath(slug)}
    rel={label === "next" ? "next" : "prev"}
  >
    <span className="text-small text-faint transition-colors duration-150 ease-out group-hover:text-muted motion-reduce:transition-none">
      {label}
    </span>
    <span className="font-medium underline decoration-transparent decoration-1 transition-colors duration-150 ease-out group-hover:decoration-ink motion-reduce:transition-none">
      {titleOf(slug)}
    </span>
  </Link>
);

const Pager = ({ slug }: PagerProps) => {
  const at = PAGE_ORDER.indexOf(slug);
  const previous = PAGE_ORDER[at - 1];
  const next = PAGE_ORDER[at + 1];

  return (
    <nav aria-label="pages" className="grid grid-cols-2 gap-4 pt-4">
      {previous !== undefined && <PagerLink label="previous" slug={previous} />}
      {next !== undefined && <PagerLink label="next" slug={next} />}
    </nav>
  );
};

export { Pager };
