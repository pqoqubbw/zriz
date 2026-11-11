"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import { isSlug, NAV_GROUPS, pagePath, parentOf } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

type NavGroupTitleProps = {
  children: string;
  id: string;
  roomy: boolean;
};

type NavItemProps = {
  active: boolean;
  children: string;
  current: "page" | "true" | undefined;
  roomy: boolean;
  slug: Slug;
};

type NavListProps = {
  roomy: boolean;
};

const navGroupTitleVariants = cva(
  "font-mono text-cell-mono leading-5 text-group",
  {
    variants: { roomy: { false: "py-0.5", true: "pt-1.5 pb-0.5" } },
  }
);

const navItemVariants = cva(
  "block w-full text-nav transition-weight duration-150 ease-out hover:text-ink motion-reduce:transition-none",
  {
    variants: {
      active: {
        false: "text-muted",
        true: "font-strong tracking-strong text-ink",
      },
      roomy: { false: "py-0.5", true: "py-1.5" },
    },
  }
);

const currentOf = (
  page: boolean,
  section: boolean
): "page" | "true" | undefined => {
  if (page) {
    return "page";
  }

  return section ? "true" : undefined;
};

const NavGroupTitle = ({ children, id, roomy }: NavGroupTitleProps) => (
  <div className={navGroupTitleVariants({ roomy })} id={id}>
    {children}
  </div>
);

const NavItem = ({ active, children, current, roomy, slug }: NavItemProps) => {
  const router = useRouter();
  const href = pagePath(slug);

  return (
    <li>
      <Link
        aria-current={current}
        className={navItemVariants({ active, roomy })}
        href={href}
        onFocus={() => {
          router.prefetch(href);
        }}
        onMouseEnter={() => {
          router.prefetch(href);
        }}
        prefetch={false}
      >
        {children}
      </Link>
    </li>
  );
};

const NavList = ({ roomy }: NavListProps) => {
  const pathname = usePathname();
  const list = useRef<HTMLDivElement>(null);
  const current = pathname.split("/").at(-1) ?? "";
  const parent = isSlug(current) ? parentOf(current) : null;
  const target = parent === null ? pathname : pagePath(parent);

  useEffect(() => {
    list.current
      ?.querySelector(`a[href="${target}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [target]);

  return (
    <div className={cn("flex flex-col", roomy ? "gap-5" : "gap-7")} ref={list}>
      {NAV_GROUPS.map((group) => {
        const id = `nav-${roomy ? "menu" : "side"}-${group.title.toLowerCase() || "start"}`;

        return (
          <div className={cn(!roomy && "-my-0.5")} key={id}>
            {group.title !== "" && (
              <NavGroupTitle id={id} roomy={roomy}>
                {group.title}
              </NavGroupTitle>
            )}
            <ul aria-labelledby={group.title === "" ? undefined : id}>
              {group.items.map((entry) => (
                <NavItem
                  active={
                    pathname === pagePath(entry.slug) || parent === entry.slug
                  }
                  current={currentOf(
                    pathname === pagePath(entry.slug),
                    parent === entry.slug
                  )}
                  key={entry.slug}
                  roomy={roomy}
                  slug={entry.slug}
                >
                  {entry.title}
                </NavItem>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

export { NavList };
