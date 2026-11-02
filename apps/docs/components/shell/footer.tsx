import Link from "next/link";

import { Mark } from "@/components/doc/icon";
import { links } from "@/lib/site";

const link = "-mx-2.5 -my-3 px-2.5 py-3 hover:text-ink";

export const Footer = () => (
  <footer className="text-caption flex flex-wrap items-center justify-between gap-4 pt-24 pb-16">
    <div className="text-soft flex items-center gap-5">
      <a className={link} href={links.github}>
        github
      </a>
      <a className={link} href={links.npm}>
        npm
      </a>
      <Link className={link} href="/docs/changelog" prefetch={false}>
        changelog
      </Link>
      <a className={link} href="/llms.txt">
        llms.txt
      </a>
    </div>
    <div className="text-faint flex items-center gap-2">
      <Mark className="text-ink size-4 shrink-0 opacity-45" />
      made by dmytro
    </div>
  </footer>
);
