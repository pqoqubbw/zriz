"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import { NAV_GROUPS, pagePath } from "@/lib/nav";
import type { Slug } from "@/lib/nav";

type NavGroupTitleProps = {
  children: string;
  id: string;
  roomy: boolean;
};

type NavItemProps = {
  active: boolean;
  children: string;
  roomy: boolean;
  slug: Slug;
};

type NavListProps = {
  roomy: boolean;
};

const navGroupTitleVariants = cva("text-caption text-group", {
  variants: { roomy: { false: "py-0.5", true: "pt-1.5 pb-0.5" } },
});

const navItemVariants = cva("block w-full text-nav hover:text-ink", {
  variants: {
    active: { false: "text-soft", true: "font-strong text-ink" },
    roomy: { false: "py-0.5", true: "py-1.5" },
  },
});

const NavGroupTitle = ({ children, id, roomy }: NavGroupTitleProps) => (
  <div className={navGroupTitleVariants({ roomy })} id={id}>
    {children}
  </div>
);

const NavItem = ({ active, children, roomy, slug }: NavItemProps) => {
  const router = useRouter();
  const href = pagePath(slug);

  return (
    <li>
      <Link
        aria-current={active ? "page" : undefined}
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

  useEffect(() => {
    list.current
      ?.querySelector(`a[href="${pathname}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);

  return (
    <div className={cn("flex flex-col", roomy ? "gap-5" : "gap-7")} ref={list}>
      {NAV_GROUPS.map((group) => {
        const id = `nav-${roomy ? "menu" : "side"}-${group.title || "start"}`;

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
                  active={pathname === pagePath(entry.slug)}
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
