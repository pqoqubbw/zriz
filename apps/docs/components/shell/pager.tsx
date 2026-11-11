import { cva } from "class-variance-authority";
import Link from "next/link";

import { neighboursOf, pagePath, titleOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

type PagerLabel = "back" | "next" | "previous";

type PagerLinkProps = {
  label: PagerLabel;
  slug: Slug;
};

type PagerProps = {
  slug: Slug;
};

const pagerLinkVariants = cva("group -my-3 flex flex-col gap-0.5 py-3", {
  variants: {
    label: {
      back: "col-start-1 items-start",
      next: "col-start-2 items-end text-right",
      previous: "col-start-1 items-start",
    },
  },
});

const PAGER_LABELS = {
  back: "Back",
  next: "Next",
  previous: "Previous",
} as const satisfies Record<PagerLabel, string>;

const PAGER_RELS = {
  back: "up",
  next: "next",
  previous: "prev",
} as const satisfies Record<PagerLabel, string>;

const PagerLink = ({ label, slug }: PagerLinkProps) => (
  <Link
    className={pagerLinkVariants({ label })}
    href={pagePath(slug)}
    rel={PAGER_RELS[label]}
  >
    <span className="font-mono text-cell-mono leading-4 text-faint transition-colors duration-150 ease-out group-hover:text-muted motion-reduce:transition-none">
      {PAGER_LABELS[label]}
    </span>
    <span className="font-medium underline decoration-transparent decoration-1 transition-colors duration-150 ease-out group-hover:decoration-ink motion-reduce:transition-none">
      {titleOf(slug)}
    </span>
  </Link>
);

const Pager = ({ slug }: PagerProps) => {
  const { back, next, previous } = neighboursOf(slug);

  return (
    <nav aria-label="Pages" className="grid grid-cols-2 gap-4 pt-4">
      {back !== undefined && <PagerLink label="back" slug={back} />}
      {previous !== undefined && <PagerLink label="previous" slug={previous} />}
      {next !== undefined && <PagerLink label="next" slug={next} />}
    </nav>
  );
};

export { Pager };
