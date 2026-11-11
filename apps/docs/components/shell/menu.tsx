"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { NavList } from "@/components/shell/nav-list";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type MenuProps = {
  foot: ReactNode;
  logo: ReactNode;
};

const Menu = ({ foot, logo }: MenuProps) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = dialog.current;

    const handleClick = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest("a")) {
        element?.close();
      }
    };

    element?.addEventListener("click", handleClick);

    return () => {
      element?.removeEventListener("click", handleClick);
    };
  }, []);

  return (
    <>
      <Button
        aria-label="Menu"
        className="-mr-3"
        onClick={() => {
          dialog.current?.showModal();
          dialog.current?.focus();
          setOpen(true);
        }}
        size="bar"
        variant="ghost"
      >
        <Icon className="size-5" name="menu" />
      </Button>
      <dialog
        aria-label="Menu"
        className="m-0 h-dvh max-h-none w-full max-w-none overflow-hidden bg-page text-ink outline-none backdrop:bg-transparent"
        onClose={() => {
          setOpen(false);
        }}
        ref={dialog}
        tabIndex={-1}
      >
        <div className="flex h-full flex-col">
          <div className="mx-auto flex h-11 page-column shrink-0 items-center justify-between">
            {logo}
            <Button
              aria-label="Close menu"
              className="-mr-3"
              onClick={() => {
                dialog.current?.close();
              }}
              size="bar"
              variant="ghost"
            >
              <Icon className="size-5" name="close" />
            </Button>
          </div>
          <nav
            aria-label="Docs"
            className="relative flex-1 overflow-y-auto overscroll-contain pt-3 pb-12"
          >
            <div className="mx-auto page-column">
              {open && <NavList roomy />}
              <div className="pt-8">{foot}</div>
            </div>
          </nav>
        </div>
      </dialog>
    </>
  );
};

export { Menu };
