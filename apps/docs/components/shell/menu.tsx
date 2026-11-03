"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { NavList } from "@/components/shell/nav-list";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

type MenuProps = {
  logo: ReactNode;
};

const Menu = ({ logo }: MenuProps) => {
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
          setOpen(true);
        }}
        size="bar"
        variant="ghost"
      >
        <Icon className="size-5" name="menu" />
      </Button>
      <dialog
        aria-label="menu"
        className="m-0 h-dvh max-h-none w-full max-w-none bg-page text-ink backdrop:bg-transparent"
        onClose={() => {
          setOpen(false);
        }}
        ref={dialog}
      >
        <div className="mx-auto flex h-full page-column flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between">
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
            aria-label="docs"
            className="-mx-1 flex-1 overflow-y-auto px-1 pt-3 pb-12"
          >
            {open && <NavList roomy />}
          </nav>
        </div>
      </dialog>
    </>
  );
};

export { Menu };
