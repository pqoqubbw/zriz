import Link from "next/link";
import type { ReactNode } from "react";

import { Mark } from "@/components/shell/logo";
import { pagePath } from "@/lib/nav";
import { SITE_LINKS } from "@/lib/site";

type FooterLinkProps = {
  children: ReactNode;
  href: string;
};

const FooterLink = ({ children, href }: FooterLinkProps) => (
  <Link
    className="-mx-2.5 -my-3 px-2.5 py-3 hover:text-ink"
    href={href}
    prefetch={false}
  >
    {children}
  </Link>
);

const Footer = () => (
  <footer className="flex flex-wrap items-center justify-between gap-4 pt-24 pb-16 text-caption">
    <div className="flex items-center gap-5 text-soft">
      <FooterLink href={SITE_LINKS.github}>GitHub</FooterLink>
      <FooterLink href={SITE_LINKS.npm}>npm</FooterLink>
      <FooterLink href={pagePath("changelog")}>Changelog</FooterLink>
      <FooterLink href="/llms.txt">llms.txt</FooterLink>
    </div>
    <div className="flex items-center gap-2 text-faint">
      <Mark className="size-4 shrink-0 text-ink opacity-45" />
      <span>
        made by <FooterLink href={SITE_LINKS.x}>dmytro</FooterLink>
      </span>
    </div>
  </footer>
);

export { Footer };
