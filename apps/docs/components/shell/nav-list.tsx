"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/cn";
import { groups, pathOf } from "@/lib/nav";

const item = cva("text-nav hover:text-ink block w-full", {
  variants: {
    active: { false: "text-muted", true: "font-strong text-ink" },
    roomy: { false: "py-0.5", true: "py-1.5" },
  },
});

const title = cva("text-caption text-group", {
  variants: { roomy: { false: "py-0.5", true: "pt-1.5 pb-0.5" } },
});

export const NavList = ({ roomy }: { roomy: boolean }) => {
  const pathname = usePathname();
  const router = useRouter();
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    list.current
      ?.querySelector(`a[href="${pathname}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [pathname]);
  return (
    <div className={cn("flex flex-col", roomy ? "gap-5" : "gap-7")} ref={list}>
      {groups.map((group) => {
        const id = `nav-${roomy ? "menu" : "side"}-${group.title || "start"}`;
        return (
          <div className={cn(!roomy && "-my-0.5")} key={id}>
            {group.title !== "" && (
              <div className={title({ roomy })} id={id}>
                {group.title}
              </div>
            )}
            <ul aria-labelledby={group.title === "" ? undefined : id}>
              {group.items.map((entry) => {
                const href = pathOf(entry.slug);
                const active = pathname === href;
                return (
                  <li key={entry.slug}>
                    <Link
                      aria-current={active ? "page" : undefined}
                      className={item({ active, roomy })}
                      href={href}
                      onFocus={() => {
                        router.prefetch(href);
                      }}
                      onMouseEnter={() => {
                        router.prefetch(href);
                      }}
                      prefetch={false}
                    >
                      {entry.title}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
